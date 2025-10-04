import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      role: 'employee',
      companyCode: '',
    },
  });

  const onSubmit = handleSubmit(async (formData) => {
    setError(null);
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      login({
        token: 'mock-token',
        user: {
          id: `user-${Date.now()}`,
          email: formData.email,
          role: formData.role,
          name: formData.email.split('@')[0],
        },
        company: {
          code: formData.companyCode || 'DEFAULT-CODE',
          name: 'Demo Company',
          currency: 'USD',
        },
      });

      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError?.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 6, md: 8 },
        px: 2,
        background: (theme) => theme.palette.background.default,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, boxShadow: 8 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" fontWeight={600} gutterBottom>
                Welcome back
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to access your expense dashboard and manage submissions.
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Stack component="form" spacing={2.5} onSubmit={onSubmit} noValidate>
              <Controller
                name="email"
                control={control}
                rules={{ required: 'Email is required.' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="email"
                    label="Work Email"
                    autoComplete="email"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    fullWidth
                  />
                )}
              />

              <Controller
                name="password"
                control={control}
                rules={{
                  required: 'Password is required.',
                  minLength: { value: 6, message: 'Password must be at least 6 characters.' },
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="password"
                    label="Password"
                    autoComplete="current-password"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    fullWidth
                  />
                )}
              />

              <Controller
                name="role"
                control={control}
                rules={{ required: 'Role selection is required.' }}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth error={!!fieldState.error}>
                    <InputLabel id="login-role-label">Role</InputLabel>
                    <Select
                      {...field}
                      labelId="login-role-label"
                      label="Role"
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                        {fieldState.error.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />

              <Controller
                name="companyCode"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Company Code"
                    placeholder="Enter your company code"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    fullWidth
                  />
                )}
              />

              <Button
                type="submit"
                size="large"
                variant="contained"
                fullWidth
                disabled={loading || isSubmitting}
                sx={{ mt: 1.5 }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Signing in...</span>
                  </Box>
                ) : (
                  'Sign In'
                )}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Need an account? <Button variant="text" onClick={() => navigate('/signup')}>Sign up</Button>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
