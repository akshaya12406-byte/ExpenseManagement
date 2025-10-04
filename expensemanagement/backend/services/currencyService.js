const ExchangeRate = require('../models/ExchangeRate');
const Company = require('../models/Company');
const { dispatchNotifications } = require('./notificationCenter');

const fetchFn = global.fetch
  ? global.fetch.bind(global)
  : async (...args) => {
      const { default: nodeFetch } = await import('node-fetch');
      return nodeFetch(...args);
    };

const ALERT_THRESHOLD = Number(process.env.CURRENCY_ALERT_THRESHOLD || 0.05);
const DEFAULT_PROVIDER = process.env.CURRENCY_PROVIDER_URL || 'https://api.exchangerate.host';

const truncateDate = (value) => {
  const date = new Date(value || Date.now());
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const listLatestRates = async ({ companyId }) => {
  const latest = await ExchangeRate.aggregate([
    { $match: { company: companyId } },
    {
      $sort: { effectiveDate: -1, createdAt: -1 },
    },
    {
      $group: {
        _id: '$targetCurrency',
        rate: { $first: '$rate' },
        baseCurrency: { $first: '$baseCurrency' },
        effectiveDate: { $first: '$effectiveDate' },
        source: { $first: '$source' },
      },
    },
  ]);

  return latest.reduce((acc, entry) => {
    acc[entry._id] = {
      rate: entry.rate,
      baseCurrency: entry.baseCurrency,
      effectiveDate: entry.effectiveDate,
      source: entry.source,
    };
    return acc;
  }, {});
};

const sendFluctuationAlert = async ({ companyId, targetCurrency, baseCurrency, rate, previousRate, change }) => {
  try {
    await dispatchNotifications({
      companyId,
      role: 'finance',
      type: 'custom',
      title: `Exchange rate update: ${targetCurrency}`,
      message: `The ${baseCurrency} → ${targetCurrency} rate changed by ${(change * 100).toFixed(2)}%. New rate: ${rate.toFixed(4)}`,
      payload: {
        baseCurrency,
        targetCurrency,
        rate,
        previousRate,
        change,
      },
      channels: ['socket', 'email'],
    });
  } catch (error) {
    console.error('Failed to dispatch currency alert', error.message);
  }
};

const storeRate = async ({ companyId, baseCurrency, targetCurrency, rate, source, effectiveDate, override = false, metadata }) => {
  const entry = await ExchangeRate.create({
    company: companyId,
    baseCurrency,
    targetCurrency,
    rate,
    source,
    effectiveDate: truncateDate(effectiveDate),
    override,
    metadata,
  });

  return entry;
};

const fetchLiveRates = async ({ companyId, baseCurrency, targetCurrencies }) => {
  const company = await Company.findById(companyId);
  if (!company) {
    const error = new Error('Company not found');
    error.status = 404;
    throw error;
  }

  const targets = ensureArray(targetCurrencies).filter((code) => code && code !== baseCurrency);
  const symbols = targets.length ? `&symbols=${targets.join(',')}` : '';
  const url = `${DEFAULT_PROVIDER}/latest?base=${encodeURIComponent(baseCurrency)}${symbols}`;

  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error('Failed to fetch exchange rates from provider');
  }

  const payload = await response.json();
  const rates = payload.rates || {};
  const effectiveDate = truncateDate(payload.date ? new Date(payload.date) : Date.now());

  const updates = [];
  const latestMap = await listLatestRates({ companyId });

  for (const [currency, rate] of Object.entries(rates)) {
    if (!rate || Number.isNaN(Number(rate))) continue;
    const numericRate = Number(rate);
    const latest = latestMap[currency];
    const entry = await storeRate({
      companyId,
      baseCurrency,
      targetCurrency: currency,
      rate: numericRate,
      source: 'live',
      effectiveDate,
    });

    updates.push(entry);

    if (latest?.rate) {
      const change = (numericRate - latest.rate) / latest.rate;
      if (Math.abs(change) >= ALERT_THRESHOLD) {
        await sendFluctuationAlert({
          companyId,
          targetCurrency: currency,
          baseCurrency,
          rate: numericRate,
          previousRate: latest.rate,
          change,
        });
      }
    }
  }

  if (updates.length) {
    company.exchangeRates = updates.map((entry) => ({
      code: entry.targetCurrency,
      rate: entry.rate,
      updatedAt: entry.effectiveDate,
    }));
    await company.save();
  }

  return updates;
};

const getRateForDate = async ({ companyId, baseCurrency, targetCurrency, effectiveDate }) => {
  const date = truncateDate(effectiveDate);

  const override = await ExchangeRate.findOne({
    company: companyId,
    baseCurrency,
    targetCurrency,
    override: true,
    effectiveDate: { $lte: date },
  })
    .sort({ effectiveDate: -1 })
    .lean();

  if (override) return override;

  const historical = await ExchangeRate.findOne({
    company: companyId,
    baseCurrency,
    targetCurrency,
    effectiveDate: { $lte: date },
  })
    .sort({ effectiveDate: -1 })
    .lean();

  return historical;
};

const convertAmount = async ({ companyId, amount, currency, date }) => {
  const company = await Company.findById(companyId).lean();
  if (!company) {
    const error = new Error('Company not found');
    error.status = 404;
    throw error;
  }

  const baseCurrency = company.currency;
  const numericAmount = Number(amount) || 0;

  if (!currency || currency === baseCurrency) {
    return {
      baseCurrency,
      targetCurrency: currency,
      rate: 1,
      convertedAmount: numericAmount,
      convertedCurrency: baseCurrency,
    };
  }

  const rateEntry = await getRateForDate({
    companyId,
    baseCurrency,
    targetCurrency: currency,
    effectiveDate: date || new Date(),
  });

  if (!rateEntry) {
    return null;
  }

  const convertedAmount = numericAmount / rateEntry.rate;
  return {
    baseCurrency,
    targetCurrency: currency,
    rate: rateEntry.rate,
    convertedAmount,
    convertedCurrency: baseCurrency,
    effectiveDate: rateEntry.effectiveDate,
    source: rateEntry.source,
    override: rateEntry.override,
  };
};

const overrideRate = async ({ companyId, baseCurrency, targetCurrency, rate, effectiveDate, metadata }) => {
  const entry = await storeRate({
    companyId,
    baseCurrency,
    targetCurrency,
    rate,
    effectiveDate,
    override: true,
    source: 'override',
    metadata,
  });

  return entry;
};

const listRates = async ({ companyId, targetCurrency, startDate, endDate, limit = 100 }) => {
  const match = { company: companyId };
  if (targetCurrency) match.targetCurrency = targetCurrency;
  if (startDate || endDate) {
    match.effectiveDate = {};
    if (startDate) match.effectiveDate.$gte = truncateDate(startDate);
    if (endDate) match.effectiveDate.$lte = truncateDate(endDate);
  }

  const rates = await ExchangeRate.find(match)
    .sort({ effectiveDate: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .lean();

  return rates;
};

module.exports = {
  fetchLiveRates,
  convertAmount,
  overrideRate,
  listRates,
  listLatestRates,
  getRateForDate,
};
