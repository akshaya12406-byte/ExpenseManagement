import { Typography, Box } from '@mui/material';

const SubmitExpensePage = () => (
  <Box sx={{ py: 6, textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>
      Submit Expense
    </Typography>
    <Typography variant="body1">Use this form to submit a new expense.</Typography>
  </Box>
);

export default SubmitExpensePage;
