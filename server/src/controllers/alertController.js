import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { sendAlertEmail } from '../services/emailService.js';


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