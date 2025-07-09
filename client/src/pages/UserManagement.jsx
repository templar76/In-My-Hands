import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { auth } from '../firebase';
import { getApiUrl } from '../utils/apiConfig';
import { fetchTenantUsers, removeUserFromTenant, updateUserRole } from '../store/userSlice';

// Import dei nuovi componenti
import InvitationSection from '../components/UserManagement/InvitationSection';
import SentInvitationsSection from '../components/UserManagement/SentInvitationsSection';
import UserManagementSection from '../components/UserManagement/UserManagementSection';

const API_URL = getApiUrl();

const UserManagement = () => {
  const dispatch = useDispatch();
  const { role: userRole, user } = useSelector(state => state.auth);
  const { tenantUsers } = useSelector(state => state.user);
  
  const [tenantId, setTenantId] = useState(null);
  
  // Stati per inviti inviati
  const [sentInvitations, setSentInvitations] = useState([]);
  const [isLoadingSentInvitations, setIsLoadingSentInvitations] = useState(false);
  const [listOperationsMessage, setListOperationsMessage] = useState(null);
  const [sentInvitationsInitialError, setSentInvitationsInitialError] = useState(null);
  
  // Stati per gestione utenti
  const [pendingRoleChanges, setPendingRoleChanges] = useState({});
  const [userManagementMessage, setUserManagementMessage] = useState(null);

  // Inizializzazione tenantId
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const token = await user.getIdToken(true);
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.tenantId) {
            setTenantId(data.tenantId);
          }
        }
      } catch (err) {
        console.error('Error fetching tenant ID:', err);
      }
    });
    return () => unsubscribe();
  }, []);

  // Carica utenti quando il componente si monta
  useEffect(() => {
    if (userRole === 'admin' && tenantId) {
      dispatch(fetchTenantUsers(tenantId));
    }
  }, [userRole, tenantId, dispatch]);

  // Carica inviti inviati
  useEffect(() => {
    const fetchSentInvitations = async () => {
      if (userRole === 'admin' && tenantId) {
        setIsLoadingSentInvitations(true);
        setListOperationsMessage(null);
        setSentInvitationsInitialError(null);
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
          setSentInvitations(data.invitations || []);
        } catch (error) {
          console.error('Errore recupero inviti inviati:', error);
          setSentInvitationsInitialError({ 
            type: 'error', 
            text: `Errore nel caricamento degli inviti: ${error.message}` 
          });
          setSentInvitations([]);
        } finally {
          setIsLoadingSentInvitations(false);
        }
      }
    };
    fetchSentInvitations();
  }, [userRole, tenantId]);

  // Handlers per inviti
  const handleResendInvite = async (invitationId) => {
    if (!tenantId) {
      setListOperationsMessage({ type: 'error', text: 'ID Tenant non disponibile. Impossibile rispedire l\'invito.' });
      return;
    }
    setListOperationsMessage(null);

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
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Errore ${response.status} durante il reinvio dell'invito`);
      }

      let alertType = 'info';
      if (typeof data.emailSent === 'boolean') {
        alertType = data.emailSent ? 'success' : 'warning';
      }
      
      const alertMessage = data.message || (data.emailSent ? "Invito rispedito con successo." : "Operazione sull'invito completata, ma lo stato dell'invio dell'email non è chiaro.");
      setListOperationsMessage({ type: alertType, text: alertMessage });

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
      .then(() => setListOperationsMessage({ type: 'success', text: 'Link invito copiato negli appunti!' }))
      .catch(() => setListOperationsMessage({ type: 'error', text: 'Errore nel copiare il link.' }));
  };

  const handleDeleteInvite = async (invitationId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo invito? L\'azione è irreversibile.')) {
      return;
    }

    if (!tenantId) {
      setListOperationsMessage({ type: 'error', text: 'ID Tenant non disponibile. Impossibile eliminare l\'invito.' });
      return;
    }

    setListOperationsMessage(null);

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
        const errorData = await response.json().catch(() => ({ error: "Errore sconosciuto durante l'eliminazione dell'invito." }));
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

  // Handlers per gestione utenti
  const handleChangeUserRole = (userId, newRole) => {
    setPendingRoleChanges(prev => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo utente? L\'azione è irreversibile.')) {
      return;
    }

    try {
      await dispatch(removeUserFromTenant({ tenantId, userId })).unwrap();
      setUserManagementMessage({ type: 'success', text: 'Utente eliminato con successo!' });
    } catch (error) {
      setUserManagementMessage({ type: 'error', text: `Errore nell'eliminazione dell'utente: ${error.message}` });
    }
  };

  const handleSaveRoleChanges = async () => {
    try {
      const promises = Object.entries(pendingRoleChanges).map(([userId, newRole]) =>
        dispatch(updateUserRole({ tenantId, userId, newRole })).unwrap()
      );
      
      await Promise.all(promises);
      setPendingRoleChanges({});
      setUserManagementMessage({ type: 'success', text: 'Ruoli aggiornati con successo!' });
    } catch (error) {
      setUserManagementMessage({ type: 'error', text: `Errore nell'aggiornamento dei ruoli: ${error.message}` });
    }
  };

  const handleInvitationSent = () => {
    // Ricarica la lista degli inviti quando ne viene inviato uno nuovo
    if (userRole === 'admin' && tenantId) {
      // Ricarica inviti
      const fetchSentInvitations = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          const token = await currentUser.getIdToken();
          const response = await fetch(`${API_URL}/api/tenants/${tenantId}/invitations`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setSentInvitations(data.invitations || []);
          }
        } catch (error) {
          console.error('Errore nel ricaricare gli inviti:', error);
        }
      };
      fetchSentInvitations();
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Gestione Utenti e Inviti
      </Typography>
      
      {/* Sezione Creazione Inviti */}
      <InvitationSection 
        tenantId={tenantId}
        onInvitationSent={handleInvitationSent}
      />
      
      {/* Sezioni per Admin */}
      {userRole === 'admin' && (
        <>
          {/* Sezione Inviti Inviati */}
          <SentInvitationsSection
            sentInvitations={sentInvitations}
            isLoadingSentInvitations={isLoadingSentInvitations}
            listOperationsMessage={listOperationsMessage}
            setListOperationsMessage={setListOperationsMessage}
            sentInvitationsInitialError={sentInvitationsInitialError}
            handleResendInvite={handleResendInvite}
            handleCopyInviteLink={handleCopyInviteLink}
            handleDeleteInvite={handleDeleteInvite}
          />
          
          {/* Sezione Gestione Utenti Registrati */}
          <UserManagementSection
            tenantUsers={tenantUsers}
            pendingRoleChanges={pendingRoleChanges}
            userManagementMessage={userManagementMessage}
            setUserManagementMessage={setUserManagementMessage}
            handleChangeUserRole={handleChangeUserRole}
            handleDeleteUser={handleDeleteUser}
            handleSaveRoleChanges={handleSaveRoleChanges}
            currentUserId={user?.uid}
          />
        </>
      )}
    </Box>
  );
};

export default UserManagement;