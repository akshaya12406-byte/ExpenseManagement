const express = require('express');

const authRoutes = require('./auth');
const receiptsRoutes = require('./receipts');
const expenseRoutes = require('./expenses');
const userRoutes = require('./users');
const companyRoutes = require('./company');
const analyticsRoutes = require('./analytics');
const currencyRoutes = require('./currency');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.use('/auth', authRoutes);
router.use('/expenses', receiptsRoutes);
router.use('/expenses', expenseRoutes);
router.use('/users', userRoutes);
router.use('/company', companyRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/currency', currencyRoutes);

module.exports = router;
