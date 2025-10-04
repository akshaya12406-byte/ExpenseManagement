import { Component } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Stack, Typography } from '@mui/material';

import logger from '../utils/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('React render error', { error, errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          role="alert"
          sx={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            px: 3,
          }}
        >
          <Stack spacing={2} maxWidth={420}>
            <Typography variant="h4" fontWeight={700}>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary">
              An unexpected error occurred. You can try again, or contact support if the problem persists.
            </Typography>
            {this.props.fallback}
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="contained" onClick={this.handleRetry}>
                Retry
              </Button>
              {this.props.onNavigateHome && (
                <Button variant="outlined" onClick={this.props.onNavigateHome}>
                  Go to dashboard
                </Button>
              )}
            </Stack>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <Box sx={{ mt: 3, textAlign: 'left' }}>
                <Typography variant="subtitle2">Debug details:</Typography>
                <Typography
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    p: 2,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                  }}
                >
                  {this.state.error?.stack || this.state.error?.message}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.node,
  onError: PropTypes.func,
  onRetry: PropTypes.func,
  onNavigateHome: PropTypes.func,
};

export default ErrorBoundary;
