// client/src/pages/CompleteTenantRegistrationPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, TextField, Button, Alert, Grid, Paper, CircularProgress } from '@mui/material';
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const API_URL = getApiUrl();

const CompleteTenantRegistrationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    companyType: '',
    companyName: '',
    vatNumber: '',
    address: '',
    codiceFiscale: '', // Aggiungi questo campo
    contacts: {
      email: '',
      phone: '',
      sdiCode: '',
      pec: '',
    },
    admin: {
      displayName: '',
      password: '',
    },
  });
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'succeeded' | 'failed'
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

  useEffect(() => {
    if (!token) {
      setMessage({ type: 'error', text: 'Token di registrazione mancante o non valido. Richiedi un nuovo link di registrazione.' });
      setStatus('failed');
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      contacts: {
        ...prev.contacts,
        [name]: value,
      },
    }));
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      admin: {
        ...prev.admin,
        [name]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setMessage({ type: 'error', text: 'Token non fornito.' });
      return;
    }
    setStatus('loading');
    setMessage(null);

    const payload = {
      token,
      ...formData,
    };

    try {
      const response = await fetch(`${API_URL}/api/auth/complete-tenant-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Errore ${response.status}: ${response.statusText}`);
      }

      setStatus('succeeded');
      setMessage({ type: 'success', text: data.message || 'Registrazione completata con successo! Verrai reindirizzato al login.' });
      setTimeout(() => navigate('/login'), 5000);
    } catch (err) {
      console.error('Complete registration error:', err);
      setStatus('failed');
      setMessage({ type: 'error', text: err.message || 'Si è verificato un errore durante il completamento della registrazione.' });
    }
  };

  if (status === 'succeeded') {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ mt: 8, p: 3 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
          <Typography variant="h5" gutterBottom align="center">Registrazione Completata!</Typography>
          {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}
          <Button component={RouterLink} to="/login" variant="contained" fullWidth sx={{ mt: 2 }}>
            Vai al Login
          </Button>
        </Paper>
      </Box>
    );
  }
  
  if (!token && status === 'failed') {
     return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ mt: 8, p: 3 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
          <Typography variant="h5" gutterBottom align="center">Errore Token</Typography>
          {message && <Alert severity={message.type}>{message.text}</Alert>}
           <Button component={RouterLink} to="/register" variant="outlined" fullWidth sx={{ mt: 2 }}>
            Richiedi un nuovo link
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box display="flex" justifyContent="center" sx={{ mt: 4, mb: 4, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 700, width: '100%' }}>
        <Typography variant="h4" gutterBottom align="center">
          Completa Registrazione Tenant
        </Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid xs={12}>
              <Typography variant="h6" gutterBottom>Dati Azienda</Typography>
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="companyName" label="Nome Azienda" value={formData.companyName} onChange={handleChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="companyType" label="Tipo Azienda (es. SRL, SPA)" value={formData.companyType} onChange={handleChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="vatNumber" label="Partita IVA" value={formData.vatNumber} onChange={handleChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="codiceFiscale" label="Codice Fiscale" value={formData.codiceFiscale} onChange={handleChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="address" label="Indirizzo Sede Legale" value={formData.address} onChange={handleChange} fullWidth required />
            </Grid>

            <Grid xs={12} sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Contatti Azienda</Typography>
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="email" label="Email Aziendale" type="email" value={formData.contacts.email} onChange={handleContactChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="phone" label="Telefono Aziendale" value={formData.contacts.phone} onChange={handleContactChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="pec" label="PEC" type="email" value={formData.contacts.pec} onChange={handleContactChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="sdiCode" label="Codice SDI" value={formData.contacts.sdiCode} onChange={handleContactChange} fullWidth required />
            </Grid>

            <Grid xs={12} sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Dati Amministratore Tenant</Typography>
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="displayName" label="Nome e Cognome Admin" value={formData.admin.displayName} onChange={handleAdminChange} fullWidth required />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField name="password" label="Password Admin" type="password" value={formData.admin.password} onChange={handleAdminChange} fullWidth required helperText="Minimo 6 caratteri" />
            </Grid>
          </Grid>

          {message && (
            <Alert severity={message.type} sx={{ mt: 3, mb: 2 }}>
              {message.text}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={status === 'loading' || !token}
            sx={{ mt: 3 }}
          >
            {status === 'loading' ? <CircularProgress size={24} /> : 'Completa Registrazione'}
          </Button>
          {status !== 'loading' && (
             <Button component={RouterLink} to="/login" variant="outlined" fullWidth sx={{ mt: 1 }}>
                Annulla e vai al Login
            </Button>
          )}
        </form>
      </Paper>
    </Box>
  );
};

export default CompleteTenantRegistrationPage;