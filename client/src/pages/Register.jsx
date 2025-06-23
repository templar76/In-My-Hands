import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { signInWithGoogle } from '../store/authSlice'; // registerUser non è più usato qui direttamente
import { Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Link } from '@mui/material';
import Alert from '@mui/material/Alert';
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const Register = () => {
  const dispatch = useDispatch();
  // isAuthenticated non è più rilevante qui per il reindirizzamento immediato
  // status ed error gestiranno lo stato della richiesta di avvio registrazione
  const { status } = useSelector(state => state.auth); 
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null); // Per messaggi di successo/errore specifici di questa fase

  const getFriendlyError = (apiError) => {
    // Questa funzione ora gestirà errori dall'API backend, non più direttamente da Firebase
    if (apiError && apiError.error) {
        if (apiError.error.includes('Un utente con questa email esiste già')) {
            return 'Un utente con questa email esiste già. Prova a fare il login.';
        }
        if (apiError.error.includes('Una richiesta di registrazione per questa email è già in corso')) {
            return 'Una richiesta di registrazione per questa email è già in corso. Controlla la tua email.';
        }
        return apiError.error; // Messaggio di errore generico dall'API
    }
    if (typeof apiError === 'string') return apiError; // Se è già una stringa
    return 'Si è verificato un errore durante la richiesta di registrazione. Riprova più tardi.';
  };

  // Rimuoviamo il redirect basato su isAuthenticated perché la registrazione non autentica immediatamente
  // if (isAuthenticated) return <Navigate to="/dashboard" replace />; 

  const API_URL = getApiUrl(); 

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage(null); // Resetta messaggi precedenti
    // Non inviamo più a registerUser di authSlice, ma direttamente all'API
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, { // Modifica questa linea
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email, plan: 'free' }), // Invia email e piano
      });
      const data = await response.json();
      if (!response.ok) {
        throw data; // Lancia l'oggetto errore dall'API
      }
      setMessage({ type: 'success', text: data.message || 'Email di conferma inviata. Controlla la tua casella di posta.' });
      setEmail(''); // Pulisci il campo email dopo il successo
    } catch (err) {
      console.error('Registration initiation error:', err);
      const friendlyError = getFriendlyError(err);
      setMessage({ type: 'error', text: friendlyError });
    }
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" mt={8}>
      <Typography variant="h4" gutterBottom>Registra la tua Azienda</Typography>
      <Box component="form" onSubmit={handleSubmit} width={300}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Piano Free (365 giorni)
        </Typography>
        <TextField
          label="La tua Email"
          fullWidth
          margin="normal"
          value={email}
          onChange={e => setEmail(e.target.value)}
          helperText="Riceverai un link per completare la registrazione."
        />
        {/* Mostra messaggi di successo o errore specifici per questa fase */} 
        {message && (
          <Alert severity={message.type} sx={{ width: '100%', mb: 2 }}>
            {message.text}
          </Alert>
        )}
        {/* L'errore globale da authSlice potrebbe non essere più rilevante qui se gestiamo tutto localmente */}
        {/* error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {getFriendlyError(error)}
          </Alert>
        )*/}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={status === 'loading'} // Potremmo usare uno stato locale 'loading' se non usiamo più status da authSlice
          sx={{ mt: 2 }}
        >
          Inizia Registrazione
        </Button>
        <Button
          variant="outlined"
          fullWidth
          sx={{ mt: 1 }}
          onClick={() => {
            dispatch(signInWithGoogle());
          }}
        >
          Registrati con Google
        </Button>
      </Box>
      <Link component={RouterLink} to="/login" sx={{ mt: 2 }}>
        Hai già un account? Accedi
      </Link>
    </Box>
  );
};

export default Register;
