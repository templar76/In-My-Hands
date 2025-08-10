import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import AlertHistory from '../models/AlertHistory.js';
import { sendAlertEmail, sendAlertPEC, verifyPECConfiguration } from './emailservice.js';
import configService from './configService.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class AlertMonitoringService {
  constructor() {
    this.isRunning = false;
    this.lastHeartbeat = null;
    this.watchdogIntervalId = null;
    this.consecutiveErrors = 0;
    this.config = configService.getAlertMonitoringConfig();
  }

  // Ricarica la configurazione
  reloadConfig() {
    const oldConfig = this.config;
    this.config = configService.reloadConfig();
    
    logger.info('Configurazione ricaricata', {
      oldConfig,
      newConfig: this.config,
      service: 'AlertMonitoringService'
    });
    
    // Se il servizio è in esecuzione e gli intervalli sono cambiati, riavvia
    if (this.isRunning && 
        (oldConfig.checkIntervalMinutes !== this.config.checkIntervalMinutes ||
         oldConfig.watchdogIntervalMinutes !== this.config.watchdogIntervalMinutes)) {
      logger.info('Riavvio del servizio per applicare nuovi intervalli', {
        service: 'AlertMonitoringService'
      });
      this.restart();
    }
  }

  // Avvia il monitoraggio periodico
  start() {
    if (this.isRunning) return;
    
    if (!this.config.enabled) {
      logger.info('Alert Monitoring Service disabilitato dalla configurazione', {
        service: 'AlertMonitoringService'
      });
      return;
    }
    
    this.isRunning = true;
    this.lastHeartbeat = new Date();
    this.consecutiveErrors = 0;
    
    logger.info('Alert Monitoring Service avviato', {
      checkIntervalMinutes: this.config.checkIntervalMinutes,
      watchdogIntervalMinutes: this.config.watchdogIntervalMinutes,
      maxConsecutiveErrors: this.config.maxConsecutiveErrors,
      service: 'AlertMonitoringService'
    });
    
    // Controlla secondo la configurazione
    this.intervalId = setInterval(() => {
      this.checkAllAlerts();
    }, this.config.checkIntervalMinutes * 60 * 1000);
    
    // Watchdog: controlla secondo la configurazione
    this.watchdogIntervalId = setInterval(() => {
      this.healthCheck();
    }, this.config.watchdogIntervalMinutes * 60 * 1000);
    
    // Primo controllo immediato
    this.checkAllAlerts();
  }

  // Health check del servizio
  healthCheck() {
    try {
      const now = new Date();
      const timeSinceLastHeartbeat = now - this.lastHeartbeat;
      const maxAllowedGap = this.config.heartbeatTimeoutMinutes * 60 * 1000;
      
      if (timeSinceLastHeartbeat > maxAllowedGap) {
        logger.error('Alert Monitoring Service non risponde da troppo tempo', {
          timeSinceLastHeartbeat: Math.round(timeSinceLastHeartbeat / 60000),
          maxAllowedMinutes: this.config.heartbeatTimeoutMinutes,
          service: 'AlertMonitoringService',
          action: 'healthCheck'
        });
        
        this.restart();
        return;
      }
      
      if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
        logger.error('Troppi errori consecutivi nel servizio alert', {
          consecutiveErrors: this.consecutiveErrors,
          maxAllowed: this.config.maxConsecutiveErrors,
          service: 'AlertMonitoringService',
          action: 'healthCheck'
        });
        
        this.restart();
        return;
      }
      
      // Verifica che l'interval sia ancora attivo
      if (!this.intervalId) {
        logger.error('Interval del servizio alert non è attivo', {
          service: 'AlertMonitoringService',
          action: 'healthCheck'
        });
        
        this.restart();
        return;
      }
      
      if (this.config.logging.enableHealthCheckLogs) {
        logger.debug('Health check del servizio alert: OK', {
          lastHeartbeat: this.lastHeartbeat,
          consecutiveErrors: this.consecutiveErrors,
          service: 'AlertMonitoringService'
        });
      }
      
    } catch (error) {
      logger.error('Errore durante health check del servizio alert', {
        error: error.message,
        stack: error.stack,
        service: 'AlertMonitoringService'
      });
      
      this.consecutiveErrors++;
    }
  }

  // Riavvia il servizio
  restart() {
    logger.warn('Riavvio del Alert Monitoring Service in corso...', {
      service: 'AlertMonitoringService',
      action: 'restart'
    });
    
    this.stop();
    
    // Aspetta secondo la configurazione prima di riavviare
    setTimeout(() => {
      this.start();
      logger.info('Alert Monitoring Service riavviato con successo', {
        service: 'AlertMonitoringService',
        action: 'restart'
      });
    }, this.config.restartDelayMs);
  }

  // Controlla tutti gli alert attivi
  async checkAllAlerts() {
    try {
      // Aggiorna heartbeat
      this.lastHeartbeat = new Date();
      
      if (this.config.logging.enableDebugLogs) {
        logger.debug('Controllo alert in corso', {
          service: 'AlertMonitoringService',
          action: 'checkAllAlerts'
        });
      }
      
      const activeAlerts = await Alert.find({ isActive: true })
        .populate('product')
        .populate('user');

      let triggeredCount = 0;

      for (const alert of activeAlerts) {
        const triggered = await this.checkSingleAlert(alert);
        if (triggered) triggeredCount++;
      }

      logger.info('Controllo alert completato', {
        triggeredCount,
        totalAlerts: activeAlerts.length,
        service: 'AlertMonitoringService'
      });
      
      // Reset errori consecutivi se tutto va bene
      this.consecutiveErrors = 0;
      
    } catch (error) {
      this.consecutiveErrors++;
      
      logger.error('Errore nel controllo degli alert', {
        error: error.message,
        stack: error.stack,
        consecutiveErrors: this.consecutiveErrors,
        service: 'AlertMonitoringService'
      });
    }
  }

  // Ferma il monitoraggio
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.watchdogIntervalId) {
      clearInterval(this.watchdogIntervalId);
      this.watchdogIntervalId = null;
    }
    
    this.isRunning = false;
    this.lastHeartbeat = null;
    
    logger.info('Alert Monitoring Service fermato', {
      service: 'AlertMonitoringService'
    });
  }

  // Metodo per ottenere lo stato del servizio
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastHeartbeat: this.lastHeartbeat,
      consecutiveErrors: this.consecutiveErrors,
      maxConsecutiveErrors: this.config.maxConsecutiveErrors,
      hasActiveInterval: !!this.intervalId,
      hasActiveWatchdog: !!this.watchdogIntervalId,
      config: this.config
    };
  }

  // Controlla un singolo alert
  async checkSingleAlert(alert) {
    try {
      if (!alert.product) {
        logger.warn('Prodotto non trovato per alert', {
          alertId: alert._id,
          service: 'AlertMonitoringService'
        });
        return false;
      }

      const product = alert.product;
      let alertTriggered = false;

      // Controlla ogni fornitore del prodotto
      // Nella funzione checkSingleAlert, sostituire:
      for (const supplier of product.prices) { // ✅ CORRETTO: 'prices' invece di 'pricesBySupplier'
      if (!supplier.priceHistory || supplier.priceHistory.length === 0) {
      continue;
      }
      
      // Prende l'ultimo prezzo
      const lastPriceEntry = supplier.priceHistory[supplier.priceHistory.length - 1];
      const currentPrice = lastPriceEntry.price;
      
      // Verifica se l'alert deve scattare
      const shouldTrigger = await alert.shouldTrigger(currentPrice, supplier.supplierId);
      
      if (shouldTrigger) {
      await this.triggerAlert(alert, product, supplier, currentPrice);
      alertTriggered = true;
      }
      }

      return alertTriggered;
    } catch (error) {
      logger.error('Errore nel controllo dell\'alert singolo', {
        error: error.message,
        stack: error.stack,
        alertId: alert._id,
        service: 'AlertMonitoringService'
      });
      return false;
    }
  }

  // Attiva un alert e invia notifica
  async triggerAlert(alert, product, supplier, currentPrice) {
    const startTime = Date.now();
    try {
      logger.info('Alert attivato', {
        alertType: alert.type,
        productDescription: product.description,
        productId: product._id,
        supplierId: supplier.supplierId,
        currentPrice,
        service: 'AlertMonitoringService'
      });

      const triggerReason = this.getTriggerReason(alert, currentPrice);

      // Registra nello storico
      const historyEntry = new AlertHistory({
        tenantId: alert.tenantId,
        alertId: alert._id,
        userId: alert.userId,
        productId: alert.productId,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName || 'N/A',
        alertType: alert.type,
        triggerReason,
        priceData: {
          currentPrice,
          thresholdPrice: alert.thresholdPrice,
          variationPercentage: alert.variationThreshold
        },
        notificationData: {
          method: alert.notificationMethod,
          sent: false
        },
        metadata: {
          responseTime: Date.now() - startTime,
          dataSource: 'automatic'
        }
      });

      try {
        await historyEntry.save();
      } catch (historyError) {
        logger.error('Errore nel salvataggio dello storico alert', {
          alertId: alert._id,
          error: historyError.message
        });
      }

      // Registra l'attivazione
      await alert.recordTrigger();

      // Prepara i dati per la notifica
      const alertData = {
        alert,
        product,
        supplier,
        currentPrice,
        triggerReason,
        historyEntry
      };

      // Invia notifica
      await this.sendNotification(alertData);

    } catch (error) {
      logger.error('Errore nell\'attivazione dell\'alert', {
        error: error.message,
        stack: error.stack,
        alertId: alert._id,
        service: 'AlertMonitoringService'
      });
    }
  }

  // Determina il motivo dell'attivazione
  getTriggerReason(alert, currentPrice) {
    switch (alert.type) {
      case 'price_threshold':
        return `Il prezzo ${currentPrice}€ supera la soglia di ${alert.thresholdPrice}€`;
      case 'price_variation':
        return `Rilevata variazione di prezzo superiore al ${alert.variationThreshold}%`;
      default:
        return 'Alert attivato';
    }
  }

  // Invia notifica
  async sendNotification(alertData) {
    const { alert, product, supplier, currentPrice, triggerReason } = alertData;

    try {
      if (alert.notificationMethod === 'email' || alert.notificationMethod === 'both') {
        await sendAlertEmail({
          to: alert.user.email,
          alertType: alert.type,
          productName: product.description,
          supplierName: supplier.supplierName,
          currentPrice,
          thresholdPrice: alert.thresholdPrice,
          triggerReason,
          productId: product._id,
          notificationMethod: 'email'
        });
        
        // Aggiorna lo storico come inviato
        if (alertData.historyEntry && alertData.historyEntry.markAsSent) {
          await alertData.historyEntry.markAsSent();
        }
      }

      if (alert.notificationMethod === 'pec' || alert.notificationMethod === 'both') {
        // Verifica se la configurazione PEC è disponibile
        if (verifyPECConfiguration()) {
          await sendAlertPEC({
            to: alert.user.pecEmail || alert.user.email, // Usa PEC se disponibile, altrimenti email normale
            alertType: alert.type,
            productName: product.description,
            supplierName: supplier.supplierName,
            currentPrice,
            thresholdPrice: alert.thresholdPrice,
            triggerReason,
            productId: product._id
          });
          
          // Aggiorna lo storico come inviato
          if (alertData.historyEntry && alertData.historyEntry.markAsSent) {
            await alertData.historyEntry.markAsSent();
          }
        } else {
          logger.warn('Configurazione PEC non disponibile, invio tramite email normale', {
            alertId: alert._id,
            userId: alert.userId,
            service: 'AlertMonitoringService'
          });
          // Fallback a email normale
          await sendAlertEmail({
            to: alert.user.email,
            alertType: alert.type,
            productName: product.description,
            supplierName: supplier.supplierName,
            currentPrice,
            thresholdPrice: alert.thresholdPrice,
            triggerReason: triggerReason + ' (Inviato via email - PEC non configurata)',
            productId: product._id,
            notificationMethod: 'email'
          });
          
          // Aggiorna lo storico come inviato
          if (alertData.historyEntry && alertData.historyEntry.markAsSent) {
            await alertData.historyEntry.markAsSent();
          }
        }
      }

    } catch (error) {
      logger.error('Errore nell\'invio della notifica', {
        error: error.message,
        stack: error.stack,
        alertId: alert._id,
        notificationMethod: alert.notificationMethod,
        service: 'AlertMonitoringService'
      });
    }
  }

  // Controlla alert per un prodotto specifico (chiamato dopo aggiornamento prezzi)
  async checkProductAlerts(productId, tenantId) {
    try {
      const alerts = await Alert.find({
        productId: new mongoose.Types.ObjectId(productId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: true
      }).populate('product').populate('user');

      for (const alert of alerts) {
        await this.checkSingleAlert(alert);
      }
    } catch (error) {
      logger.error('Errore nel controllo degli alert per il prodotto', {
        error: error.message,
        stack: error.stack,
        productId,
        tenantId,
        service: 'AlertMonitoringService'
      });
    }
  }
}

// Singleton instance
const alertMonitoringService = new AlertMonitoringService();
export default alertMonitoringService;