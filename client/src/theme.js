import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#3F51B5' },   // indaco
    secondary: { main: '#E91E63' }, // rosa tenue
    background: { default: '#F5F5F5' }
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
  },
});

export default theme;