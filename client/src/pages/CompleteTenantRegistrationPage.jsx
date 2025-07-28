import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Grid, Alert, CircularProgress } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { getApiUrl } from '../utils/apiConfig';

const CompleteTenantRegistrationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const API_URL = getApiUrl();
  const [formData, setFormData] = useState({
    companyType: '',
    companyName: '',
    vatNumber: '',
    codiceFiscale: '',
    address: '',
    contacts: { email: '', phone: '', sdiCode: '', pec: '' },
    admin: { displayName: '', password: '' }
  });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState(null);
  const [token, setToken] = useState('');

  const [step, setStep] = useState(1); // 1: search, 2: form
  const [searchValue, setSearchValue] = useState('');
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const tokenParam = query.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setMessage({ type: 'error', text: 'Token non valido o mancante.' });
    }
  }, [location.search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      contacts: { ...prev.contacts, [name]: value }
    }));
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      admin: { ...prev.admin, [name]: value }
    }));
  };

  const handleFetch = async () => {
    setFetchError(null);
    if (!searchValue) {
      setFetchError('Inserisci P.IVA o Codice Fiscale.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/auth/fetch-company-data?vatCode_taxCode_or_id=${searchValue}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      setFormData(prev => ({
        ...prev,
        companyName: data.data.companyName || '',
        vatNumber: data.data.vatNumber || '',
        codiceFiscale: data.data.codiceFiscale || '',
        address: data.data.address || '',
        contacts: { ...prev.contacts, sdiCode: data.data.sdiCode || '' }
      }));
      setStep(2);
    } catch (err) {
      setFetchError(err.message || 'Errore nel recupero dati. Riprova o inserisci manualmente.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/complete-tenant-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, token })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante la registrazione.');
      }

      setMessage({ type: 'success', text: 'Registrazione completata con successo!' });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setStatus('idle');
    }
  };

  if (step === 1) {
    return (
      <Box display="flex" justifyContent="center" sx={{ mt: 4, mb: 4, p: 2 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
          <Typography variant="h5" gutterBottom align="center">Recupera Dati Azienda</Typography>
          <TextField
            label="P.IVA o Codice Fiscale"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}
          <Button variant="contained" onClick={handleFetch} fullWidth sx={{ mb: 1 }}>Recupera</Button>
          <Button variant="outlined" onClick={() => setStep(2)} fullWidth>Inserisci Manualmente</Button>
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