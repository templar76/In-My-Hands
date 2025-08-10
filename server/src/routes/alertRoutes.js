import express from 'express';
import {
  createAlert,
  getUserAlerts,
  updateAlert,
  deleteAlert,
  toggleAlert,
  testAlert,
  testPECConfig,
  getAlertStats,
  getAlertAnalytics,
  getAlertHistory,
  acknowledgeAlert,
  bulkUpdateAlerts,
  exportAlertReport,
  getPerformanceMetrics
} from '../controllers/alertController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import configService from '../services/configService.js';
import alertMonitoringService from '../services/alertMonitoringService.js'; // ✅ AGGIUNTO

const router = express.Router();

// Tutte le route richiedono autenticazione
router.use(verifyFirebaseToken);

// CRUD Operations
router.post('/', createAlert);
router.get('/', getUserAlerts);
router.put('/:alertId', updateAlert);
router.delete('/:alertId', deleteAlert);

// Operazioni speciali
router.patch('/:alertId/toggle', toggleAlert);
router.post('/:alertId/test', testAlert);

// Statistiche e analytics
router.get('/stats', getAlertStats);
router.get('/analytics', getAlertAnalytics);
router.get('/history', getAlertHistory);
router.patch('/history/:historyId/acknowledge', acknowledgeAlert);

// Operazioni bulk
router.post('/bulk', bulkUpdateAlerts);

// Export e reporting
router.get('/export', exportAlertReport);

// Performance metrics
router.get('/performance-metrics', getPerformanceMetrics);

// Configurazione PEC
router.get('/pec/test', testPECConfig);

// Ottieni configurazione alert monitoring
router.get('/monitoring/config', verifyFirebaseToken, async (req, res) => { // ✅ CORRETTO
  try {
    const config = configService.getAlertMonitoringConfig();
    res.json({
      status: 'ok',
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Aggiorna configurazione alert monitoring
router.put('/monitoring/config', verifyFirebaseToken, async (req, res) => { // ✅ CORRETTO
  try {
    const success = configService.updateConfig(req.body);
    
    if (success) {
      // Ricarica la configurazione nel servizio
      alertMonitoringService.reloadConfig();
      
      res.json({
        status: 'ok',
        message: 'Configurazione aggiornata con successo',
        config: configService.getAlertMonitoringConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Errore nell\'aggiornamento della configurazione'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Stato del servizio di monitoraggio
router.get('/monitoring/status', verifyFirebaseToken, async (req, res) => { // ✅ CORRETTO
  try {
    const status = alertMonitoringService.getStatus();
    
    res.json({
      status: 'ok',
      alertService: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

export default router;