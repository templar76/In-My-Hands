import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

const ProcessingMonitor = ({ jobId, onComplete }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);

  // Implementare un backoff esponenziale per il polling
  const [pollingInterval, setPollingInterval] = useState(2000);
  const [pollingErrors, setPollingErrors] = useState(0);

  useEffect(() => {
    if (!jobId) return;

    const fetchJobStatus = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        const response = await axios.get(
          `${getApiUrl()}/api/invoices/processing/${jobId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000 // Aggiungere timeout per evitare richieste bloccate
          }
        );

        setJob(response.data);
        setLoading(false);
        setPollingErrors(0);
        
        // Ripristina l'intervallo normale dopo un successo
        if (pollingInterval > 2000) {
          setPollingInterval(2000);
        }

        // Se completato, notifica il parent
        if (response.data.status === 'completed' && onComplete) {
          onComplete(response.data);
        }

      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
        
        // Incrementa il contatore di errori e aumenta l'intervallo di polling
        setPollingErrors(prev => prev + 1);
        if (pollingErrors > 2) {
          // Aumenta l'intervallo fino a un massimo di 10 secondi
          setPollingInterval(Math.min(pollingInterval * 1.5, 10000));
        }
      }
    };

    // Fetch iniziale
    fetchJobStatus();

    // Polling con intervallo variabile
    const interval = setInterval(() => {
      if (job?.status === 'processing' || job?.status === 'pending') {
        fetchJobStatus();
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [jobId, job?.status, onComplete, pollingInterval, pollingErrors]);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'default',
      processing: 'primary',
      completed: 'success',
      failed: 'error',
      cancelled: 'warning'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Schedule />,
      processing: <PlayArrow />,
      completed: <CheckCircle />,
      failed: <Error />
    };
    return icons[status] || <Schedule />;
  };

  const getOverallProgress = () => {
    if (!job || job.totalFiles === 0) return 0;
    return Math.round((job.processedFiles / job.totalFiles) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Caricamento stato elaborazione...</Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Errore nel recupero dello stato: {error}
      </Alert>
    );
  }

  if (!job) return null;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Elaborazione Fatture
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              icon={getStatusIcon(job.status)}
              label={job.status.toUpperCase()}
              color={getStatusColor(job.status)}
              size="small"
            />
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Progresso Generale: {job.processedFiles}/{job.totalFiles} file
          </Typography>
          <LinearProgress
            variant="determinate"
            value={getOverallProgress()}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="textSecondary">
            {getOverallProgress()}% completato
          </Typography>
        </Box>

        <Box display="flex" gap={2} mb={2}>
          <Chip
            label={`Successo: ${job.successfulFiles}`}
            color="success"
            variant="outlined"
            size="small"
          />
          <Chip
            label={`Errori: ${job.failedFiles}`}
            color="error"
            variant="outlined"
            size="small"
          />
        </Box>

        <Collapse in={expanded}>
          <Typography variant="subtitle2" gutterBottom>
            Dettaglio File:
          </Typography>
          <List dense>
            {job.files.map((file, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {getStatusIcon(file.status)}
                </ListItemIcon>
                <ListItemText
                  primary={file.filename}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {file.progress.message}
                      </Typography>
                      {file.status === 'processing' && (
                        <LinearProgress
                          variant="determinate"
                          value={file.progress.percentage}
                          size="small"
                          sx={{ mt: 0.5, height: 4 }}
                        />
                      )}
                      {file.error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {file.error.message}
                        </Alert>
                      )}
                    </Box>
                  }
                />
                <Chip
                  label={file.fileType.toUpperCase()}
                  size="small"
                  variant="outlined"
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default ProcessingMonitor;