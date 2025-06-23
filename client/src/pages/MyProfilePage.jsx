import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, Typography, TextField, Button, Paper, Grid, List, ListItem, ListItemText, IconButton, Switch, FormControlLabel, Divider, Alert } from '@mui/material'; // Aggiunto Alert
import { Edit as EditIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { updateUserProfile, changePassword, fetchTenantUsers, removeUserFromTenant, updateUserRole } from '../store/userSlice'; // Azioni da creare

const MyProfilePage = () => {
  const dispatch = useDispatch();
  // Leggiamo user, tenantId, role e companyName direttamente dallo stato auth
  const { user, tenantId, role, companyName: authCompanyName } = useSelector(state => state.auth);
  console.log('MyProfilePage - useSelector: user:', user, 'tenantId:', tenantId, 'role:', role, 'authCompanyName:', authCompanyName);
  const tenantUsers = useSelector(state => state.user.tenantUsers); // Da userSlice

  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  // Utilizziamo authCompanyName per il nome dell'azienda, con fallback a tenantId o 'N/A'
  const companyToDisplay = authCompanyName || tenantId || 'N/A';
  console.log('MyProfilePage - companyToDisplay:', companyToDisplay);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeNotification, setPasswordChangeNotification] = useState({ open: false, message: '', severity: 'success' }); // Notifica per cambio password
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false); // Placeholder
  const [pendingRoleChanges, setPendingRoleChanges] = useState({}); // Stato per le modifiche ai ruoli non salvate
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' }); // Nuovo stato per la notifica generale (es. ruoli)
  const [nameUpdateNotification, setNameUpdateNotification] = useState({ open: false, message: '', severity: 'success' }); // Stato per la notifica dell'aggiornamento nome

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
    // Il ruolo 'admin' e tenantId sono usati per fetchTenantUsers
    if (role === 'admin' && tenantId) {
      console.log('MyProfilePage - useEffect: Dispatching fetchTenantUsers because role is admin and tenantId is present. Role:', role, 'TenantId:', tenantId);
      dispatch(fetchTenantUsers(tenantId));
    } else {
      console.log('MyProfilePage - useEffect: NOT dispatching fetchTenantUsers. Role:', role, 'TenantId:', tenantId);
    }
  }, [user, role, tenantId, dispatch]);

  const handleNameChange = (e) => {
    setDisplayName(e.target.value);
  };

  const handleSaveName = () => {
    dispatch(updateUserProfile({ uid: user.uid, displayName }))
      .unwrap()
      .then(() => {
        setIsEditingName(false);
        setNameUpdateNotification({ open: true, message: 'Nominativo aggiornato con successo!', severity: 'success' });
      })
      .catch((error) => {
        setNameUpdateNotification({ open: true, message: `Errore nell'aggiornamento del nominativo: ${error.message || error}`, severity: 'error' });
      });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeNotification({ open: true, message: 'Le nuove password non coincidono.', severity: 'error' });
      return;
    }
    if (!currentPassword || !newPassword) {
      setPasswordChangeNotification({ open: true, message: 'Tutti i campi password sono obbligatori.', severity: 'error' });
      return;
    }
    try {
      await dispatch(changePassword({ currentPassword, newPassword })).unwrap();
      setPasswordChangeNotification({ open: true, message: 'Password modificata con successo!', severity: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      setPasswordChangeNotification({ open: true, message: `Errore nella modifica della password: ${error.message || error}`, severity: 'error' });
    }
  };

  const handleToggleTwoFactor = (event) => {
    setTwoFactorEnabled(event.target.checked);
    // TODO: Implementare logica effettiva quando sarà pronta
    alert('La funzionalità di autenticazione a due fattori non è ancora attiva.');
  };

  const handleDeleteUser = (userId) => {
    // TODO: Aggiungere una conferma prima di eliminare
    if (userId === user.uid) {
      alert("Non puoi eliminare te stesso.");
      return;
    }
    // Considerare se questa azione debba essere immediata o parte del "Salva Modifiche"
    dispatch(removeUserFromTenant({ tenantId, userId }));
    // TODO: Aggiungere notifica di successo/errore
  };

  const handleChangeUserRole = (userId, newRoleValue) => {
    if (userId === user.uid) {
      alert("Non puoi modificare il tuo ruolo.");
      return;
    }
    setPendingRoleChanges(prev => ({
      ...prev,
      [userId]: newRoleValue
    }));
  };

  const handleSaveRoleChanges = async () => {
    const promises = Object.entries(pendingRoleChanges).map(([userId, newRole]) => {
      // dispatch().unwrap() restituisce una Promise che si risolve con l'action.payload o rigetta con l'action.error
      return dispatch(updateUserRole({ tenantId, userId, newRole })).unwrap();
    });

    try {
      await Promise.all(promises);
      setPendingRoleChanges({}); // Resetta le modifiche pendenti solo dopo che tutte le operazioni sono andate a buon fine
      // alert('Tutte le modifiche ai ruoli sono state salvate con successo.'); // Notifica di successo generale
      setNotification({ open: true, message: 'Tutte le modifiche ai ruoli sono state salvate con successo.', severity: 'success' });
    } catch (error) {
      console.error("Errore durante il salvataggio dei ruoli:", error);
      // L'utente potrebbe essere già stato notificato dal thunk/slice in caso di errore individuale.
      // Qui potresti mostrare un messaggio di errore generale se alcune modifiche non sono andate a buon fine.
      // alert('Errore durante il salvataggio di alcune modifiche ai ruoli. Controlla la console per i dettagli.');
      setNotification({ open: true, message: 'Errore durante il salvataggio di alcune modifiche ai ruoli. Controlla la console per i dettagli.', severity: 'error' });
      // In caso di errore, si potrebbe decidere di non resettare pendingRoleChanges,
      // così l'utente può vedere quali modifiche non sono state applicate e riprovare.
      // Oppure, se il backend gestisce gli errori e lo store riflette comunque lo stato corretto,
      // si potrebbe resettare pendingRoleChanges anche qui, a seconda della UX desiderata.
    }
  };

  if (!user) {
    return <Typography>Caricamento profilo...</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>Il Mio Profilo</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Informazioni Utente</Typography>
        {nameUpdateNotification.open && (
          <Alert 
            severity={nameUpdateNotification.severity} 
            onClose={() => setNameUpdateNotification({ ...nameUpdateNotification, open: false })} 
            sx={{ mb: 2, mt: 1 }}
          >
            {nameUpdateNotification.message}
          </Alert>
        )}
        {/* 
          NOTA PER LO SVILUPPATORE: 
          Il campo 'Azienda / Tenant' cerca di visualizzare user.companyName.
          Assicurati che 'user.companyName' sia disponibile nello stato Redux (state.auth.user.companyName).
          Se 'companyName' è memorizzato altrove (es. state.tenant.details.companyName),
          aggiorna di conseguenza il selettore e l'accesso alla proprietà.
          Attualmente, se user.companyName non è definito, verrà visualizzato tenantId.
        */}
        <Grid container spacing={2} direction="column">
          {/* Azienda / Tenant */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Azienda / Tenant:
            </Typography>
            <Typography variant="body1" sx={{ pl: 1, mb: 1 }}>
              {companyToDisplay}
            </Typography>
          </Grid>

          {/* Email Utente */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Email:
            </Typography>
            <Typography variant="body1" sx={{ pl: 1, mb: 1 }}>
              {user?.email || 'N/A'}
            </Typography>
          </Grid>

          {/* Nominativo Utente */}
          <Grid item xs={12}>
            {isEditingName ? (
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <TextField
                  label="Nominativo Utente"
                  value={displayName}
                  onChange={handleNameChange}
                  fullWidth
                  margin="normal"
                  size="small"
                />
                <IconButton onClick={handleSaveName} color="primary" sx={{ ml: 1 }}>
                  <SaveIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mt: 1, minHeight: '40px' }}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', display: 'inline' }}>
                    Nominativo:
                  </Typography>
                  <Typography variant="body1" sx={{ display: 'inline', ml: 1 }}>
                    {displayName}
                  </Typography>
                </Box>
                <IconButton onClick={() => setIsEditingName(true)} size="small">
                  <EditIcon />
                </IconButton>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Sicurezza</Typography>
        {passwordChangeNotification.open && (
          <Alert 
            severity={passwordChangeNotification.severity} 
            onClose={() => setPasswordChangeNotification({ ...passwordChangeNotification, open: false })} 
            sx={{ mb: 2, mt: 1 }}
          >
            {passwordChangeNotification.message}
          </Alert>
        )}
        <TextField
          label="Password Corrente"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Nuova Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Conferma Nuova Password"
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Button variant="contained" onClick={handleChangePassword} sx={{ mt: 2 }}>
          Cambia Password
        </Button>
        <Divider sx={{ my: 3 }} />
        <FormControlLabel
          control={<Switch checked={twoFactorEnabled} onChange={handleToggleTwoFactor} />}
          label="Attiva Autenticazione a Due Fattori (Disabilitato)"
        />
      </Paper>

      {role === 'admin' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Gestione Utenti Tenant</Typography>
          {notification.open && (
            <Alert 
              severity={notification.severity} 
              onClose={() => setNotification({ ...notification, open: false })} 
              sx={{ mb: 2, mt: 1 }} // Aggiunto mt: 1 per un po' di spazio sopra
            >
              {notification.message}
            </Alert>
          )}
          <List>
            {(() => {
              if (tenantUsers && tenantUsers.length > 0) {
                const userListItems = tenantUsers.map(tenantUser => {
                  const currentRole = pendingRoleChanges[tenantUser.uid] !== undefined ? pendingRoleChanges[tenantUser.uid] : tenantUser.role;
                  const isChecked = currentRole === 'admin';

                  const actionButtons = (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Switch
                        checked={isChecked}
                        onChange={(e) => handleChangeUserRole(tenantUser.uid, e.target.checked ? 'admin' : 'operator')}
                      disabled={tenantUser.uid === user.uid}
                    />
                      <Typography variant="caption" sx={{ mr: 1 }}>{currentRole}</Typography>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                      onClick={() => handleDeleteUser(tenantUser.uid)}
                      disabled={tenantUser.uid === user.uid}
                    >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  );

                  return (<ListItem key={tenantUser.uid} secondaryAction={actionButtons}>
                      <ListItemText primary={tenantUser.displayName || 'Nome non disponibile'} secondary={tenantUser.email} />
                    </ListItem>);
                });
                return userListItems;
              } else {
                return <Typography>Nessun altro utente nel tenant.</Typography>;
              }
            })()}
          </List>
          {Object.keys(pendingRoleChanges).length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="primary" onClick={handleSaveRoleChanges}>
                Salva Modifiche Ruoli
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default MyProfilePage;