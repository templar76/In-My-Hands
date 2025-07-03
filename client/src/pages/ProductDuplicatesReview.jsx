import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import {
  Box,
  Typography,
  Alert,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  Card,
  CardContent,
  Paper
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { getApiUrl } from '../utils/apiConfig';

const API_URL = getApiUrl();

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const ProductDuplicatesReview = () => {
  const [duplicates, setDuplicates] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError('Utente non autenticato.');
          setLoading(false);
          return;
        }
        
        const token = await user.getIdToken();
        
        // Fetch duplicates e insights in parallelo
        const [duplicatesRes, insightsRes] = await Promise.all([
          axios.get(`${API_URL}/api/product-duplicates`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_URL}/api/products/import/insights`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        console.log('Duplicates response:', duplicatesRes.data);
        console.log('Insights response:', insightsRes.data);
        
        // Imposta insights
        setInsights(insightsRes.data);
        
        // Salva informazioni di debug
        setDebugInfo({
          totalGroups: duplicatesRes.data.groups?.length || 0,
          rawData: duplicatesRes.data
        });
        
        // Trasforma la struttura dati per allinearla con il frontend
        const transformedData = duplicatesRes.data.groups.map(group => ({
          id: group.groupId,
          standardDesc: group.groupId,
          items: group.products.map(product => ({
            _id: product._id,
            supplierName: product.supplierName || 'N/A',
            price: product.prices?.[0]?.price || 0,
            description: product.description || 'N/A',
            codeInternal: product.codeInternal || 'N/A',
            createdAt: product.createdAt
          }))
        }));
        
        console.log('Transformed data:', transformedData);
        setDuplicates(transformedData);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(`Errore nel caricamento dei dati: ${err.response?.data?.error || err.message}`);
        setDebugInfo({
          error: err.response?.data || err.message,
          status: err.response?.status
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMerge = async (groupId) => {
    try {
      setLoading(true);
      const token = await auth.currentUser.getIdToken();
      
      const group = duplicates.find(g => g.id === groupId);
      if (!group || !group.items.length) {
        setAlert({ type: 'error', message: 'Gruppo non trovato.' });
        return;
      }
      
      const primaryProductId = group.items[0]._id;
      console.log('Merging group:', groupId, 'Primary product:', primaryProductId);
      
      await axios.post(
        `${API_URL}/api/product-duplicates/${encodeURIComponent(groupId)}/merge`,
        { primaryProductId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAlert({ type: 'success', message: 'Prodotti uniti con successo.' });
      setDuplicates(prev => prev.filter(g => g.id !== groupId));
    } catch (err) {
      console.error('Merge error:', err);
      setAlert({ type: 'error', message: err.response?.data?.error || 'Merge fallito. Riprova più tardi.' });
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = async (groupId) => {
    try {
      const token = await auth.currentUser.getIdToken();
      console.log('Ignoring group:', groupId);
      
      await axios.post(
        `${API_URL}/api/product-duplicates/${encodeURIComponent(groupId)}/ignore`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAlert({ type: 'info', message: 'Gruppo ignorato.' });
      setDuplicates(prev => prev.filter(g => g.id !== groupId));
    } catch (err) {
      console.error('Ignore error:', err);
      setAlert({ type: 'error', message: err.response?.data?.error || 'Operazione fallita. Riprova.' });
    }
  };

  const renderKPICard = (title, value, icon, color = 'primary') => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" color={color}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
          <Box color={color}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderRecommendations = () => {
    if (!insights?.recommendations?.length) return null;
    
    return (
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📋 Raccomandazioni
        </Typography>
        {insights.recommendations.map((rec, idx) => {
          const getIcon = () => {
            switch (rec.type) {
              case 'warning': return <WarningIcon color="warning" />;
              case 'success': return <CheckCircleIcon color="success" />;
              case 'info': return <InfoIcon color="info" />;
              default: return <InfoIcon />;
            }
          };
          
          return (
            <Alert 
              key={idx} 
              severity={rec.type} 
              icon={getIcon()}
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2">{rec.title}</Typography>
              <Typography variant="body2">{rec.message}</Typography>
            </Alert>
          );
        })}
      </Paper>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
        <Typography ml={2}>Caricamento duplicati e statistiche...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box mx={2} my={4}>
        <Alert severity="error">{error}</Alert>
        {debugInfo && (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Informazioni di Debug</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Verifica Duplicati Prodotti
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Questa pagina mostra i prodotti con descrizioni standardizzate identiche che potrebbero essere duplicati.
        Puoi unire i duplicati selezionando automaticamente il primo prodotto come principale, o ignorare il gruppo se non sono realmente duplicati.
      </Typography>

      {/* Sezione KPI */}
      {insights && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            📊 Statistiche Duplicati
            <TrendingUpIcon color="primary" />
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                'Gruppi Duplicati',
                insights.duplicateAnalysis?.potentialDuplicates || 0,
                <WarningIcon />,
                'warning.main'
              )}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                'Prodotti Totali',
                insights.overview?.totalProducts || 0,
                <InfoIcon />,
                'info.main'
              )}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                'In Attesa Approvazione',
                insights.overview?.pendingApproval || 0,
                <WarningIcon />,
                'warning.main'
              )}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                'Multi-Fornitore',
                insights.overview?.productsWithMultipleSuppliers || 0,
                <CheckCircleIcon />,
                'success.main'
              )}
            </Grid>
          </Grid>
          
          {/* Top Duplicati */}
          {insights.duplicateAnalysis?.topDuplicates?.length > 0 && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                🔍 Top Duplicati per Frequenza
              </Typography>
              {insights.duplicateAnalysis.topDuplicates.map((dup, idx) => (
                <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>{dup.description}</strong> - {dup.count} occorrenze
                  </Typography>
                </Box>
              ))}
            </Paper>
          )}
          
          {/* Raccomandazioni */}
          {renderRecommendations()}
        </Box>
      )}

      {alert.message && (
        <Alert severity={alert.type} onClose={() => setAlert({ type: '', message: '' })} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}
      
      {debugInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Trovati {debugInfo.totalGroups} gruppi di potenziali duplicati
        </Alert>
      )}

      {duplicates.length === 0 ? (
        <Alert severity="info">
          Nessun duplicato rilevato. Tutti i prodotti hanno descrizioni standardizzate uniche.
        </Alert>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            {duplicates.length} gruppo{duplicates.length !== 1 ? 'i' : ''} di duplicati rilevat{duplicates.length !== 1 ? 'i' : 'o'}
          </Typography>
          
          {duplicates.map((group, idx) => (
            <Accordion key={idx} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Typography variant="h6">
                    Gruppo #{idx + 1}
                  </Typography>
                  <Chip 
                    label={`${group.items.length} prodotti`} 
                    color="primary" 
                    size="small" 
                  />
                  <Typography variant="body2" color="text.secondary">
                    "{group.standardDesc}"
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Codice Interno</TableCell>
                      <TableCell>Descrizione Originale</TableCell>
                      <TableCell>Fornitore</TableCell>
                      <TableCell>Prezzo</TableCell>
                      <TableCell>Data Creazione</TableCell>
                      <TableCell>ID Prodotto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.items.map((item, itemIdx) => (
                      <TableRow key={item._id} sx={{ backgroundColor: itemIdx === 0 ? 'action.hover' : 'inherit' }}>
                        <TableCell>
                          {item.codeInternal}
                          {itemIdx === 0 && <Chip label="Principale" size="small" color="primary" sx={{ ml: 1 }} />}
                        </TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.supplierName}</TableCell>
                        <TableCell>{formatCurrency(item.price)}</TableCell>
                        <TableCell>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {item._id}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Box mt={2} display="flex" gap={2}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => handleMerge(group.id)}
                    disabled={loading}
                  >
                    Unisci Gruppo (Mantieni il primo)
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    onClick={() => handleIgnore(group.id)}
                    disabled={loading}
                  >
                    Ignora (Non sono duplicati)
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </Box>
  );
};

export default ProductDuplicatesReview;