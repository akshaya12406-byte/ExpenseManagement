const express = require('express');

const authRoutes = require('./auth');
const receiptsRoutes = require('./receipts');
const expenseRoutes = require('./expenses');
const userRoutes = require('./users');
const companyRoutes = require('./company');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.use('/auth', authRoutes);
router.use('/expenses', receiptsRoutes);
router.use('/expenses', expenseRoutes);
router.use('/users', userRoutes);
router.use('/company', companyRoutes);

module.exports = router;
