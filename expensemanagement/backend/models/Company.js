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

const exchangeRateSchema = new mongoose.Schema(
  {
    code: { type: String, uppercase: true, required: true },
    rate: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const companyProfileSchema = new mongoose.Schema(
  {
    legalName: String,
    taxId: String,
    address: String,
    website: String,
    contactEmail: String,
    contactPhone: String,
    logoUrl: String,
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

const workflowSettingsSchema = new mongoose.Schema(
  {
    autoEscalateHours: { type: Number, default: 24 },
    requireManagerApproval: { type: Boolean, default: true },
    requireFinanceApproval: { type: Boolean, default: false },
    allowCfoBypass: { type: Boolean, default: true },
    notifyOnEscalation: { type: Boolean, default: true },
  },
  { _id: false },
);

const emailIntegrationSchema = new mongoose.Schema(
  {
    host: String,
    port: Number,
    username: String,
    fromAddress: String,
    secure: { type: Boolean, default: false },
  },
  { _id: false },
);

const integrationSettingsSchema = new mongoose.Schema(
  {
    email: emailIntegrationSchema,
    slackWebhookUrl: String,
    webhookEndpoint: String,
  },
  { _id: false },
);

const backupSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false },
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, required: true, default: 'USD' },
    profile: companyProfileSchema,
    approvalRules: [approvalLevelSchema],
    budgetThresholds: [budgetThresholdSchema],
    categories: [categorySchema],
    settings: companySettingsSchema,
    exchangeRates: [exchangeRateSchema],
    workflowSettings: workflowSettingsSchema,
    integrations: integrationSettingsSchema,
    backups: [backupSchema],
  },
  {
    timestamps: true,
  },
);

companySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Company', companySchema);
