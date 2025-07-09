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
  Divider
} from '@mui/material';
import {
  Upload,
  Visibility,
  FilterList,
  Search,
  Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { auth } from '../firebase';
import InvoiceUploadComponent from '../components/InvoiceUploadComponent';
import ClientLogger from '../utils/ClientLogger';

//const API_URL = getApiUrl();

// Aggiungi questa funzione formatCurrency
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
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  
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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);



  // PRIMA: Definire tutte le funzioni
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

      const response = await axios.get(
        `${getApiUrl()}/api/invoices`,
        { headers, params }
      );

      setInvoices(response.data.invoices);
      setPagination(prev => ({
        ...prev,
        totalCount: response.data.pagination.totalCount
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

      const response = await axios.get(
        `${getApiUrl()}/api/invoices/stats`,
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

      ClientLogger.debug('Loading suppliers from API', {
        context: 'Invoices.loadSuppliers'
      });
      const response = await axios.get(
        `${getApiUrl()}/api/suppliers`,
        { headers }
      );

      ClientLogger.debug('Suppliers API response', {
        responseData: response.data,
        suppliersCount: response.data?.length,
        context: 'Invoices.loadSuppliers'
      });
      
      if (response.data && response.data.length > 0) {
        ClientLogger.debug('First supplier structure', {
          firstSupplier: response.data[0],
          context: 'Invoices.loadSuppliers'
        });
      }
      
      setSuppliers(response.data);
    } catch (error) {
      ClientLogger.error('Errore nel caricamento fornitori', {
        error: error,
        context: 'Invoices.loadSuppliers'
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([
      loadInvoices(),
      loadStats(),
      loadSuppliers()
    ]);
  }, [loadInvoices, loadStats, loadSuppliers]);

  // Debug useEffect - per controllare i suppliers
  useEffect(() => {
    ClientLogger.debug('Suppliers state updated', {
      suppliers: suppliers,
      suppliersLength: suppliers?.length,
      context: 'Invoices.useEffect.suppliersDebug'
    });
    
    if (suppliers && suppliers.length > 0) {
      ClientLogger.debug('Suppliers analysis', {
        sampleSupplier: suppliers[0],
        suppliersMapping: suppliers.map(s => ({
          id: s._id,
          supplierName: s.supplierName,
          name: s.name,
          displayName: s.supplierName || s.name || 'Nome non disponibile'
        })),
        context: 'Invoices.useEffect.suppliersDebug'
      });
    }
  }, [suppliers]);

  // Carica dati iniziali
  useEffect(() => {
    loadData();
    loadSuppliers();
  }, [loadData, loadSuppliers]);

  // Ricarica quando cambiano filtri o paginazione
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

      const response = await axios.get(
        `${getApiUrl()}/api/invoices/${invoiceId}`,
        { headers }
      );

      setSelectedInvoice(response.data);
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

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    loadData(); // Ricarica tutti i dati
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

  if (loading && invoices.length === 0) {
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
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Carica Fattura
        </Button>
      </Box>

      {/* Statistiche */}
      {stats && (
        <Grid container spacing={3} mb={3}>
          <Grid xs={12} sm={6} md={3}>
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
          <Grid xs={12} sm={6} md={3}>
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
          <Grid xs={12} sm={6} md={3}>
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
          <Grid xs={12} sm={6} md={3}>
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

      {/* Filtri */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filtri di Ricerca
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Cerca fattura o fornitore"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </Grid>
            <Grid xs={12} sm={6} md={6}>
              <FormControl fullWidth size="medium">
                <InputLabel>Fornitore</InputLabel>
                <Select
                  value={filters.supplierId}
                  label="Fornitore"
                  onChange={(e) => handleFilterChange('supplierId', e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 400,
                        width: 'auto',
                        minWidth: 300
                      }
                    }
                  }}
                  sx={{
                    minWidth: 200,
                    '& .MuiSelect-select': {
                      paddingRight: '32px !important'
                    }
                  }}
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
            <Grid xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Data Inizio"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Data Fine"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={12} sm={6} md={2}>
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

      {/* Tabella Fatture */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Lista Fatture
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
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(invoice._id)}
                          title="Visualizza dettagli"
                        >
                          <Visibility />
                        </IconButton>
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

      {/* Dialog Upload Fattura */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Carica Nuova Fattura
        </DialogTitle>
        <DialogContent>
          <InvoiceUploadComponent onSuccess={handleUploadSuccess} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Dettagli Fattura */}
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
                <Grid xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Informazioni Generali
                  </Typography>
                  <Typography><strong>Numero:</strong> {selectedInvoice.invoiceNumber}</Typography>
                  <Typography><strong>Data:</strong> {new Date(selectedInvoice.invoiceDate).toLocaleDateString('it-IT')}</Typography>
                  <Typography><strong>Importo:</strong> {formatCurrency(selectedInvoice.totalAmount || 0)}</Typography>
                  <Typography><strong>IVA:</strong> {formatCurrency(selectedInvoice.totalVAT || 0)}</Typography>
                  <Typography><strong>Valuta:</strong> {selectedInvoice.currency}</Typography>
                </Grid>
                <Grid xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Fornitore
                  </Typography>
                  <Typography><strong>Nome:</strong> {selectedInvoice.supplierId?.name}</Typography>
                  <Typography><strong>P.IVA:</strong> {selectedInvoice.supplierId?.pIva}</Typography>
                  <Typography><strong>Email:</strong> {selectedInvoice.supplierId?.email}</Typography>
                  <Typography><strong>Telefono:</strong> {selectedInvoice.supplierId?.phone}</Typography>
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