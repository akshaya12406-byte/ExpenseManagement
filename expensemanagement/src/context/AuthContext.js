import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';

const STORAGE_KEY = 'expenseManagement.auth';

const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'view_reports', 'approve_expenses', 'submit_expenses'],
  manager: ['view_reports', 'approve_expenses', 'submit_expenses'],
  employee: ['submit_expenses'],
};

const AuthContext = createContext(null);

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse stored auth state', error);
    return null;
  }
};

const writeStoredAuth = (state) => {
  try {
    if (!state || (!state.token && !state.user)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist auth state', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [company, setCompany] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setUser(stored.user ?? null);
      setToken(stored.token ?? null);
      setCompany(stored.company ?? null);
      setExpiresAt(stored.expiresAt ?? null);
      setSessionExpired(false);
    }
    setIsInitializing(false);
  }, []);

  const login = useCallback(({ token: nextToken, user: nextUser, company: nextCompany, expiresAt: nextExpiresAt }) => {
    if (!nextToken) {
      setToken(null);
      setUser(null);
      setCompany(null);
      setExpiresAt(null);
      setSessionExpired(false);
      return;
    }

    const expiryTimestamp = nextExpiresAt ?? Date.now() + 1000 * 60 * 60; // default 1h session
    setToken(nextToken);
    setUser(nextUser ?? null);
    setCompany(nextCompany ?? null);
    setExpiresAt(expiryTimestamp);
    setSessionExpired(false);
  }, []);

  const logout = useCallback((options = {}) => {
    setToken(null);
    setUser(null);
    setCompany(null);
    setExpiresAt(null);
    setSessionExpired(options.reason === 'session_expired');
  }, []);

  useEffect(() => {
    writeStoredAuth({ user, token, company, expiresAt });
  }, [user, token, company, expiresAt]);

  const isAuthenticated = Boolean(token);

  const hasRole = useCallback(
    (roles) => {
      if (!roles || roles.length === 0) return true;
      return roles.includes(user?.role);
    },
    [user?.role],
  );

  const hasPermission = useCallback(
    (permission) => {
      if (!user?.role) return false;
      const permissions = ROLE_PERMISSIONS[user.role] ?? [];
      if (Array.isArray(permission)) {
        return permission.every((perm) => permissions.includes(perm));
      }
      return permissions.includes(permission);
    },
    [user?.role],
  );

  const isTokenExpired = useCallback(() => {
    if (!token || !expiresAt) return false;
    return Date.now() >= expiresAt;
  }, [token, expiresAt]);

  useEffect(() => {
    if (!token || !expiresAt) return undefined;

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      logout({ reason: 'session_expired' });
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      logout({ reason: 'session_expired' });
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [token, expiresAt, logout]);

  useEffect(() => {
    if (!isInitializing && isTokenExpired()) {
      logout({ reason: 'session_expired' });
    }
  }, [isInitializing, isTokenExpired, logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      company,
      expiresAt,
      isAuthenticated,
      isInitializing,
      login,
      logout,
      setCompany,
      hasRole,
      hasPermission,
      isTokenExpired,
      sessionExpired,
    }),
    [
      company,
      expiresAt,
      hasPermission,
      hasRole,
      isAuthenticated,
      isInitializing,
      isTokenExpired,
      login,
      logout,
      sessionExpired,
      token,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const ProtectedRoute = ({ children, roles, redirectTo = '/login' }) => {
  const { isAuthenticated, hasRole, isInitializing, sessionExpired } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <Box
        sx={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    const state = { from: location };
    if (sessionExpired) {
      state.reason = 'session_expired';
    }
    return <Navigate to={redirectTo} replace state={state} />;
  }

  if (roles && roles.length > 0 && !hasRole(roles)) {
    return <Navigate to="/dashboard" replace state={{ from: location, reason: 'forbidden' }} />;
  }

  return children;
};

export default AuthContext;
