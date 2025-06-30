import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  //Divider,
  List,
  ListItem,
  ListItemText,
  Snackbar // ← Nuovo import per feedback
} from '@mui/material';
import {
  ArrowBack,
  Search,
  TrendingUp,
  TrendingDown,
  CompareArrows,
  ShoppingCart,
  Edit, // ← Nuovo import
  Save, // ← Nuovo import
  Cancel // ← Nuovo import
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { auth } from '../firebase';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const SupplierDetail = () => {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [supplierData, setSupplierData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filteredProducts, setFilteredProducts] = useState([]);
  
  // ← Nuovi stati per editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedSupplier, setEditedSupplier] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadSupplierDetails = useCallback(async () => {
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

      let url = `${getApiUrl()}/api/suppliers/${supplierId}/details`;
      if (dateRange.start && dateRange.end) {
        url += `?startDate=${dateRange.start}&endDate=${dateRange.end}`;
      }

      
      
      const response = await axios.get(url, { headers });
     
      
      
      setSupplierData(response.data);
    } catch (error) {
      setError('Errore nel caricamento dei dettagli del fornitore');
    } finally {
      setLoading(false);
    }
  }, [supplierId, dateRange.start, dateRange.end]);

  useEffect(() => {
    loadSupplierDetails();
  }, [loadSupplierDetails]);

  // Effetto per filtrare i prodotti in base al termine di ricerca
  useEffect(() => {
    if (supplierData?.topProducts) {
      if (searchTerm.trim() === '') {
        // Se non c'è termine di ricerca, mostra tutti i prodotti
        setFilteredProducts(supplierData.topProducts);
      } else {
        // Filtra i prodotti che contengono il termine di ricerca (case-insensitive)
        const filtered = supplierData.topProducts.filter(product =>
          product._id.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredProducts(filtered);
      }
    } else {
      setFilteredProducts([]);
    }
  }, [searchTerm, supplierData]);

  const handleDateRangeChange = () => {
    if (dateRange.start && dateRange.end) {
      loadSupplierDetails();
    }
  };

  // Configurazione grafico trend mensile
  const monthlyTrendData = {
    labels: supplierData?.monthlyTrend?.map(item => 
      `${item._id.month}/${item._id.year}`
    ) || [],
    datasets: [{
      label: 'Spesa Mensile (€)',
      data: supplierData?.monthlyTrend?.map(item => item.totalSpent) || [],
      borderColor: '#3F51B5',
      backgroundColor: 'rgba(63, 81, 181, 0.1)',
      tension: 0.4
    }]
  };

  const monthlyTrendOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Trend Spesa Mensile'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '€' + value.toLocaleString();
          }
        }
      }
    }
  };

  // Configurazione grafico prodotti più acquistati
  const topProductsData = {
    labels: filteredProducts.slice(0, 10).map(product => 
      product._id.length > 30 ? product._id.substring(0, 30) + '...' : product._id
    ),
    datasets: [{
      label: 'Spesa Totale (€)',
      data: filteredProducts.slice(0, 10).map(product => product.totalSpent),
      backgroundColor: 'rgba(63, 81, 181, 0.6)',
      borderColor: '#3F51B5',
      borderWidth: 1
    }]
  };

  const topProductsOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Prodotti Più Acquistati'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '€' + value.toLocaleString();
          }
        }
      },
      x: {
        ticks: {
          maxRotation: 45
        }
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // ← Nuova funzione per salvare i dati
  const handleSaveSupplier = async () => {
    try {
      setSaving(true);
      console.log('Frontend - SupplierId:', supplierId);
      console.log('Frontend - Dati da inviare:', editedSupplier);
      
      const user = auth.currentUser;
      if (!user) {
        setSnackbar({ open: true, message: 'Utente non autenticato', severity: 'error' });
        return;
      }

      const token = await user.getIdToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.put(
        `${getApiUrl()}/api/suppliers/${supplierId}`,
        editedSupplier,
        { headers }
      );
      
      console.log('Frontend - Risposta ricevuta:', response.data);
      if (response.data.success) {
        // Aggiorna i dati locali
        setSupplierData(prev => ({
          ...prev,
          supplier: response.data.supplier
        }));
        setIsEditing(false);
        setSnackbar({ 
          open: true, 
          message: 'Fornitore aggiornato con successo', 
          severity: 'success' 
        });
      }
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Errore nel salvataggio', 
        severity: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  // ← Nuova funzione per annullare le modifiche
  const handleCancelEdit = () => {
    setEditedSupplier(supplierData?.supplier || {});
    setIsEditing(false);
  };

  // ← Nuova funzione per iniziare l'editing
  const handleStartEdit = () => {
    setEditedSupplier(supplierData?.supplier || {});
    setIsEditing(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header con nome fornitore editabile */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => navigate('/suppliers')} 
          sx={{ mr: 2 }}
        >
          <ArrowBack />
        </IconButton>
        
        {isEditing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              value={editedSupplier.name || ''}
              onChange={(e) => setEditedSupplier(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mr: 2 }}
              placeholder="Nome Fornitore"
            />
            <IconButton 
              onClick={handleSaveSupplier} 
              disabled={saving}
              color="primary"
              sx={{ mr: 1 }}
            >
              <Save />
            </IconButton>
            <IconButton 
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <Cancel />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <Typography variant="h4" sx={{ flex: 1 }}>
              {supplierData?.supplier?.name || 'Fornitore'}
            </Typography>
            <IconButton 
              onClick={handleStartEdit}
              color="primary"
            >
              <Edit />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Filtri per range di date */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filtri Analisi
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Data Inizio"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Data Fine"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={12} sm={4}>
              <Button
                variant="contained"
                onClick={handleDateRangeChange}
                disabled={!dateRange.start || !dateRange.end}
                fullWidth
              >
                Applica Filtro
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Statistiche Principali */}
      <Grid container spacing={3} mb={3}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Spesa Totale
              </Typography>
              <Typography variant="h4">
                €{(supplierData?.statistics?.totalSpent || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {supplierData?.statistics?.invoiceCount || 0} fatture
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Fattura Media
              </Typography>
              <Typography variant="h4">
                €{(supplierData?.statistics?.avgInvoiceAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Prima Fattura
              </Typography>
              <Typography variant="h6">
                {supplierData?.statistics?.firstInvoiceDate ? 
                  new Date(supplierData.statistics.firstInvoiceDate).toLocaleDateString('it-IT') : 
                  'N/A'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Ultima Fattura
              </Typography>
              <Typography variant="h6">
                {supplierData?.statistics?.lastInvoiceDate ? 
                  new Date(supplierData.statistics.lastInvoiceDate).toLocaleDateString('it-IT') : 
                  'N/A'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Grafici */}
      <Grid container spacing={3} mb={3}>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Box height={400}>
                <Line data={monthlyTrendData} options={monthlyTrendOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Box height={400}>
                <Bar data={topProductsData} options={topProductsOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Ricerca Prodotti */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Search sx={{ mr: 1, verticalAlign: 'middle' }} />
            Cerca Prodotti Specifici
          </Typography>
          <TextField
            fullWidth
            label="Cerca prodotto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Inserisci il nome del prodotto"
          />
        </CardContent>
      </Card>

      {/* Tabella Prodotti */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Prodotti Acquistati
            {searchTerm && ` (${filteredProducts.length} risultati)`}
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Prodotto</TableCell>
                  <TableCell align="right">Quantità Totale</TableCell>
                  <TableCell align="right">Spesa Totale</TableCell>
                  <TableCell align="right">Prezzo Medio</TableCell>
                  <TableCell align="right">N° Fatture</TableCell>
                  <TableCell align="center">Azioni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.slice(0, 20).map((product, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2">
                        {product._id}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {product.totalQuantity?.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      €{(product.totalSpent || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right">
                      €{(product.avgPrice || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right">
                      {product.invoiceCount}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ShoppingCart />}
                        onClick={() => {
                          // Qui potresti navigare alla scheda prodotto
                          console.log('Vai alla scheda prodotto:', product._id);
                        }}
                      >
                        Dettagli
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Sezione Potere Contrattuale */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            Su quali prodotti mi conviene richiedere riduzioni di prezzo?
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Analisi basata su volume di acquisto e frequenza. I prodotti con maggiore spesa 
            e acquisti frequenti offrono il miglior potere contrattuale.
          </Alert>
          
          <List>
            {filteredProducts.slice(0, 5).map((product, index) => (
              <ListItem key={index} divider sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <ListItemText
                      primary={product._id}
                      secondary={
                        <Typography variant="body2" color="textSecondary" component="span">
                          Spesa totale: €{product.totalSpent?.toLocaleString()} • 
                          {product.invoiceCount} fatture • 
                          Quantità: {product.totalQuantity?.toLocaleString()}
                        </Typography>
                      }
                    />
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={index < 2 ? "Alto potere contrattuale" : "Medio potere contrattuale"}
                        color={index < 2 ? "success" : "warning"}
                        size="small"
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                    {index < 2 ? 
                      <TrendingUp color="success" sx={{ fontSize: 28 }} /> : 
                      <TrendingDown color="warning" sx={{ fontSize: 28 }} />
                    }
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Sezione Confronto Concorrenti (placeholder) */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <CompareArrows sx={{ mr: 1, verticalAlign: 'middle' }} />
            Confronto con Concorrenti
          </Typography>
          <Alert severity="info">
            Funzionalità in sviluppo: qui sarà possibile confrontare i prezzi 
            dei prodotti di questo fornitore con le offerte di concorrenti.
          </Alert>
        </CardContent>
      </Card>

      {/* Snackbar per feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SupplierDetail;