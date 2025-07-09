import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Divider,
  Tooltip,
  IconButton,
  Alert
} from '@mui/material';
import {
  FileCopy as FileCopyIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

const SentInvitationsSection = ({
  sentInvitations,
  isLoadingSentInvitations,
  listOperationsMessage,
  setListOperationsMessage,
  sentInvitationsInitialError,
  handleResendInvite,
  handleCopyInviteLink,
  handleDeleteInvite
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
      
      {listOperationsMessage && (
        <Alert 
          severity={listOperationsMessage.type} 
          sx={{ mb: 2 }} 
          onClose={() => setListOperationsMessage(null)}
        >
          {listOperationsMessage.text}
        </Alert>
      )}
      
      {sentInvitationsInitialError && (
        <Alert 
          severity={sentInvitationsInitialError.type} 
          sx={{ mb: 2 }}
        >
          {sentInvitationsInitialError.text}
        </Alert>
      )}
      
      {isLoadingSentInvitations ? (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      ) : !listOperationsMessage && sentInvitationsInitialError ? (
        <Typography sx={{ textAlign: 'center', my: 3 }}>
          Errore nel caricamento degli inviti.
        </Typography>
      ) : sentInvitations.length === 0 ? (
        <Typography sx={{ textAlign: 'center', my: 3 }}>
          Nessun invito inviato trovato per questo tenant.
        </Typography>
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
                  <TableCell align="center">
                    {formatDate(invite.createdAt || invite.sentAt)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDate(invite.expiresAt)}
                  </TableCell>
                  <TableCell align="center">
                    {invite.status || 'Inviato'}
                  </TableCell>
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

export default SentInvitationsSection;