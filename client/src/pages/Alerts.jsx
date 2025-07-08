import React, { useState, useEffect, useCallback } from 'react'; // Aggiungi useCallback
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  NotificationsActive,
  Edit,
  Delete,
  ToggleOn,
  ToggleOff,
  TrendingUp,
  Schedule,
  ExpandMore,
  Refresh
} from '@mui/icons-material'; // Rimossi Add, TrendingDown, Email
import { useSelector } from 'react-redux';
import axios from 'axios';
import { auth } from '../firebase';
import { getApiUrl } from '../utils/apiConfig';

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
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setError('Utente non autenticato');
        return;
      }
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('isActive', filterStatus === 'active');
      if (searchTerm) params.append('search', searchTerm);
      
      const requestUrl = `${apiUrl}/api/alerts?${params.toString()}`;
      console.log('🔍 Fetching alerts from:', requestUrl);
      console.log('🔑 Token present:', !!token);
      console.log('📊 Current filters:', { filterType, filterStatus, searchTerm, page, limit });
      
      const response = await axios.get(requestUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📥 API Response:', response.data);
      console.log('📋 Alerts received:', response.data.alerts);
      console.log('🔢 Total count:', response.data.total);
      
      setAlerts(response.data.alerts || []);
      
      // Calcola statistiche
      const totalAlerts = response.data.total || 0;
      const activeAlerts = response.data.alerts?.filter(alert => alert.isActive).length || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const triggeredToday = response.data.alerts?.filter(alert => 
        alert.triggerHistory?.some(trigger => 
          new Date(trigger.triggeredAt) >= today
        )
      ).length || 0;
      
      const triggeredThisWeek = response.data.alerts?.filter(alert => 
        alert.triggerHistory?.some(trigger => 
          new Date(trigger.triggeredAt) >= weekAgo
        )
      ).length || 0;
      
      const calculatedStats = {
        totalAlerts,
        activeAlerts,
        triggeredToday,
        triggeredThisWeek
      };
      
      console.log('📈 Calculated stats:', calculatedStats);
      setStats(calculatedStats);
      
    } catch (err) {
      console.error('❌ Error fetching alerts:', err);
      console.error('❌ Error response:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      setError('Errore nel caricamento degli alert');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterType, filterStatus, searchTerm]);

  const handleToggleAlert = async (alertId, currentStatus) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      
      await axios.patch( // ⭐ CAMBIATO da PUT a PATCH
        `${apiUrl}/api/alerts/${alertId}/toggle`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess(`Alert ${currentStatus ? 'disattivato' : 'attivato'} con successo`);
      await fetchAlerts();
      
    } catch (err) {
      setError('Errore nell\'aggiornamento dell\'alert');
      console.error('Error toggling alert:', err);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo alert?')) return;
    
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      
      await axios.delete(
        `${apiUrl}/api/alerts/${alertId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess('Alert eliminato con successo');
      await fetchAlerts();
      
    } catch (err) {
      setError('Errore nell\'eliminazione dell\'alert');
      console.error('Error deleting alert:', err);
    }
  };

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

  const handleSaveEdit = async () => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !selectedAlert) return;
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      
      const updateData = {
        type: editFormData.alertType, // Cambiato da alertType a type
        isActive: editFormData.isActive
      };
      
      if (editFormData.alertType === 'price_threshold') {
        updateData.thresholdPrice = parseFloat(editFormData.thresholdPrice);
      } else {
        updateData.variationThreshold = parseFloat(editFormData.variationThreshold);
      }
      
      await axios.put(
        `${apiUrl}/api/alerts/${selectedAlert._id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess('Alert aggiornato con successo');
      setEditDialog(false);
      await fetchAlerts();
      
    } catch (err) {
      setError('Errore nell\'aggiornamento dell\'alert');
      console.error('Error updating alert:', err);
    }
  };

  // Funzione per inviare email di test
  const handleSendTestEmail = async (alertId) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      
      await axios.post(
        `${apiUrl}/api/alerts/${alertId}/test`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess('Email di test inviata con successo!');
      
    } catch (err) {
      setError('Errore nell\'invio dell\'email di test');
      console.error('Error sending test email:', err);
    }
  };

  // Funzione per esportare dati alert
  const handleExportAlerts = async () => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      
      const response = await axios.get(
        `${apiUrl}/api/alerts/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Crea e scarica il file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `alerts_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('Export completato con successo!');
      
    } catch (err) {
      setError('Errore nell\'export dei dati');
      console.error('Error exporting alerts:', err);
    }
  };

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
                        {alert.alertType === 'price_threshold' ? ( // Cambiato da alert.alertType a alert.type
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
