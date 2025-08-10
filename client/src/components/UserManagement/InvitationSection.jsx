import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Select, MenuItem, Alert, FormControl, InputLabel, IconButton, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { auth } from '../../firebase';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QRCode from 'react-qr-code';
import { getApiUrl } from '../../utils/apiConfig';

// Aggiungi import in cima al file
import ClientLogger from '../../utils/ClientLogger';

const API_URL = getApiUrl();

const InvitationSection = ({ tenantId, onInvitationSent, isLoading }) => {
  const [email, setEmail] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [role, setRole] = useState('operator');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);
  const [mode, setMode] = useState('email');

  // Verifica se l'email esiste già nel tenant
  const checkEmail = async (addr) => {
    if (!tenantId || !addr) return;
    setCheckingEmail(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Utente non autenticato');
      const token = await user.getIdToken();
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
        setEmailExists(false);
        return;
      }

      const res = await fetch(
        `${API_URL}/api/tenants/${tenantId}/users/check?email=${encodeURIComponent(addr)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Errore durante la verifica email');
      }

      const data = await res.json();
      setEmailExists(data.exists);
    } catch (err) {
      ClientLogger.error('checkEmail error:', { error: err.message, email: addr, tenantId });
      setEmailExists(false);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId) {
      setMessage({ type: 'error', text: 'ID Tenant non è ancora disponibile. Attendere prego e riprovare.' });
      setStatus('failed');
      return;
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      setMessage({ type: 'error', text: 'L\'email dell\'operatore è obbligatoria e non può essere vuota.' });
      setStatus('failed');
      return;
    }
    if (!role || typeof role !== 'string' || role.trim() === '') {
      setMessage({ type: 'error', text: 'Il ruolo è obbligatorio e non può essere vuoto.' });
      setStatus('failed');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Utente non autenticato');
      const token = await user.getIdToken();
      
      const payload = { emails: [email.trim()], role: role.trim() };

      const res = await fetch(`${API_URL}/api/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante l\'invio dell\'invito');
      }

      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      
      if (result.emailSent === false && result.error) {
        setStatus('failed');
        setMessage({
          type: 'error',
          text: `Errore nell'invio dell'invito: ${result.error}`
        });
        return;
      }
      
      if (result.emailSent === false) {
        setStatus('succeeded');
        setMessage({
          type: 'warning',
          text: 'Invito creato ma non è stato possibile inviare l\'email. Utilizza il link o QR code per condividere l\'invito.'
        });
      } else {
        setStatus('succeeded');
        setMessage({
          type: 'success',
          text: mode === 'email' 
            ? 'Invito inviato via email con successo!' 
            : 'Invito generato con successo!'
        });
      }
      
      if (result.inviteUrl) {
        const urlParams = new URLSearchParams(new URL(result.inviteUrl).search);
        const token = urlParams.get('token');
        if (token) {
          setInviteToken(token);
        }
      } else if (result.token) {
        setInviteToken(result.token);
      }
      
      // Reset form
      setEmail('');
      setRole('operator');
      setEmailExists(false);
      setCheckingEmail(false);
      
      // Notifica il componente padre che è stato inviato un invito
      if (onInvitationSent) {
        onInvitationSent();
      }
      
    } catch (err) {
      setStatus('failed');
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCopyLink = () => {
    if (inviteToken) {
      const inviteLink = `${window.location.origin}/accept-invitation?token=${inviteToken}`;
      navigator.clipboard.writeText(inviteLink)
        .then(() => setMessage({ type: 'success', text: 'Link copiato negli appunti!' }))
        .catch(() => setMessage({ type: 'error', text: 'Errore nel copiare il link.' }));
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Crea Nuovo Invito
      </Typography>
      
      {isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Caricamento dati tenant in corso. Attendere prego...
        </Alert>
      )}
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email destinatario"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (e.target.value) {
              checkEmail(e.target.value);
            }
          }}
          margin="normal"
          required
          error={emailExists}
          helperText={emailExists ? 'Questa email è già registrata nel tenant' : ''}
        />

        <FormControl fullWidth margin="normal">
          <InputLabel>Ruolo</InputLabel>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            label="Ruolo"
          >
            <MenuItem value="operator">Operatore</MenuItem>
            <MenuItem value="admin">Amministratore</MenuItem>
          </Select>
        </FormControl>

        <FormControl component="fieldset" margin="normal">
          <Typography variant="subtitle1" gutterBottom>
            Modalità di invio
          </Typography>
          <RadioGroup
            row
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <FormControlLabel value="email" control={<Radio />} label="Email" />
            <FormControlLabel value="link" control={<Radio />} label="Link" />
            <FormControlLabel value="qr" control={<Radio />} label="QR Code" />
          </RadioGroup>
        </FormControl>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={status === 'loading' || emailExists || checkingEmail || isLoading}
          sx={{ mt: 2 }}
        >
          {status === 'loading' ? 'Invio in corso...' : isLoading ? 'Caricamento...' : 'Invia Invito'}
        </Button>
      </form>

      {/* Visualizzazione risultato invito */}
      {status === 'succeeded' && inviteToken && (
        <Box mt={3} p={2} border={1} borderColor="grey.300" borderRadius={1}>
          <Typography variant="h6" gutterBottom>
            Invito Generato
          </Typography>
          
          {mode === 'link' && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Link di invito:
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                  fullWidth
                  value={`${window.location.origin}/accept-invitation?token=${inviteToken}`}
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                <IconButton onClick={handleCopyLink}>
                  <ContentCopyIcon />
                </IconButton>
              </Box>
            </Box>
          )}
          
          {mode === 'qr' && (
            <Box textAlign="center">
              <Typography variant="body2" gutterBottom>
                QR Code per l'invito:
              </Typography>
              <QRCode
                value={`${window.location.origin}/accept-invitation?token=${inviteToken}`}
                size={200}
              />
              <Box mt={1}>
                <Button onClick={handleCopyLink} startIcon={<ContentCopyIcon />}>
                  Copia Link
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default InvitationSection;