const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String },
    parallelGroupId: { type: String },
    requiredApprovals: { type: Number, default: 1 },
    approvalsReceived: { type: Number, default: 0 },
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    escalationAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'escalated'],
      default: 'pending',
    },
    decisionAt: { type: Date },
    decisionComment: { type: String },
    autoApproved: { type: Boolean, default: false },
  },
  { _id: false },
);

const conversionSchema = new mongoose.Schema(
  {
    baseCurrency: { type: String, required: true },
    baseAmount: { type: Number, required: true },
    convertedCurrency: { type: String, required: true },
    convertedAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    provider: { type: String },
    fetchedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const receiptSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    extension: { type: String, required: true },
    storagePath: { type: String, required: true },
    thumbnailPath: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const expenseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, trim: true },
    receiptUrl: { type: String },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid'],
      default: 'submitted',
    },
    approvalChain: [approvalStepSchema],
    currentApprovalLevel: { type: Number, default: 0 },
    approvalProgress: { type: Number, default: 0 },
    escalationNotifiedAt: { type: Date },
    workflowGraph: {
      nodes: [{
        id: { type: String },
        label: { type: String },
        status: { type: String },
        metadata: { type: mongoose.Schema.Types.Mixed },
      }],
      edges: [{
        from: { type: String },
        to: { type: String },
        type: { type: String },
      }],
    },
    submittedAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    merchant: { type: String },
    projectCode: { type: String },
    expenseDate: { type: Date, required: true },
    policyViolations: [{ type: String }],
    conversion: conversionSchema,
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    receipts: [receiptSchema],
  },
  { timestamps: true },
);

expenseSchema.index({ company: 1, employee: 1, status: 1 });
expenseSchema.index({ category: 1, expenseDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
