import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import ExpenseList from '../components/ExpenseList';
import useExpenses from '../hooks/useExpenses';

const ExpensesPage = () => {
  const { data, isLoading, error } = useExpenses();

  const categories = useMemo(
    () => Array.from(new Set((data || []).map((expense) => expense.category).filter(Boolean))).sort(),
    [data],
  );

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700} textTransform="capitalize">
          My expenses
        </Typography>

        {error ? (
          <Alert severity="error">{error.message || 'Failed to load expenses. Please try again.'}</Alert>
        ) : isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ExpenseList expenses={data} isLoading={isLoading} categories={categories} />
        )}
      </Stack>
    </Box>
  );
};

export default ExpensesPage;
