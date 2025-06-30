// client/src/pages/Home.jsx (VERSIONE AGGIORNATA)
import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  Receipt,
  Inventory,
  Business,
  NotificationsActive,
  Add,
  FileUpload,
  Analytics,
  Warning,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';
import { useResponsive } from '../hooks/useResponsive';
import KPICard, { KPIGrid, RevenueKPI, InvoicesKPI, SuppliersKPI, AlertsKPI } from '../components/ui/KPICard';

const Home = () => {
  const { isMobile, getGridProps, getSpacing } = useResponsive();

  // Dati mock - in produzione verranno dalle API
  const kpiData = {
    revenue: { value: 125000, trend: 'up', trendValue: '+12.5%' },
    invoices: { value: 47, trend: 'up', trendValue: '+8' },
    suppliers: { value: 23, trend: 'neutral', trendValue: '0' },
    alerts: { value: 5, trend: 'down', trendValue: '-2' },
  };

  const recentInvoices = [
    { id: 1, supplier: 'Fornitore ABC', amount: 1250, status: 'processed', date: '2025-06-30' },
    { id: 2, supplier: 'Fornitore XYZ', amount: 890, status: 'pending', date: '2025-06-29' },
    { id: 3, supplier: 'Fornitore DEF', amount: 2100, status: 'processed', date: '2025-06-28' },
    { id: 4, supplier: 'Fornitore GHI', amount: 750, status: 'error', date: '2025-06-27' },
  ];

  const activeAlerts = [
    { id: 1, type: 'price', message: 'Prezzo prodotto A aumentato del 15%', severity: 'warning' },
    { id: 2, type: 'stock', message: 'Scorte prodotto B in esaurimento', severity: 'error' },
    { id: 3, type: 'supplier', message: 'Nuovo fornitore aggiunto', severity: 'info' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'processed': return 'success';
      case 'pending': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'processed': return 'Elaborata';
      case 'pending': return 'In attesa';
      case 'error': return 'Errore';
      default: return 'Sconosciuto';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant={isMobile ? 'h5' : 'h4'} 
          fontWeight="bold" 
          gutterBottom
          sx={{
            background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Benvenuto nella tua dashboard aziendale. Ecco una panoramica delle attività recenti.
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Metriche Principali
        </Typography>
        <KPIGrid spacing={getSpacing().current}>
          <RevenueKPI 
            value={kpiData.revenue.value}
            trend={kpiData.revenue.trend}
            trendValue={kpiData.revenue.trendValue}
          />
          <InvoicesKPI 
            value={kpiData.invoices.value}
            trend={kpiData.invoices.trend}
            trendValue={kpiData.invoices.trendValue}
          />
          <SuppliersKPI 
            value={kpiData.suppliers.value}
            trend={kpiData.suppliers.trend}
            trendValue={kpiData.suppliers.trendValue}
          />
          <AlertsKPI 
            value={kpiData.alerts.value}
            trend={kpiData.alerts.trend}
            trendValue={kpiData.alerts.trendValue}
          />
        </KPIGrid>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Azioni Rapide
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<FileUpload />}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Carica Fattura
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Add />}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Nuovo Prodotto
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Business />}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Aggiungi Fornitore
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Analytics />}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Visualizza Report
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Content Grid */}
      <Grid container spacing={3}>
        {/* Recent Invoices */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Fatture Recenti
                </Typography>
                <Button size="small" endIcon={<TrendingUp />}>
                  Vedi tutte
                </Button>
              </Box>
              
              <List disablePadding>
                {recentInvoices.map((invoice, index) => (
                  <React.Fragment key={invoice.id}>
                    <ListItem 
                      sx={{ 
                        px: 0,
                        py: 1.5,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                        },
                      }}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: 'primary.light', width: 40, height: 40 }}>
                          <Receipt />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {invoice.supplier}
                            </Typography>
                            <Typography variant="h6" fontWeight={700} color="primary.main">
                              €{invoice.amount.toLocaleString()}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(invoice.date).toLocaleDateString('it-IT')}
                            </Typography>
                            <Chip 
                              label={getStatusText(invoice.status)}
                              size="small"
                              color={getStatusColor(invoice.status)}
                              variant="outlined"
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentInvoices.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Alerts */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Alert Attivi
                </Typography>
                <Chip 
                  label={activeAlerts.length} 
                  size="small" 
                  color="error" 
                  variant="filled"
                />
              </Box>
              
              <List disablePadding>
                {activeAlerts.map((alert, index) => (
                  <React.Fragment key={alert.id}>
                    <ListItem 
                      sx={{ 
                        px: 0,
                        py: 1.5,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                        },
                      }}
                    >
                      <ListItemIcon>
                        <Avatar 
                          sx={{ 
                            bgcolor: `${getSeverityColor(alert.severity)}.light`,
                            color: `${getSeverityColor(alert.severity)}.dark`,
                            width: 36,
                            height: 36,
                          }}
                        >
                          {alert.severity === 'error' ? <Warning /> : 
                           alert.severity === 'warning' ? <Schedule /> : 
                           <CheckCircle />}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={500}>
                            {alert.message}
                          </Typography>
                        }
                        secondary={
                          <Chip 
                            label={alert.type.toUpperCase()}
                            size="small"
                            color={getSeverityColor(alert.severity)}
                            variant="outlined"
                            sx={{ mt: 0.5, fontSize: '0.7rem' }}
                          />
                        }
                      />
                    </ListItem>
                    {index < activeAlerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              
              <Button 
                fullWidth 
                variant="outlined" 
                sx={{ mt: 2, textTransform: 'none' }}
                startIcon={<NotificationsActive />}
              >
                Gestisci Alert
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Obiettivi Mensili
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        Fatturato Mensile
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        75%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={75} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      €125.000 / €167.000
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        Fatture Elaborate
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        94%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={94} 
                      color="success"
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      47 / 50 fatture
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        Fornitori Attivi
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        85%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={85} 
                      color="warning"
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      23 / 27 fornitori
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Home;

