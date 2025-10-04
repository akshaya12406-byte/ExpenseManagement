import { Typography, Box } from '@mui/material';

const DashboardPage = () => (
  <Box sx={{ py: 6, textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>
      Dashboard
    </Typography>
    <Typography variant="body1">Overview of expenses and insights.</Typography>
  </Box>
);

export default DashboardPage;
