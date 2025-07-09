import React from 'react';
import {
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  Switch,
  IconButton,
  Button,
  Divider
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

const UserManagementSection = ({
  tenantUsers,
  pendingRoleChanges,
  userManagementMessage,
  setUserManagementMessage,
  handleChangeUserRole,
  handleDeleteUser,
  handleSaveRoleChanges,
  currentUserId
}) => {
  return (
    <Box mt={5}>
      <Divider sx={{ my: 3 }} />
      <Typography variant="h5" gutterBottom>
        Utenti Registrati
      </Typography>
      
      {userManagementMessage && (
        <Alert 
          severity={userManagementMessage.type} 
          sx={{ mb: 2 }} 
          onClose={() => setUserManagementMessage(null)}
        >
          {userManagementMessage.text}
        </Alert>
      )}
      
      <List>
        {tenantUsers && tenantUsers.length > 0 ? (
          tenantUsers.map(tenantUser => {
            const currentRole = pendingRoleChanges[tenantUser.uid] !== undefined 
              ? pendingRoleChanges[tenantUser.uid] 
              : tenantUser.role;
            const isChecked = currentRole === 'admin';
            
            return (
              <ListItem key={tenantUser.uid} secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Switch
                    checked={isChecked}
                    onChange={(e) => handleChangeUserRole(
                      tenantUser.uid, 
                      e.target.checked ? 'admin' : 'operator'
                    )}
                    disabled={tenantUser.uid === currentUserId}
                  />
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    {currentRole}
                  </Typography>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteUser(tenantUser.uid)}
                    disabled={tenantUser.uid === currentUserId}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              }>
                <ListItemText 
                  primary={tenantUser.displayName || 'Nome non disponibile'} 
                  secondary={tenantUser.email} 
                />
              </ListItem>
            );
          })
        ) : (
          <Typography>Nessun utente registrato nel tenant.</Typography>
        )}
      </List>
      
      {Object.keys(pendingRoleChanges).length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" color="primary" onClick={handleSaveRoleChanges}>
            Salva Modifiche Ruoli
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default UserManagementSection;