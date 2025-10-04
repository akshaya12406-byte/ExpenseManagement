import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { DataGrid } from '@mui/x-data-grid';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, ChartTooltip, Legend);

const formatDateInput = (date) => {
  const d = new Date(date);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const formatCurrency = (amount = 0, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

const AnalyticsDashboardPage = () => {
  const { token } = useAuth();
  const [filters, setFilters] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(end),
    };
  });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [drilldown, setDrilldown] = useState({ open: false, loading: false, type: null, key: null, rows: [] });

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

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosClient.get('/analytics/overview', {
        params: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });
      setOverview(data);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [axiosClient, filters.endDate, filters.startDate]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleExport = async (report, format) => {
    setExporting(true);
    setError(null);
    try {
      const response = await axiosClient.get('/analytics/export', {
        params: {
          report,
          format,
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        responseType: 'blob',
      });

      const fileExt = format === 'json' ? 'json' : 'csv';
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report}-report.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.response?.data?.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const openDrilldown = async (type, key) => {
    setDrilldown({ open: true, loading: true, type, key, rows: [] });
    try {
      const { data } = await axiosClient.get('/analytics/drilldown', {
        params: {
          type,
          key,
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });
      setDrilldown({ open: true, loading: false, type, key, rows: data.expenses || [] });
    } catch (drillError) {
      setDrilldown((prev) => ({ ...prev, loading: false }));
      setError(drillError.response?.data?.message || 'Failed to load drill-down data');
    }
  };

  const closeDrilldown = () => {
    setDrilldown({ open: false, loading: false, type: null, key: null, rows: [] });
  };

  const trendChart = useMemo(() => {
    if (!overview?.expenseTrend?.length) {
      return {
        data: {
          labels: [],
          datasets: [],
        },
        options: {},
      };
    }

    const labels = overview.expenseTrend.map((entry) => entry.date);
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Amount',
            data: overview.expenseTrend.map((entry) => entry.amount),
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.15)',
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${formatCurrency(context.parsed.y, 'USD')}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#666' } },
          y: { ticks: { color: '#666' } },
        },
      },
    };
  }, [overview]);

  const departmentChart = useMemo(() => {
    if (!overview?.departmentSpending?.length) {
      return {
        data: { labels: [], datasets: [] },
        options: {},
      };
    }

    return {
      data: {
        labels: overview.departmentSpending.map((entry) => entry.department || 'Unassigned'),
        datasets: [
          {
            label: 'Spending',
            data: overview.departmentSpending.map((entry) => entry.amount),
            backgroundColor: '#9c27b0',
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        onClick: (_, elements) => {
          if (elements.length > 0) {
            const { index } = elements[0];
            const department = overview.departmentSpending[index]?.department;
            if (department) {
              openDrilldown('department', department);
            }
          }
        },
      },
    };
  }, [overview]);

  const categoryChart = useMemo(() => {
    if (!overview?.topCategories?.length) {
      return {
        data: { labels: [], datasets: [] },
        options: {},
      };
    }

    const colors = ['#42a5f5', '#66bb6a', '#ffca28', '#ef5350', '#ab47bc', '#26c6da'];
    return {
      data: {
        labels: overview.topCategories.map((entry) => entry.category || 'Uncategorized'),
        datasets: [
          {
            data: overview.topCategories.map((entry) => entry.amount),
            backgroundColor: overview.topCategories.map((_, idx) => colors[idx % colors.length]),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        onClick: (_, elements) => {
          if (elements.length > 0) {
            const { index } = elements[0];
            const category = overview.topCategories[index]?.category;
            if (category) {
              openDrilldown('category', category);
            }
          }
        },
      },
    };
  }, [overview]);

  const budgetChart = useMemo(() => {
    if (!overview?.budgetVsActual?.length) {
      return {
        data: { labels: [], datasets: [] },
        options: {},
      };
    }

    return {
      data: {
        labels: overview.budgetVsActual.map((entry) => entry.category),
        datasets: [
          {
            label: 'Actual spend',
            data: overview.budgetVsActual.map((entry) => entry.actualSpent),
            backgroundColor: '#1976d2',
          },
          {
            label: 'Monthly limit',
            data: overview.budgetVsActual.map((entry) => entry.monthlyLimit || 0),
            backgroundColor: '#90caf9',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        onClick: (_, elements) => {
          if (elements.length > 0) {
            const { index } = elements[0];
            const category = overview.budgetVsActual[index]?.category;
            if (category) {
              openDrilldown('category', category);
            }
          }
        },
      },
    };
  }, [overview]);

  const decisionDurationData = useMemo(() => {
    const durations = overview?.approvalBottlenecks?.decisionDurations || [];
    return {
      labels: durations.map((entry) => `Level ${entry.level}`),
      datasets: [
        {
          label: 'Avg hours',
          data: durations.map((entry) => entry.averageHours || 0),
          backgroundColor: '#ff7043',
        },
        {
          label: 'Max hours',
          data: durations.map((entry) => entry.maxHours || 0),
          backgroundColor: '#ffa270',
        },
      ],
    };
  }, [overview]);

  const pendingSteps = overview?.approvalBottlenecks?.pendingSteps || [];

  const drilldownColumns = useMemo(
    () => [
      { field: 'id', headerName: 'ID', flex: 1.2 },
      { field: 'employee', headerName: 'Employee', flex: 1.1 },
      { field: 'department', headerName: 'Department', flex: 1 },
      {
        field: 'amount',
        headerName: 'Amount',
        flex: 1,
        valueFormatter: ({ value, row }) => formatCurrency(value, row.currency || 'USD'),
      },
      { field: 'category', headerName: 'Category', flex: 1 },
      { field: 'status', headerName: 'Status', flex: 1 },
      {
        field: 'expenseDate',
        headerName: 'Expense date',
        flex: 1,
        valueGetter: ({ value }) => (value ? new Date(value).toLocaleDateString() : ''),
      },
    ],
    [],
  );

  return (
    <Box sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <InsightsRoundedIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Analytics dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Deep dive into spending patterns, approvals, and budgets across the organization.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Start date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
          />
          <TextField
            label="End date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
          />
          <Tooltip title="Refresh">
            <span>
              <IconButton color="primary" onClick={fetchOverview} disabled={loading}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {overview && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }} elevation={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Total spend
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {formatCurrency(overview.summary?.totalSpend || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {overview.summary?.totalCount || 0} expenses | Avg {formatCurrency(overview.summary?.averageExpense || 0)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }} elevation={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Departments tracked
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {overview.departmentSpending?.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click bars to drill down
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }} elevation={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Categories monitored
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {overview.topCategories?.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tap chart segments to drill down
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }} elevation={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Pending approval steps
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {pendingSteps.reduce((acc, entry) => acc + entry.pendingCount, 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Identifies where approvals are stalled
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: 380 }} elevation={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Expense trends
                </Typography>
                <Chip label={`${overview.expenseTrend?.length || 0} data points`} size="small" />
              </Stack>
              <Box sx={{ height: 300 }}>
                <Line data={trendChart.data} options={trendChart.options} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: 380 }} elevation={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Top categories
                </Typography>
                <Chip label="Click to drill down" size="small" color="primary" />
              </Stack>
              <Box sx={{ height: 300 }}>
                <Doughnut data={categoryChart.data} options={categoryChart.options} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: 420 }} elevation={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Department spend
                </Typography>
                <Chip label="Click bars to drill down" size="small" />
              </Stack>
              <Box sx={{ height: 340 }}>
                <Bar data={departmentChart.data} options={departmentChart.options} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: 420 }} elevation={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Budget vs actual
                </Typography>
                <Chip label="Click bars for details" size="small" />
              </Stack>
              <Box sx={{ height: 340 }}>
                <Bar data={budgetChart.data} options={budgetChart.options} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3, height: 420 }} elevation={3}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Approval bottlenecks
              </Typography>
              <Box sx={{ height: 320 }}>
                <Bar
                  data={decisionDurationData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Highlight long-running approval levels to optimize workflow.
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3, height: 420 }} elevation={3}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Pending approval steps
              </Typography>
              <Stack spacing={2} sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {pendingSteps.length === 0 ? (
                  <Alert severity="success">No pending approval bottlenecks 🎉</Alert>
                ) : (
                  pendingSteps.map((entry) => (
                    <Paper key={entry.level} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight={600}>
                          Level {entry.level}
                        </Typography>
                        <Chip label={`${entry.pendingCount} pending`} color="warning" size="small" />
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }} elevation={3}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography variant="h6" fontWeight={600}>
                  Export reports
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField select size="small" label="Report" defaultValue="trend" id="analytics-export-report">
                    <MenuItem value="trend">Spending trend</MenuItem>
                    <MenuItem value="departments">Department spending</MenuItem>
                    <MenuItem value="categories">Category spending</MenuItem>
                  </TextField>
                  <TextField select size="small" label="Format" defaultValue="csv" id="analytics-export-format">
                    <MenuItem value="csv">CSV</MenuItem>
                    <MenuItem value="json">JSON</MenuItem>
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<DownloadRoundedIcon />}
                    disabled={exporting}
                    onClick={() => {
                      const report = document.getElementById('analytics-export-report').value;
                      const format = document.getElementById('analytics-export-format').value;
                      handleExport(report, format);
                    }}
                  >
                    Export
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog open={drilldown.open} onClose={closeDrilldown} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>
            Drill-down • {drilldown.type} • {drilldown.key}
          </Typography>
          <IconButton onClick={closeDrilldown}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {drilldown.loading ? (
            <Box sx={{ py: 4 }}>
              <LinearProgress />
            </Box>
          ) : drilldown.rows.length === 0 ? (
            <Alert severity="info">No detailed records available for this selection.</Alert>
          ) : (
            <Box sx={{ height: 400 }}>
              <DataGrid
                rows={drilldown.rows}
                columns={drilldownColumns}
                pageSizeOptions={[10, 25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                disableRowSelectionOnClick
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDrilldown}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalyticsDashboardPage;
