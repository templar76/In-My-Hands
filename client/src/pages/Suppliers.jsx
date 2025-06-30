

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
  Grid
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { useSelector } from 'react-redux';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

// Registrazione dei componenti Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
  // Rimosso BarElement
);

const Suppliers = () => {
  const [analytics, setAnalytics] = useState(null);
  const [spendingAnalysis, setSpendingAnalysis] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('3months');
  const [timeframe, setTimeframe] = useState('month');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const user = useSelector(state => state.auth);
  const navigate = useNavigate(); // Aggiungi questa linea dopo gli altri useState
  
  // Definisco loadData con useCallback per evitare re-render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
  
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
  
      // Carica analytics
      const analyticsResponse = await axios.get(
        `${getApiUrl()}/api/suppliers/analytics`,
        { headers }
      );
      setAnalytics(analyticsResponse.data);
  
      // Carica analisi spesa
      const spendingResponse = await axios.get(
        `${getApiUrl()}/api/suppliers/spending-analysis?groupBy=${timeframe}`,
        { headers }
      );
      setSpendingAnalysis(spendingResponse.data);
  
      // Carica lista fornitori - AGGIUNTO searchTerm
      const suppliersResponse = await axios.get(
        `${getApiUrl()}/api/suppliers/search?page=${page + 1}&limit=${rowsPerPage}&search=${searchTerm}`,
        { headers }
      );
      console.log('Suppliers API Response:', suppliersResponse.data);
      console.log('Suppliers total:', suppliersResponse.data.total);
      console.log('Suppliers data:', suppliersResponse.data.data || suppliersResponse.data.suppliers);
      setSuppliers(suppliersResponse.data);
  
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }, [timeframe, page, rowsPerPage, searchTerm]); // AGGIUNTO searchTerm alle dipendenze

  // Caricamento dati iniziali
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Ricerca fornitori
  const handleSearch = () => {
    setPage(0);
    loadData();
  };

  // Configurazione grafico a torta per la distribuzione della spesa
  const pieChartData = {
    labels: analytics?.topSuppliers?.map(s => s.supplierName) || [],
    datasets: [{
      data: analytics?.topSuppliers?.map(s => s.totalSpent) || [],
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#FF6384',
        '#C9CBCF'
      ],
      borderWidth: 2
    }]
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Distribuzione Spesa per Fornitore'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: €${value.toLocaleString()} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Configurazione grafico lineare per trend temporale
  const lineChartData = {
    labels: spendingAnalysis?.timeline?.map(t => {
      const date = new Date(t._id.year, (t._id.month || 1) - 1, t._id.day || 1);
      return date.toLocaleDateString('it-IT', {
        month: 'short',
        year: timeframe === 'year' ? 'numeric' : undefined,
        day: timeframe === 'day' ? 'numeric' : undefined
      });
    }) || [],
    datasets: [{
      label: 'Spesa Totale',
      data: spendingAnalysis?.timeline?.map(t => t.totalSpent) || [],
      borderColor: '#36A2EB',
      backgroundColor: 'rgba(54, 162, 235, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Trend Spesa nel Tempo'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Spesa: €${context.parsed.y.toLocaleString()}`;
          }
        }
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

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Dashboard Fornitori
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Fornitori Attivi
              </Typography>
              <Typography variant="h4">
                {analytics?.totalSuppliers || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Spesa Totale
              </Typography>
              <Typography variant="h4">
                €{analytics?.totalSpent?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Concentrazione (HHI)
              </Typography>
              <Typography variant="h4">
                {analytics?.concentrationMetrics?.herfindahlIndex?.toFixed(0) || 0}
              </Typography>
              <Chip 
                label={analytics?.concentrationMetrics?.herfindahlIndex > 2500 ? 'Alta' : 
                       analytics?.concentrationMetrics?.herfindahlIndex > 1500 ? 'Media' : 'Bassa'}
                color={analytics?.concentrationMetrics?.herfindahlIndex > 2500 ? 'error' : 
                       analytics?.concentrationMetrics?.herfindahlIndex > 1500 ? 'warning' : 'success'}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Top 3 Fornitori
              </Typography>
              <Typography variant="h4">
                {analytics?.concentrationMetrics?.top3Percentage?.toFixed(1) || 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtri */}
      <Grid container spacing={2} mb={3}>
        <Grid xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Periodo</InputLabel>
            <Select
              value={dateRange}
              label="Periodo"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="1month">Ultimo Mese</MenuItem>
              <MenuItem value="3months">Ultimi 3 Mesi</MenuItem>
              <MenuItem value="6months">Ultimi 6 Mesi</MenuItem>
              <MenuItem value="1year">Ultimo Anno</MenuItem>
              <MenuItem value="all">Tutto il Periodo</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Raggruppamento</InputLabel>
            <Select
              value={timeframe}
              label="Raggruppamento"
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <MenuItem value="day">Giornaliero</MenuItem>
              <MenuItem value="week">Settimanale</MenuItem>
              <MenuItem value="month">Mensile</MenuItem>
              <MenuItem value="year">Annuale</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Cerca Fornitore"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </Grid>
        <Grid xs={12} sm={6} md={2}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleSearch}
            sx={{ height: '56px' }}
          >
            Cerca
          </Button>
        </Grid>
      </Grid>

      {/* Grafici */}
      <Grid container spacing={3} mb={3}>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Box height={400}>
                <Pie data={pieChartData} options={pieChartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Box height={400}>
                <Line data={lineChartData} options={lineChartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabella Fornitori */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Lista Fornitori
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Spesa Totale</TableCell>
                  <TableCell>Numero Fatture</TableCell>
                  <TableCell>Ultima Fattura</TableCell>
                  <TableCell>% sul Totale</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(suppliers.suppliers || []).map((supplier) => (
                  <TableRow key={supplier._id}>
                    <TableCell>
                      <Button
                        variant="text"
                        color="primary"
                        onClick={() => navigate(`/suppliers/${supplier._id || supplier.supplierId}`)}
                        sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                      >
                        {supplier.supplierName || supplier.name}
                      </Button>
                    </TableCell>
                    <TableCell>€{supplier.totalSpent?.toLocaleString()}</TableCell>
                    <TableCell>{supplier.invoiceCount}</TableCell>
                    <TableCell>
                      {supplier.lastInvoiceDate ? 
                        new Date(supplier.lastInvoiceDate).toLocaleDateString('it-IT') : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      {((supplier.totalSpent / analytics?.totalSpent) * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={suppliers.pagination?.total || 0}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default Suppliers;