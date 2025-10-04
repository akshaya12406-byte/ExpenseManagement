import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const ErrorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <Stack spacing={3} maxWidth={480}>
        <Typography variant="h4" fontWeight={700}>
          {state.title || 'Something went wrong'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {state.message ||
            'We ran into an unexpected error while processing your request. Try again or return to the dashboard.'}
        </Typography>
        {state.errorId && (
          <Typography variant="caption" color="text.secondary">
            Error reference: {state.errorId}
          </Typography>
        )}
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </Button>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Try again
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ErrorPage;
