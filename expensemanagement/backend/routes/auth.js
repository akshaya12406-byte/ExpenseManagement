const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');

const Company = require('../models/Company');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const ACCESS_TOKEN_TTL = Number(process.env.JWT_ACCESS_TTL_SECONDS || 900); // 15 minutes
const REFRESH_TOKEN_TTL = Number(process.env.JWT_REFRESH_TTL_SECONDS || 60 * 60 * 24 * 7); // 7 days
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const generateTokens = (user) => {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    company: user.company?.toString?.() || null,
    email: user.email,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL * 1000,
  };
};

const sanitizeString = (value) => sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Validation failed',
      errors: errors.array().map((error) => ({ field: error.param, message: error.msg })),
    });
  }
  return next();
};

router.post(
  '/register',
  [
    body('companyName').trim().isLength({ min: 2 }).withMessage('Company name is required'),
    body('currency').trim().isLength({ min: 1 }).withMessage('Currency is required'),
    body('adminEmail').isEmail().normalizeEmail().withMessage('Valid admin email is required'),
    body('adminPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('adminName').optional().trim().escape(),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { companyName, currency, adminEmail, adminPassword, adminName } = req.body;

    try {
      const existingCompany = await Company.findOne({ name: companyName.trim() });
      if (existingCompany) {
        return res.status(409).json({ message: 'A company with this name already exists.' });
      }

      const company = await Company.create({
        name: sanitizeString(companyName),
        currency: currency.toUpperCase(),
        approvalRules: [
          {
            level: 1,
            role: 'manager',
            thresholdAmount: 1000,
            thresholdCurrency: currency.toUpperCase(),
            fallbackRoles: ['admin'],
          },
          {
            level: 2,
            role: 'admin',
            thresholdAmount: 10000,
            thresholdCurrency: currency.toUpperCase(),
          },
        ],
        settings: {
          reimbursementPolicy: 'Refer to company policy for reimbursements.',
          autoApproveBelow: 0,
          workingWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          notificationEmails: [adminEmail],
        },
      });

      const user = await User.create({
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        company: company._id,
        profile: {
          firstName: adminName ? sanitizeString(adminName) : undefined,
        },
        approvalPermissions: ['approve_expenses', 'manage_users'],
      });

      const tokens = generateTokens(user);

      res.status(201).json({
        message: 'Company and admin account created successfully.',
        company: {
          id: company._id,
          name: company.name,
          currency: company.currency,
        },
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        tokens,
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Unable to complete registration at this time.' });
    }
  },
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email }).populate('company');
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const passwordsMatch = await user.comparePassword(password);
      if (!passwordsMatch) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      user.lastLoginAt = new Date();
      await user.save({ validateModifiedOnly: true });

      const tokens = generateTokens(user);

      res.json({
        message: 'Login successful.',
        tokens,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          company: user.company ? { id: user.company._id, name: user.company.name, currency: user.company.currency } : null,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Unable to log in at this time.' });
    }
  },
);

router.post(
  '/refresh',
  [body('refreshToken').isString().withMessage('Refresh token is required')],
  handleValidationErrors,
  async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      if (decoded.type !== 'refresh') {
        return res.status(400).json({ message: 'Invalid refresh token.' });
      }

      const user = await User.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({ message: 'User no longer exists.' });
      }

      const tokens = generateTokens(user);

      res.json({ message: 'Token refreshed.', tokens });
    } catch (error) {
      console.error('Refresh token error:', error);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Refresh token expired. Please log in again.' });
      }
      res.status(401).json({ message: 'Invalid refresh token.' });
    }
  },
);

router.get('/me', authMiddleware(), async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('-password').populate('company');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company: user.company
          ? {
              id: user.company._id,
              name: user.company.name,
              currency: user.company.currency,
            }
          : null,
        profile: user.profile,
        preferences: user.preferences,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Fetch current user error:', error);
    res.status(500).json({ message: 'Unable to load user details right now.' });
  }
});

module.exports = router;
