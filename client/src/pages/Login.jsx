import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../store/authSlice';
import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Link } from '@mui/material';
import Alert from '@mui/material/Alert';

// Map Firebase errors to user-friendly messages
const getFriendlyError = (firebaseMessage) => {
  if (firebaseMessage.includes('auth/invalid-email')) {
    return 'Indirizzo email non valido.';
  }
  if (firebaseMessage.includes('auth/user-not-found')) {
    return 'Email non trovata. Verifica l’indirizzo o registrati.';
  }
  if (
    firebaseMessage.includes('auth/wrong-password') ||
    firebaseMessage.includes('auth/invalid-credential')
  ) {
    return 'Email o password errati. Riprova.';
  }
  // fallback generico
  return 'Si è verificato un errore durante il login. Riprova più tardi.';
};

const Login = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, status, error } = useSelector(state => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = e => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" mt={8}>
      <Typography variant="h4" gutterBottom>Login</Typography>
      <Box component="form" onSubmit={handleSubmit} width={300}>
        <TextField
          label="Email"
          fullWidth
          margin="normal"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {getFriendlyError(error)}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={status === 'loading'}
          sx={{ mt: 2 }}
        >
          Accedi
        </Button>
      </Box>
      <Link component={RouterLink} to="/register" sx={{ mt: 2 }}>
        Non hai un account? Registrati
      </Link>
      <Link component={RouterLink} to="/reset-password" sx={{ mt: 1 }}>
        Hai dimenticato la password?
      </Link>
    </Box>
  );
};

export default Login;
