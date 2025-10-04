const express = require('express');
const crypto = require('crypto');
const { Parser } = require('json2csv');

const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const Company = require('../models/Company');
const ApprovalLog = require('../models/ApprovalLog');
const { sendApprovalNotification } = require('../services/notificationService');

const router = express.Router();

const adminGuard = authMiddleware(['admin']);

const populateFields = 'company manager profile preferences';

router.get('/', adminGuard, async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const query = { company: req.user.company };
    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .populate('manager', 'email profile.firstName profile.lastName')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', adminGuard, async (req, res) => {
  try {
    const company = await Company.findById(req.user.company);
    if (!company) {
      return res.status(400).json({ message: 'Company not found' });
    }

    const { email, role = 'employee', password, profile, manager, status = 'active' } = req.body;
    const newUser = await User.create({
      email,
      password: password || crypto.randomBytes(6).toString('base64url'),
      role,
      company: company._id,
      manager,
      profile,
      status,
    });

    res.status(201).json({ user: await User.findById(newUser._id).populate(populateFields) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

router.put('/:userId', adminGuard, async (req, res) => {
  try {
    const allowedFields = ['role', 'status', 'manager', 'profile', 'preferences'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    });

    const updated = await User.findOneAndUpdate(
      { _id: req.params.userId, company: req.user.company },
      updates,
      { new: true },
    ).populate(populateFields);

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:userId/status', adminGuard, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'inactive', 'suspended'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, company: req.user.company },
      { status },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/bulk', adminGuard, async (req, res) => {
  try {
    const { userIds = [], action, payload = {} } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users specified' });
    }

    const filter = { _id: { $in: userIds }, company: req.user.company };
    let result;

    switch (action) {
      case 'activate':
        result = await User.updateMany(filter, { status: 'active' });
        break;
      case 'deactivate':
        result = await User.updateMany(filter, { status: 'inactive' });
        break;
      case 'assign-manager':
        result = await User.updateMany(filter, { manager: payload.managerId });
        break;
      case 'change-role':
        if (!payload.role) {
          return res.status(400).json({ message: 'Role required for change-role action' });
        }
        result = await User.updateMany(filter, { role: payload.role });
        break;
      default:
        return res.status(400).json({ message: 'Unknown bulk action' });
    }

    res.json({ updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:userId/reset-password', adminGuard, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, company: req.user.company });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const temporaryPassword = crypto.randomBytes(8).toString('base64url');
    user.password = temporaryPassword;
    await user.save();

    await sendApprovalNotification({
      to: user.email,
      subject: 'Your password has been reset',
      text: `Your new temporary password is ${temporaryPassword}. Please log in and change it immediately.`,
    });

    res.json({ message: 'Temporary password generated and emailed to user.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:userId/activity', adminGuard, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, company: req.user.company });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const logs = await ApprovalLog.find({ actor: user._id })
      .sort({ performedAt: -1 })
      .limit(50)
      .lean();

    res.json({
      activity: logs.map((log) => ({
        id: log._id,
        expense: log.expense,
        action: log.action,
        comment: log.comment,
        performedAt: log.performedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/export/csv', adminGuard, async (req, res) => {
  try {
    const users = await User.find({ company: req.user.company })
      .populate('manager', 'email profile.firstName profile.lastName')
      .lean();

    const parser = new Parser({
      fields: [
        { label: 'Email', value: 'email' },
        { label: 'Role', value: 'role' },
        { label: 'Status', value: 'status' },
        { label: 'Manager', value: (row) => row.manager?.email || '' },
        { label: 'First Name', value: 'profile.firstName' },
        { label: 'Last Name', value: 'profile.lastName' },
        { label: 'Last Login', value: (row) => row.lastLoginAt || '' },
        { label: 'Created At', value: 'createdAt' },
      ],
    });

    const csv = parser.parse(users);
    res.header('Content-Type', 'text/csv');
    res.attachment('users.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
