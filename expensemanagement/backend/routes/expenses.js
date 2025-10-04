const express = require('express');

const authMiddleware = require('../middleware/auth');
const Expense = require('../models/Expense');
const ApprovalLog = require('../models/ApprovalLog');
const {
  buildApprovalWorkflow,
  advanceApproval,
  triggerCfoBypass,
} = require('../services/approvalEngine');
const {
  dispatchNotifications,
} = require('../services/notificationCenter');

const router = express.Router();

router.get('/', authMiddleware(), async (req, res) => {
  try {
    const { company, sub: userId, role } = req.user;

    const match = { company };
    if (role !== 'admin' && role !== 'manager') {
      match.employee = userId;
    }

    const expenses = await Expense.find(match)
      .sort({ expenseDate: -1, createdAt: -1 })
      .populate('employee', 'profile.firstName profile.lastName email')
      .lean();

    res.json({
      expenses: expenses.map((expense) => ({
        id: expense._id,
        employeeName:
          expense.employee?.profile?.firstName || expense.employee?.email || 'Team member',
        employeeEmail: expense.employee?.email,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        status: expense.status,
        description: expense.description,
        expenseDate: expense.expenseDate,
        createdAt: expense.createdAt,
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to load expenses' });
  }
});

router.post('/', authMiddleware(), async (req, res) => {
  try {
    const { company, sub: userId } = req.user;
    const {
      amount,
      currency,
      category,
      description,
      expenseDate,
      convertedAmount,
      conversionRate,
      vendor,
      receiptFile,
      ocrText,
      projectCode,
      customFields,
    } = req.body || {};

    if (!amount || !currency || !category || !expenseDate) {
      return res.status(400).json({
        message: 'Amount, currency, category, and expenseDate are required.',
      });
    }

    const expense = await Expense.create({
      company,
      employee: userId,
      amount,
      currency,
      category,
      description,
      expenseDate,
      merchant: vendor,
      projectCode,
      conversion: convertedAmount
        ? {
            baseCurrency: currency,
            baseAmount: amount,
            convertedCurrency: currency,
            convertedAmount,
            rate: conversionRate || 1,
          }
        : undefined,
      customFields,
      receipts: receiptFile
        ? [
            {
              _id: receiptFile.id || receiptFile._id || Date.now().toString(),
              originalName: receiptFile.originalName || receiptFile.name || 'receipt',
              mimeType: receiptFile.mimeType || receiptFile.type || 'application/octet-stream',
              size: receiptFile.size || 0,
              extension: receiptFile.extension || receiptFile.originalName?.split('.').pop() || 'jpg',
              storagePath: receiptFile.storagePath || receiptFile.url || '',
              thumbnailPath: receiptFile.thumbnailPath,
              uploadedBy: userId,
            },
          ]
        : [],
    });

    res.status(201).json({
      expenseId: expense._id,
      status: expense.status,
      submittedAt: expense.submittedAt,
      ocrText,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Failed to submit expense' });
  }
});

router.post('/:expenseId/workflow', authMiddleware(), async (req, res) => {
  try {
    const expense = await buildApprovalWorkflow(req.params.expenseId);
    res.json({
      expenseId: expense._id,
      workflowGraph: expense.workflowGraph,
      approvalChain: expense.approvalChain,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:expenseId/decision', authMiddleware(), async (req, res) => {
  const { decision, comment } = req.body;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ message: 'Decision must be approve or reject.' });
  }

  try {
    const expense = await advanceApproval({
      expenseId: req.params.expenseId,
      approverId: req.user.sub,
      decision,
      comment,
    });

    await dispatchNotifications({
      companyId: expense.company,
      recipients: [expense.employee],
      type: 'approval_status_changed',
      title: `Expense ${decision === 'approve' ? 'approved' : 'rejected'}`,
      message: `Your expense ${expense._id} was ${decision} by ${req.user.email || 'an approver'}.`,
      payload: {
        expenseId: expense._id,
        decision,
      },
      channels: ['socket', 'email'],
      createdBy: req.user.sub,
    });

    res.json({
      expenseId: expense._id,
      status: expense.status,
      approvalChain: expense.approvalChain,
      approvalProgress: expense.approvalProgress,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:expenseId/bypass', authMiddleware(['executive', 'finance']), async (req, res) => {
  try {
    const expense = await triggerCfoBypass({ expenseId: req.params.expenseId, cfoUserId: req.user.sub });

    await dispatchNotifications({
      companyId: expense.company,
      recipients: [expense.employee],
      type: 'cfo_bypass',
      title: 'Expense approved by CFO',
      message: `Your expense ${expense._id} was approved via CFO bypass.`,
      payload: { expenseId: expense._id },
      channels: ['socket', 'email'],
      createdBy: req.user.sub,
    });

    res.json({
      expenseId: expense._id,
      status: expense.status,
      approvalChain: expense.approvalChain,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/:expenseId/history', authMiddleware(), async (req, res) => {
  try {
    const logs = await ApprovalLog.find({ expense: req.params.expenseId })
      .sort({ performedAt: -1 })
      .populate('actor', 'email role');

    res.json({
      history: logs.map((log) => ({
        id: log._id,
        actor: log.actor,
        action: log.action,
        comment: log.comment,
        metadata: log.metadata,
        performedAt: log.performedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:expenseId/workflow', authMiddleware(), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    res.json({
      workflowGraph: expense.workflowGraph,
      approvalProgress: expense.approvalProgress,
      approvalChain: expense.approvalChain,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
