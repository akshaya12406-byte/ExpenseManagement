import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  DashboardCustomizeRounded,
  LogoutRounded,
  MenuRounded,
  NotificationsRounded,
  PaidRounded,
  PeopleAltRounded,
  ReceiptLongRounded,
  SettingsRounded,
  TaskRounded,
} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';
import { io } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 260;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Legend);

const roleMenus = {
  admin: [
    { label: 'Dashboard', icon: <DashboardCustomizeRounded />, path: '/dashboard' },
    { label: 'Manage Users', icon: <PeopleAltRounded />, path: '/admin/users' },
    { label: 'Expenses', icon: <ReceiptLongRounded />, path: '/expenses' },
    { label: 'Approvals', icon: <TaskRounded />, path: '/admin/approvals' },
    { label: 'Settings', icon: <SettingsRounded />, path: '/admin/settings' },
  ],
  manager: [
    { label: 'Dashboard', icon: <DashboardCustomizeRounded />, path: '/dashboard' },
    { label: 'Team Expenses', icon: <ReceiptLongRounded />, path: '/expenses/team' },
    { label: 'Approvals', icon: <TaskRounded />, path: '/manager/approvals' },
    { label: 'Reports', icon: <PaidRounded />, path: '/manager/reports' },
  ],
  employee: [
    { label: 'Dashboard', icon: <DashboardCustomizeRounded />, path: '/dashboard' },
    { label: 'My Expenses', icon: <ReceiptLongRounded />, path: '/expenses' },
    { label: 'Submit Expense', icon: <PaidRounded />, path: '/submit-expense' },
  ],
};

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  background: theme.palette.background.default,
  minHeight: '100vh',
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 2),
}));

const DashboardPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { user, logout, sessionExpired } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    monthTotal: {
      amount: 0,
      currency: 'USD',
      convertedAmount: 0,
      convertedCurrency: 'USD',
      rate: 1,
    },
    pendingApprovals: 0,
    budgetUtilization: 0,
    recentExpenses: [],
    trend: [],
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const menuItems = useMemo(() => roleMenus[user?.role] || roleMenus.employee, [user?.role]);
  const apiBase = useMemo(() => process.env.REACT_APP_API_URL || 'http://localhost:4000/api', []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const fallbackData = {
      monthTotal: {
        amount: 23850,
        currency: 'USD',
        convertedAmount: 23850,
        convertedCurrency: 'USD',
        rate: 1,
      },
      pendingApprovals: user?.role === 'manager' || user?.role === 'admin' ? 5 : 0,
      budgetUtilization: 62,
      recentExpenses: [
        {
          id: 'exp-1',
          employeeName: 'Alex Johnson',
          amount: 450.25,
          currency: 'USD',
          status: 'submitted',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'exp-2',
          employeeName: 'Maria Gomez',
          amount: 120.9,
          currency: 'USD',
          status: 'approved',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        },
      ],
      trend: Array.from({ length: 7 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return {
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          amount: 1500 + index * 320,
        };
      }),
    };

    const fetchDashboardData = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch(`${apiBase}/dashboard/summary`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const data = await response.json();

        if (!active) return;

        setStats({
          monthTotal: data.monthTotal || fallbackData.monthTotal,
          pendingApprovals:
            typeof data.pendingApprovals === 'number'
              ? data.pendingApprovals
              : fallbackData.pendingApprovals,
          budgetUtilization:
            typeof data.budgetUtilization === 'number'
              ? data.budgetUtilization
              : fallbackData.budgetUtilization,
          recentExpenses: Array.isArray(data.recentExpenses)
            ? data.recentExpenses
            : fallbackData.recentExpenses,
          trend: Array.isArray(data.trend) ? data.trend : fallbackData.trend,
        });
      } catch (error) {
        if (active) {
          setStats(fallbackData);
        }
      } finally {
        if (active) {
          setIsLoadingStats(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [apiBase, user?.role]);

  useEffect(() => {
    const storedAuth = (() => {
      try {
        const raw = localStorage.getItem('expenseManagement.auth');
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn('Failed to parse stored auth state', error);
        return null;
      }
    })();

    const client = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000', {
      transports: ['websocket'],
      auth: {
        token: storedAuth?.token || storedAuth?.accessToken || null,
      },
    });

    client.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    client.on('notification', (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
    });

    client.on('expense:new', (expense) => {
      setStats((prev) => {
        const recentExpenses = [
          {
            id: expense._id || `temp-${Date.now()}`,
            employeeName:
              expense.employeeName || expense.employee?.name || expense.employee?.email || 'Team member',
            amount: Number(expense.amount) || 0,
            currency: expense.currency || prev.monthTotal.currency,
            status: expense.status || 'submitted',
            createdAt: expense.createdAt || new Date().toISOString(),
          },
          ...prev.recentExpenses,
        ].slice(0, 6);

        const monthTotal = {
          ...prev.monthTotal,
          amount: prev.monthTotal.amount + (Number(expense.amount) || 0),
          convertedAmount:
            prev.monthTotal.convertedAmount + (Number(expense.convertedAmount) || Number(expense.amount) || 0),
        };

        const trendLabels = prev.trend.map((point) => point.label);
        const todayLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        let trendUpdated = false;
        const trend = prev.trend.map((point) => {
          if (point.label === todayLabel) {
            trendUpdated = true;
            return {
              ...point,
              amount: point.amount + (Number(expense.amount) || 0),
            };
          }
          return point;
        });

        if (!trendUpdated) {
          trend.push({ label: todayLabel, amount: Number(expense.amount) || 0 });
        }

        return {
          ...prev,
          monthTotal,
          pendingApprovals:
            prev.pendingApprovals + (expense.status === 'submitted' ? 1 : 0),
          recentExpenses,
          trend: trend.slice(-12),
        };
      });
    });

    return () => {
      client.disconnect();
    };
  }, []);

  useEffect(() => {
    if (sessionExpired) {
      navigate('/login', { replace: true, state: { reason: 'session_expired' } });
    }
  }, [sessionExpired, navigate]);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DrawerHeader>
        <Typography variant="h6" fontWeight={600}>
          ExpensePro
        </Typography>
      </DrawerHeader>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton key={item.label} onClick={() => handleNavigate(item.path)}>
            <ListItemIcon sx={{ color: 'text.primary' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          onClick={() => logout()}
          variant="outlined"
          color="secondary"
          startIcon={<LogoutRounded />}
          fullWidth
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );

  const drawerVariant = isMobile ? 'temporary' : 'permanent';

  const formatCurrency = (amount, currency) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount || 0);

  const spendingTrendData = useMemo(
    () => ({
      labels: stats.trend.map((point) => point.label),
      datasets: [
        {
          label: 'Spending',
          data: stats.trend.map((point) => point.amount),
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.light,
          tension: 0.3,
          fill: false,
          pointRadius: 4,
        },
      ],
    }),
    [stats.trend, theme.palette.primary.main, theme.palette.primary.light],
  );

  const spendingTrendOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => `${formatCurrency(context.parsed.y, stats.monthTotal.currency)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: theme.palette.text.secondary,
          },
        },
        y: {
          ticks: {
            color: theme.palette.text.secondary,
          },
          grid: {
            color: theme.palette.divider,
          },
        },
      },
    }),
    [stats.monthTotal.currency, theme.palette.divider, theme.palette.text.secondary],
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuRounded />
            </IconButton>
            <Typography variant="h6" fontWeight={600}>
              {menuItems[0]?.label || 'Dashboard'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Notifications">
              <IconButton color="primary" onClick={() => navigate('/dashboard/notifications')}>
                <Badge color="secondary" badgeContent={notifications.length} max={99}>
                  <NotificationsRounded />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.email || 'Profile'}>
              <Avatar alt={user?.profile?.firstName || user?.email} src={user?.profile?.avatarUrl} />
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={drawerVariant}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Main>
        <Toolbar />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }} elevation={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total expenses this month
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {formatCurrency(stats.monthTotal.amount, stats.monthTotal.currency)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Converted: {formatCurrency(stats.monthTotal.convertedAmount, stats.monthTotal.convertedCurrency)} (rate {stats.monthTotal.rate.toFixed(2)})
              </Typography>
            </Paper>
          </Grid>

          {(user?.role === 'manager' || user?.role === 'admin') && (
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: '100%' }} elevation={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Pending approvals
                </Typography>
                <Typography variant="h4" fontWeight={600}>
                  {stats.pendingApprovals}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Approvals awaiting action across your team
                </Typography>
              </Paper>
            </Grid>
          )}

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }} elevation={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Budget utilization
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {Math.round(stats.budgetUtilization)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, stats.budgetUtilization))}
                sx={{ mt: 2, height: 10, borderRadius: 5 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Based on allocated departmental budgets
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: 360 }} elevation={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Spending trends
                </Typography>
                <Chip label="Last 7 days" size="small" />
              </Box>
              <Box sx={{ position: 'relative', height: '100%' }}>
                {isLoadingStats ? (
                  <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Loading trends...
                    </Typography>
                  </Box>
                ) : (
                  <Line data={spendingTrendData} options={spendingTrendOptions} />
                )}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: 360, display: 'flex', flexDirection: 'column' }} elevation={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Recent expenses
                </Typography>
                <Chip label={`${stats.recentExpenses.length}`} size="small" color="primary" />
              </Box>
              <List sx={{ overflowY: 'auto', flexGrow: 1 }}>
                {stats.recentExpenses.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No recent expenses" secondary="Your team's activity will appear here." />
                  </ListItem>
                ) : (
                  stats.recentExpenses.map((expense) => (
                    <ListItem key={expense.id} divider disableGutters>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {expense.employeeName}
                            </Typography>
                            <Typography variant="subtitle2" color="text.primary">
                              {formatCurrency(expense.amount, expense.currency || stats.monthTotal.currency)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(expense.createdAt).toLocaleString()}
                            </Typography>
                            <Chip label={expense.status} size="small" color="default" />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Outlet />
        </Box>
      </Main>
    </Box>
  );
};

export default DashboardPage;
