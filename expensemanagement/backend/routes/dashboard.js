const express = require('express');
const mongoose = require('mongoose');

const authMiddleware = require('../middleware/auth');
const Expense = require('../models/Expense');
const Company = require('../models/Company');

const router = express.Router();

const ensureNumber = (value) => {
  if (!value || Number.isNaN(Number(value))) {
    return 0;
  }
  return Number.parseFloat(Number(value).toFixed(2));
};

const formatLabel = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

router.get('/summary', authMiddleware(), async (req, res) => {
  try {
    const companyId = req.user.company;
    const objectId = new mongoose.Types.ObjectId(companyId);

    const company = await Company.findById(companyId).lean();
    const companyCurrency = company?.currency || 'USD';

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const trendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const [monthTotals] = await Expense.aggregate([
      {
        $match: {
          company: objectId,
          expenseDate: { $gte: monthStart, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: '$amount' },
          convertedAmount: {
            $sum: {
              $cond: [
                { $ifNull: ['$conversion.convertedAmount', false] },
                '$conversion.convertedAmount',
                '$amount',
              ],
            },
          },
        },
      },
    ]);

    const pendingApprovals = await Expense.countDocuments({
      company: objectId,
      status: { $in: ['submitted', 'under_review'] },
    });

    const recentExpensesRaw = await Expense.find({ company: objectId })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('amount currency status createdAt conversion employee')
      .populate('employee', 'profile.firstName profile.lastName email')
      .lean();

    const recentExpenses = recentExpensesRaw.map((expense) => ({
      id: expense._id,
      employeeName:
        expense.employee?.profile?.firstName || expense.employee?.email || 'Team member',
      amount: ensureNumber(
        expense.conversion?.convertedAmount && expense.conversion?.convertedCurrency === companyCurrency
          ? expense.conversion.convertedAmount
          : expense.amount,
      ),
      currency:
        expense.conversion?.convertedCurrency === companyCurrency && expense.conversion?.convertedCurrency
          ? expense.conversion.convertedCurrency
          : expense.currency || companyCurrency,
      status: expense.status,
      createdAt: expense.createdAt,
    }));

    const trendAggregate = await Expense.aggregate([
      {
        $match: {
          company: objectId,
          expenseDate: { $gte: trendStart, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' },
          },
          amount: {
            $sum: {
              $cond: [
                { $ifNull: ['$conversion.convertedAmount', false] },
                '$conversion.convertedAmount',
                '$amount',
              ],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const trendMap = trendAggregate.reduce((acc, entry) => {
      acc[entry._id] = ensureNumber(entry.amount);
      return acc;
      // eslint-disable-next-line no-return-assign
    }, {});

    const trend = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(trendStart);
      date.setDate(trendStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        label: formatLabel(date),
        amount: trendMap[key] || 0,
      };
    });

    const monthTotalAmount = ensureNumber(monthTotals?.convertedAmount || monthTotals?.amount || 0);
    const totalBudget = ensureNumber(
      (company?.budgetThresholds || []).reduce((acc, entry) => acc + (entry.monthlyLimit || 0), 0),
    );
    const budgetUtilization = totalBudget > 0 ? Math.min((monthTotalAmount / totalBudget) * 100, 999) : 0;

    res.json({
      monthTotal: {
        amount: ensureNumber(monthTotals?.amount || 0),
        currency: companyCurrency,
        convertedAmount: monthTotalAmount,
        convertedCurrency: companyCurrency,
        rate: 1,
      },
      pendingApprovals,
      budgetUtilization: ensureNumber(budgetUtilization),
      recentExpenses,
      trend,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to load dashboard summary' });
  }
});

module.exports = router;
