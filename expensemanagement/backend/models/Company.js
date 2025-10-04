const mongoose = require('mongoose');

const approvalLevelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'manager', 'finance', 'executive'],
    },
    parallelRoles: [{ type: String }],
    requiredApprovals: { type: Number, default: 1 },
    autoApprovePercentage: { type: Number, default: 1 },
    bypassRole: { type: String },
    thresholdAmount: { type: Number, default: 0 },
    thresholdCurrency: { type: String, default: 'USD' },
    fallbackRoles: [{ type: String }],
    autoApproveBelow: { type: Number, default: 0 },
    notifyRoles: [{ type: String }],
    slaHours: { type: Number, default: 24 },
  },
  { _id: false },
);

const budgetThresholdSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    monthlyLimit: { type: Number, default: 0 },
    quarterlyLimit: { type: Number, default: 0 },
    yearlyLimit: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false },
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    active: { type: Boolean, default: true },
    defaultLimit: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false },
);

const companySettingsSchema = new mongoose.Schema(
  {
    reimbursementPolicy: String,
    autoApproveBelow: { type: Number, default: 0 },
    workingWeek: [{ type: String }],
    notificationEmails: [{ type: String }],
    expenseSubmissionWindowDays: { type: Number, default: 30 },
    enableMultiCurrency: { type: Boolean, default: true },
  },
  { _id: false },
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, required: true, default: 'USD' },
    approvalRules: [approvalLevelSchema],
    budgetThresholds: [budgetThresholdSchema],
    categories: [categorySchema],
    settings: companySettingsSchema,
  },
  {
    timestamps: true,
  },
);

companySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Company', companySchema);
