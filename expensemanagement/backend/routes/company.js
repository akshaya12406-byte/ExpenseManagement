const express = require('express');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../middleware/auth');
const Company = require('../models/Company');

const router = express.Router();

const adminGuard = authMiddleware(['admin']);

const loadCompany = async (companyId) => {
  const company = await Company.findById(companyId);
  if (!company) {
    const error = new Error('Company not found');
    error.status = 404;
    throw error;
  }
  return company;
};

const buildResponse = (company) => ({
  id: company._id,
  name: company.name,
  currency: company.currency,
  profile: company.profile,
  approvalRules: company.approvalRules,
  budgetThresholds: company.budgetThresholds,
  categories: company.categories,
  settings: company.settings,
  exchangeRates: company.exchangeRates,
  workflowSettings: company.workflowSettings,
  integrations: company.integrations,
  backups: company.backups?.map((backup) => ({
    id: backup._id,
    createdAt: backup.createdAt,
    createdBy: backup.createdBy,
  })),
});

router.get('/', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    res.json({ company: buildResponse(company) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/profile', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    company.profile = { ...company.profile?.toObject?.(), ...req.body };
    await company.save();
    res.json({ profile: company.profile });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/settings', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    company.settings = { ...company.settings?.toObject?.(), ...req.body };
    await company.save();
    res.json({ settings: company.settings });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/workflow', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    company.workflowSettings = { ...company.workflowSettings?.toObject?.(), ...req.body };
    await company.save();
    res.json({ workflowSettings: company.workflowSettings });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/integrations', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    company.integrations = { ...company.integrations?.toObject?.(), ...req.body };
    await company.save();
    res.json({ integrations: company.integrations });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/approval-rules', adminGuard, async (req, res) => {
  try {
    const { approvalRules } = req.body;
    if (!Array.isArray(approvalRules)) {
      return res.status(400).json({ message: 'approvalRules must be an array' });
    }
    const company = await loadCompany(req.user.company);
    company.approvalRules = approvalRules;
    await company.save();
    res.json({ approvalRules: company.approvalRules });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/categories', adminGuard, async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: 'categories must be an array' });
    }
    const company = await loadCompany(req.user.company);
    company.categories = categories;
    await company.save();
    res.json({ categories: company.categories });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/budgets', adminGuard, async (req, res) => {
  try {
    const { budgetThresholds } = req.body;
    if (!Array.isArray(budgetThresholds)) {
      return res.status(400).json({ message: 'budgetThresholds must be an array' });
    }
    const company = await loadCompany(req.user.company);
    company.budgetThresholds = budgetThresholds;
    await company.save();
    res.json({ budgetThresholds: company.budgetThresholds });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/exchange-rates', adminGuard, async (req, res) => {
  try {
    const { exchangeRates } = req.body;
    if (!Array.isArray(exchangeRates)) {
      return res.status(400).json({ message: 'exchangeRates must be an array' });
    }
    const company = await loadCompany(req.user.company);
    company.exchangeRates = exchangeRates.map((entry) => ({
      ...entry,
      updatedAt: entry.updatedAt || new Date(),
    }));
    await company.save();
    res.json({ exchangeRates: company.exchangeRates });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/backup', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    const snapshot = {
      profile: company.profile,
      approvalRules: company.approvalRules,
      budgetThresholds: company.budgetThresholds,
      categories: company.categories,
      settings: company.settings,
      exchangeRates: company.exchangeRates,
      workflowSettings: company.workflowSettings,
      integrations: company.integrations,
    };
    const backup = {
      _id: uuidv4(),
      createdAt: new Date(),
      createdBy: req.user.sub,
      snapshot,
    };
    company.backups = company.backups || [];
    company.backups.push(backup);
    await company.save();
    res.status(201).json({ backup: { id: backup._id, createdAt: backup.createdAt, createdBy: backup.createdBy } });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/backups', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    res.json({
      backups: (company.backups || []).map((backup) => ({
        id: backup._id,
        createdAt: backup.createdAt,
        createdBy: backup.createdBy,
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/restore/:backupId', adminGuard, async (req, res) => {
  try {
    const company = await loadCompany(req.user.company);
    const backup = (company.backups || []).find((entry) => entry._id === req.params.backupId);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }

    const snapshot = backup.snapshot || {};
    company.profile = snapshot.profile || company.profile;
    company.approvalRules = snapshot.approvalRules || company.approvalRules;
    company.budgetThresholds = snapshot.budgetThresholds || company.budgetThresholds;
    company.categories = snapshot.categories || company.categories;
    company.settings = snapshot.settings || company.settings;
    company.exchangeRates = snapshot.exchangeRates || company.exchangeRates;
    company.workflowSettings = snapshot.workflowSettings || company.workflowSettings;
    company.integrations = snapshot.integrations || company.integrations;

    await company.save();
    res.json({ company: buildResponse(company) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
