import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

// Crea un nuovo alert
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
      userId: new mongoose.Types.ObjectId(req.user._id),
      productId: new mongoose.Types.ObjectId(productId),
      type,
      isActive: true
    });

    if (existingAlert) {
      return res.status(400).json({ error: 'Esiste già un alert attivo di questo tipo per questo prodotto' });
    }

    const alertData = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(req.user._id),
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
    await alert.populate(['product', 'user']);

    res.status(201).json({
      message: 'Alert creato con successo',
      alert
    });
  } catch (error) {
    console.error('Errore nella creazione dell\'alert:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Recupera tutti gli alert dell'utente
export const getUserAlerts = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { page = 1, limit = 10, isActive, type } = req.query;

    const filter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(req.user._id)
    };

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (type) {
      filter.type = type;
    }

    const alerts = await Alert.find(filter)
      .populate('product', 'description code category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Alert.countDocuments(filter);

    res.json({
      alerts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Errore nel recupero degli alert:', error);
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
      userId: new mongoose.Types.ObjectId(req.user._id)
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    // Aggiorna i campi permessi
    const allowedUpdates = ['thresholdPrice', 'variationThreshold', 'isActive', 'checkFrequency', 'notificationMethod', 'notes'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        alert[field] = updates[field];
      }
    });

    alert.updatedAt = new Date();
    await alert.save();
    await alert.populate(['product', 'user']);

    res.json({
      message: 'Alert aggiornato con successo',
      alert
    });
  } catch (error) {
    console.error('Errore nell\'aggiornamento dell\'alert:', error);
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
      userId: new mongoose.Types.ObjectId(req.user._id)
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    res.json({ message: 'Alert eliminato con successo' });
  } catch (error) {
    console.error('Errore nell\'eliminazione dell\'alert:', error);
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
      userId: new mongoose.Types.ObjectId(req.user._id)
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    alert.isActive = !alert.isActive;
    alert.updatedAt = new Date();
    await alert.save();
    await alert.populate(['product', 'user']);

    res.json({
      message: `Alert ${alert.isActive ? 'attivato' : 'disattivato'} con successo`,
      alert
    });
  } catch (error) {
    console.error('Errore nel toggle dell\'alert:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

// Testa un alert (verifica se dovrebbe scattare)
export const testAlert = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { alertId } = req.params;
    const { testPrice, supplierId } = req.body;

    const alert = await Alert.findOne({
      _id: alertId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(req.user._id)
    }).populate('product');

    if (!alert) {
      return res.status(404).json({ error: 'Alert non trovato' });
    }

    const shouldTrigger = await alert.shouldTrigger(testPrice, supplierId);
    const avgPrice = await alert.calculateAveragePrice();

    res.json({
      shouldTrigger,
      testPrice,
      averagePrice: avgPrice,
      thresholdPrice: alert.thresholdPrice,
      variationThreshold: alert.variationThreshold,
      alertType: alert.type
    });
  } catch (error) {
    console.error('Errore nel test dell\'alert:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};