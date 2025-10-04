import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setUser(stored.user ?? null);
      setToken(stored.token ?? null);
      setCompany(stored.company ?? null);
    }
  }, []);

  useEffect(() => {
    writeStoredAuth({ user, token, company });
  }, [user, token, company]);

  const login = useCallback(({ token: nextToken, user: nextUser, company: nextCompany }) => {
    setToken(nextToken ?? null);
    setUser(nextUser ?? null);
    setCompany(nextCompany ?? null);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setCompany(null);
  }, []);

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

  const value = useMemo(
    () => ({
      user,
      token,
      company,
      isAuthenticated,
      login,
      logout,
      setCompany,
      hasRole,
      hasPermission,
    }),
    [company, hasPermission, hasRole, isAuthenticated, login, logout, token, user],
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
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (roles && roles.length > 0 && (!user?.role || !roles.includes(user.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AuthContext;
