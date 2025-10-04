const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String },
    type: {
      type: String,
      enum: [
        'expense_submitted',
        'approval_required',
        'approval_status_changed',
        'approval_escalated',
        'cfo_bypass',
        'custom',
      ],
      default: 'custom',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    readAt: { type: Date },
    channels: [{ type: String, enum: ['socket', 'email', 'push'] }],
    deliveredChannels: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ company: 1, role: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
