const express = require('express');
const { Parser } = require('json2csv');

const authMiddleware = require('../middleware/auth');
const Expense = require('../models/Expense');
const Company = require('../models/Company');

const router = express.Router();

const analyticsGuard = authMiddleware(['admin', 'manager', 'finance', 'executive']);

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const parseDate = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
};

const buildMatchStage = (companyId, startDate, endDate) => {
  const match = { company: companyId };
  if (startDate || endDate) {
    match.expenseDate = {};
    if (startDate) match.expenseDate.$gte = startDate;
    if (endDate) match.expenseDate.$lte = endDate;
  }
  return match;
};

router.get('/overview', analyticsGuard, async (req, res) => {
  try {
    const companyId = req.user.company;
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * MS_IN_DAY);
    const startDate = parseDate(req.query.startDate, defaultStart);
    const endDate = parseDate(req.query.endDate, today);

    const matchStage = buildMatchStage(companyId, startDate, endDate);

    const [trend, departmentSpending, categorySpending, approvalDurations, pendingSteps] = await Promise.all([
      Expense.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' },
            },
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id': 1 } },
      ]),
      Expense.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'users',
            localField: 'employee',
            foreignField: '_id',
            as: 'employee',
          },
        },
        { $unwind: '$employee' },
        {
          $group: {
            _id: {
              department: {
                $ifNull: ['$employee.profile.department', 'Unassigned'],
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      Expense.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      Expense.aggregate([
        { $match: matchStage },
        { $unwind: '$approvalChain' },
        { $match: { 'approvalChain.decisionAt': { $ne: null } } },
        {
          $project: {
            level: '$approvalChain.level',
            status: '$approvalChain.status',
            durationHours: {
              $divide: [
                { $subtract: ['$approvalChain.decisionAt', '$submittedAt'] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: '$level',
            averageHours: { $avg: '$durationHours' },
            maxHours: { $max: '$durationHours' },
            decisions: { $sum: 1 },
          },
        },
        { $sort: { averageHours: -1 } },
      ]),
      Expense.aggregate([
        { $match: matchStage },
        { $unwind: '$approvalChain' },
        { $match: { 'approvalChain.status': 'pending' } },
        {
          $group: {
            _id: '$approvalChain.level',
            pendingCount: { $sum: 1 },
          },
        },
        { $sort: { pendingCount: -1 } },
      ]),
    ]);

    const company = await Company.findById(companyId).lean();
    const categoryTotalsMap = categorySpending.reduce((acc, entry) => {
      acc[entry._id] = entry.totalAmount;
      return acc;
    }, {});

    const budgetVsActual = (company?.budgetThresholds || []).map((threshold) => {
      const actual = categoryTotalsMap[threshold.category] || 0;
      return {
        category: threshold.category,
        monthlyLimit: threshold.monthlyLimit,
        quarterlyLimit: threshold.quarterlyLimit,
        yearlyLimit: threshold.yearlyLimit,
        currency: threshold.currency || company.currency || 'USD',
        actualSpent: actual,
        utilization: threshold.monthlyLimit ? (actual / threshold.monthlyLimit) * 100 : null,
      };
    });

    const totalSpend = categorySpending.reduce((acc, item) => acc + item.totalAmount, 0);
    const totalCount = categorySpending.reduce((acc, item) => acc + item.count, 0);

    res.json({
      summary: {
        totalSpend,
        totalCount,
        averageExpense: totalCount ? totalSpend / totalCount : 0,
        startDate,
        endDate,
      },
      expenseTrend: trend.map((entry) => ({
        date: entry._id,
        amount: entry.amount,
        count: entry.count,
      })),
      departmentSpending: departmentSpending.map((entry) => ({
        department: entry._id.department || 'Unassigned',
        amount: entry.totalAmount,
        count: entry.count,
      })),
      topCategories: categorySpending.map((entry) => ({
        category: entry._id,
        amount: entry.totalAmount,
        count: entry.count,
      })),
      approvalBottlenecks: {
        pendingSteps: pendingSteps.map((entry) => ({
          level: entry._id,
          pendingCount: entry.pendingCount,
        })),
        decisionDurations: approvalDurations.map((entry) => ({
          level: entry._id,
          averageHours: entry.averageHours,
          maxHours: entry.maxHours,
          decisions: entry.decisions,
        })),
      },
      budgetVsActual,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to load analytics overview' });
  }
});

router.get('/drilldown', analyticsGuard, async (req, res) => {
  try {
    const { type, key } = req.query;
    if (!type || !key) {
      return res.status(400).json({ message: 'type and key are required' });
    }

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * MS_IN_DAY);
    const startDate = parseDate(req.query.startDate, defaultStart);
    const endDate = parseDate(req.query.endDate, today);

    const match = buildMatchStage(req.user.company, startDate, endDate);
    const query = match;

    const populateOptions = [
      { path: 'employee', select: 'email profile.firstName profile.lastName profile.department' },
    ];

    let expensesQuery = Expense.find(query).populate(populateOptions);

    if (type === 'department') {
      expensesQuery = expensesQuery.where('employee.profile.department').equals(key);
    } else if (type === 'category') {
      expensesQuery = expensesQuery.where('category').equals(key);
    } else if (type === 'status') {
      expensesQuery = expensesQuery.where('status').equals(key);
    }

    const expenses = await expensesQuery.sort({ expenseDate: -1 }).limit(200).lean();

    res.json({
      expenses: expenses.map((expense) => ({
        id: expense._id,
        employee: expense.employee?.profile?.firstName
          ? `${expense.employee.profile.firstName} ${expense.employee.profile.lastName || ''}`.trim()
          : expense.employee?.email,
        department: expense.employee?.profile?.department || 'Unassigned',
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        status: expense.status,
        expenseDate: expense.expenseDate,
        submittedAt: expense.submittedAt,
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to load drilldown data' });
  }
});

router.get('/export', analyticsGuard, async (req, res) => {
  try {
    const { format = 'csv', report = 'trend' } = req.query;
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * MS_IN_DAY);
    const startDate = parseDate(req.query.startDate, defaultStart);
    const endDate = parseDate(req.query.endDate, today);

    const matchStage = buildMatchStage(req.user.company, startDate, endDate);

    const trend = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' },
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    const departments = await Expense.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: {
            department: {
              $ifNull: ['$employee.profile.department', 'Unassigned'],
            },
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const categories = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    let dataset;
    let fileName;

    if (report === 'departments') {
      dataset = departments.map((dep) => ({
        department: dep._id.department || 'Unassigned',
        amount: dep.totalAmount,
        count: dep.count,
      }));
      fileName = 'department-spending';
    } else if (report === 'categories') {
      dataset = categories.map((cat) => ({
        category: cat._id,
        amount: cat.totalAmount,
        count: cat.count,
      }));
      fileName = 'category-spending';
    } else {
      dataset = trend.map((entry) => ({
        date: entry._id,
        amount: entry.amount,
        count: entry.count,
      }));
      fileName = 'spending-trend';
    }

    if (format === 'json') {
      res.header('Content-Type', 'application/json');
      res.attachment(`${fileName}.json`);
      return res.send(JSON.stringify(dataset, null, 2));
    }

    const parser = new Parser();
    const csv = parser.parse(dataset);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${fileName}.csv`);
    return res.send(csv);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to export analytics data' });
  }
});

module.exports = router;
