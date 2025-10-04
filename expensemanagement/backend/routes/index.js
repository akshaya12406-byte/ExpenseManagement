const express = require('express');

const authRoutes = require('./auth');
const receiptsRoutes = require('./receipts');
const expenseRoutes = require('./expenses');
const userRoutes = require('./users');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.use('/auth', authRoutes);
router.use('/expenses', receiptsRoutes);
router.use('/expenses', expenseRoutes);
router.use('/users', userRoutes);

module.exports = router;
