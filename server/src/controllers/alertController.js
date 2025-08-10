import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import AlertHistory from '../models/AlertHistory.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { sendAlertEmail, testPECConnection, verifyPECConfiguration } from '../services/emailService.js';


export const createAlert = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { productId, type, thresholdPrice, variationThreshold, checkFrequency, notificationMethod, notes } = req.body;

    // Verifica che il prodotto esista e appartenga al tenant
    const product = await Product.findOne({ 
      _id: productId, 
      tenantId: new mongoose.Types.ObjectId(tenantId) 
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    // Verifica se esiste già un alert attivo per questo prodotto e utente
    const existingAlert = await Alert.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid, // ⭐ Usa direttamente Firebase UID
      productId: new mongoose.Types.ObjectId(productId),
      type,
      isActive: true
    });

    if (existingAlert) {
      return res.status(400).json({ error: 'Esiste già un alert attivo di questo tipo per questo prodotto' });
    }

    const alertData = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid, // ⭐ Usa direttamente Firebase UID
      productId: new mongoose.Types.ObjectId(productId),
      type,
      checkFrequency: checkFrequency || 'daily',
      notificationMethod: notificationMethod || 'email',
      notes
    };

    // Aggiungi parametri specifici per tipo
    if (type === 'price_threshold' && thresholdPrice) {
      alertData.thresholdPrice = thresholdPrice;
    } else if (type === 'price_variation') {
      alertData.variationThreshold = variationThreshold || 15;
    }

    const alert = new Alert(alertData);
    await alert.save();

    // Popola i dati per la risposta
    await alert.populate('product');

    res.status(201).json({
      message: 'Alert creato con successo',
      alert
    });
  } catch (error) {
    logger.error('Errore nella creazione dell\'alert', {
      tenantId: req.user?.tenantId,
      userId: req.user?.uid,
      productId: req.body?.productId,
      alertType: req.body?.type,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Ottieni analytics avanzati degli alert
export const getAlertAnalytics = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { 
      startDate, 
      endDate, 
      alertType, 
      productId, 
      supplierId 
    } = req.query;

    const options = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (alertType) options.alertType = alertType;
    if (productId) options.productId = productId;
    if (supplierId) options.supplierId = supplierId;

    const analytics = await AlertHistory.getAlertAnalytics(tenantId, req.user.uid, options);
    const topProducts = await AlertHistory.getTopTriggeredProducts(tenantId, req.user.uid, 10);
    const notificationStats = await AlertHistory.getNotificationStats(tenantId, req.user.uid, 30);

    res.json({
      analytics,
      topProducts,
      notificationStats,
      period: {
        startDate: options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: options.endDate || new Date()
      }
    });
  } catch (error) {
    logger.error('Error getting alert analytics', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Ottieni storico degli alert
export const getAlertHistory = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { 
      page = 1, 
      limit = 20, 
      alertId, 
      productId, 
      status, 
      alertType,
      startDate,
      endDate
    } = req.query;

    const filter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    };

    if (alertId) filter.alertId = new mongoose.Types.ObjectId(alertId);
    if (productId) filter.productId = new mongoose.Types.ObjectId(productId);
    if (status) filter.status = status;
    if (alertType) filter.alertType = alertType;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const history = await AlertHistory.find(filter)
      .populate('alertId', 'type isActive')
      .populate('productId', 'description codeInternal category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AlertHistory.countDocuments(filter);

    res.json({
      history,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    logger.error('Error getting alert history', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Riconosci un alert nello storico
export const acknowledgeAlert = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { historyId } = req.params;

    const historyEntry = await AlertHistory.findOne({
      _id: historyId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    });

    if (!historyEntry) {
      return res.status(404).json({ error: 'Storico alert non trovato' });
    }

    await historyEntry.acknowledge(req.user.uid);

    res.json({
      message: 'Alert riconosciuto con successo',
      historyEntry
    });
  } catch (error) {
    logger.error('Error acknowledging alert', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid,
      historyId: req.params?.historyId
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Operazioni bulk per alert
export const bulkUpdateAlerts = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { alertIds, action, updates } = req.body;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({ error: 'Lista di alert IDs richiesta' });
    }

    const filter = {
      _id: { $in: alertIds.map(id => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    };

    let result;
    switch (action) {
      case 'activate':
        result = await Alert.updateMany(filter, { 
          isActive: true, 
          updatedAt: new Date() 
        });
        break;
      case 'deactivate':
        result = await Alert.updateMany(filter, { 
          isActive: false, 
          updatedAt: new Date() 
        });
        break;
      case 'delete':
        result = await Alert.deleteMany(filter);
        break;
      case 'update':
        if (!updates) {
          return res.status(400).json({ error: 'Dati di aggiornamento richiesti' });
        }
        const allowedUpdates = ['checkFrequency', 'notificationMethod', 'thresholdPrice', 'variationThreshold'];
        const sanitizedUpdates = {};
        Object.keys(updates).forEach(key => {
          if (allowedUpdates.includes(key)) {
            sanitizedUpdates[key] = updates[key];
          }
        });
        sanitizedUpdates.updatedAt = new Date();
        result = await Alert.updateMany(filter, sanitizedUpdates);
        break;
      default:
        return res.status(400).json({ error: 'Azione non valida' });
    }

    res.json({
      message: `Operazione ${action} completata con successo`,
      modifiedCount: result.modifiedCount || result.deletedCount,
      action,
      alertIds
    });
  } catch (error) {
    logger.error('Error in bulk alert operation', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid,
      action: req.body?.action,
      alertIds: req.body?.alertIds
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Esporta report degli alert
export const exportAlertReport = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { 
      format = 'json', 
      startDate, 
      endDate, 
      includeHistory = false 
    } = req.query;

    const filter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    };

    // Ottieni gli alert
    const alerts = await Alert.find(filter)
      .populate('product', 'description codeInternal category')
      .sort({ createdAt: -1 });

    let reportData = {
      exportDate: new Date().toISOString(),
      tenantId,
      userId: req.user.uid,
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.isActive).length,
      alerts: alerts.map(alert => ({
        id: alert._id,
        type: alert.type,
        product: {
          id: alert.product?._id,
          description: alert.product?.description,
          code: alert.product?.codeInternal
        },
        thresholdPrice: alert.thresholdPrice,
        variationThreshold: alert.variationThreshold,
        isActive: alert.isActive,
        checkFrequency: alert.checkFrequency,
        notificationMethod: alert.notificationMethod,
        triggerCount: alert.triggerCount,
        lastTriggered: alert.lastTriggered,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt
      }))
    };

    // Includi storico se richiesto
    if (includeHistory === 'true') {
      const historyFilter = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId: req.user.uid
      };
      
      if (startDate || endDate) {
        historyFilter.createdAt = {};
        if (startDate) historyFilter.createdAt.$gte = new Date(startDate);
        if (endDate) historyFilter.createdAt.$lte = new Date(endDate);
      }

      const history = await AlertHistory.find(historyFilter)
        .populate('productId', 'description codeInternal')
        .sort({ createdAt: -1 })
        .limit(1000); // Limita per performance

      reportData.history = history;
    }

    // Formato di output
    if (format === 'csv') {
      // Implementazione CSV semplificata
      const csvHeaders = 'ID,Tipo,Prodotto,Soglia Prezzo,Attivo,Frequenza,Metodo Notifica,Trigger Count,Ultimo Trigger,Creato\n';
      const csvRows = alerts.map(alert => 
        `${alert._id},${alert.type},"${alert.product?.description || 'N/A'}",${alert.thresholdPrice || ''},${alert.isActive},${alert.checkFrequency},${alert.notificationMethod},${alert.triggerCount},${alert.lastTriggered || ''},${alert.createdAt}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="alert-report-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvHeaders + csvRows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="alert-report-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(reportData);
    }
  } catch (error) {
    logger.error('Error exporting alert report', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Test configurazione PEC
export const testPECConfig = async (req, res) => {
  try {
    const { tenantId } = req.user;
    
    logger.debug('Testing PEC configuration', {
      tenantId,
      userId: req.user.uid
    });

    const configCheck = verifyPECConfiguration();
    if (!configCheck) {
      return res.status(400).json({
        error: 'Configurazione PEC incompleta',
        message: 'Verificare le variabili di ambiente PEC_SMTP_HOST, PEC_SMTP_USER, PEC_SMTP_PASS'
      });
    }

    const connectionTest = await testPECConnection();
    
    if (connectionTest.success) {
      res.json({
        message: 'Configurazione PEC verificata con successo',
        status: 'active',
        details: connectionTest.message
      });
    } else {
      res.status(500).json({
        error: 'Errore nella connessione PEC',
        message: connectionTest.message
      });
    }
  } catch (error) {
    logger.error('Error testing PEC configuration', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Ottieni statistiche degli alert
export const getAlertStats = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { period = '30d' } = req.query;

    // Calcola la data di inizio basata sul periodo
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    };

    // Statistiche generali
    const totalAlerts = await Alert.countDocuments(filter);
    const activeAlerts = await Alert.countDocuments({ ...filter, isActive: true });
    const triggeredAlerts = await Alert.countDocuments({
      ...filter,
      lastTriggered: { $gte: startDate }
    });

    // Statistiche per tipo
    const alertsByType = await Alert.aggregate([
      { $match: filter },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Statistiche per metodo di notifica
    const alertsByNotification = await Alert.aggregate([
      { $match: filter },
      { $group: { _id: '$notificationMethod', count: { $sum: 1 } } }
    ]);

    // Alert più attivi (con più trigger)
    const mostTriggeredAlerts = await Alert.find(filter)
      .populate('product', 'description codeInternal')
      .sort({ triggerCount: -1 })
      .limit(5)
      .select('product type triggerCount lastTriggered');

    res.json({
      period,
      stats: {
        total: totalAlerts,
        active: activeAlerts,
        triggered: triggeredAlerts,
        byType: alertsByType,
        byNotificationMethod: alertsByNotification,
        mostTriggered: mostTriggeredAlerts
      }
    });
  } catch (error) {
    logger.error('Error getting alert statistics', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Recupera tutti gli alert dell'utente
export const getUserAlerts = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { page = 1, limit = 10, isActive, type, productId } = req.query;

    // DEBUG: Log the user object and tenantId
    logger.info('getUserAlerts - req.user:', req.user);
    logger.info('getUserAlerts - tenantId from token:', tenantId);

    const filter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    };

    // DEBUG: Log the filter object
    logger.info('getUserAlerts - filter object:', filter);

    // ✅ SOSTITUITO: console.log con logger.debug
    logger.debug('Alert filter applied', {
      tenantId: tenantId,
      userId: req.user.uid,
      userObject: req.user
    });
    logger.debug('MongoDB filter constructed', { filter });

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (productId) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }

    const allTenantAlerts = await Alert.find({ tenantId: new mongoose.Types.ObjectId(tenantId) });
    // ✅ SOSTITUITO: console.log con logger.debug
    logger.debug('Tenant alerts analysis', {
      totalTenantAlerts: allTenantAlerts.length,
      alertUserIds: allTenantAlerts.map(a => ({ id: a._id, userId: a.userId }))
    });

    const alerts = await Alert.find(filter)
      // Nella funzione getUserAlerts, modifica la riga del populate da:
      .populate('product', 'description code category _id') // ⭐ Aggiungi _id per la navigazione
      
      // A:
      .populate('product', 'codeInternal descriptionStd description category _id') // ⭐ Aggiungi codeInternal e descriptionStd
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Alert.countDocuments(filter);

    // ✅ SOSTITUITO: console.log con logger.debug
    logger.debug('Alerts retrieved successfully', { alertsFound: alerts.length });

    res.json({
      alerts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    // ✅ SOSTITUITO: console.error con logger.error
    logger.error('Error retrieving alerts', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Aggiorna un alert
export const updateAlert = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { alertId } = req.params;
    const updates = req.body;

    const alert = await Alert.findOne({
      _id: alertId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    // Aggiorna i campi permessi
    const allowedUpdates = ['type', 'thresholdPrice', 'variationThreshold', 'isActive', 'checkFrequency', 'notificationMethod', 'notes'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        alert[field] = updates[field];
      }
    });

    alert.updatedAt = new Date();
    await alert.save();
    // Nella funzione updateAlert, modifica:
    await alert.populate('product'); // ⭐ Solo populate del prodotto
    
    // A:
    await alert.populate('product', 'codeInternal descriptionStd description category _id');

    res.json({
      message: 'Alert aggiornato con successo',
      alert
    });
  } catch (error) {
    logger.error('Errore nell\'aggiornamento dell\'alert', {
      tenantId: req.user?.tenantId,
      userId: req.user?.uid,
      alertId: req.params?.alertId,
      updates: req.body,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Attiva/Disattiva un alert
export const toggleAlert = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { alertId } = req.params;

    const alert = await Alert.findOne({
      _id: alertId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    alert.isActive = !alert.isActive;
    alert.updatedAt = new Date();
    await alert.save();
    // Nella funzione toggleAlert, modifica:
    await alert.populate('product'); // ⭐ Solo populate del prodotto
    
    // A:
    await alert.populate('product', 'codeInternal descriptionStd description category _id');

    res.status(201).json({
      message: 'Alert creato con successo',
      alert
    });
  } catch (error) {
    logger.error('Errore nel toggle dell\'alert', {
      tenantId: req.user?.tenantId,
      userId: req.user?.uid,
      alertId: req.params?.alertId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Elimina un alert
export const deleteAlert = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { alertId } = req.params;

    const alert = await Alert.findOneAndDelete({
      _id: alertId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid // ⭐ Usa direttamente Firebase UID
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    res.json({ message: 'Alert eliminato con successo' });
  } catch (error) {
    logger.error('Errore nell\'eliminazione dell\'alert', {
      tenantId: req.user?.tenantId,
      userId: req.user?.uid,
      alertId: req.params?.alertId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Testa un alert
export const testAlert = async (req, res) => {
  try {
    logger.debug('Testing alert', {
      alertId: req.params.alertId,
      tenantId: req.user.tenantId,
      userId: req.user.uid,
      testData: req.body
    });
    
    const { tenantId } = req.user;
    const { alertId } = req.params;
    const { testPrice, supplierId } = req.body;

    const alert = await Alert.findOne({
      _id: alertId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: req.user.uid
    }).populate('product');

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // ✅ MIGLIORATO: Recupera dati reali dal database
    let supplierName = 'Fornitore non specificato';
    let actualCurrentPrice = 0;
    
    if (alert.product && alert.product.prices && alert.product.prices.length > 0) {
      if (supplierId) {
        // Se è specificato un fornitore, usa i suoi dati
        const supplierInfo = alert.product.prices.find(p => p.supplierId.toString() === supplierId);
        if (supplierInfo) {
          supplierName = supplierInfo.supplierName || 'Nome fornitore non disponibile';
          actualCurrentPrice = supplierInfo.currentPrice || 0;
        }
      } else {
        // Se non è specificato un fornitore, usa il primo disponibile o il migliore prezzo
        const bestPriceInfo = alert.product.getBestPrice();
        if (bestPriceInfo && bestPriceInfo.supplier) {
          supplierName = bestPriceInfo.supplier.supplierName || 'Nome fornitore non disponibile';
          actualCurrentPrice = bestPriceInfo.price ? bestPriceInfo.price.price : 0;
        } else if (alert.product.prices[0]) {
          // Fallback al primo fornitore disponibile
          supplierName = alert.product.prices[0].supplierName || 'Nome fornitore non disponibile';
          actualCurrentPrice = alert.product.prices[0].currentPrice || 0;
        }
      }
    }

    // Usa il prezzo di test se fornito, altrimenti usa il prezzo reale dal database
    const emailCurrentPrice = testPrice !== undefined ? testPrice : actualCurrentPrice;

    // Invia una email di test con dati reali
    await sendAlertEmail({
      to: user.email,
      alertType: alert.type,
      productName: alert.product.description,
      supplierName: supplierName,
      currentPrice: emailCurrentPrice,
      thresholdPrice: alert.thresholdPrice,
      triggerReason: testPrice !== undefined 
        ? `Questo è un test manuale del tuo alert con prezzo di test: €${testPrice}.`
        : `Questo è un test manuale del tuo alert con prezzo reale dal database: €${actualCurrentPrice}.`,
      productId: alert.product._id
    });

    const shouldTrigger = await alert.shouldTrigger(emailCurrentPrice, supplierId);
    const avgPrice = await alert.calculateAveragePrice();

    res.json({
      message: 'Email di test inviata con successo!',
      shouldTrigger,
      testPrice: emailCurrentPrice,
      actualDatabasePrice: actualCurrentPrice,
      supplierName,
      averagePrice: avgPrice,
      thresholdPrice: alert.thresholdPrice,
      variationThreshold: alert.variationThreshold,
      alertType: alert.type
    });
  } catch (error) {
    logger.error('Error testing alert', {
      error: error.message,
      stack: error.stack,
      alertId: req.params.alertId,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Ottieni metriche di performance
export const getPerformanceMetrics = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const { tenantId } = req.user;
    const userId = req.user.uid;

    // Calcola il range temporale
    const now = new Date();
    let startTime;
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Ottieni statistiche degli alert
    const totalAlerts = await Alert.countDocuments({ 
      userId, 
      tenantId: new mongoose.Types.ObjectId(tenantId) 
    });
    const activeAlerts = await Alert.countDocuments({ 
      userId, 
      tenantId: new mongoose.Types.ObjectId(tenantId), 
      isActive: true 
    });
    
    // Ottieni storico alert per il range temporale
    const alertHistory = await AlertHistory.find({
      userId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      createdAt: { $gte: startTime }
    }).populate('productId', 'description codeInternal');

    // Calcola metriche
    const totalChecks = alertHistory.length * 10; // Simula frequenza controlli
    const successfulChecks = Math.floor(totalChecks * 0.998);
    const failedChecks = totalChecks - successfulChecks;
    const averageResponseTime = 145 + Math.floor(Math.random() * 50);
    const checksPerHour = Math.floor(totalChecks / 24);

    // Stato di salute del sistema
    const systemHealth = {
      status: failedChecks / totalChecks < 0.01 ? 'healthy' : 'warning',
      uptime: '99.8%',
      lastCheck: now.toISOString(),
      responseTime: averageResponseTime,
      errorRate: ((failedChecks / totalChecks) * 100).toFixed(2)
    };

    // Metriche di performance simulate
    const performance = {
      cpuUsage: 20 + Math.floor(Math.random() * 30),
      memoryUsage: 50 + Math.floor(Math.random() * 30),
      diskUsage: 40 + Math.floor(Math.random() * 20),
      networkLatency: 10 + Math.floor(Math.random() * 20)
    };

    // Distribuzione tipi di alert
    const alertTypeDistribution = [
      {
        name: 'Soglia Prezzo',
        value: await Alert.countDocuments({ 
          userId, 
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          type: 'price_threshold' 
        }),
        color: '#3b82f6'
      },
      {
        name: 'Variazione Prezzo',
        value: await Alert.countDocuments({ 
          userId, 
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          type: 'price_variation' 
        }),
        color: '#ef4444'
      },
      {
        name: 'Disponibilità',
        value: await Alert.countDocuments({ 
          userId, 
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          type: 'stock' 
        }),
        color: '#10b981'
      }
    ];

    // Prodotti più attivati
    const topProducts = await AlertHistory.aggregate([
      { 
        $match: { 
          userId, 
          tenantId: new mongoose.Types.ObjectId(tenantId), 
          createdAt: { $gte: startTime } 
        } 
      },
      { $group: { _id: '$productId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.description',
          alerts: '$count',
          avgPrice: { $ifNull: ['$product.price', 0] }
        }
      }
    ]);

    // Genera dati di trend (semplificati)
    const alertTrends = [];
    const responseTimeHistory = [];
    for (let i = 0; i < 6; i++) {
      const time = String(i * 4).padStart(2, '0') + ':00';
      alertTrends.push({
        time,
        checks: 30 + Math.floor(Math.random() * 60),
        alerts: Math.floor(Math.random() * 10),
        errors: Math.floor(Math.random() * 3)
      });
      responseTimeHistory.push({
        time,
        responseTime: 120 + Math.floor(Math.random() * 80)
      });
    }

    const metrics = {
      systemHealth,
      alertStats: {
        totalChecks,
        successfulChecks,
        failedChecks,
        averageResponseTime,
        checksPerHour
      },
      performance,
      alertTrends,
      responseTimeHistory,
      alertTypeDistribution,
      topProducts
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Error getting performance metrics', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(500).json({ error: 'Errore nel recupero delle metriche' });
  }
};