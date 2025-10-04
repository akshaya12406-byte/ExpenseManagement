import { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import CommentRoundedIcon from '@mui/icons-material/CommentRounded';
import { formatDistanceToNowStrict, isAfter, subDays } from 'date-fns';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
}));

const statusColors = {
  submitted: 'info',
  under_review: 'warning',
  escalated: 'error',
};

const defaultFilters = {
  employee: 'all',
  category: 'all',
  minAmount: '',
  maxAmount: '',
  priority: 'all',
};

const ApprovalDashboard = ({
  approvals = [],
  employees = [],
  categories = [],
  onBulkDecision,
  onDecision,
  onLoadHistory,
  isLoading = false,
}) => {
  const theme = useTheme();
  const [filters, setFilters] = useState(defaultFilters);
  const [selection, setSelection] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const filteredApprovals = useMemo(() => {
    return approvals
      .filter((item) => {
        if (filters.employee !== 'all' && item.employee.id !== filters.employee) return false;
        if (filters.category !== 'all' && item.category !== filters.category) return false;
        const amount = Number(item.amount);
        if (filters.minAmount && amount < Number(filters.minAmount)) return false;
        if (filters.maxAmount && amount > Number(filters.maxAmount)) return false;
        if (filters.priority === 'escalated') {
          return item.escalated;
        }
        if (filters.priority === 'high') {
          return item.priority === 'high';
        }
        return true;
      })
      .sort((a, b) => {
        if (a.escalated && !b.escalated) return -1;
        if (!a.escalated && b.escalated) return 1;
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });
  }, [approvals, filters]);

  const escalationAlerts = useMemo(() => {
    const now = new Date();
    const overdue = filteredApprovals.filter((item) => item.deadline && isAfter(now, new Date(item.deadline)));
    return overdue.map((item) => ({
      id: item.id,
      message: `${item.employee.name} • ${item.category} • overdue by ${formatDistanceToNowStrict(new Date(item.deadline))}`,
    }));
  }, [filteredApprovals]);

  const handleFilterChange = (name) => (event, value) => {
    const nextValue = event?.target ? event.target.value : value;
    setFilters((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleBulkDecision = async (decision) => {
    setCommentError(null);
    if (!selection.length) return;
    if (decision === 'reject' && comment.trim().length < 3) {
      setCommentError('Please provide a short comment when rejecting in bulk.');
      return;
    }
    if (onBulkDecision) {
      await onBulkDecision({ expenseIds: selection, decision, comment: comment.trim() });
      setSelection([]);
      setComment('');
    }
  };

  const handleDecision = async (expenseId, decision) => {
    setCommentError(null);
    if (decision === 'reject' && comment.trim().length < 3) {
      setCommentError('Please provide a comment when rejecting.');
      return;
    }
    if (onDecision) {
      await onDecision({ expenseId, decision, comment: comment.trim() });
      setComment('');
      setSelection((prev) => prev.filter((id) => id !== expenseId));
    }
  };

  const openDetails = async (expense) => {
    setViewing(expense);
    setHistory([]);
    setHistoryError(null);
    if (!onLoadHistory) return;
    setHistoryLoading(true);
    try {
      const result = await onLoadHistory(expense.id);
      setHistory(result || []);
    } catch (error) {
      setHistoryError('Failed to load approval history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'employeeName',
        headerName: 'Employee',
        flex: 1,
        valueGetter: ({ row }) => row.employee?.name,
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 1,
      },
      {
        field: 'amount',
        headerName: 'Amount',
        flex: 1,
        type: 'number',
        valueFormatter: ({ value, row }) =>
          new Intl.NumberFormat(undefined, { style: 'currency', currency: row.currency || 'USD' }).format(value),
      },
      {
        field: 'submittedAt',
        headerName: 'Submitted',
        flex: 1,
        valueFormatter: ({ value }) => formatDistanceToNowStrict(new Date(value), { addSuffix: true }),
      },
      {
        field: 'deadline',
        headerName: 'Deadline',
        flex: 1,
        renderCell: ({ row }) =>
          row.deadline ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleRoundedIcon fontSize="small" color={isAfter(new Date(), new Date(row.deadline)) ? 'error' : 'action'} />
              <Typography variant="caption">
                {new Date(row.deadline).toLocaleString()}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ),
      },
      {
        field: 'priority',
        headerName: 'Priority',
        flex: 0.6,
        renderCell: ({ value, row }) => (
          <Chip label={value || 'normal'} color={row.escalated ? 'error' : value === 'high' ? 'warning' : 'default'} size="small" />
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.8,
        renderCell: ({ row }) => (
          <Chip
            label={row.status.replace('_', ' ')}
            color={statusColors[row.status] || 'default'}
            size="small"
          />
        ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        flex: 1,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Approve">
              <IconButton color="success" onClick={() => handleDecision(row.id, 'approve')}>
                <CheckCircleRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reject">
              <IconButton color="error" onClick={() => handleDecision(row.id, 'reject')}>
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View details">
              <IconButton color="primary" onClick={() => openDetails(row)}>
                <CommentRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [handleDecision],
  );

  return (
    <Stack spacing={3}>
      {escalationAlerts.length > 0 && (
        <StyledPaper sx={{ borderLeft: (theme) => `4px solid ${theme.palette.error.main}` }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <WarningAmberRoundedIcon color="error" />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Escalation alerts
              </Typography>
              {escalationAlerts.map((alert) => (
                <Typography key={alert.id} variant="body2">
                  {alert.message}
                </Typography>
              ))}
            </Box>
          </Stack>
        </StyledPaper>
      )}

      <StyledPaper>
        <Stack direction="row" spacing={2} alignItems="center" mb={3}>
          <FilterAltRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Filters
          </Typography>
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select label="Employee" fullWidth value={filters.employee} onChange={handleFilterChange('employee')}>
              <MenuItem value="all">All employees</MenuItem>
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select label="Category" fullWidth value={filters.category} onChange={handleFilterChange('category')}>
              <MenuItem value="all">All categories</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Min amount"
              type="number"
              fullWidth
              value={filters.minAmount}
              onChange={handleFilterChange('minAmount')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Max amount"
              type="number"
              fullWidth
              value={filters.maxAmount}
              onChange={handleFilterChange('maxAmount')}
            />
          </Grid>
          <Grid item xs={12}>
            <ToggleButtonGroup
              value={filters.priority}
              exclusive
              onChange={(event, value) => setFilters((prev) => ({ ...prev, priority: value || 'all' }))}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="high">High priority</ToggleButton>
              <ToggleButton value="escalated">Escalated</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
        <Stack direction="row" spacing={2} justifyContent="flex-end" mt={2}>
          <Button variant="outlined" onClick={() => setFilters(defaultFilters)}>
            Reset filters
          </Button>
        </Stack>
      </StyledPaper>

      <StyledPaper>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={2}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Pending approvals
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredApprovals.length} approvals awaiting action
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Comments"
              placeholder="Add context for decisions"
              minRows={1}
              multiline
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              error={!!commentError}
              helperText={commentError}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
            />
            <Button
              variant="contained"
              color="success"
              startIcon={<DoneAllRoundedIcon />}
              disabled={!selection.length}
              onClick={() => handleBulkDecision('approve')}
            >
              Approve selected
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearRoundedIcon />}
              disabled={!selection.length}
              onClick={() => handleBulkDecision('reject')}
            >
              Reject selected
            </Button>
          </Stack>
        </Stack>

        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        <DataGrid
          autoHeight
          rows={filteredApprovals}
          columns={columns}
          getRowId={(row) => row.id}
          checkboxSelection
          disableRowSelectionOnClick
          selectionModel={selection}
          onSelectionModelChange={(model) => setSelection(model)}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 10,
              },
            },
          }}
          sx={{
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
          }}
        />
      </StyledPaper>

      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Expense details</Typography>
          <IconButton onClick={() => setViewing(null)}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewing ? (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Employee
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {viewing.employee?.name}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="body1">
                  {new Intl.NumberFormat(undefined, { style: 'currency', currency: viewing.currency || 'USD' }).format(viewing.amount)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Category
                </Typography>
                <Typography variant="body1">{viewing.category}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">{viewing.description}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Submitted
                </Typography>
                <Typography variant="body1">
                  {new Date(viewing.submittedAt).toLocaleString()}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HistoryRoundedIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Approval history
                  </Typography>
                </Stack>
                {historyLoading ? (
                  <LinearProgress sx={{ mt: 2 }} />
                ) : historyError ? (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {historyError}
                  </Alert>
                ) : history.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No approval history yet.
                  </Alert>
                ) : (
                  <Stack spacing={2} mt={2}>
                    {history.map((entry) => (
                      <Box key={entry.id}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {entry.actor?.name} • {entry.action}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.performedAt).toLocaleString()}
                        </Typography>
                        {entry.comment && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {entry.comment}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : (
            <Typography>No expense selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => viewing && handleDecision(viewing.id, 'reject')} color="error">
            Reject
          </Button>
          <Button onClick={() => viewing && handleDecision(viewing.id, 'approve')} color="success" variant="contained">
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

ApprovalDashboard.propTypes = {
  approvals: PropTypes.arrayOf(PropTypes.object),
  employees: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })),
  categories: PropTypes.arrayOf(PropTypes.string),
  onBulkDecision: PropTypes.func,
  onDecision: PropTypes.func,
  onLoadHistory: PropTypes.func,
  isLoading: PropTypes.bool,
};

export default ApprovalDashboard;
