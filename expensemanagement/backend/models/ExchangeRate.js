const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    baseCurrency: { type: String, required: true },
    targetCurrency: { type: String, required: true },
    rate: { type: Number, required: true },
    source: { type: String, default: 'manual' },
    effectiveDate: { type: Date, required: true },
    fetchedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed },
    override: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

exchangeRateSchema.index({ company: 1, baseCurrency: 1, targetCurrency: 1, effectiveDate: -1 });

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);
