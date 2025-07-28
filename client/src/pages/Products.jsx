import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  TrendingUp as TrendingUpIcon,
  Euro as EuroIcon,
  Business as BusinessIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
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
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getApiUrl } from '../utils/apiConfig';
import  ClientLogger  from '../utils/ClientLogger';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = getApiUrl();

function Products() {
  const navigate = useNavigate();
  
  // Stati per i dati
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  
  // Stati per UI e filtri
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [category, setCategory] = useState('');
  
  // Stati per autenticazione
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Gestione autenticazione
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        navigate('/login');
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);

  // Funzioni di formattazione
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

  // Fetch dei prodotti
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
        sortBy,
        sortOrder,
        ...(category && { category })
      });

      const response = await fetch(`${API_URL}/api/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento dei prodotti');
      }

      const data = await response.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, sortBy, sortOrder, category, user]);

  // Fetch delle statistiche
  const fetchStats = useCallback(async () => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      const response = await fetch(`${API_URL}/api/products/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento delle statistiche');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      ClientLogger.error('Error fetching product stats', {
        error: err.message,
        userId: user?.uid,
        component: 'Products',
        action: 'fetchStats'
      });
    }
  }, [user]);

  // Effetti per caricare dati
  useEffect(() => {
    if (user && !authLoading) {
      fetchProducts();
    }
  }, [fetchProducts, user, authLoading]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchStats();
    }
  }, [fetchStats, user, authLoading]);

  // Event handlers
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleProductClick = (productId) => {
    console.log('Product ID type:', typeof productId);
  console.log('Product ID value:', productId);
  console.log('Product ID string:', String(productId));
  
  if (!productId) {
    console.error('Product ID is null or undefined');
    return;
  }
  
  // Assicurati che sia una stringa
  const idString = String(productId);
  navigate(`/products/${idString}`);
    //navigate(`/products/${productId}`);
  };

  // Dati per il grafico
  const chartData = {
    labels: stats?.monthlyTrend?.map(item => {
      const [year, month] = item.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
    }) || [],
    datasets: [
      {
        label: 'Volume Acquisti (€)',
        data: stats?.monthlyTrend?.map(item => item.totalValue || 0) || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: true,
        text: 'Trend Mensile Acquisti Prodotti'
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

  // Rendering condizionale per stati di caricamento
  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return null;
  }

  if (loading && !stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Prodotti
      </Typography>
      
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Panoramica generale sui tuoi acquisti che permette di:
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      {stats && stats.stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Volumi Totali di Acquisto
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(stats.stats.totalVolume)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      negli ultimi 12 mesi
                    </Typography>
                  </Box>
                  <EuroIcon color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Fornitori Attivi
                    </Typography>
                    <Typography variant="h5">
                      {stats.stats.activeSuppliers || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      negli ultimi 12 mesi
                    </Typography>
                  </Box>
                  <BusinessIcon color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Prodotti Unici
                    </Typography>
                    <Typography variant="h5">
                      {stats.stats.uniqueProducts || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      varietà acquistata
                    </Typography>
                  </Box>
                  <CategoryIcon color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" component="div" sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    Crescita Mensile
                  </Typography>
                  <TrendingUpIcon sx={{ color: 'success.main' }} />
                </Box>
                <Typography 
                  variant="h4" 
                  component="div" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: stats?.stats?.hasInsufficientData ? 'text.secondary' : 
                           (stats?.stats?.monthlyGrowth >= 0 ? 'success.main' : 'error.main')
                  }}
                >
                  {stats?.stats?.hasInsufficientData ? '--' : `${stats?.stats?.monthlyGrowth || 0}%`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs mese precedente
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {/* Avviso dati insufficienti */}
      {stats?.stats?.hasInsufficientData && (
        <Box sx={{ mb: 4, p: 2, backgroundColor: 'info.light', borderRadius: 1 }}>
          <Typography variant="body2" color="info.dark" sx={{ textAlign: 'center' }}>
            Primo periodo con dati non sufficienti
          </Typography>
        </Box>
      )}

      {/* Monthly Trend Chart */}
      {stats?.monthlyTrend && stats.monthlyTrend.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Line data={chartData} options={chartOptions} />
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Cerca prodotto..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Categoria</InputLabel>
                <Select
                  value={category}
                  label="Categoria"
                  onChange={(e) => setCategory(e.target.value)}>
                  <MenuItem value="">Tutte</MenuItem>
                  {stats?.categories?.filter(Boolean).map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Ordina per</InputLabel>
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  label="Ordina per"
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                >
                  <MenuItem value="relevance-desc">Più rilevanti</MenuItem>
                  <MenuItem value="updatedAt-desc">Più recenti</MenuItem>
                  <MenuItem value="totalSpent-desc">Spesa maggiore</MenuItem>
                  <MenuItem value="totalQuantityPurchased-desc">Quantità maggiore</MenuItem>
                  <MenuItem value="description-asc">Nome A-Z</MenuItem>
                  <MenuItem value="description-desc">Nome Z-A</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Naviga tra tutti i tuoi prodotti individuando quelli più rilevanti
            {searchTerm && ` (${pagination?.totalItems || 0} risultati)`}
          </Typography>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Prodotto</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell align="right">Spesa Totale</TableCell>
                  <TableCell align="right">Quantità</TableCell>
                  <TableCell align="center">U.M.</TableCell>
                  <TableCell align="right">Prezzo Medio</TableCell>
                  <TableCell align="right">Ultimo Acquisto</TableCell>
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
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">
                        Nessun prodotto trovato
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {product.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {product.codeInternal}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {product.category ? (
                          <Chip label={product.category} size="small" />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(product.totalSpent)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {product.totalQuantityPurchased?.toLocaleString()}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">
                          {product.unitOfMeasure || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(product.averagePrice)}
                      </TableCell>
                      <TableCell align="right">
                        {product.lastPurchaseDate ? formatDate(product.lastPurchaseDate) : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleProductClick(product._id)}
                          title="Vedi dettagli">
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {pagination && (
            <TablePagination
              component="div"
              count={pagination.totalItems || 0}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Righe per pagina:"
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} di ${count !== -1 ? count : `più di ${to}`}`
              }
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default Products;