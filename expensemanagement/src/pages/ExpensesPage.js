import { Typography, Box } from '@mui/material';

const ExpensesPage = () => (
  <Box sx={{ py: 6, textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>
      Expenses
    </Typography>
    <Typography variant="body1">List of submitted expenses will appear here.</Typography>
  </Box>
);

export default ExpensesPage;
