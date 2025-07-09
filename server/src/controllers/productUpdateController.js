import mongoose from 'mongoose';
import Product from '../models/Product.js';
import alertMonitoringService from '../services/alertMonitoringService.js';
import logger from '../utils/logger.js';

export const updateProductPrice = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { productId, supplierId, price, currency = 'EUR', invoiceId, invoiceDate } = req.body;

    logger.info('Inizio aggiornamento prezzo prodotto', {
      tenantId,
      productId,
      supplierId,
      price,
      currency,
      invoiceId
    });

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId is required' });
    }

    // Validate required fields
    if (!productId || !supplierId || !price || !invoiceId || !invoiceDate) {
      logger.warn('Campi obbligatori mancanti per aggiornamento prezzo', {
        tenantId,
        missingFields: {
          productId: !productId,
          supplierId: !supplierId,
          price: !price,
          invoiceId: !invoiceId,
          invoiceDate: !invoiceDate
        }
      });
      return res.status(400).json({ 
        error: 'Missing required fields: productId, supplierId, price, invoiceId, invoiceDate' 
      });
    }

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(supplierId)) {
      logger.warn('Formato ObjectId non valido', {
        tenantId,
        productId,
        supplierId,
        productIdValid: mongoose.Types.ObjectId.isValid(productId),
        supplierIdValid: mongoose.Types.ObjectId.isValid(supplierId)
      });
      return res.status(400).json({ error: 'Invalid productId or supplierId format' });
    }

    // Find the product
    const product = await Product.findOne({
      _id: new mongoose.Types.ObjectId(productId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!product) {
      logger.warn('Prodotto non trovato per aggiornamento prezzo', {
        tenantId,
        productId
      });
      return res.status(404).json({ error: 'Product not found' });
    }

    // Find or create price entry for this supplier
    let supplierPriceIndex = product.prices.findIndex(
      p => p.supplierId.toString() === supplierId
    );

    const newPriceEntry = {
      price: parseFloat(price),
      currency,
      invoiceId: new mongoose.Types.ObjectId(invoiceId),
      invoiceDate: new Date(invoiceDate),
      createdAt: new Date()
    };

    if (supplierPriceIndex === -1) {
      // Create new supplier price entry
      product.prices.push({
        supplierId: new mongoose.Types.ObjectId(supplierId),
        priceHistory: [newPriceEntry]
      });
      logger.debug('Creata nuova entry prezzo per fornitore', {
        tenantId,
        productId,
        supplierId
      });
    } else {
      // Add to existing supplier's price history
      product.prices[supplierPriceIndex].priceHistory.push(newPriceEntry);
      
      // Keep only last 100 price entries per supplier
      if (product.prices[supplierPriceIndex].priceHistory.length > 100) {
        product.prices[supplierPriceIndex].priceHistory = 
          product.prices[supplierPriceIndex].priceHistory
            .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))
            .slice(0, 100);
        logger.debug('Limitato storico prezzi a 100 entry', {
          tenantId,
          productId,
          supplierId
        });
      }
      logger.debug('Aggiunto prezzo a storico esistente', {
        tenantId,
        productId,
        supplierId,
        historyLength: product.prices[supplierPriceIndex].priceHistory.length
      });
    }

    // Update product timestamp
    product.updatedAt = new Date();

    // Save the product
    await product.save();

    logger.info('Prezzo prodotto aggiornato con successo', {
      tenantId,
      productId,
      supplierId,
      newPrice: newPriceEntry.price,
      currency: newPriceEntry.currency
    });

    // Check for price alerts after updating the product
    try {
      await alertMonitoringService.checkProductAlerts(productId, tenantId);
      logger.debug('Controllo alert completato dopo aggiornamento prezzo', {
        tenantId,
        productId
      });
    } catch (alertError) {
      logger.error('Errore nel controllo alert dopo aggiornamento prezzo', {
        tenantId,
        productId,
        error: alertError.message,
        stack: alertError.stack
      });
      // Don't fail the price update if alert checking fails
    }

    res.json({
      message: 'Product price updated successfully',
      productId,
      supplierId,
      newPrice: newPriceEntry
    });

  } catch (error) {
    logger.error('Errore durante aggiornamento prezzo prodotto', {
      tenantId: req.user?.tenantId,
      productId: req.body?.productId,
      supplierId: req.body?.supplierId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};