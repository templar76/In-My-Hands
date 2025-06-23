

// client/src/pages/AcceptInvitationPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const AcceptInvitationPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'succeeded' | 'failed'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token di invito mancante.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, displayName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'accettazione dell\'invito.');
      }
      setSuccess(true);
      setStatus('succeeded');
      // Redirect to login after a short delay
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
      setStatus('failed');
    }
  };

  if (success) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" mt={8}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Account creato con successo! Verrai reindirizzato al login...
        </Alert>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" mt={8}>
      <Typography variant="h4" gutterBottom>
        Accetta Invito
      </Typography>
      {error && (
        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit} width={300}>
        <TextField
          label="Nome e Cognome"
          fullWidth
          margin="normal"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={status === 'loading' || !token}
          sx={{ mt: 2 }}
        >
          {status === 'loading' ? 'Invio...' : 'Accetta Invito'}
        </Button>
      </Box>
      <Button component="a" href="/login" sx={{ mt: 2 }}>
        Torna al Login
      </Button>
    </Box>
  );
};

export default AcceptInvitationPage;