import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Select, MenuItem, Alert, FormControl, InputLabel,
          IconButton, RadioGroup, FormControlLabel, Radio
        } from '@mui/material';
import { auth } from '../firebase';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QRCode from 'react-qr-code';
import { useSelector } from 'react-redux'; // Aggiunto per accedere allo stato Redux
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Divider, // Aggiunto Divider
  Tooltip // Aggiunto Tooltip
} from '@mui/material';
import {
// Removed unused SendIcon import
  FileCopy as FileCopyIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon // Aggiunto per rispedire
} from '@mui/icons-material';

const API_URL = getApiUrl();

const Invitations = () => {
  const [email, setEmail] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [role, setRole] = useState('operator');
  const [tenantId, setTenantId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | succeeded | failed
  const [message, setMessage] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);
  const [mode, setMode] = useState('email'); // 'email' | 'link' | 'qr'

  // Stato per la gestione degli inviti inviati (per admin)
  const { role: userRole } = useSelector(state => state.auth);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [isLoadingSentInvitations, setIsLoadingSentInvitations] = useState(false);
  // Rimuoviamo sentInvitationsError e usiamo listOperationsMessage
  // const [sentInvitationsError, setSentInvitationsError] = useState(null); 
  const [listOperationsMessage, setListOperationsMessage] = useState(null); // Nuovo stato per i messaggi della lista inviti
  const [sentInvitationsInitialError, setSentInvitationsInitialError] = useState(null); // Nuovo stato per errore caricamento iniziale

  // Wait for Firebase Auth to be ready, then fetch profile
  useEffect(() => {
    console.log('Invitations.jsx: API_URL =', API_URL);
    console.log('Invitations.jsx: auth object =', auth);
    // Subscribe to auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('Invitations.jsx: onAuthStateChanged user =', user);
      if (!user) {
        setMessage({ type: 'error', text: 'Utente non autenticato' });
        return;
      }
      try {
        const token = await user.getIdToken(true); // Force refresh to get latest claims
        console.log('Invitations.jsx: idToken (refreshed) =', token);
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Log dettagliato della risposta HTTP
        console.log(`Invitations.jsx: /api/auth/me response status: ${res.status}, statusText: ${res.statusText}, ok: ${res.ok}`);

        if (!res.ok) {
          console.log('Invitations.jsx: /api/auth/me call was not successful.');
          let errorPayload;
          let errorMessage;
          try {
            errorPayload = await res.json();
            console.log('Invitations.jsx: /api/auth/me error response JSON:', errorPayload);
            errorMessage = errorPayload.error || `Errore API (${res.status}): ${res.statusText}`;
          } catch (e) {
            // Se res.json() fallisce, prova a leggere come testo
            const errorText = await res.text(); // Consuma il corpo della risposta
            console.error('Invitations.jsx: /api/auth/me error response (not JSON):', errorText);
            errorMessage = `Errore API (${res.status}): ${res.statusText}. Dettagli: ${errorText}`;
          }
          throw new Error(errorMessage); // Questo uscirà dal blocco try
        }

        // Se siamo qui, res.ok era true
        const data = await res.json(); 
        console.log('Invitations.jsx: /api/auth/me response data:', data); // Mantenuto il log precedente
        if (data && data.tenantId) {
          setTenantId(data.tenantId);
        } else {
          console.warn('Invitations.jsx: tenantId not found in /api/auth/me response or data is null. Response:', data);
          setMessage({ type: 'warning', text: 'ID Tenant non ricevuto dal server.' });
          setTenantId(null); 
        }
      } catch (err) {
        console.error('Invitations.jsx: Error during /api/auth/me fetch or processing:', err);
        setMessage({ type: 'error', text: `Errore recupero profilo: ${err.message}` });
        setTenantId(null); 
      }
    });
    return () => unsubscribe();
  }, []);

  // Effetto per caricare gli inviti inviati se l'utente è admin
  useEffect(() => {
    const fetchSentInvitations = async () => {
      if (userRole === 'admin' && tenantId) {
        setIsLoadingSentInvitations(true);
        setListOperationsMessage(null); // Resetta il messaggio specifico della lista
        setSentInvitationsInitialError(null); // Resetta l'errore di caricamento iniziale
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) throw new Error('Utente non autenticato per recuperare gli inviti.');
          const token = await currentUser.getIdToken();
          const response = await fetch(`${API_URL}/api/tenants/${tenantId}/invitations`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore ${response.status} nel recupero inviti`);
          }
          const data = await response.json();
          setSentInvitations(data.invitations || []); // Assumendo che la risposta sia { invitations: [...] }
        } catch (error) {
          console.error('Errore recupero inviti inviati:', error);
          // setListOperationsMessage({ type: 'error', text: error.message }); // Usa il nuovo stato per l'errore
          setSentInvitationsInitialError({ type: 'error', text: `Errore nel caricamento degli inviti: ${error.message}` }); // Imposta l'errore di caricamento iniziale
          setSentInvitations([]);
        } finally {
          setIsLoadingSentInvitations(false);
        }
      }
    };

    fetchSentInvitations();
  }, [userRole, tenantId]); // Dipendenze: userRole e tenantId (authTenantId potrebbe essere usato qui se tenantId non è ancora settato)

  const handleResendInvite = async (invitationId) => {
    if (!tenantId) {
      setListOperationsMessage({ type: 'error', text: 'ID Tenant non disponibile. Impossibile rispedire l\'invito.' });
      return;
    }
    setListOperationsMessage(null); // Resetta messaggi precedenti

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Utente non autenticato. Impossibile rispedire l\'invito.');
      }
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/api/tenants/${tenantId}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json' // Anche se il corpo è vuoto, è buona norma specificarlo per le POST
        },
        // Non c'è corpo per questa richiesta specifica, ma l'header Content-Type può essere mantenuto
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Errore ${response.status} durante il reinvio dell'invito`);
      }

      // response.ok === true
      let alertType = 'info'; // Default type
      if (typeof data.emailSent === 'boolean') {
        alertType = data.emailSent ? 'success' : 'warning';
      } else {
        console.warn("handleResendInvite: Il campo 'emailSent' nella risposta non è un booleano:", data.emailSent, "Risposta completa:", data);
      }
      
      // Usa direttamente il messaggio dal backend.
      const alertMessage = data.message || (data.emailSent ? "Invito rispedito con successo." : "Operazione sull'invito completata, ma lo stato dell'invio dell'email non è chiaro.");

      setListOperationsMessage({ type: alertType, text: alertMessage });

      // Aggiorna l'invito nella lista locale con i dati ricevuti dal backend.
      // Questo aggiornerà il token/link nella tabella se è cambiato.
      if (data.invitation) {
        setSentInvitations(prevInvitations =>
          prevInvitations.map(inv =>
            inv._id === data.invitation._id ? data.invitation : inv
          )
        );
      }

    } catch (error) {
      console.error(`Errore durante il reinvio dell'invito:`, error);
      setListOperationsMessage({ type: 'error', text: `Errore durante il reinvio dell'invito: ${error.message}` });
    }
  };

  const handleCopyInviteLink = (inviteLink) => {
    navigator.clipboard.writeText(inviteLink)
      .then(() => setListOperationsMessage({ type: 'success', text: 'Link invito copiato negli appunti!' })) // Potrebbe essere setMessage se si vuole globale
      .catch(() => setListOperationsMessage({ type: 'error', text: 'Errore nel copiare il link.' })); // Potrebbe essere setMessage
  };

  const handleDeleteInvite = async (invitationId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo invito? L\'azione è irreversibile.')) {
      return;
    }

    if (!tenantId) {
      setListOperationsMessage({ type: 'error', text: 'ID Tenant non disponibile. Impossibile eliminare l\'invito.' });
      return;
    }

    setListOperationsMessage(null); // Resetta messaggi precedenti specifici della lista

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Utente non autenticato. Impossibile eliminare l\'invito.');
      }
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/api/tenants/${tenantId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Errore sconosciuto durante l\"eliminazione dell\"invito." }));
        throw new Error(errorData.error || `Errore ${response.status} durante l'eliminazione dell'invito`);
      }

      setSentInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation._id !== invitationId)
      );
      setListOperationsMessage({ type: 'success', text: 'Invito eliminato con successo!' });

    } catch (error) {
      console.error("Errore durante l'eliminazione dell'invito:", error);
      setListOperationsMessage({ type: 'error', text: `Errore durante l'eliminazione dell'invito: ${error.message}` });
    }
  };

  // Verifica se l'email esiste già nel tenant
  const checkEmail = async (addr) => {
    console.log('Invitations.jsx: checkEmail called with addr:', addr);
    if (!tenantId || !addr) {
      console.log('Invitations.jsx: checkEmail returning early - no tenantId or addr');
      return;
    }
    setCheckingEmail(true);
    console.log('Invitations.jsx: checkingEmail set to true');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Utente non autenticato');
      const token = await user.getIdToken();
      // Controlla se l'email è valida prima della richiesta
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
      console.log('Invitations.jsx: Check email API response data.exists:', data.exists);
      // Log emailExists directly after setting it might not show the updated value immediately due to async nature of setState
      // It's better to log it in the render or a useEffect that depends on it.
    } catch (err) {
      console.error('checkEmail error:', err);
      setEmailExists(false); // Assicurati di resettare in caso di errore
    } finally {
      setCheckingEmail(false);
      console.log('Invitations.jsx: checkingEmail set to false in finally block');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId) {
      setMessage({ type: 'error', text: 'ID Tenant non è ancora disponibile. Attendere prego e riprovare.' });
      setStatus('failed');
      return;
    }
    console.log('Invitations.jsx: handleSubmit called with mode:', mode, 'email:', email, 'role:', role, 'tenantId:', tenantId);

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
      console.log('Invitations.jsx: Payload to be sent:', payload);

      // Corretto l'endpoint API mancante /api
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
        console.error('Invitations.jsx: Error response:', data);
        throw new Error(data.error || 'Errore durante l\'invio dell\'invito');
      }

      // Estrai il primo risultato dall'array di risultati
      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      
      if (result.inviteUrl) {
        // Estrai il token dall'URL di invito
        const urlParams = new URLSearchParams(new URL(result.inviteUrl).search);
        const token = urlParams.get('token');
        if (token) {
          setInviteToken(token);
          setStatus('succeeded');
          
          if (!result.emailSent) {
            setMessage({
              type: 'warning',
              text: 'Invito generato con successo, ma non è stato possibile inviare l\'email. Puoi utilizzare il link o il QR code.'
            });
          } else {
            setMessage({
              type: 'success',
              text: mode === 'email' 
                ? 'Invito inviato via email con successo! È disponibile anche come link e QR code.'
                : 'Invito generato con successo!'
            });
          }
          
          setEmail('');
          setRole('operator');
          return;
        }
      }
      
      console.log('Invitations.jsx: Invite token received:', data.token);
      setInviteToken(data.token); 

      // Reset stati dopo il successo
      setEmailExists(false);
      setCheckingEmail(false);
      setStatus('succeeded');
      
      if (mode === 'email') {
        setMessage({ 
          type: 'success', 
          text: 'Invito inviato correttamente via email! È stato anche generato un link e un QR code come backup.' 
        });
      } else {
        setMessage({ 
          type: 'success', 
          text: 'Invito generato con successo! Puoi trovare il link o il QR code qui sotto.' 
        });
      }
      
      setEmail('');
      setRole('operator');
    } catch (err) {
      setStatus('failed');
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <Box p={3} maxWidth={userRole === 'admin' ? 1000 : 400} mx="auto">
      <Typography variant="h4" gutterBottom>
        Gestione Inviti
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      {console.log('Invitations.jsx: Rendering. emailExists:', emailExists, 'checkingEmail:', checkingEmail, 'tenantId:', tenantId, 'status:', status)}

      {/* RIMOZIONE: Visualizzazione del link di invito e QR code - Questa sezione verrà spostata sotto il pulsante */}
      {/* {inviteToken && (mode === 'link' || mode === 'qr') && (
        <Box sx={{ mb: 3, mt: 2 }}>
          {mode === 'link' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                value={`${window.location.origin}/accept-invitation?token=${inviteToken}`}
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: true,
                }}
              />
              <IconButton
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/accept-invitation?token=${inviteToken}`);
                  setMessage({ type: 'success', text: 'Link copiato negli appunti!' });
                }}
                color="primary"
              >
                <ContentCopyIcon />
              </IconButton>
            </Box>
          )}
          {mode === 'qr' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <QRCode
                value={`${window.location.origin}/accept-invitation?token=${inviteToken}`}
                size={256}
                level="H"
              />
            </Box>
          )}
        </Box>
      )} */}

      <Box component="form" onSubmit={handleSubmit}>
        {/* RIMOZIONE: Primo RadioGroup duplicato */}
        {/* <RadioGroup
        row
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        sx={{ mb: 2 }}
      >
        <FormControlLabel value="email" control={<Radio />} label="Email" />
        <FormControlLabel value="link" control={<Radio />} label="Link" />
        <FormControlLabel value="qr" control={<Radio />} label="QR Code" />
      </RadioGroup> */}

      <TextField
          label="Email dell'operatore"
          fullWidth
          required
          margin="normal"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={e => checkEmail(e.target.value)}
        />
        {emailExists && (
          <>
            {console.log('Invitations.jsx: Rendering Alert for emailExists = true')}
            <Alert severity="warning" sx={{ mb: 2 }}>
              Email già registrata in questo tenant
            </Alert>
          </>
        )}
        <FormControl fullWidth margin="normal">
          <InputLabel id="role-label">Ruolo</InputLabel>
          <Select
            labelId="role-label"
            label="Ruolo"
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <MenuItem value="operator">Operatore</MenuItem>
            <MenuItem value="admin">Amministratore</MenuItem>
          </Select>
        </FormControl>
        {/* Inserimento selezione modalità */}
        <FormControl component="fieldset" sx={{ mt: 2, mb: 1 }} fullWidth>
          <Typography component="legend" variant="subtitle1" sx={{ mb:1 }}>Seleziona Modalità invito</Typography> {/* CORREZIONE ETICHETTA */}
          <RadioGroup row value={mode} onChange={e => setMode(e.target.value)} aria-label="seleziona modalità invito">
            <FormControlLabel value="email" control={<Radio />} label="Email" />
            <FormControlLabel value="link" control={<Radio />} label="Link" />
            <FormControlLabel value="qr" control={<Radio />} label="QR Code" />
          </RadioGroup>
        </FormControl>
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={
            status === 'loading' ||
            !tenantId ||
            emailExists ||
            checkingEmail
          }
          sx={{ mt: 2 }}
        >
          {console.log('Invitations.jsx: Button disabled state evaluation - status:', status, '!tenantId:', !tenantId, 'emailExists:', emailExists, 'checkingEmail:', checkingEmail)}
          {status === 'loading' ? 'Invio...' : 'Invia Invito'}
        </Button>
        {/* SPOSTAMENTO E MODIFICA: Visualizzazione del link di invito e QR code */}
        {inviteToken && (status === 'succeeded' || message?.type === 'warning') && (
          <Box mt={4}>
            {console.log('Invitations.jsx: Displaying content for mode:', mode, 'with token:', inviteToken)}
            {mode === 'link' && (
              <Box>
                <Typography variant="caption" display="block" gutterBottom>
                  Copia e invia questo link per la registrazione:
                </Typography>
                <Box display="flex" alignItems="center">
                  <TextField
                    fullWidth
                    value={`${window.location.origin}/accept-invitation?token=${inviteToken}`}
                    variant="outlined"
                    size="small"
                    InputProps={{
                      readOnly: true,
                    }}
                    sx={{ mr: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/accept-invitation?token=${inviteToken}`
                        ).then(() => {
                          setMessage({ type: 'info', text: 'Link copiato negli appunti!' });
                        }).catch(err => {
                          console.error('Failed to copy text: ', err);
                          setMessage({ type: 'error', text: 'Impossibile copiare il link. Si prega di copiare manualmente.' });
                        });
                      } else {
                        console.warn('Clipboard API not available.');
                        setMessage({ type: 'warning', text: 'La copia automatica non è disponibile. Si prega di copiare il link manualmente.' });
                        // Optionally, implement a fallback for manual copying here, e.g., selecting the text in the input field
                        // For instance, you could try to select the text of the TextField to make it easier for the user to copy manually.
                        // This requires a ref to the TextField.
                      }
                    }}
                    color="primary"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )}

            {mode === 'qr' && (
              <Box textAlign="center">
                <Typography variant="caption" display="block" gutterBottom>
                  Inquadra e condividi questo QR code per la registrazione:
                </Typography>
                <Box display="flex" justifyContent="center">
                  <QRCode
                    value={`${window.location.origin}/accept-invitation?token=${inviteToken}`}
                    size={128}
                  />
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Sezione per visualizzare gli inviti inviati, visibile solo agli admin */}
      {userRole === 'admin' && (
        <AdminSentInvitationsSection
          userRole={userRole}
          isLoadingSentInvitations={isLoadingSentInvitations}
          sentInvitations={sentInvitations}
          listOperationsMessage={listOperationsMessage}
          setListOperationsMessage={setListOperationsMessage}
          sentInvitationsInitialError={sentInvitationsInitialError}
          handleResendInvite={handleResendInvite}
          handleCopyInviteLink={handleCopyInviteLink}
          handleDeleteInvite={handleDeleteInvite}
          tenantId={tenantId}
          API_URL={API_URL}
        />
      )}
    </Box>
  );
};

// Componente per la sezione degli inviti inviati (per admin)
const AdminSentInvitationsSection = ({
  isLoadingSentInvitations,
  sentInvitations,
  listOperationsMessage,
  setListOperationsMessage,
  sentInvitationsInitialError,
  handleResendInvite,
  handleCopyInviteLink,
  handleDeleteInvite,
  // tenantId e API_URL non sono più necessari qui se le funzioni sono passate da Invitations
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Data non valida';
    }
  };

  return (
    <Box mt={5}>
      <Divider sx={{ my: 3 }} />
      <Typography variant="h5" gutterBottom>
        Inviti Inviati
      </Typography>
      {/* Alert per mostrare messaggi da operazioni (listOperationsMessage) */}
      {listOperationsMessage && (
        <Alert 
          severity={listOperationsMessage.type} 
          sx={{ mb: 2 }} 
          onClose={() => setListOperationsMessage(null)} // Usa la prop corretta
        >
          {listOperationsMessage.text}
        </Alert>
      )}
      {isLoadingSentInvitations ? (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      ) : !listOperationsMessage && sentInvitationsInitialError ? (
        // Se c'è un errore specifico dal fetch (diverso da un messaggio di info/success), 
        // non mostriamo "Nessun invito" ma l'alert di errore è già visibile sopra.
        // Potremmo anche non mostrare nulla qui o un messaggio più generico se l'alert sopra è sufficiente.
        <Typography sx={{ textAlign: 'center', my: 3 }}>Errore nel caricamento degli inviti.</Typography>
      ) : sentInvitations.length === 0 ? (
        <Typography sx={{ textAlign: 'center', my: 3 }}>Nessun invito inviato trovato per questo tenant.</Typography>
      ) : (
        <TableContainer component={Paper} elevation={2}>
          <Table sx={{ minWidth: 650 }} aria-label="tabella inviti inviati">
            <TableHead sx={{ backgroundColor: (theme) => theme.palette.grey[200] }}>
              <TableRow>
                <TableCell>Email Destinatario</TableCell>
                <TableCell align="center">Data Invio</TableCell>
                <TableCell align="center">Scadenza Link</TableCell>
                <TableCell align="center">Stato</TableCell>
                <TableCell align="center">Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sentInvitations.map((invite) => (
                <TableRow key={invite._id || invite.token}>
                  <TableCell component="th" scope="row">
                    {invite.email}
                  </TableCell>
                  <TableCell align="center">{formatDate(invite.createdAt || invite.sentAt)}</TableCell>
                  <TableCell align="center">{formatDate(invite.expiresAt)}</TableCell>
                  <TableCell align="center">{invite.status || 'Inviato'}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Rispedisci Invito">
                      <IconButton 
                        onClick={() => handleResendInvite(invite._id || invite.token)} 
                        color="primary" 
                        size="small"
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copia Link Invito">
                      <IconButton 
                        onClick={() => handleCopyInviteLink(`${window.location.origin}/accept-invitation?token=${invite.token}`)} 
                        color="secondary" 
                        size="small"
                        disabled={!invite.token}
                      >
                        <FileCopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Elimina Invito">
                      <IconButton 
                        onClick={() => handleDeleteInvite(invite._id || invite.token)} 
                        color="error" 
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};



export default Invitations;