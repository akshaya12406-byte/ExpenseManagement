const express = require('express');

const authMiddleware = require('../middleware/auth');
const {
  fetchLiveRates,
  listLatestRates,
  listRates,
  overrideRate,
  convertAmount,
} = require('../services/currencyService');
const Company = require('../models/Company');

const router = express.Router();

const readGuard = authMiddleware(['admin', 'finance', 'executive', 'manager']);
const manageGuard = authMiddleware(['admin', 'finance']);

router.get('/latest', readGuard, async (req, res) => {
  try {
    const data = await listLatestRates({ companyId: req.user.company });
    res.json({ baseCurrency: req.baseCurrency, rates: data });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to load latest rates' });
  }
});

router.get('/history', readGuard, async (req, res) => {
  try {
    const { currency, startDate, endDate, limit } = req.query;
    const data = await listRates({
      companyId: req.user.company,
      targetCurrency: currency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });
    res.json({ history: data });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to load rate history' });
  }
});

router.post('/fetch', manageGuard, async (req, res) => {
  try {
    const company = await Company.findById(req.user.company);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    const { baseCurrency = company.currency, currencies } = req.body || {};
    const updates = await fetchLiveRates({
      companyId: req.user.company,
      baseCurrency,
      targetCurrencies: currencies,
    });
    res.status(201).json({ updates });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch live rates' });
  }
});

router.post('/override', manageGuard, async (req, res) => {
  try {
    const company = await Company.findById(req.user.company);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    const { targetCurrency, rate, effectiveDate, metadata } = req.body || {};
    if (!targetCurrency || !rate) {
      return res.status(400).json({ message: 'targetCurrency and rate are required' });
    }

    const entry = await overrideRate({
      companyId: req.user.company,
      baseCurrency: company.currency,
      targetCurrency,
      rate: Number(rate),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      metadata,
    });

    res.status(201).json({ override: entry });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to override rate' });
  }
});

router.get('/convert', readGuard, async (req, res) => {
  try {
    const { amount, currency, date } = req.query;
    if (amount == null || !currency) {
      return res.status(400).json({ message: 'amount and currency are required' });
    }

    const result = await convertAmount({
      companyId: req.user.company,
      amount,
      currency,
      date: date ? new Date(date) : undefined,
    });

    if (!result) {
      return res.status(404).json({ message: 'No exchange rate available for requested currency/date' });
    }

    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to convert amount' });
  }
});

module.exports = router;
