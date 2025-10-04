import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import BackupRoundedIcon from '@mui/icons-material/BackupRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';

const CompanySettingsPage = () => {
  const { token, company: authCompany } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const axiosClient = useMemo(
    () =>
      axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
        withCredentials: true,
      }),
    [token],
  );

  const loadCompany = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosClient.get('/company');
      setCompany(data.company || null);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (path, payload, message) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await axiosClient.put(path, payload);
      setCompany((prev) => ({ ...prev, ...data }));
      setSuccess(message || 'Settings saved');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateApprovalRules = async (nextRules) => {
    await handleSave('/company/approval-rules', { approvalRules: nextRules }, 'Approval rules updated');
  };

  const updateCategories = async (nextCategories) => {
    await handleSave('/company/categories', { categories: nextCategories }, 'Categories updated');
  };

  const updateBudgets = async (nextBudgets) => {
    await handleSave('/company/budgets', { budgetThresholds: nextBudgets }, 'Budget thresholds updated');
  };

  const updateExchangeRates = async (nextRates) => {
    await handleSave('/company/exchange-rates', { exchangeRates: nextRates }, 'Exchange rates updated');
  };

  const createBackup = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await axiosClient.post('/company/backup');
      setSuccess('Backup created');
      loadCompany();
    } catch (backupError) {
      setError(backupError.response?.data?.message || 'Failed to create backup');
    } finally {
      setSaving(false);
    }
  };

  const restoreBackup = async (backupId) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await axiosClient.post(`/company/restore/${backupId}`);
      setCompany(data.company || company);
      setSuccess('Backup restored successfully');
    } catch (restoreError) {
      setError(restoreError.response?.data?.message || 'Failed to restore backup');
    } finally {
      setSaving(false);
    }
  };

  const upsertItem = (collection, template) => {
    setCompany((prev) => ({
      ...prev,
      [collection]: [...(prev?.[collection] || []), template],
    }));
  };

  const removeItem = (collection, index) => {
    setCompany((prev) => ({
      ...prev,
      [collection]: prev[collection].filter((_, idx) => idx !== index),
    }));
  };

  const updateCollectionValue = (collection, index, field, value) => {
    setCompany((prev) => ({
      ...prev,
      [collection]: prev[collection].map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  };

  if (loading || !company) {
    return (
      <Box sx={{ py: 4 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Company configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage company-level settings and workflows for {authCompany?.name || company.name}.
          </Typography>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {saving && <LinearProgress sx={{ mb: 2 }} />}

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Company profile</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Legal name"
                fullWidth
                value={company.profile?.legalName || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, legalName: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tax ID"
                fullWidth
                value={company.profile?.taxId || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, taxId: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Address"
                fullWidth
                multiline
                minRows={2}
                value={company.profile?.address || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, address: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Website"
                fullWidth
                value={company.profile?.website || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, website: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Contact email"
                fullWidth
                value={company.profile?.contactEmail || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, contactEmail: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Contact phone"
                fullWidth
                value={company.profile?.contactPhone || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, contactPhone: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Logo URL"
                fullWidth
                value={company.profile?.logoUrl || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, logoUrl: event.target.value },
                  }))
                }
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} justifyContent="flex-end" mt={3}>
            <Button variant="contained" onClick={() => handleSave('/company/profile', company.profile, 'Profile updated')}>
              Save profile
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Approval rules</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {company.approvalRules?.map((rule, index) => (
              <Box key={`${rule.level}-${index}`} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Level"
                      type="number"
                      fullWidth
                      value={rule.level}
                      onChange={(event) =>
                        updateCollectionValue('approvalRules', index, 'level', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      label="Role"
                      fullWidth
                      value={rule.role || ''}
                      onChange={(event) => updateCollectionValue('approvalRules', index, 'role', event.target.value)}
                    >
                      <MenuItem value="manager">Manager</MenuItem>
                      <MenuItem value="finance">Finance</MenuItem>
                      <MenuItem value="executive">Executive</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Threshold amount"
                      type="number"
                      fullWidth
                      value={rule.thresholdAmount || 0}
                      onChange={(event) =>
                        updateCollectionValue('approvalRules', index, 'thresholdAmount', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Currency"
                      fullWidth
                      value={rule.thresholdCurrency || company.currency}
                      onChange={(event) =>
                        updateCollectionValue('approvalRules', index, 'thresholdCurrency', event.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Required approvals"
                      type="number"
                      fullWidth
                      value={rule.requiredApprovals || 1}
                      onChange={(event) =>
                        updateCollectionValue('approvalRules', index, 'requiredApprovals', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Auto approve %"
                      type="number"
                      fullWidth
                      value={rule.autoApprovePercentage || 1}
                      onChange={(event) =>
                        updateCollectionValue('approvalRules', index, 'autoApprovePercentage', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <TextField
                        label="Parallel roles (comma separated)"
                        fullWidth
                        value={rule.parallelRoles?.join(', ') || ''}
                        onChange={(event) =>
                          updateCollectionValue(
                            'approvalRules',
                            index,
                            'parallelRoles',
                            event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                          )
                        }
                      />
                      <Tooltip title="Remove">
                        <IconButton color="error" onClick={() => removeItem('approvalRules', index)}>
                          <DeleteRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineRoundedIcon />}
              onClick={() =>
                upsertItem('approvalRules', {
                  level: (company.approvalRules?.length || 0) + 1,
                  role: 'manager',
                  thresholdAmount: 0,
                  thresholdCurrency: company.currency || 'USD',
                  requiredApprovals: 1,
                  autoApprovePercentage: 1,
                })
              }
            >
              Add approval level
            </Button>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => updateApprovalRules(company.approvalRules)}>
                Save approval rules
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Expense categories</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {company.categories?.map((category, index) => (
              <Box key={`${category.name}-${index}`} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Name"
                      fullWidth
                      value={category.name}
                      onChange={(event) => updateCollectionValue('categories', index, 'name', event.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Description"
                      fullWidth
                      value={category.description || ''}
                      onChange={(event) => updateCollectionValue('categories', index, 'description', event.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Default limit"
                      type="number"
                      fullWidth
                      value={category.defaultLimit || 0}
                      onChange={(event) =>
                        updateCollectionValue('categories', index, 'defaultLimit', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Currency"
                      fullWidth
                      value={category.currency || company.currency}
                      onChange={(event) => updateCollectionValue('categories', index, 'currency', event.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <Tooltip title="Remove">
                      <IconButton color="error" onClick={() => removeItem('categories', index)}>
                        <DeleteRoundedIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Box>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineRoundedIcon />}
              onClick={() =>
                upsertItem('categories', {
                  name: 'New category',
                  description: '',
                  defaultLimit: 0,
                  currency: company.currency || 'USD',
                  active: true,
                })
              }
            >
              Add category
            </Button>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => updateCategories(company.categories)}>
                Save categories
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Budget thresholds</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {company.budgetThresholds?.map((budget, index) => (
              <Box key={`${budget.category}-${index}`} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Category"
                      fullWidth
                      value={budget.category}
                      onChange={(event) => updateCollectionValue('budgetThresholds', index, 'category', event.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Monthly limit"
                      type="number"
                      fullWidth
                      value={budget.monthlyLimit || 0}
                      onChange={(event) =>
                        updateCollectionValue('budgetThresholds', index, 'monthlyLimit', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Quarterly limit"
                      type="number"
                      fullWidth
                      value={budget.quarterlyLimit || 0}
                      onChange={(event) =>
                        updateCollectionValue('budgetThresholds', index, 'quarterlyLimit', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Yearly limit"
                      type="number"
                      fullWidth
                      value={budget.yearlyLimit || 0}
                      onChange={(event) =>
                        updateCollectionValue('budgetThresholds', index, 'yearlyLimit', Number(event.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Currency"
                      fullWidth
                      value={budget.currency || company.currency}
                      onChange={(event) => updateCollectionValue('budgetThresholds', index, 'currency', event.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <Tooltip title="Remove">
                      <IconButton color="error" onClick={() => removeItem('budgetThresholds', index)}>
                        <DeleteRoundedIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Box>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineRoundedIcon />}
              onClick={() =>
                upsertItem('budgetThresholds', {
                  category: 'General',
                  monthlyLimit: 0,
                  quarterlyLimit: 0,
                  yearlyLimit: 0,
                  currency: company.currency || 'USD',
                })
              }
            >
              Add budget threshold
            </Button>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => updateBudgets(company.budgetThresholds)}>
                Save budgets
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Currency & exchange rates</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2} mb={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField
                label="Base currency"
                fullWidth
                value={company.currency}
                onChange={(event) => setCompany((prev) => ({ ...prev, currency: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Multi-currency"
                select
                fullWidth
                value={company.settings?.enableMultiCurrency ? 'true' : 'false'}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, enableMultiCurrency: event.target.value === 'true' },
                  }))
                }
              >
                <MenuItem value="true">Enabled</MenuItem>
                <MenuItem value="false">Disabled</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Stack spacing={2}>
            {company.exchangeRates?.map((rate, index) => (
              <Stack
                key={`${rate.code}-${index}`}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}
              >
                <TextField
                  label="Currency code"
                  value={rate.code}
                  onChange={(event) => updateCollectionValue('exchangeRates', index, 'code', event.target.value.toUpperCase())}
                />
                <TextField
                  label="Rate"
                  type="number"
                  value={rate.rate}
                  onChange={(event) =>
                    updateCollectionValue('exchangeRates', index, 'rate', Number(event.target.value))
                  }
                />
                <Chip label={`Updated ${new Date(rate.updatedAt).toLocaleString()}`} size="small" />
                <Tooltip title="Remove">
                  <IconButton color="error" onClick={() => removeItem('exchangeRates', index)}>
                    <DeleteRoundedIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineRoundedIcon />}
              onClick={() =>
                upsertItem('exchangeRates', {
                  code: 'EUR',
                  rate: 0.92,
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              Add exchange rate
            </Button>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => handleSave('/company/settings', company.settings, 'Currency settings saved')}>
                Save currency settings
              </Button>
              <Button variant="contained" onClick={() => updateExchangeRates(company.exchangeRates)}>
                Save exchange rates
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Workflow settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Auto escalate after (hours)"
                type="number"
                fullWidth
                value={company.workflowSettings?.autoEscalateHours || 24}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    workflowSettings: {
                      ...prev.workflowSettings,
                      autoEscalateHours: Number(event.target.value),
                    },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Require manager approval"
                fullWidth
                value={company.workflowSettings?.requireManagerApproval ? 'true' : 'false'}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    workflowSettings: {
                      ...prev.workflowSettings,
                      requireManagerApproval: event.target.value === 'true',
                    },
                  }))
                }
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Require finance approval"
                fullWidth
                value={company.workflowSettings?.requireFinanceApproval ? 'true' : 'false'}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    workflowSettings: {
                      ...prev.workflowSettings,
                      requireFinanceApproval: event.target.value === 'true',
                    },
                  }))
                }
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Allow CFO bypass"
                fullWidth
                value={company.workflowSettings?.allowCfoBypass ? 'true' : 'false'}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    workflowSettings: {
                      ...prev.workflowSettings,
                      allowCfoBypass: event.target.value === 'true',
                    },
                  }))
                }
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Notify on escalation"
                fullWidth
                value={company.workflowSettings?.notifyOnEscalation ? 'true' : 'false'}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    workflowSettings: {
                      ...prev.workflowSettings,
                      notifyOnEscalation: event.target.value === 'true',
                    },
                  }))
                }
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" mt={3}>
            <Button variant="contained" onClick={() => handleSave('/company/workflow', company.workflowSettings, 'Workflow settings saved')}>
              Save workflow settings
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Integration settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" gutterBottom>
            Email (SMTP)
          </Typography>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Host"
                fullWidth
                value={company.integrations?.email?.host || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      email: { ...prev.integrations?.email, host: event.target.value },
                    },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Port"
                type="number"
                fullWidth
                value={company.integrations?.email?.port || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      email: { ...prev.integrations?.email, port: Number(event.target.value) },
                    },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Username"
                fullWidth
                value={company.integrations?.email?.username || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      email: { ...prev.integrations?.email, username: event.target.value },
                    },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="From address"
                fullWidth
                value={company.integrations?.email?.fromAddress || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      email: { ...prev.integrations?.email, fromAddress: event.target.value },
                    },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                select
                label="Secure"
                fullWidth
                value={company.integrations?.email?.secure ? 'true' : 'false'}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      email: { ...prev.integrations?.email, secure: event.target.value === 'true' },
                    },
                  }))
                }
              >
                <MenuItem value="true">TLS/SSL</MenuItem>
                <MenuItem value="false">None</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Webhooks
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Slack webhook URL"
                fullWidth
                value={company.integrations?.slackWebhookUrl || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      slackWebhookUrl: event.target.value,
                    },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Generic webhook endpoint"
                fullWidth
                value={company.integrations?.webhookEndpoint || ''}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    integrations: {
                      ...prev.integrations,
                      webhookEndpoint: event.target.value,
                    },
                  }))
                }
              />
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" mt={3}>
            <Button variant="contained" onClick={() => handleSave('/company/integrations', company.integrations, 'Integration settings saved')}>
              Save integration settings
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Backup & restore</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction="row" spacing={2} mb={2}>
            <Button
              startIcon={<BackupRoundedIcon />}
              variant="contained"
              onClick={createBackup}
            >
              Create backup
            </Button>
            <Button variant="text" onClick={loadCompany}>
              Refresh backups
            </Button>
          </Stack>
          {company.backups?.length ? (
            <Stack spacing={2}>
              {company.backups.map((backup) => (
                <Stack
                  key={backup.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}
                >
                  <Typography variant="subtitle2">
                    {new Date(backup.createdAt).toLocaleString()}
                  </Typography>
                  <Chip label={`Created by ${backup.createdBy || 'system'}`} size="small" />
                  <Button
                    startIcon={<RestoreRoundedIcon />}
                    onClick={() => restoreBackup(backup.id)}
                    variant="outlined"
                  >
                    Restore
                  </Button>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Alert severity="info">No backups available yet.</Alert>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default CompanySettingsPage;
