import { createTheme, responsiveFontSizes } from '@mui/material/styles';

let theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    success: { main: '#2e7d32' },
    background: {
      default: '#f7f9fc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2933',
      secondary: '#52606d',
    },
  },
  typography: {
    fontFamily: `'Roboto', 'Helvetica Neue', 'Arial', sans-serif`,
    h1: { fontWeight: 600, fontSize: '2.75rem', lineHeight: 1.2 },
    h2: { fontWeight: 600, fontSize: '2.25rem', lineHeight: 1.25 },
    h3: { fontWeight: 600, fontSize: '1.9rem', lineHeight: 1.3 },
    h4: { fontWeight: 600, fontSize: '1.6rem', lineHeight: 1.35 },
    h5: { fontWeight: 600, fontSize: '1.35rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '1.15rem', lineHeight: 1.45 },
    subtitle1: { fontWeight: 500, fontSize: '1rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.9rem' },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.9rem', lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em' },
  },
  shape: { borderRadius: 12 },
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, padding: '0.6rem 1.5rem' },
        containedPrimary: { boxShadow: 'none' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 16, padding: '1.5rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        colorPrimary: { backgroundColor: '#1976d2' },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: { marginTop: '0.75rem', marginBottom: '0.75rem' },
      },
    },
  },
});

theme = responsiveFontSizes(theme);

export default theme;
