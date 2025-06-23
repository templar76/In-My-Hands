

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { resetPassword } from '../store/authSlice';
import { Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, Link } from '@mui/material';

const ResetPassword = () => {
  const dispatch = useDispatch();
  const { status, error } = useSelector(state => state.auth);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(resetPassword(email));
    if (result.type === 'auth/resetPassword/fulfilled') {
      setSent(true);
    }
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" mt={8}>
      <Typography variant="h4" gutterBottom>
        Recupera Password
      </Typography>
      <Box component="form" onSubmit={handleSubmit} width={300}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {sent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Email di reset inviata! Controlla la tua casella di posta.
          </Alert>
        )}
        <TextField
          label="Email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={status === 'loading'}
          sx={{ mt: 2 }}
        >
          Invia email di reset
        </Button>
      </Box>
      <Link component={RouterLink} to="/login" sx={{ mt: 2 }}>
        Torna al Login
      </Link>
    </Box>
  );
};

export default ResetPassword;