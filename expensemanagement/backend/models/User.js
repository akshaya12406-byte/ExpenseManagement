const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const profileSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String },
    title: { type: String },
    department: { type: String },
    timezone: { type: String },
    locale: { type: String, default: 'en-US' },
    avatarUrl: { type: String },
  },
  { _id: false },
);

const preferenceSchema = new mongoose.Schema(
  {
    receiveEmailNotifications: { type: Boolean, default: true },
    dailyDigest: { type: Boolean, default: false },
    defaultCurrency: { type: String, default: 'USD' },
    weeklyReportDay: { type: String, default: 'Friday' },
    dashboardWidgets: [{ type: String }],
    notificationChannels: {
      type: [String],
      default: ['socket', 'email'],
    },
    notificationTypes: {
      type: [String],
      default: ['approval_required', 'approval_status_changed', 'expense_submitted'],
    },
    muteUntil: { type: Date },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'manager', 'employee', 'finance', 'executive'],
      default: 'employee',
    },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvalPermissions: [{ type: String }],
    delegatedApprovers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    profile: profileSchema,
    preferences: preferenceSchema,
    lastLoginAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'inactive', 'invited', 'suspended'],
      default: 'active',
    },
  },
  { timestamps: true },
);

userSchema.index({ company: 1, role: 1 });
userSchema.index({ manager: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
