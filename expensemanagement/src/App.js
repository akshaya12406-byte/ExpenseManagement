import { Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { ThemeProvider, CssBaseline, Container, CircularProgress } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import theme from './theme';
import ErrorBoundary from './components/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const SubmitExpensePage = lazy(() => import('./pages/SubmitExpensePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ErrorPage = lazy(() => import('./pages/ErrorPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const Layout = ({ children }) => (
  <Container maxWidth="lg" sx={{ py: 4 }}>
    {children}
  </Container>
);

Layout.propTypes = {
  children: PropTypes.node,
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense
            fallback={(
              <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
              </Container>
            )}
          >
            <Layout>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/submit-expense" element={<SubmitExpensePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/error" element={<ErrorPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
