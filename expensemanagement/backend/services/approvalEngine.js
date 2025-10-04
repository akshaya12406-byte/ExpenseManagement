const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Expense = require('../models/Expense');
const Company = require('../models/Company');
const ApprovalLog = require('../models/ApprovalLog');
const { sendApprovalNotification } = require('./notificationService');

const toCurrency = (value) => Number(value || 0);

const buildParallelGroup = (baseLevel, config, currency, amount) => {
  const groupId = uuidv4();
  const approvers = (config.parallelRoles || [config.role]).map((role) => ({ role, requiredApprovals: 1 }));

  const thresholdPassed = toCurrency(amount) >= toCurrency(config.thresholdAmount);
  const autoApprove = toCurrency(amount) <= toCurrency(config.autoApproveBelow || 0);

  return approvers.map((approverConfig, index) => ({
    level: baseLevel,
    parallelGroupId: groupId,
    role: approverConfig.role,
    approver: null,
    approvers: [],
    requiredApprovals: approverConfig.requiredApprovals || config.requiredApprovals || 1,
    approvalsReceived: autoApprove ? approverConfig.requiredApprovals || 1 : 0,
    status: autoApprove ? 'approved' : 'pending',
    autoApproved: autoApprove,
    escalationAt: thresholdPassed
      ? new Date(Date.now() + (config.slaHours || 24) * 60 * 60 * 1000)
      : null,
  }));
};

const buildWorkflowGraph = (steps) => {
  const nodes = [];
  const edges = [];

  steps.forEach((step, index) => {
    const nodeId = step.parallelGroupId ? `${step.level}-${step.parallelGroupId}-${index}` : `${step.level}-${index}`;
    nodes.push({
      id: nodeId,
      label: `${step.role}`,
      status: step.status,
      metadata: {
        level: step.level,
        requiredApprovals: step.requiredApprovals,
        approvalsReceived: step.approvalsReceived,
        autoApproved: step.autoApproved,
      },
    });

    if (index > 0) {
      const previous = steps[index - 1];
      const previousNodeId = previous.parallelGroupId
        ? `${previous.level}-${previous.parallelGroupId}-${index - 1}`
        : `${previous.level}-${index - 1}`;
      edges.push({
        from: previousNodeId,
        to: nodeId,
        type: step.parallelGroupId === previous.parallelGroupId ? 'parallel' : 'serial',
      });
    }
  });

  return { nodes, edges };
};

const buildApprovalWorkflow = async (expenseId) => {
  const expense = await Expense.findById(expenseId).populate('company');
  if (!expense) {
    const error = new Error('Expense not found');
    error.status = 404;
    throw error;
  }

  const company = await Company.findById(expense.company._id);
  if (!company) {
    const error = new Error('Company not found');
    error.status = 404;
    throw error;
  }

  const rules = (company.approvalRules || [])
    .filter((rule) => toCurrency(expense.amount) >= toCurrency(rule.thresholdAmount || 0))
    .sort((a, b) => a.level - b.level);

  const steps = [];
  rules.forEach((rule) => {
    const baseLevel = rule.level;
    const candidates = buildParallelGroup(baseLevel, rule, expense.currency, expense.amount);
    steps.push(...candidates);
  });

  if (!steps.length) {
    steps.push({
      level: 1,
      parallelGroupId: uuidv4(),
      role: 'manager',
      approver: null,
      approvers: [],
      requiredApprovals: 1,
      approvalsReceived: 0,
      status: 'pending',
      autoApproved: false,
      escalationAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }

  expense.approvalChain = steps;
  expense.currentApprovalLevel = steps[0]?.level || 0;
  expense.approvalProgress = 0;
  expense.workflowGraph = buildWorkflowGraph(steps);
  await expense.save();

  return expense;
};

const recordAuditLog = async ({ expense, actor, action, comment, metadata }) => {
  await ApprovalLog.create({
    expense: expense._id,
    company: expense.company,
    actor,
    action,
    comment,
    metadata,
  });
};

const advanceApproval = async ({ expenseId, approverId, decision, comment }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const expense = await Expense.findById(expenseId).session(session);
    if (!expense) {
      throw new Error('Expense not found');
    }

    const activeSteps = expense.approvalChain.filter((step) => step.status === 'pending');
    if (!activeSteps.length) {
      await session.commitTransaction();
      return expense;
    }

    const targetStepIndex = expense.approvalChain.findIndex(
      (step) => step.status === 'pending' && (!step.approver || step.approver.toString() === approverId),
    );

    if (targetStepIndex === -1) {
      throw new Error('No pending approval found for this user');
    }

    const step = expense.approvalChain[targetStepIndex];
    const parallelSteps = expense.approvalChain.filter(
      (candidate) => candidate.parallelGroupId && candidate.parallelGroupId === step.parallelGroupId,
    );

    if (decision === 'approve') {
      step.approvalsReceived += 1;
      step.approver = approverId;
      step.decisionAt = new Date();
      step.decisionComment = comment;
      step.approvers.push(approverId);
      step.status = step.approvalsReceived >= step.requiredApprovals ? 'approved' : 'pending';

      if (step.status === 'approved' && parallelSteps.length) {
        const completedApprovals = parallelSteps.filter((candidate) => candidate.status === 'approved');
        const fulfilledPercentage = completedApprovals.length / parallelSteps.length;
        if (fulfilledPercentage >= 0.6) {
          parallelSteps.forEach((candidate) => {
            if (candidate.status !== 'approved') {
              candidate.status = 'approved';
              candidate.autoApproved = true;
              candidate.decisionAt = new Date();
            }
          });
        }
      }
    } else if (decision === 'reject') {
      step.status = 'rejected';
      step.approver = approverId;
      step.decisionAt = new Date();
      step.decisionComment = comment;
      expense.status = 'rejected';
    }

    const approvedSteps = expense.approvalChain.filter((candidate) => candidate.status === 'approved').length;
    expense.approvalProgress = Math.round((approvedSteps / expense.approvalChain.length) * 100);

    const allApproved = expense.approvalChain.every((candidate) => candidate.status === 'approved');
    if (allApproved) {
      expense.status = 'approved';
      await recordAuditLog({
        expense,
        actor: approverId,
        action: 'approved',
        comment,
        metadata: { final: true },
      });
    } else {
      await recordAuditLog({
        expense,
        actor: approverId,
        action: decision === 'approve' ? 'approved' : 'rejected',
        comment,
      });
    }

    expense.workflowGraph = buildWorkflowGraph(expense.approvalChain);

    await expense.save({ session });
    await session.commitTransaction();

    return expense;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const triggerCfoBypass = async ({ expenseId, cfoUserId }) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new Error('Expense not found');

  expense.approvalChain.forEach((step) => {
    step.status = 'approved';
    step.autoApproved = true;
    step.decisionAt = new Date();
    step.decisionComment = 'CFO bypass';
  });

  expense.status = 'approved';
  expense.approvalProgress = 100;
  expense.workflowGraph = buildWorkflowGraph(expense.approvalChain);
  await expense.save();

  await recordAuditLog({
    expense,
    actor: cfoUserId,
    action: 'cfo_bypass',
    comment: 'CFO bypass executed',
  });

  return expense;
};

const notifyPendingApprovers = async (expense, company) => {
  const pendingSteps = expense.approvalChain.filter((step) => step.status === 'pending');
  const recipients = pendingSteps.flatMap((step) => step.approvers || []);
  if (!recipients.length) return;

  await Promise.all(
    recipients.map((userId) =>
      sendApprovalNotification({
        to: `${userId}@example.com`,
        subject: `Expense awaiting your approval • ${company.name}`,
        text: `An expense submitted by ${expense.employee} requires your attention.`,
      }),
    ),
  );
};

const checkEscalations = async () => {
  const now = new Date();
  const expenses = await Expense.find({ status: 'under_review', 'approvalChain.status': 'pending' });

  await Promise.all(
    expenses.map(async (expense) => {
      let escalated = false;

      expense.approvalChain.forEach((step) => {
        if (step.status === 'pending' && step.escalationAt && step.escalationAt <= now) {
          step.status = 'escalated';
          escalated = true;
        }
      });

      if (escalated) {
        expense.escalationNotifiedAt = now;
        await expense.save();
        await recordAuditLog({
          expense,
          actor: null,
          action: 'escalated',
          comment: 'Automatic escalation triggered',
        });
      }
    }),
  );
};

module.exports = {
  buildApprovalWorkflow,
  advanceApproval,
  triggerCfoBypass,
  notifyPendingApprovers,
  checkEscalations,
};
