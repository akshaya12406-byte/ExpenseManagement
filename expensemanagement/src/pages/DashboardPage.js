import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  Button,
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

import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 260;

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
  const [socket, setSocket] = useState(null);

  const menuItems = useMemo(() => roleMenus[user?.role] || roleMenus.employee, [user?.role]);

  useEffect(() => {
    const client = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000', {
      transports: ['websocket'],
      auth: {
        token: localStorage.getItem('expenseManagement.auth')
          ? JSON.parse(localStorage.getItem('expenseManagement.auth')).token
          : null,
      },
    });

    client.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    client.on('notification', (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
    });

    setSocket(client);

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
        <Outlet />
      </Main>
    </Box>
  );
};

export default DashboardPage;
