import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  Button,
  LinearProgress,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  Warning,
  TrendingUp,
  Inventory,
  PendingActions,
  ContentCopy,
  ExpandMore,
  ExpandLess,
  Refresh,
  Security
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getApiUrl } from '../utils/apiConfig';

const Home = () => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDuplicates, setExpandedDuplicates] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const API_URL = getApiUrl();
  
  // Ottieni il ruolo dell'utente dal Redux store
  const { role, isAuthenticated } = useSelector(state => state.auth);
  const isAdmin = role === 'admin';

  // Monitora lo stato di autenticazione
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Funzione per recuperare gli insights dal backend (solo per admin)
  const fetchInsights = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setError('Utente non autenticato');
      setLoading(false);
      return;
    }

    if (!isAdmin) {
      setError('Accesso negato: solo gli amministratori possono visualizzare gli insights');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/api/products/import/insights`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Errore nel recupero degli insights');
      }
      
      const data = await response.json();
      setInsights(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, user, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (user && isAuthenticated) {
      if (isAdmin) {
        fetchInsights();
      } else {
        setLoading(false);
      }
    }
  }, [fetchInsights, user, isAuthenticated, isAdmin]);

  // Componente per le statistiche principali
  const StatsCard = ({ title, value, icon, color = 'primary', subtitle }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={color}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Componente per l'analisi dei duplicati
  const DuplicateAnalysis = ({ duplicateAnalysis }) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Analisi Duplicati</Typography>
          <IconButton onClick={() => setExpandedDuplicates(!expandedDuplicates)}>
            {expandedDuplicates ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedDuplicates}>
          <List>
            {duplicateAnalysis.topDuplicates?.map((duplicate, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <ContentCopy color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={duplicate.description}
                  secondary={`${duplicate.count} prodotti simili`}
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );

  // Componente per i trend dei prodotti
  const ProductTrend = ({ trends }) => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Trend Prodotti</Typography>
        <Box>
          {trends.map((trend, index) => (
            <Box key={index} mb={1}>
              <Typography variant="body2">{trend.period}</Typography>
              <LinearProgress 
                variant="determinate" 
                value={trend.percentage} 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption">{trend.count} prodotti</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );

  // Se l'utente non è autenticato
  if (!isAuthenticated) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          <AlertTitle>Accesso Richiesto</AlertTitle>
          Devi effettuare il login per accedere alla dashboard.
        </Alert>
      </Box>
    );
  }

  // Se l'utente non è admin
  if (!isAdmin) {
    return (
      <Box p={3}>
        <Alert severity="info" icon={<Security />}>
          <AlertTitle>Dashboard Amministratore</AlertTitle>
          Questa sezione è riservata agli amministratori. Gli insights sui prodotti e le funzionalità di import sono disponibili solo per gli utenti con ruolo admin.
        </Alert>
        
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Benvenuto nella Dashboard
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Come operatore, puoi accedere alle seguenti funzionalità:
            </Typography>
            <Box mt={2}>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/products')}
                sx={{ mr: 2, mb: 1 }}
              >
                Visualizza Prodotti
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/alerts')}
                sx={{ mr: 2, mb: 1 }}
              >
                Visualizza Alert
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Dashboard per amministratori
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Caricamento insights...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          <AlertTitle>Errore</AlertTitle>
          {error}
          <Box mt={2}>
            <Button 
              variant="outlined" 
              startIcon={<Refresh />}
              onClick={fetchInsights}
            >
              Riprova
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Dashboard Amministratore
      </Typography>
      
      {/* Notificazioni e raccomandazioni */}
      {insights?.recommendations && insights.recommendations.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Raccomandazioni Sistema</AlertTitle>
          <List dense>
            {insights.recommendations.map((recommendation, index) => (
              <ListItem key={index}>
                <ListItemText primary={recommendation.message} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Statistiche principali */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid xs={12} sm={6} md={3}>
          <StatsCard
            title="Prodotti Totali"
            value={insights?.overview?.totalProducts || 0}
            icon={<Inventory />}
            color="primary"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatsCard
            title="Prodotti Recenti"
            value={insights?.overview?.recentProducts || 0}
            icon={<TrendingUp />}
            color="success"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatsCard
            title="In Attesa Approvazione"
            value={insights?.overview?.pendingApproval || 0}
            icon={<PendingActions />}
            color={insights?.overview?.pendingApproval > 0 ? "warning" : "success"}
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatsCard
            title="Rischio Duplicati"
            value={insights?.overview?.duplicateRisk || 0}
            icon={<Warning />}
            color={insights?.overview?.duplicateRisk > 0 ? "error" : "success"}
          />
        </Grid>
      </Grid>

      {/* Analisi dettagliata */}
      <Grid container spacing={3}>
        {insights?.duplicateAnalysis && (
          <Grid xs={12} md={6}>
            <DuplicateAnalysis duplicateAnalysis={insights.duplicateAnalysis} />
          </Grid>
        )}
        
        {insights?.trends?.productCreation && (
          <Grid xs={12} md={6}>
            <ProductTrend trends={insights.trends.productCreation} />
          </Grid>
        )}
      </Grid>

      {/* Azioni rapide per admin */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Azioni Rapide
          </Typography>
          <Box>
            {insights?.overview?.pendingApproval > 0 && (
              <Button 
                variant="contained" 
                color="warning"
                onClick={() => navigate('/products?filter=pending')}
                sx={{ mr: 2, mb: 1 }}
              >
                Gestisci Approvazioni ({insights.overview.pendingApproval})
              </Button>
            )}
            <Button 
              variant="outlined"
              onClick={() => navigate('/invoices')}
              sx={{ mr: 2, mb: 1 }}
            >
              Importa Fatture
            </Button>
            <Button 
              variant="outlined"
              onClick={() => navigate('/settings')}
              sx={{ mr: 2, mb: 1 }}
            >
              Configurazioni
            </Button>
            <Button 
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchInsights}
              sx={{ mb: 1 }}
            >
              Aggiorna Dati
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Home;