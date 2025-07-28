import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Tabs,
  Tab,
  Alert,
  Pagination,
  CircularProgress
} from '@mui/material';
import {
  Edit,
  Delete,
  ToggleOn,
  ToggleOff,
  Schedule,
  FileDownload,
  Refresh,
  TrendingUp,
  NotificationsActive
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getFirebaseToken } from '../store/authSlice';
import ClientLogger from '../utils/ClientLogger';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`alerts-tabpanel-${index}`}
      aria-labelledby={`alerts-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Alerts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  // Aggiungi questa funzione per la navigazione ai prodotti
  const handleProductClick = useCallback((productId) => {
    if (productId) {
      navigate(`/products/${productId}`);
    }
  }, [navigate]);
  const [tabValue, setTabValue] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({
    totalAlerts: 0,
    activeAlerts: 0,
    triggeredToday: 0,
    triggeredThisWeek: 0
  });
  
  // Filtri e paginazione
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog per modifica alert
  const [editDialog, setEditDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [editFormData, setEditFormData] = useState({
    alertType: 'price_threshold',
    thresholdPrice: '',
    variationThreshold: '10',
    isActive: true
  });

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const token = await dispatch(getFirebaseToken()).unwrap();
      
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts?page=${page}&limit=${limit}&search=${searchTerm}&type=${filterType}&status=${filterStatus}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      ClientLogger.info('Alerts fetched successfully', {
        component: 'Alerts',
        action: 'fetchAlerts',
        alertsCount: data.alerts?.length || 0,
        page,
        limit,
        searchTerm,
        filterType,
        filterStatus
      });
      
      setAlerts(data.alerts || []);
      setStats(data.stats || {});
      
      ClientLogger.debug('Alerts data processed', {
        component: 'Alerts',
        action: 'fetchAlerts',
        alertsProcessed: data.alerts?.length || 0,
        stats: data.stats
      });
    } catch (error) {
      ClientLogger.error('Error fetching alerts', {
        component: 'Alerts',
        action: 'fetchAlerts',
        error: error.message,
        page,
        limit,
        searchTerm,
        filterType,
        filterStatus
      });
      setError('Errore nel caricamento degli alert');
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, limit, searchTerm, filterType, filterStatus]);

  const handleToggleAlert = useCallback(async (alertId, currentStatus) => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${alertId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await fetchAlerts();
    } catch (error) {
      ClientLogger.error('Error toggling alert status', {
        component: 'Alerts',
        action: 'handleToggleAlert',
        alertId,
        currentStatus,
        error: error.message
      });
      setError('Errore nell\'aggiornamento dello stato dell\'alert');
    }
  }, [dispatch, fetchAlerts]);

  const handleDeleteAlert = useCallback(async (alertId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo alert?')) {
      return;
    }
    
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await fetchAlerts();
    } catch (error) {
      ClientLogger.error('Error deleting alert', {
        component: 'Alerts',
        action: 'handleDeleteAlert',
        alertId,
        error: error.message
      });
      setError('Errore nell\'eliminazione dell\'alert');
    }
  }, [dispatch, fetchAlerts]);

  const handleEditAlert = (alert) => {
    setSelectedAlert(alert);
    setEditFormData({
      alertType: alert.type, // Cambiato da alert.alertType a alert.type
      thresholdPrice: alert.thresholdPrice?.toString() || '',
      variationThreshold: alert.variationThreshold?.toString() || '10',
      isActive: alert.isActive
    });
    setEditDialog(true);
  };

  const handleSaveEdit = useCallback(async () => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${selectedAlert._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alertType: editFormData.alertType,
          thresholdPrice: editFormData.alertType === 'price_threshold' ? parseFloat(editFormData.thresholdPrice) : undefined,
          variationThreshold: editFormData.alertType === 'price_variation' ? parseInt(editFormData.variationThreshold) : undefined,
          isActive: editFormData.isActive
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setEditDialog(false);
      await fetchAlerts();
    } catch (error) {
      ClientLogger.error('Error updating alert', {
        component: 'Alerts',
        action: 'handleSaveEdit',
        alertId: editFormData._id,
        alertType: editFormData.alertType,
        error: error.message
      });
      setError('Errore nell\'aggiornamento dell\'alert');
    }
  }, [dispatch, fetchAlerts, selectedAlert, editFormData]);

  // Funzione per inviare email di test
  const handleSendTestEmail = useCallback(async (alertId) => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${alertId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setSuccess('Email di test inviata con successo!');
    } catch (error) {
      ClientLogger.error('Error sending test email', {
        component: 'Alerts',
        action: 'handleSendTestEmail',
        alertId,
        error: error.message
      });
      setError('Errore nell\'invio dell\'email di test');
    }
  }, [dispatch]);

  // Funzione per esportare dati alert
  const handleExportAlerts = useCallback(async () => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/export`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `alerts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      ClientLogger.error('Error exporting alerts', {
        component: 'Alerts',
        action: 'handleExportAlerts',
        error: error.message
      });
      setError('Errore nell\'esportazione degli alert');
    }
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    }
  }, [fetchAlerts, isAuthenticated]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestione Alert
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={handleExportAlerts}
            disabled={alerts.length === 0}
          >
            Esporta CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchAlerts}
          >
            Aggiorna
          </Button>
        </Box>
      </Box>

      {/* Messaggi di feedback */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Dashboard" icon={<TrendingUp />} />
          <Tab label="Lista Alert" icon={<NotificationsActive />} />
        </Tabs>
      </Box>

      {/* Dashboard Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* KPI Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Alert Totali
                    </Typography>
                    <Typography variant="h4">
                      {stats.totalAlerts}
                    </Typography>
                  </Box>
                  <NotificationsActive color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Alert Attivi
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {stats.activeAlerts}
                    </Typography>
                  </Box>
                  <ToggleOn color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Scattati Oggi
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {stats.triggeredToday}
                    </Typography>
                  </Box>
                  <Schedule color="warning" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Scattati Settimana
                    </Typography>
                    <Typography variant="h4" color="info.main">
                      {stats.triggeredThisWeek}
                    </Typography>
                  </Box>
                  <TrendingUp color="info" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Alert Recenti */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Alert Attivati di Recente
            </Typography>
            {alerts.filter(alert => 
              alert.triggerHistory && alert.triggerHistory.length > 0
            ).slice(0, 5).map((alert) => {
              const lastTrigger = alert.triggerHistory[alert.triggerHistory.length - 1];
              return (
                <Accordion key={alert._id}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box display="flex" alignItems="center" width="100%">
                      <Box flexGrow={1}>
                        <Typography variant="subtitle1">
                          {alert.productId?.description || 'Prodotto non trovato'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(lastTrigger.triggeredAt)}
                        </Typography>
                      </Box>
                      <Chip 
                        label={alert.type === 'price_threshold' ? 'Soglia' : 'Variazione'} // Cambiato da alert.alertType a alert.type
                        size="small"
                        color={alert.type === 'price_threshold' ? 'primary' : 'secondary'} // Cambiato da alert.alertType a alert.type
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">
                      <strong>Prezzo rilevato:</strong> {formatCurrency(lastTrigger.currentPrice)}<br/>
                      <strong>Prezzo medio:</strong> {formatCurrency(lastTrigger.averagePrice)}<br/>
                      {alert.type === 'price_threshold' && ( // Cambiato da alert.alertType a alert.type
                        <><strong>Soglia impostata:</strong> {formatCurrency(alert.thresholdPrice)}<br/></>
                      )}
                      {alert.type === 'price_variation' && ( // Cambiato da alert.alertType a alert.type
                        <><strong>Variazione rilevata:</strong> {lastTrigger.variationPercentage}%<br/></>
                      )}
                      <strong>Fornitore:</strong> {lastTrigger.supplierName}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
            
            {alerts.filter(alert => 
              alert.triggerHistory && alert.triggerHistory.length > 0
            ).length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                Nessun alert attivato di recente
              </Typography>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Lista Alert Tab */}
      <TabPanel value={tabValue} index={1}>
        {/* Filtri */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Cerca prodotto"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo Alert</InputLabel>
                  <Select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    label="Tipo Alert"
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="price_threshold">Soglia Prezzo</MenuItem>
                    <MenuItem value="price_variation">Variazione Prezzo</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stato</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Stato"
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="active">Attivi</MenuItem>
                    <MenuItem value="inactive">Disattivi</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setFilterStatus('all');
                    setPage(1);
                  }}
                >
                  Reset Filtri
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabella Alert */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Prodotto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Configurazione</TableCell>
                    <TableCell>Stato</TableCell>
                    <TableCell>Attivazioni</TableCell>
                    <TableCell>Ultima Attivazione</TableCell>
                    <TableCell align="center">Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert._id}>
                      <TableCell>
                          {alert.product ? (
                        <Box
                          onClick={() => handleProductClick(alert.product._id)}
                          sx={{
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: '4px',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
    >
      <Typography 
        variant="subtitle2"
        sx={{
          color: 'primary.main',
          fontWeight: 600,
          fontSize: '0.875rem',
          lineHeight: 1.2,
          '&:hover': {
            textDecoration: 'underline'
          }
        }}
      >
        {alert.product.codeInternal || 'N/A'}
      </Typography>
      <Typography 
        variant="body2" 
        sx={{
          color: 'text.secondary',
          fontSize: '0.75rem',
          lineHeight: 1.1,
          mt: 0.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {alert.product.descriptionStd || 'Descrizione non disponibile'}
      </Typography>
    </Box>
  ) : (
    <Box>
      <Typography variant="subtitle2" color="error" sx={{ fontSize: '0.875rem' }}>
        Codice non trovato
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
        Prodotto non disponibile
      </Typography>
    </Box>
  )}
</TableCell>
                      
                      <TableCell>
                        <Chip 
                          label={alert.alertType === 'price_threshold' ? 'Soglia' : 'Variazione'}
                          size="small"
                          color={alert.alertType === 'price_threshold' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      
                      <TableCell>
                        {alert.alertType === 'price_threshold' ? ( 
                          <Typography variant="body2">
                            Soglia: {formatCurrency(alert.thresholdPrice)}
                          </Typography>
                        ) : (
                          <Typography variant="body2">
                            Variazione: {alert.variationThreshold}%
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Chip 
                          label={alert.isActive ? 'Attivo' : 'Disattivo'}
                          size="small"
                          color={alert.isActive ? 'success' : 'default'}
                          icon={alert.isActive ? <ToggleOn /> : <ToggleOff />}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {alert.triggerHistory?.length || 0}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        {alert.triggerHistory && alert.triggerHistory.length > 0 ? (
                          <Typography variant="body2">
                            {formatDate(alert.triggerHistory[alert.triggerHistory.length - 1].triggeredAt)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Mai
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell align="center">
                        <Box display="flex" gap={1} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => handleToggleAlert(alert._id, alert.isActive)}
                            color={alert.isActive ? 'warning' : 'success'}
                            title={alert.isActive ? 'Disattiva' : 'Attiva'}
                          >
                            {alert.isActive ? <ToggleOff /> : <ToggleOn />}
                          </IconButton>
                          
                          <IconButton
                            size="small"
                            onClick={() => handleEditAlert(alert)}
                            color="primary"
                            title="Modifica"
                          >
                            <Edit />
                          </IconButton>
                          
                          <IconButton
                            size="small"
                            onClick={() => handleSendTestEmail(alert._id)}
                            color="info"
                            title="Test Email"
                            disabled={!alert.isActive}
                          >
                            <Schedule />
                          </IconButton>
                          
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteAlert(alert._id)}
                            color="error"
                            title="Elimina"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {alerts.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  Nessun alert trovato
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Crea il tuo primo alert dalla pagina di dettaglio di un prodotto
                </Typography>
              </Box>
            )}
            
            {/* Paginazione */}
            {alerts.length > 0 && (
              <Box display="flex" justifyContent="center" mt={3}>
                <Pagination
                  count={Math.ceil(stats.totalAlerts / limit)}
                  page={page}
                  onChange={(event, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Dialog per modifica alert */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifica Alert</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Tipo Alert</InputLabel>
              <Select
                value={editFormData.alertType}
                onChange={(e) => setEditFormData({...editFormData, alertType: e.target.value})}
                label="Tipo Alert"
              >
                <MenuItem value="price_threshold">Soglia Prezzo</MenuItem>
                <MenuItem value="price_variation">Variazione Prezzo</MenuItem>
              </Select>
            </FormControl>
            
            {editFormData.alertType === 'price_threshold' ? (
              <TextField
                fullWidth
                margin="normal"
                label="Prezzo soglia (€)"
                type="number"
                value={editFormData.thresholdPrice}
                onChange={(e) => setEditFormData({...editFormData, thresholdPrice: e.target.value})}
                inputProps={{ min: 0, step: 0.01 }}
              />
            ) : (
              <TextField
                fullWidth
                margin="normal"
                label="Soglia variazione (%)"
                type="number"
                value={editFormData.variationThreshold}
                onChange={(e) => setEditFormData({...editFormData, variationThreshold: e.target.value})}
                inputProps={{ min: 1, max: 100 }}
              />
            )}
            
            <FormControlLabel
              control={
                <Switch
                  checked={editFormData.isActive}
                  onChange={(e) => setEditFormData({...editFormData, isActive: e.target.checked})}
                />
              }
              label="Alert attivo"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Annulla</Button>
          <Button onClick={handleSaveEdit} variant="contained">Salva</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Alerts;
