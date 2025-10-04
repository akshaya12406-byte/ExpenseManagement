import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';

const AdminPage = () => {
  const { token, company } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [modalState, setModalState] = useState({ open: false, user: null });
  const [confirmState, setConfirmState] = useState({ open: false, action: null, payload: null });
  const [activityState, setActivityState] = useState({ open: false, loading: false, user: null, logs: [] });
  const [filters, setFilters] = useState({ role: 'all', status: 'all', search: '' });

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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.role !== 'all') params.role = filters.role;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const { data } = await axiosClient.get('/users', { params });
      setUsers(data.users || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [axiosClient, filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = useCallback(() => {
    setModalState({ open: true, user: null });
  }, []);

  const openEditModal = useCallback((user) => {
    setModalState({ open: true, user });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ open: false, user: null });
  }, []);

  const handleSaveUser = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      email: data.get('email'),
      role: data.get('role'),
      status: data.get('status'),
      manager: data.get('manager') || undefined,
      profile: {
        firstName: data.get('firstName') || undefined,
        lastName: data.get('lastName') || undefined,
      },
      preferences: {
        receiveEmailNotifications: data.get('receiveEmailNotifications') === 'true',
      },
    };

    try {
      if (modalState.user) {
        await axiosClient.put(`/users/${modalState.user._id}`, payload);
        setSuccessMessage('User updated successfully');
      } else {
        await axiosClient.post('/users', payload);
        setSuccessMessage('User invited successfully');
      }
      closeModal();
      fetchUsers();
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Failed to save user');
    }
  };

  const handleBulkAction = async (action, payload) => {
    try {
      await axiosClient.post('/users/bulk', {
        userIds: selected,
        action,
        payload,
      });
      setSuccessMessage('Bulk action completed');
      setSelected([]);
      fetchUsers();
    } catch (bulkError) {
      setError(bulkError.response?.data?.message || 'Bulk action failed');
    }
  };

  const openConfirmDialog = useCallback((action, payload) => {
    setConfirmState({ open: true, action, payload });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmState({ open: false, action: null, payload: null });
  }, []);

  const executeConfirmAction = async () => {
    if (!confirmState.action) return;
    if (confirmState.action.type === 'bulk') {
      await handleBulkAction(confirmState.action.name, confirmState.payload);
    } else if (confirmState.action.type === 'reset') {
      try {
        await axiosClient.post(`/users/${confirmState.payload.userId}/reset-password`);
        setSuccessMessage('Temporary password generated');
      } catch (resetError) {
        setError(resetError.response?.data?.message || 'Password reset failed');
      }
    }
    closeConfirmDialog();
  };

  const openActivityDialog = useCallback(
    async (user) => {
      setActivityState({ open: true, loading: true, user, logs: [] });
      try {
        const { data } = await axiosClient.get(`/users/${user._id}/activity`);
        setActivityState((prev) => ({ ...prev, loading: false, logs: data.activity || [] }));
      } catch (activityError) {
        setActivityState((prev) => ({
          ...prev,
          loading: false,
          error: activityError.response?.data?.message || 'Failed to load activity',
        }));
      }
    },
    [axiosClient],
  );

  const closeActivityDialog = useCallback(() => {
    setActivityState({ open: false, loading: false, user: null, logs: [], error: null });
  }, []);

  const exportUsers = async () => {
    try {
      const response = await axiosClient.get('/users/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (exportError) {
      setError(exportError.response?.data?.message || 'Failed to export users');
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'profile',
        headerName: 'User',
        flex: 1.4,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={row.profile?.avatarUrl}>
              {row.profile?.firstName?.[0] || row.email[0]}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                {row.profile?.firstName ? `${row.profile.firstName} ${row.profile?.lastName || ''}`.trim() : row.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.email}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'role',
        headerName: 'Role',
        flex: 0.8,
        renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'admin' ? 'primary' : 'default'} />, 
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.8,
        renderCell: ({ value }) => (
          <Chip
            label={value}
            size="small"
            color={value === 'active' ? 'success' : value === 'inactive' ? 'warning' : 'error'}
          />
        ),
      },
      {
        field: 'manager',
        headerName: 'Manager',
        flex: 1,
        valueGetter: ({ row }) => row.manager?.email || '—',
      },
      {
        field: 'lastLoginAt',
        headerName: 'Last activity',
        flex: 1,
        valueFormatter: ({ value }) => (value ? new Date(value).toLocaleString() : 'Never'),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        flex: 1.2,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEditModal(row)}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset password">
              <IconButton
                size="small"
                color="warning"
                onClick={() => openConfirmDialog({ type: 'reset' }, { userId: row._id })}
              >
                <ReplayRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View activity">
              <IconButton size="small" onClick={() => openActivityDialog(row)}>
                <RestoreRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [openActivityDialog, openConfirmDialog, openEditModal],
  );

  return (
    <Box sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Stack direction="row" spacing={2} alignItems="center">
          <PeopleAltRoundedIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h4" fontWeight={700}>
              User management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage employees, roles, and approval permissions for {company?.name || 'your company'}.
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button variant="outlined" startIcon={<CloudDownloadRoundedIcon />} onClick={exportUsers}>
            Export CSV
          </Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateModal}>
            Invite user
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} sm={4} md={3}>
          <TextField
            fullWidth
            select
            label="Role"
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
          >
            <MenuItem value="all">All roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="employee">Employee</MenuItem>
            <MenuItem value="finance">Finance</MenuItem>
            <MenuItem value="executive">Executive</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField
            fullWidth
            select
            label="Status"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4} md={6}>
          <TextField
            fullWidth
            label="Search"
            placeholder="Search by name or email"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Badge color="primary" badgeContent={selected.length} showZero>
            <Typography variant="subtitle1">Selected</Typography>
          </Badge>
          <Divider orientation="vertical" flexItem />
          <Button
            size="small"
            variant="outlined"
            startIcon={<CheckCircleRoundedIcon />}
            disabled={!selected.length}
            onClick={() => openConfirmDialog({ type: 'bulk', name: 'activate' })}
          >
            Activate
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DeleteRoundedIcon />}
            disabled={!selected.length}
            onClick={() => openConfirmDialog({ type: 'bulk', name: 'deactivate' })}
          >
            Deactivate
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<WarningRoundedIcon />}
            disabled={!selected.length}
            onClick={() => openConfirmDialog({ type: 'bulk', name: 'change-role' }, { role: 'manager' })}
          >
            Promote to manager
          </Button>
        </Stack>
        <Button variant="text" onClick={fetchUsers}>
          Refresh
        </Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      <DataGrid
        autoHeight
        rows={users}
        columns={columns}
        getRowId={(row) => row._id}
        checkboxSelection
        disableRowSelectionOnClick
        selectionModel={selected}
        onSelectionModelChange={(model) => setSelected(model)}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 10 },
          },
        }}
        sx={{
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: 'none',
          },
        }}
      />

      <Dialog open={modalState.open} onClose={closeModal} fullWidth maxWidth="sm" component="form" onSubmit={handleSaveUser}>
        <DialogTitle>{modalState.user ? 'Edit user' : 'Invite user'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                name="email"
                label="Email"
                fullWidth
                required
                defaultValue={modalState.user?.email || ''}
                disabled={!!modalState.user}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="firstName"
                label="First name"
                fullWidth
                defaultValue={modalState.user?.profile?.firstName || ''}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="lastName"
                label="Last name"
                fullWidth
                defaultValue={modalState.user?.profile?.lastName || ''}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                name="role"
                label="Role"
                fullWidth
                defaultValue={modalState.user?.role || 'employee'}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="employee">Employee</MenuItem>
                <MenuItem value="finance">Finance</MenuItem>
                <MenuItem value="executive">Executive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                name="status"
                label="Status"
                fullWidth
                defaultValue={modalState.user?.status || 'active'}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="manager"
                label="Manager email"
                fullWidth
                placeholder="Optional"
DefaultValue={modalState.user?.manager?.email || ''}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                name="receiveEmailNotifications"
                label="Email notifications"
                fullWidth
                defaultValue={modalState.user?.preferences?.receiveEmailNotifications ? 'true' : 'false'}
              >
                <MenuItem value="true">Enabled</MenuItem>
                <MenuItem value="false">Disabled</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Cancel</Button>
          <Button type="submit" variant="contained">
            {modalState.user ? 'Save' : 'Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmState.open} onClose={closeConfirmDialog}>
        <DialogTitle>Confirm action</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {confirmState.action?.type === 'reset'
              ? 'This will generate a temporary password and email the user. Continue?'
              : `Apply this bulk action to ${selected.length} users?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={executeConfirmAction}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activityState.open} onClose={closeActivityDialog} fullWidth maxWidth="sm">
        <DialogTitle>User activity</DialogTitle>
        <DialogContent dividers>
          {activityState.loading && <LinearProgress sx={{ mb: 2 }} />}
          {activityState.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {activityState.error}
            </Alert>
          )}
          {activityState.logs.length === 0 && !activityState.loading ? (
            <Alert severity="info">No recent activity recorded.</Alert>
          ) : (
            <Stack spacing={2}>
              {activityState.logs.map((entry) => (
                <Box key={entry.id}>
                  <Typography variant="subtitle2">
                    {entry.action} • {new Date(entry.performedAt).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Expense: {entry.expense}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActivityDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;
