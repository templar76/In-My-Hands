import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, Typography, TextField, Button, Paper, Grid, IconButton, Switch, FormControlLabel, Divider, Alert } from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon } from '@mui/icons-material';
import { updateUserProfile, changePassword } from '../store/userSlice';

const MyProfilePage = () => {
  const dispatch = useDispatch();
  const { user, tenantId, role, companyName: authCompanyName } = useSelector(state => state.auth);
  console.log('MyProfilePage - useSelector: user:', user, 'tenantId:', tenantId, 'role:', role, 'authCompanyName:', authCompanyName);

  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const companyToDisplay = authCompanyName || tenantId || 'N/A';
  console.log('MyProfilePage - companyToDisplay:', companyToDisplay);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeNotification, setPasswordChangeNotification] = useState({ open: false, message: '', severity: 'success' });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [nameUpdateNotification, setNameUpdateNotification] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

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
    alert('La funzionalità di autenticazione a due fattori non è ancora attiva.');
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
        <Grid container spacing={2} direction="column">
          <Grid xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Azienda / Tenant:
            </Typography>
            <Typography variant="body1" sx={{ pl: 1, mb: 1 }}>
              {companyToDisplay}
            </Typography>
          </Grid>

          <Grid xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Email:
            </Typography>
            <Typography variant="body1" sx={{ pl: 1, mb: 1 }}>
              {user?.email || 'N/A'}
            </Typography>
          </Grid>

          <Grid xs={12}>
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
    </Box>
  );
};

export default MyProfilePage;