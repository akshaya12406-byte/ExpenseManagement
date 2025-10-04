const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');

const Company = require('../models/Company');
const User = require('../models/User');
const Expense = require('../models/Expense');
const ApprovalLog = require('../models/ApprovalLog');
const Notification = require('../models/Notification');
const ExchangeRate = require('../models/ExchangeRate');

const COMPANY_NAME = 'Nimbus Dynamics';

const seedUsers = [
  {
    email: 'alex.admin@nimbusdynamics.com',
    password: 'Password@123',
    name: 'Alex Rivera',
    role: 'admin',
    title: 'Head of Finance',
  },
  {
    email: 'maria.manager@nimbusdynamics.com',
    password: 'Password@123',
    name: 'Maria Gomez',
    role: 'manager',
    title: 'Sales Manager',
  },
  {
    email: 'li.employee@nimbusdynamics.com',
    password: 'Password@123',
    name: 'Li Wei',
    role: 'employee',
    title: 'Account Executive',
  },
  {
    email: 'sanjay.finance@nimbusdynamics.com',
    password: 'Password@123',
    name: 'Sanjay Patel',
    role: 'finance',
    title: 'Finance Controller',
  },
  {
    email: 'sofia.executive@nimbusdynamics.com',
    password: 'Password@123',
    name: 'Sofia Dimitrov',
    role: 'executive',
    title: 'COO',
  },
];

const seedCategories = [
  {
    name: 'Travel',
    description: 'Flights, hotels, and transportation',
    defaultLimit: 2500,
    currency: 'USD',
  },
  {
    name: 'Meals & Entertainment',
    description: 'Client lunches, team events',
    defaultLimit: 500,
    currency: 'USD',
  },
  {
    name: 'Software & Subscriptions',
    description: 'SaaS tools and IT subscriptions',
    defaultLimit: 1500,
    currency: 'USD',
  },
  {
    name: 'Training',
    description: 'Courses and certifications',
    defaultLimit: 1200,
    currency: 'USD',
  },
];

const exchangeRates = [
  {
    baseCurrency: 'USD',
    targetCurrency: 'EUR',
    rate: 0.92,
    effectiveDate: new Date('2025-09-01'),
    source: 'demo',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'GBP',
    rate: 0.78,
    effectiveDate: new Date('2025-09-01'),
    source: 'demo',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    rate: 84.5,
    effectiveDate: new Date('2025-09-01'),
    source: 'demo',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'AUD',
    rate: 1.42,
    effectiveDate: new Date('2025-09-01'),
    source: 'demo',
  },
];

const buildApprovalWorkflow = () => [
  {
    level: 1,
    role: 'manager',
    requiredApprovals: 1,
    autoApproveBelow: 150,
    thresholdAmount: 0,
    thresholdCurrency: 'USD',
    notifyRoles: ['admin'],
  },
  {
    level: 2,
    role: 'finance',
    requiredApprovals: 1,
    thresholdAmount: 1000,
    thresholdCurrency: 'USD',
    notifyRoles: ['executive'],
  },
  {
    level: 3,
    role: 'executive',
    requiredApprovals: 1,
    thresholdAmount: 5000,
    thresholdCurrency: 'USD',
    bypassRole: 'admin',
  },
];

const demoExpenses = (companyId, users) => {
  const employee = users.find((user) => user.role === 'employee');
  const manager = users.find((user) => user.role === 'manager');
  const finance = users.find((user) => user.role === 'finance');

  return [
    {
      company: companyId,
      employee: employee._id,
      amount: 452.75,
      currency: 'USD',
      category: 'Travel',
      description: 'Sales trip to Chicago - hotel and meals',
      receipts: [
        {
          id: uuid(),
          fileName: 'receipt-hotel.pdf',
          mimeType: 'application/pdf',
          url: '/demo/receipts/receipt-hotel.pdf',
          originalAmount: 352.75,
          detectedCurrency: 'USD',
          ocrSummary: 'Hotel stay - Grand Plaza, Chicago',
        },
      ],
      status: 'under_review',
      approvalWorkflow: {
        currentLevel: 1,
        levels: [
          {
            level: 1,
            assigneeRole: 'manager',
            assignee: manager._id,
            status: 'pending',
          },
          {
            level: 2,
            assigneeRole: 'finance',
            assignee: finance._id,
            status: 'pending',
          },
        ],
      },
      expenseDate: new Date('2025-09-18'),
      conversion: {
        amount: 452.75,
        currency: 'USD',
        convertedAmount: 452.75,
        convertedCurrency: 'USD',
        rate: 1,
        source: 'demo',
      },
    },
    {
      company: companyId,
      employee: employee._id,
      amount: 1200,
      currency: 'EUR',
      category: 'Software & Subscriptions',
      description: 'Annual subscription for localization tool',
      receipts: [
        {
          id: uuid(),
          fileName: 'receipt-subscription.png',
          mimeType: 'image/png',
          url: '/demo/receipts/receipt-subscription.png',
          originalAmount: 1200,
          detectedCurrency: 'EUR',
          ocrSummary: 'Localization tool subscription - Invoice #5433',
        },
      ],
      status: 'approved',
      approvalWorkflow: {
        currentLevel: 2,
        levels: [
          {
            level: 1,
            assigneeRole: 'manager',
            assignee: manager._id,
            status: 'approved',
            actedAt: new Date('2025-09-10T10:00:00Z'),
            comment: 'Looks good, necessary for the team.',
          },
          {
            level: 2,
            assigneeRole: 'finance',
            assignee: finance._id,
            status: 'approved',
            actedAt: new Date('2025-09-11T15:30:00Z'),
            comment: 'Converted to USD and budgeted.',
          },
        ],
      },
      expenseDate: new Date('2025-09-09'),
      conversion: {
        amount: 1200,
        currency: 'EUR',
        convertedAmount: 1080,
        convertedCurrency: 'USD',
        rate: 0.9,
        source: 'demo',
      },
    },
    {
      company: companyId,
      employee: employee._id,
      amount: 685,
      currency: 'GBP',
      category: 'Training',
      description: 'Advanced sales enablement course',
      receipts: [
        {
          id: uuid(),
          fileName: 'receipt-training.jpg',
          mimeType: 'image/jpeg',
          url: '/demo/receipts/receipt-training.jpg',
          originalAmount: 685,
          detectedCurrency: 'GBP',
          ocrSummary: 'Sales enablement course - London Academy',
        },
      ],
      status: 'rejected',
      rejectionReason: 'Budget exceeded for training this quarter.',
      approvalWorkflow: {
        currentLevel: 1,
        levels: [
          {
            level: 1,
            assigneeRole: 'manager',
            assignee: manager._id,
            status: 'rejected',
            actedAt: new Date('2025-09-14T09:15:00Z'),
            comment: 'Hold off until next quarter due to budget caps.',
          },
        ],
      },
      expenseDate: new Date('2025-09-12'),
      conversion: {
        amount: 685,
        currency: 'GBP',
        convertedAmount: 877,
        convertedCurrency: 'USD',
        rate: 1.28,
        source: 'demo',
      },
    },
  ];
};

const demoLogs = (expenses, users) => {
  const manager = users.find((user) => user.role === 'manager');
  const finance = users.find((user) => user.role === 'finance');

  return expenses.flatMap((expense) => {
    if (expense.status === 'approved') {
      return [
        {
          expense: expense._id,
          actionBy: manager._id,
          action: 'approved',
          comment: 'Approved for consolidation tool.',
          level: 1,
          createdAt: new Date('2025-09-10T10:15:00Z'),
        },
        {
          expense: expense._id,
          actionBy: finance._id,
          action: 'approved',
          comment: 'Converted to USD and within budget.',
          level: 2,
          createdAt: new Date('2025-09-11T15:45:00Z'),
        },
      ];
    }

    if (expense.status === 'rejected') {
      return [
        {
          expense: expense._id,
          actionBy: manager._id,
          action: 'rejected',
          comment: 'Budget exceeded; re-evaluate next quarter.',
          level: 1,
          createdAt: new Date('2025-09-14T09:20:00Z'),
        },
      ];
    }

    return [];
  });
};

const demoNotifications = (companyId, users) => {
  const admin = users.find((user) => user.role === 'admin');
  const manager = users.find((user) => user.role === 'manager');
  const finance = users.find((user) => user.role === 'finance');

  return [
    {
      company: companyId,
      user: admin._id,
      type: 'expense_submitted',
      title: 'New expense submitted by Li Wei',
      message: 'Li Wei submitted a travel expense for $452.75 awaiting manager review.',
      metadata: { expenseId: 'demo-exp-1' },
    },
    {
      company: companyId,
      user: manager._id,
      type: 'expense_requires_action',
      title: 'Expense under review',
      message: 'Expense #demo-exp-1 needs approval. SLA: 12 hours remaining.',
      metadata: { level: 1 },
    },
    {
      company: companyId,
      user: finance._id,
      type: 'rate_alert',
      title: 'Currency fluctuation alert',
      message: 'EUR increased by 3.2% against USD in the last 24 hours.',
      metadata: { currency: 'EUR', rate: 0.92 },
    },
  ];
};

const demoAnalytics = () => ({
  spendByCategory: [
    { category: 'Travel', amount: 12850, currency: 'USD' },
    { category: 'Meals & Entertainment', amount: 3150, currency: 'USD' },
    { category: 'Software & Subscriptions', amount: 8900, currency: 'USD' },
  ],
  spendByDepartment: [
    { department: 'Sales', amount: 7450, currency: 'USD' },
    { department: 'Marketing', amount: 4820, currency: 'USD' },
    { department: 'Operations', amount: 3120, currency: 'USD' },
  ],
  trend: Array.from({ length: 8 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (7 - index));
    return { date, amount: 1200 + index * 340 };
  }),
  bottlenecks: [
    { level: 'Manager', pending: 4, averageHours: 16 },
    { level: 'Finance', pending: 2, averageHours: 24 },
  ],
});

async function seedDemoData(mongoUri) {
  await mongoose.connect(mongoUri);

  const existingCompany = await Company.findOne({ name: COMPANY_NAME });
  if (existingCompany) {
    console.log('Demo company already exists. Skipping seed.');
    await mongoose.disconnect();
    return;
  }

  const company = await Company.create({
    name: COMPANY_NAME,
    currency: 'USD',
    categories: seedCategories,
    approvalRules: buildApprovalWorkflow(),
    settings: {
      reimbursementPolicy: 'Submit expenses within 30 days of occurrence.',
      autoApproveBelow: 50,
      workingWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      notificationEmails: ['finance@nimbusdynamics.com'],
      enableMultiCurrency: true,
    },
    workflowSettings: {
      autoEscalateHours: 12,
      requireManagerApproval: true,
      requireFinanceApproval: true,
      allowCfoBypass: true,
      notifyOnEscalation: true,
    },
    integrations: {
      slackWebhookUrl: 'https://hooks.slack.com/services/demo/hook',
      webhookEndpoint: 'https://demo.nimbusdynamics.com/webhooks/expenses',
    },
  });

  const users = await User.insertMany(
    seedUsers.map((user) => ({
      ...user,
      company: company._id,
      passwordChangedAt: new Date(),
    })),
  );

  const expenses = await Expense.insertMany(
    demoExpenses(company._id, users).map((expense, index) => ({ ...expense, externalId: `demo-exp-${index + 1}` })),
  );

  const logs = await ApprovalLog.insertMany(demoLogs(expenses, users));

  await Notification.insertMany(
    demoNotifications(company._id, users).map((notification) => ({
      ...notification,
      source: 'demo-seed',
    })),
  );

  await ExchangeRate.insertMany(
    exchangeRates.map((rate) => ({
      ...rate,
      company: company._id,
    })),
  );

  company.analyticsSnapshot = demoAnalytics();
  await company.save();

  await mongoose.disconnect();
  console.log('Demo data seeded successfully.');
}

if (require.main === module) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/expensemanagement';
  seedDemoData(mongoUri)
    .then(() => {
      console.log('Demo data script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to seed demo data:', error);
      process.exit(1);
    });
}

module.exports = seedDemoData;
