import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

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
      <Stack spacing={3} maxWidth={460}>
        <Typography variant="h2" fontWeight={800} color="primary">
          404
        </Typography>
        <Typography variant="h5" fontWeight={600}>
          The page you are looking for does not exist.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          It may have been moved or deleted. Check the URL or return to the dashboard.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </Button>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default NotFoundPage;
