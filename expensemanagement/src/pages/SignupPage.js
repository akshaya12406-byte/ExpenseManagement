import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
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

const DEFAULT_CURRENCIES = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'Pound Sterling (GBP)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
];

const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'employee',
      companyName: '',
      companyCode: '',
      currency: 'USD',
    },
  });

  const role = watch('role');

  const currencyOptions = useMemo(() => DEFAULT_CURRENCIES, []);

  const onSubmit = handleSubmit(async (formData) => {
    setError(null);
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const generatedCompanyCode = formData.companyCode || `COMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const companyDetails =
        formData.role === 'admin'
          ? {
              name: formData.companyName,
              currency: formData.currency,
              code: generatedCompanyCode,
            }
          : {
              name: 'Existing Company',
              currency: 'USD',
              code: formData.companyCode,
            };

      if (formData.role === 'admin' && !formData.companyName) {
        throw new Error('Company name is required for administrators.');
      }

      if (formData.role !== 'admin' && !formData.companyCode) {
        throw new Error('Company code is required for managers and employees.');
      }

      login({
        token: 'mock-signup-token',
        user: {
          id: `user-${Date.now()}`,
          email: formData.email,
          role: formData.role,
          name: formData.fullName,
        },
        company: companyDetails,
      });

      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError?.message || 'Unable to complete signup. Please try again.');
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
      <Card sx={{ width: '100%', maxWidth: 560, boxShadow: 8 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" fontWeight={600} gutterBottom>
                Create your account
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Set up access to manage and track company expenses seamlessly.
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="fullName"
                    control={control}
                    rules={{ required: 'Full name is required.' }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Full Name"
                        autoComplete="name"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
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
                </Grid>
                <Grid item xs={12} sm={6}>
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
                        autoComplete="new-password"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="role"
                    control={control}
                    rules={{ required: 'Role selection is required.' }}
                    render={({ field, fieldState }) => (
                      <FormControl fullWidth error={!!fieldState.error}>
                        <InputLabel id="signup-role-label">Role</InputLabel>
                        <Select
                          {...field}
                          labelId="signup-role-label"
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
                </Grid>
              </Grid>

              {role === 'admin' ? (
                <Stack spacing={2}>
                  <Controller
                    name="companyName"
                    control={control}
                    rules={{ required: 'Company name is required for admins.' }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Company Name"
                        placeholder="Enter your company name"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                      />
                    )}
                  />

                  <Controller
                    name="currency"
                    control={control}
                    rules={{ required: 'Select a currency for your company.' }}
                    render={({ field, fieldState }) => (
                      <FormControl fullWidth error={!!fieldState.error}>
                        <InputLabel id="currency-label">Preferred Currency</InputLabel>
                        <Select
                          {...field}
                          labelId="currency-label"
                          label="Preferred Currency"
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                        >
                          {currencyOptions.map((currency) => (
                            <MenuItem key={currency.value} value={currency.value}>
                              {currency.label}
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
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Company Code (optional)"
                        placeholder="Auto-generated if left blank"
                        fullWidth
                      />
                    )}
                  />
                </Stack>
              ) : (
                <Controller
                  name="companyCode"
                  control={control}
                  rules={{ required: 'Company code is required to join your organization.' }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Company Code"
                      placeholder="Enter the code provided by your admin"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      fullWidth
                    />
                  )}
                />
              )}

              <Button
                type="submit"
                size="large"
                variant="contained"
                fullWidth
                disabled={loading || isSubmitting}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Creating account...</span>
                  </Box>
                ) : (
                  'Create account'
                )}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Already have an account?{' '}
              <Button variant="text" onClick={() => navigate('/login')}>
                Log in
              </Button>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SignupPage;
