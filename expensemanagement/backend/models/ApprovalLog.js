const mongoose = require('mongoose');

const approvalLogSchema = new mongoose.Schema(
  {
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'escalated', 'commented', 'forwarded'],
      required: true,
    },
    level: { type: Number },
    comment: { type: String },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    previousStatus: { type: String },
    newStatus: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    performedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

approvalLogSchema.index({ expense: 1, performedAt: -1 });
approvalLogSchema.index({ company: 1, action: 1 });

module.exports = mongoose.model('ApprovalLog', approvalLogSchema);
