import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Upload,
  Visibility,
  FilterList,
  Search,
  Refresh,
  PlayArrow,
  Stop,
  Delete,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosConfig';
import { getApiUrl } from '../utils/apiConfig';
import { auth } from '../firebase';
import InvoiceUploadComponent from '../components/InvoiceUploadComponent';
import ClientLogger from '../utils/ClientLogger';
import { useSmartPolling } from '../hooks';

// Funzione formatCurrency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);  // Fatture elaborate dal DB
  const [processingJobs, setProcessingJobs] = useState([]);  // Job di elaborazione
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  
  // Stati per le due sezioni
  const [activeTab, setActiveTab] = useState(0); // 0 = Fatture Elaborate, 1 = Job Elaborazione
  
  // Filtri
  const [filters, setFilters] = useState({
    search: '',
    supplierId: '',
    startDate: '',
    endDate: '',
    sortBy: 'invoiceDate',
    sortOrder: 'desc'
  });
  
  // Paginazione
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 20,
    totalCount: 0
  });
  
  // Dialog states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  // Rimosso completamente uploadDialogOpen

  // Funzioni
  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setError('Utente non autenticato');
        return;
      }

      const token = await user.getIdToken();
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
  
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage,
        ...filters
      };
  
      const response = await axiosInstance.get(
        `/api/invoices`,
        { headers, params }
      );
  
      setInvoices(response.data.invoices);
      setPagination(prev => ({
        ...prev,
        totalCount: response.data.pagination.total
      }));
    } catch (error) {
      ClientLogger.error('Errore nel caricamento fatture', {
        error: error,
        filters: filters,
        pagination: pagination,
        context: 'Invoices.loadInvoices'
      });
      setError('Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.rowsPerPage]);

  const loadStats = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await axiosInstance.get(
        `/api/invoices/stats`,
        { headers }
      );

      setStats(response.data.stats);
    } catch (error) {
      ClientLogger.error('Errore nel caricamento statistiche', {
        error: error,
        context: 'Invoices.loadStats'
      });
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await axiosInstance.get(
        `/api/suppliers`,
        { headers }
      );
      
      setSuppliers(response.data);
    } catch (error) {
      ClientLogger.error('Errore nel caricamento fornitori', {
        error: error,
        context: 'Invoices.loadSuppliers'
      });
    }
  }, []);

  const fetchProcessingJobs = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const response = await axiosInstance.get(
        `/api/invoices/processing`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setProcessingJobs(response.data.jobs || []);
    } catch (err) {
      ClientLogger.error('Errore recupero job elaborazione', {
        error: err,
        context: 'Invoices.fetchProcessingJobs'
      });
    }
  }, []);

  // Aggiungi queste funzioni DENTRO il componente Invoices
  const handleJobAction = async (action, jobId, jobStatus) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      let endpoint = '';
      let method = 'POST';
      
      switch (action) {
        case 'start': // Nuova azione per avviare l'elaborazione
          endpoint = `/api/invoices/processing/${jobId}/start`;
          method = 'POST';
          break;
        case 'cancel':
          endpoint = `/api/invoices/processing/${jobId}/cancel`;
          method = 'POST';
          break;
        case 'restart':
          endpoint = `/api/invoices/processing/${jobId}/restart`;
          method = 'POST';
          break;
        case 'delete':
          endpoint = `/api/invoices/processing/${jobId}`;
          method = 'DELETE';
          break;
        default:
          throw new Error('Azione non supportata');
      }

      await axiosInstance({
        method,
        url: endpoint,
        headers: { Authorization: `Bearer ${token}` }
      });

      // Ricarica i job dopo l'azione
      fetchProcessingJobs();
      
      // Mostra messaggio di successo
      const messages = {
        start: 'Elaborazione avviata con successo',
        cancel: 'Job cancellato con successo',
        restart: 'Job riavviato con successo',
        delete: 'Job eliminato con successo'
      };
      
      console.log(messages[action]);
      
    } catch (error) {
      ClientLogger.error(`Errore ${action} job`, {
        error: error,
        jobId,
        context: `Invoices.handleJobAction.${action}`
      });
      
      console.error(`Errore durante ${action} del job:`, error.message);
    }
  };

  const getJobActions = (job, file) => {
    const status = file?.status || job?.status;
    const actions = [];
    
    // Azioni basate sullo stato
    switch (status) {
      case 'uploaded': // Nuovo stato per file caricati ma non elaborati
        actions.push({
          icon: <PlayArrow />,
          label: 'Avvia Elaborazione',
          action: () => handleJobAction('start', job.jobId, status),
          color: 'primary'
        });
        actions.push({
          icon: <Delete />,
          label: 'Elimina',
          action: () => handleJobAction('delete', job.jobId, status),
          color: 'error'
        });
        break;
        
      case 'pending':
      case 'processing':
        actions.push({
          icon: <Stop />,
          label: 'Cancella',
          action: () => handleJobAction('cancel', job.jobId, status),
          color: 'error'
        });
        break;
        
      case 'failed':
      case 'cancelled':
        actions.push({
          icon: <PlayArrow />,
          label: 'Riavvia',
          action: () => handleJobAction('restart', job.jobId, status),
          color: 'primary'
        });
        actions.push({
          icon: <Delete />,
          label: 'Elimina',
          action: () => handleJobAction('delete', job.jobId, status),
          color: 'error'
        });
        break;
        
      case 'completed':
        actions.push({
          icon: <Delete />,
          label: 'Elimina',
          action: () => handleJobAction('delete', job.jobId, status),
          color: 'error'
        });
        break;
    }
    
    return actions;
  };

  const loadData = useCallback(async () => {
    await Promise.all([
      loadInvoices(),
      loadStats(),
      loadSuppliers()
    ]);
  }, [loadInvoices, loadStats, loadSuppliers]);

  // Effects
  useEffect(() => {
    // Ritarda l'avvio del polling di 2 secondi dopo il caricamento iniziale
    loadData();
    const timer = setTimeout(() => {
      fetchProcessingJobs();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [loadData, fetchProcessingJobs]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  const handleSearch = () => {
    loadInvoices();
  };

  const handleViewDetails = async (invoiceId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await axiosInstance.get(
        `/api/invoices/${invoiceId}`,
        { headers }
      );

      // Estrai i dati della fattura dall'oggetto response
      setSelectedInvoice(response.data.invoice || response.data);
      setDetailDialogOpen(true);
    } catch (error) {
      ClientLogger.error('Errore nel caricamento dettagli fattura', {
        error: error,
        invoiceId: invoiceId,
        context: 'Invoices.handleViewDetails'
      });
      setError('Errore nel caricamento dei dettagli della fattura');
    }
  };

  const handleUploadSuccess = (result) => {
    // Non chiudiamo più la dialog perché non c'è più
    loadData();
    fetchProcessingJobs(); // Ricarica i job
    
    // Passa automaticamente al tab "Job di Elaborazione" per vedere i file caricati
    setActiveTab(1);
    
    // Mostra un messaggio di successo
    console.log(`Upload completato! Job ID: ${result.jobId}`);
  };

  // Configurazione del polling intelligente
  const {
    isPolling,
    hasActiveJobs,
    currentInterval,
    startPolling,
    stopPolling
  } = useSmartPolling({
    fetchJobs: fetchProcessingJobs,
    fetchInvoices: loadInvoices,
    fetchStats: loadStats, // NUOVO: Aggiungi l'aggiornamento dei KPI
    jobs: processingJobs,
    enabled: true,
    interval: 3000, // 3 secondi
    maxInterval: 10000 // massimo 10 secondi
  });

  // Funzioni per gestire gli stati dei job
  const getJobStatusLabel = (status) => {
    switch (status) {
      case 'uploaded': return 'Caricato'; // Nuovo stato
      case 'pending': return 'In Attesa';
      case 'processing': return 'In Elaborazione';
      case 'completed': return 'Completato';
      case 'failed': return 'Errore';
      case 'cancelled': return 'Annullato';
      default: return 'Sconosciuto';
    }
  };
  
  const getJobStatusColor = (status) => {
    switch (status) {
      case 'uploaded': return 'warning'; // Nuovo colore per stato uploaded
      case 'pending': return 'default';
      case 'processing': return 'info';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processed': return 'success';
      case 'processing': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'processed': return 'Elaborata';
      case 'processing': return 'In elaborazione';
      case 'error': return 'Errore';
      default: return 'Sconosciuto';
    }
  };

  if (loading && invoices.length === 0 && processingJobs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestione Fatture
        </Typography>
        {/* Rimosso il bottone di upload dalla header */}
      </Box>

      {/* Statistiche */}
      {stats && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Totale Fatture
                </Typography>
                <Typography variant="h4">
                  {stats.totalInvoices?.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Importo Totale
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(stats.totalAmount || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Importo Medio
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(stats.avgAmount || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  IVA Totale
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(stats.totalVAT || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* NUOVO: Sezione Upload Integrata */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Upload sx={{ mr: 1 }} />
            Carica Nuove Fatture
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Carica i tuoi file XML, PDF, P7M o ZIP. I file verranno preparati per l'elaborazione.
          </Typography>
          <InvoiceUploadComponent onSuccess={handleUploadSuccess} />
        </CardContent>
      </Card>

      {/* Tab per separare Fatture Elaborate e Job di Elaborazione */}
      <Card sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`Fatture Elaborate (${invoices.length})`} />
          <Tab label={`Job di Elaborazione (${processingJobs.length})`} />
        </Tabs>
      </Card>

      {/* Contenuto Tab 0: Fatture Elaborate */}
      {activeTab === 0 && (
        <>
          {/* Filtri */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
                Filtri di Ricerca
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Cerca fattura o fornitore"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Fornitore</InputLabel>
                    <Select
                      value={filters.supplierId}
                      label="Fornitore"
                      onChange={(e) => handleFilterChange('supplierId', e.target.value)}
                    >
                      <MenuItem value="">Tutti i fornitori</MenuItem>
                      {suppliers && suppliers.length > 0 ? (
                        suppliers.map((supplier) => (
                          <MenuItem key={supplier._id} value={supplier._id}>
                            {supplier.supplierName || supplier.name || 'Nome non disponibile'}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>Nessun fornitore trovato</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Data Inizio"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Data Fine"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Search />}
                    onClick={handleSearch}
                    sx={{ height: '56px' }}
                  >
                    Cerca
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Tabella Fatture Elaborate */}
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Fatture Elaborate
                </Typography>
                <IconButton onClick={loadData}>
                  <Refresh />
                </IconButton>
              </Box>
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Numero Fattura</TableCell>
                      <TableCell>Fornitore</TableCell>
                      <TableCell>Data</TableCell>
                      <TableCell align="right">Importo</TableCell>
                      <TableCell align="right">IVA</TableCell>
                      <TableCell align="center">Stato</TableCell>
                      <TableCell align="center">Azioni</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    ) : invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="textSecondary">
                            Nessuna fattura trovata
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((invoice) => (
                        <TableRow key={invoice._id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {invoice.invoiceNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="text"
                              color="primary"
                              onClick={() => navigate(`/suppliers/${invoice.supplier?._id}`)}
                              sx={{ textTransform: 'none', justifyContent: 'flex-start', p: 0 }}
                            >
                              {invoice.supplier?.name || 'N/A'}
                            </Button>
                            <Typography variant="caption" display="block" color="textSecondary">
                              {invoice.supplier?.pIva}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {new Date(invoice.invoiceDate).toLocaleDateString('it-IT')}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(invoice.totalAmount || 0)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(invoice.totalVAT || 0)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getStatusLabel(invoice.status)}
                              color={getStatusColor(invoice.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {/* Tasto Info per errori */}
                              {invoice.validationErrors && invoice.validationErrors.length > 0 && (
                                <Tooltip 
                                  title={
                                    <Box>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        Errori di validazione:
                                      </Typography>
                                      {invoice.validationErrors.map((error, index) => (
                                        <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                                          • {error.message}
                                        </Typography>
                                      ))}
                                    </Box>
                                  }
                                  arrow
                                  placement="left"
                                >
                                  <IconButton
                                    size="small"
                                    color={invoice.validationErrors.some(e => e.severity === 'error') ? 'error' : 'warning'}
                                    sx={{ 
                                      animation: 'pulse 2s infinite',
                                      '@keyframes pulse': {
                                        '0%': { opacity: 1 },
                                        '50%': { opacity: 0.5 },
                                        '100%': { opacity: 1 }
                                      }
                                    }}
                                  >
                                    <InfoIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              
                              {/* Tasto Visualizza dettagli */}
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(invoice._id)}
                                title="Visualizza dettagli"
                              >
                                <Visibility />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={pagination.totalCount}
                page={pagination.page}
                onPageChange={(event, newPage) => 
                  setPagination(prev => ({ ...prev, page: newPage }))
                }
                rowsPerPage={pagination.rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setPagination(prev => ({
                    ...prev,
                    rowsPerPage: parseInt(event.target.value, 10),
                    page: 0
                  }));
                }}
                rowsPerPageOptions={[10, 20, 50, 100]}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Contenuto Tab 1: Job di Elaborazione */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Job di Elaborazione
              </Typography>
              <IconButton onClick={fetchProcessingJobs}>
                <Refresh />
              </IconButton>
            </Box>
            
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome File</TableCell>
                    <TableCell>Data Upload</TableCell>
                    <TableCell align="center">Stato</TableCell>
                    <TableCell align="center">Progresso</TableCell>
                    <TableCell>Messaggio</TableCell>
                    <TableCell align="center">Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {processingJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="textSecondary">
                          Nessun job di elaborazione trovato
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    processingJobs.map((job) => (
                      job.files?.map((file, fileIndex) => (
                        <TableRow key={`${job.jobId}-${fileIndex}`}>
                          <TableCell>{file.filename}</TableCell>
                          <TableCell>
                            {new Date(job.createdAt).toLocaleDateString('it-IT')}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getJobStatusLabel(file.status || job.status)}
                              color={getJobStatusColor(file.status || job.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={file.progress?.percentage || job.progress || 0} 
                              />
                              <Typography variant="caption">
                                {file.progress?.percentage || job.progress || 0}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {file.progress?.message || job.message || 'File caricato, in attesa di elaborazione'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {/* NUOVO: Icona errori di validazione */}
                              {file.validationErrors && file.validationErrors.length > 0 && (
                                <Tooltip 
                                  title={
                                    <Box>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        Errori di validazione:
                                      </Typography>
                                      {file.validationErrors.map((error, index) => (
                                        <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                                          • {error.message}
                                        </Typography>
                                      ))}
                                    </Box>
                                  }
                                  arrow
                                  placement="left"
                                >
                                  <IconButton
                                    size="small"
                                    color={file.validationErrors.some(e => e.severity === 'error') ? 'error' : 'warning'}
                                    sx={{ 
                                      animation: 'pulse 2s infinite',
                                      '@keyframes pulse': {
                                        '0%': { opacity: 1 },
                                        '50%': { opacity: 0.5 },
                                        '100%': { opacity: 1 }
                                      }
                                    }}
                                  >
                                    <InfoIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              
                              {/* Azioni esistenti */}
                              {getJobActions(job, file).map((actionItem, actionIndex) => (
                                <IconButton
                                  key={actionIndex}
                                  size="small"
                                  color={actionItem.color}
                                  onClick={actionItem.action}
                                  title={actionItem.label}
                                >
                                  {actionItem.icon}
                                </IconButton>
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )) || (
                        <TableRow key={job.jobId}>
                          <TableCell>{job.jobId}</TableCell>
                          <TableCell>
                            {new Date(job.createdAt).toLocaleDateString('it-IT')}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getJobStatusLabel(job.status)}
                              color={getJobStatusColor(job.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={job.progress || 0} 
                              />
                              <Typography variant="caption">
                                {job.progress || 0}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {job.message || 'Job in elaborazione'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {getJobActions(job).map((actionItem, actionIndex) => (
                                <IconButton
                                  key={actionIndex}
                                  size="small"
                                  color={actionItem.color}
                                  onClick={actionItem.action}
                                  title={actionItem.label}
                                >
                                  {actionItem.icon}
                                </IconButton>
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Dialog Dettagli Fattura - MANTIENI QUESTO */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Dettagli Fattura: {selectedInvoice?.invoiceNumber}
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Informazioni Generali
                  </Typography>
                  <Typography><strong>Numero:</strong> {selectedInvoice.invoiceNumber}</Typography>
                  <Typography><strong>Data:</strong> {new Date(selectedInvoice.invoiceDate).toLocaleDateString('it-IT')}</Typography>
                  <Typography><strong>Importo:</strong> {formatCurrency(selectedInvoice.totalAmount || 0)}</Typography>
                  <Typography><strong>IVA:</strong> {formatCurrency(selectedInvoice.totalVAT || 0)}</Typography>
                  <Typography><strong>Valuta:</strong> {selectedInvoice.currency}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Fornitore
                  </Typography>
                  <Typography><strong>Nome:</strong> {selectedInvoice.supplierId?.name}</Typography>
                  <Typography><strong>P.IVA:</strong> {selectedInvoice.supplierId?.vatNumber}</Typography>
                  <Typography><strong>Email:</strong> {selectedInvoice.supplierId?.email || selectedInvoice.supplierId?.contatti?.email}</Typography>
                  <Typography><strong>Telefono:</strong> {selectedInvoice.supplierId?.phone || selectedInvoice.supplierId?.contatti?.telefono}</Typography>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Righe Fattura ({selectedInvoice.lineItems?.length || 0})
              </Typography>
              
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Descrizione</TableCell>
                        <TableCell align="right">Quantità</TableCell>
                        <TableCell align="center">U.M.</TableCell>
                        <TableCell align="right">Prezzo Unit.</TableCell>
                        <TableCell align="right">Totale</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedInvoice.lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="center">{item.unitOfMeasure || '-'}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="textSecondary">
                  Nessuna riga trovata per questa fattura
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Invoices;