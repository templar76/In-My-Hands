import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack,
  TrendingUp,
  NotificationsActive,
  Calculate,
  History,
  ExpandMore,
  CheckCircle,
  Cancel,
  Schedule
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import axios from 'axios';
import { auth } from '../firebase';
import { getApiUrl } from '../utils/apiConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`product-tabpanel-${index}`}
      aria-labelledby={`product-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [tabValue, setTabValue] = useState(0);
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);

  const fetchProductDetails = useCallback(async () => {
    try {
      setLoading(true);
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setError('Utente non autenticato');
        return;
      }
      
      const token = await firebaseUser.getIdToken();
      const apiUrl = getApiUrl();
      const response = await axios.get(
        `${apiUrl}/api/products/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // DEBUG: Aggiungi questo log
      console.log('=== FRONTEND PRODUCT DETAIL DEBUG ===');
      console.log('Response data:', response.data);
      console.log('Overview data:', response.data.overview);
      console.log('Overview totalVolume:', response.data.overview?.totalVolume);
      console.log('Overview totalQuantity:', response.data.overview?.totalQuantity);
      console.log('Overview averagePrice:', response.data.overview?.averagePrice);
      console.log('Purchase History:', response.data.purchaseHistory);
      console.log('First transaction:', response.data.purchaseHistory?.transactions?.[0]);
      console.log('Transaction keys:', response.data.purchaseHistory?.transactions?.[0] ? Object.keys(response.data.purchaseHistory.transactions[0]) : 'No transactions');
      console.log('====================================');
      
      setProductData(response.data);
    } catch (err) {
      setError('Errore nel caricamento dei dettagli del prodotto');
      console.error('Error fetching product details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProductDetails();
    }
  }, [fetchProductDetails, isAuthenticated]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('it-IT');
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

  if (!productData) {
    return (
      <Box p={3}>
        <Alert severity="warning">Prodotto non trovato</Alert>
      </Box>
    );
  }

  const { product, overview, purchaseHistory, savings } = productData;

  // Dati per il grafico dell'overview - con controlli di sicurezza
  const chartData = {
    labels: (overview?.monthlyData || []).map(item => 
      `${item._id.month}/${item._id.year}`
    ).reverse(),
    datasets: [
      {
        label: 'Volume Mensile (€)',
        data: (overview?.monthlyData || []).map(item => item.totalVolume).reverse(),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'Prezzo Medio (€)',
        data: (overview?.monthlyData || []).map(item => item.averagePrice).reverse(),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1,
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Mese'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Volume (€)'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Prezzo Medio (€)'
        },
        grid: {
          drawOnChartArea: false,
        },
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Andamento Volumi e Prezzi'
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      {/* Nella sezione header, dopo il codice interno: */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/products')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {product.description}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Codice: {product.codeInternal}
          </Typography>
          
          {/* NUOVO: Stato di Approvazione */}
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={
                product.approvalStatus === 'approved' ? 'Approvato' :
                product.approvalStatus === 'rejected' ? 'Rifiutato' :
                'Da Approvare'
              }
              color={
                product.approvalStatus === 'approved' ? 'success' :
                product.approvalStatus === 'rejected' ? 'error' :
                'warning'
              }
              size="small"
              icon={
                product.approvalStatus === 'approved' ? <CheckCircle /> :
                product.approvalStatus === 'rejected' ? <Cancel /> :
                <Schedule />
              }
            />
            {product.approvedAt && (
              <Typography variant="caption" color="text.secondary">
                {product.approvalStatus === 'approved' ? 'Approvato' : 'Modificato'} il {formatDate(product.approvedAt)}
              </Typography>
            )}
          </Box>
          
          {product.category && (
            <Chip label={product.category} size="small" sx={{ mt: 1 }} />
          )}
        </Box>
      </Box>

      {/* Mobile: Accordion Layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">📊 Overview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Overview Content */}
            <Grid container spacing={2}>
              <Grid xs={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(overview?.totalVolume || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Volume Totale
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid xs={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(overview?.averagePrice || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Prezzo Medio
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {/* Continua con le altre card per totalQuantity e supplierCount */}
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">📋 Storico Acquisti</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Purchase History Content */}
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Fornitore</TableCell>
                    <TableCell align="right">Prezzo</TableCell>
                    <TableCell align="right">Qtà</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseHistory.transactions.slice(0, 10).map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(transaction.invoiceDate)}</TableCell>
                      <TableCell>{transaction.supplier.name}</TableCell>
                      <TableCell align="right">{formatCurrency(transaction.unitPrice)}</TableCell>
                      <TableCell align="right">{transaction.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">🔔 Imposta Alert</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Alert Settings Content */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={alertEnabled}
                    onChange={(e) => setAlertEnabled(e.target.checked)}
                  />
                }
                label="Abilita alert di prezzo"
              />
              {alertEnabled && (
                <Box mt={2}>
                  <TextField
                    fullWidth
                    label="Prezzo soglia (€)"
                    type="number"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button variant="contained" fullWidth>
                    Conferma Alert
                  </Button>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">💰 Calcola Risparmio</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Savings Calculation Content */}
            <Box>
              {savings.potentialSavings > 0 ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Risparmio potenziale: <strong>{formatCurrency(savings.potentialSavings)}</strong>
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Stai già acquistando al miglior prezzo disponibile
                </Alert>
              )}
              
              <Typography variant="h6" gutterBottom>
                Confronto Fornitori
              </Typography>
              
              {savings.supplierComparison.map((supplier, index) => (
                <Card key={supplier._id} sx={{ mb: 1 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle1">
                          {supplier.supplierName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Prezzo medio: {formatCurrency(supplier.averagePrice)}
                        </Typography>
                      </Box>
                      {index === 0 && (
                        <Chip label="Migliore" color="success" size="small" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Desktop: Tab Layout */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="product detail tabs">
            <Tab label="Overview" icon={<TrendingUp />} />
            <Tab label="Storico Acquisti" icon={<History />} />
            <Tab label="Imposta Alert" icon={<NotificationsActive />} />
            <Tab label="Calcola Risparmio" icon={<Calculate />} />
          </Tabs>
        </Box>

        {/* Rimuovi tutto il codice dalle linee 685-732 e sostituisci con: */}
        <TabPanel value={tabValue} index={0}>
          {/* Overview Tab Content */}
          <Grid container spacing={3}>
            <Grid xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {formatCurrency(overview.totalVolume)}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Volume Totale (12 mesi)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {formatCurrency(overview.averagePrice)}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Prezzo Medio
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {overview.totalQuantity}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Quantità Totale
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {overview.supplierCount}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Fornitori
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Stato Approvazione - AGGIUNTO CORRETTAMENTE */}
            <Grid xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Stato Approvazione
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Chip 
                      label={
                        product.approvalStatus === 'approved' ? 'Approvato' :
                        product.approvalStatus === 'rejected' ? 'Rifiutato' :
                        'In Attesa di Approvazione'
                      }
                      color={
                        product.approvalStatus === 'approved' ? 'success' :
                        product.approvalStatus === 'rejected' ? 'error' :
                        'warning'
                      }
                      icon={
                        product.approvalStatus === 'approved' ? <CheckCircle /> :
                        product.approvalStatus === 'rejected' ? <Cancel /> :
                        <Schedule />
                      }
                    />
                  </Box>
                  
                  {product.approvalStatus === 'pending' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Questo prodotto è in attesa di approvazione. Verifica la descrizione e i possibili duplicati.
                    </Alert>
                  )}
                  
                  {product.approvedAt && (
                    <Typography variant="body2" color="text.secondary">
                      {product.approvalStatus === 'approved' ? 'Approvato' : 'Ultima modifica'}: {formatDate(product.approvedAt)}
                    </Typography>
                  )}
                  
                  {product.approvalNotes && (
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                      Note: {product.approvalNotes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {/* Chart */}
            <Grid xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Andamento Mensile
                  </Typography>
                  <Line data={chartData} options={chartOptions} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Purchase History Tab Content */}
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Storico Acquisti
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Data Fattura</TableCell>
                      <TableCell>Numero Fattura</TableCell>
                      <TableCell>Fornitore</TableCell>
                      <TableCell>Descrizione</TableCell>
                      <TableCell align="right">Quantità</TableCell>
                      <TableCell align="center">U.M.</TableCell>
                      <TableCell align="right">Prezzo Unitario</TableCell>
                      <TableCell align="right">Totale</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(purchaseHistory?.transactions || []).map((transaction, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(transaction.invoiceDate)}</TableCell>
                        <TableCell>{transaction.invoiceNumber}</TableCell>
                        <TableCell>{transaction.supplier.name}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell align="right">{transaction.quantity}</TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="text.secondary">
                            {transaction.unitOfMeasure || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(transaction.unitPrice)}</TableCell>
                        <TableCell align="right">{formatCurrency(transaction.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Alert Settings Tab Content */}
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Imposta Alert di Prezzo
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={alertEnabled}
                        onChange={(e) => setAlertEnabled(e.target.checked)}
                      />
                    }
                    label="Abilita alert di prezzo"
                  />
                  {alertEnabled && (
                    <Box mt={2}>
                      <TextField
                        fullWidth
                        label="Prezzo soglia (€)"
                        type="number"
                        value={alertPrice}
                        onChange={(e) => setAlertPrice(e.target.value)}
                        helperText="Riceverai una notifica quando il prezzo scende sotto questa soglia"
                        sx={{ mb: 2 }}
                      />
                      <Button variant="contained">
                        Conferma Alert
                      </Button>
                    </Box>
                  )}
                </Grid>
                <Grid xs={12} md={6}>
                  <Alert severity="info">
                    Gli alert verranno inviati via email quando:
                    <ul>
                      <li>Il prezzo scende sotto la soglia impostata</li>
                      <li>Viene rilevato un nuovo fornitore con prezzo migliore</li>
                      <li>Si verificano variazioni significative di prezzo</li>
                    </ul>
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {/* Savings Calculation Tab Content */}
          <Grid container spacing={3}>
            <Grid xs={12}>
              {savings.potentialSavings > 0 ? (
                <Alert severity="success">
                  <Typography variant="h6">
                    Risparmio potenziale negli ultimi 12 mesi: <strong>{formatCurrency(savings.potentialSavings)}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Acquistando sempre dal fornitore più conveniente ({savings.bestSupplier?.supplierName})
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="info">
                  <Typography variant="h6">
                    Ottimo! Stai già acquistando al miglior prezzo disponibile
                  </Typography>
                </Alert>
              )}
            </Grid>
            
            <Grid xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    Confronto Fornitori (Ultimi 12 mesi)
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Fornitore</TableCell>
                          <TableCell align="right">Prezzo Medio</TableCell>
                          <TableCell align="right">Prezzo Min</TableCell>
                          <TableCell align="right">Prezzo Max</TableCell>
                          <TableCell align="right">Quantità Totale</TableCell>
                          <TableCell align="right">Spesa Totale</TableCell>
                          <TableCell align="right">Ultimo Acquisto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {savings.supplierComparison.map((supplier, index) => (
                          <TableRow key={supplier._id}>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                {supplier.supplierName}
                                {index === 0 && (
                                  <Chip label="Migliore" color="success" size="small" sx={{ ml: 1 }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(supplier.averagePrice)}</TableCell>
                            <TableCell align="right">{formatCurrency(supplier.minPrice)}</TableCell>
                            <TableCell align="right">{formatCurrency(supplier.maxPrice)}</TableCell>
                            <TableCell align="right">{supplier.totalQuantity}</TableCell>
                            <TableCell align="right">{formatCurrency(supplier.totalSpent)}</TableCell>
                            <TableCell align="right">{formatDate(supplier.lastPurchase)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Box>
  );
};

export default ProductDetail;