import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import { sendAlertEmail } from './emailService.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class AlertMonitoringService {
  constructor() {
    this.isRunning = false;
  }

  // Avvia il monitoraggio periodico
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('Alert Monitoring Service avviato', {
      intervalMinutes: 60,
      service: 'AlertMonitoringService'
    });
    
    // Controlla ogni ora
    this.intervalId = setInterval(() => {
      this.checkAllAlerts();
    }, 60 * 60 * 1000); // 1 ora
    
    // Primo controllo immediato
    this.checkAllAlerts();
  }

  // Ferma il monitoraggio
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Alert Monitoring Service fermato', {
      service: 'AlertMonitoringService'
    });
  }

  // Controlla tutti gli alert attivi
  async checkAllAlerts() {
    try {
      logger.debug('Controllo alert in corso', {
        service: 'AlertMonitoringService',
        action: 'checkAllAlerts'
      });
      
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
    } catch (error) {
      logger.error('Errore nel controllo degli alert', {
        error: error.message,
        stack: error.stack,
        service: 'AlertMonitoringService'
      });
    }
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
      for (const supplier of product.pricesBySupplier) {
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
    try {
      logger.info('Alert attivato', {
        alertType: alert.type,
        productDescription: product.description,
        productId: product._id,
        supplierId: supplier.supplierId,
        currentPrice,
        service: 'AlertMonitoringService'
      });

      // Registra l'attivazione
      await alert.recordTrigger();

      // Prepara i dati per la notifica
      const alertData = {
        alert,
        product,
        supplier,
        currentPrice,
        triggerReason: this.getTriggerReason(alert, currentPrice)
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
          productId: product._id
        });
      }

      // TODO: Implementare invio PEC se necessario
      if (alert.notificationMethod === 'pec' || alert.notificationMethod === 'both') {
        logger.debug('Invio PEC non ancora implementato', {
          alertId: alert._id,
          notificationMethod: alert.notificationMethod,
          service: 'AlertMonitoringService'
        });
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