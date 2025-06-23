import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const NotFound = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    height="100vh"
    textAlign="center"
    p={2}
  >
    <Typography variant="h3" gutterBottom>
      404 - Pagina non trovata
    </Typography>
    <Typography variant="body1" gutterBottom>
      La pagina che stai cercando non esiste.
    </Typography>
    <Button
      component={RouterLink}
      to="/dashboard"
      variant="contained"
    >
      Torna alla Dashboard
    </Button>
  </Box>
);

export default NotFound;
