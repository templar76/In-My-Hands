import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import ProductMatchingService from '../services/productMatchingService.js';
import { isPhaseEnabled } from '../middleware/tenantConfig.js';
import logger from '../utils/logger.js';

/**
 * Ottiene tutte le linee fattura in attesa di revisione manuale
 */
export const getPendingReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending_review' } = req.query;
    const tenantId = req.user.tenantId;

    if (!isPhaseEnabled(req.tenantConfig, 'phase1')) {
      return res.status(403).json({ error: 'Phase 1 non abilitata' });
    }

    const skip = (page - 1) * limit;

    // Trova fatture con linee in pending_review
    const invoices = await Invoice.find({
      tenantId,
      'lineItems.productMatchingStatus': status
    })
    .populate('supplierId', 'name vatNumber')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Estrai solo le linee in pending_review
    const pendingItems = [];
    invoices.forEach(invoice => {
      invoice.lineItems.forEach((item, index) => {
        if (item.productMatchingStatus === status) {
          pendingItems.push({
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            supplier: {
              id: invoice.supplierId._id,
              name: invoice.supplierId.name,
              vatNumber: invoice.supplierId.vatNumber
            },
            lineItem: {
              ...item.toObject(),
              lineIndex: index
            }
          });
        }
      });
    });

    // Conta totale
    const totalCount = await Invoice.countDocuments({
      tenantId,
      'lineItems.productMatchingStatus': status
    });

    res.json({
      items: pendingItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error('Errore nel recupero pending reviews', { error: error.message, stack: error.stack, tenantId: req.user?.tenantId });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Ottiene prodotti non abbinati (Phase 2)
 */
export const getUnmatchedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const tenantId = req.user.tenantId;

    if (!isPhaseEnabled(req.tenantConfig, 'phase2')) {
      return res.status(403).json({ error: 'Phase 2 non abilitata' });
    }

    const skip = (page - 1) * limit;

    // Trova fatture con linee unmatched
    const invoices = await Invoice.find({
      tenantId,
      'lineItems.productMatchingStatus': 'unmatched'
    })
    .populate('supplierId', 'name vatNumber')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Estrai solo le linee unmatched
    const unmatchedItems = [];
    invoices.forEach(invoice => {
      invoice.lineItems.forEach((item, index) => {
        if (item.productMatchingStatus === 'unmatched') {
          unmatchedItems.push({
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            supplier: {
              id: invoice.supplierId._id,
              name: invoice.supplierId.name,
              vatNumber: invoice.supplierId.vatNumber
            },
            lineItem: {
              ...item.toObject(),
              lineIndex: index
            }
          });
        }
      });
    });

    const totalCount = await Invoice.countDocuments({
      tenantId,
      'lineItems.productMatchingStatus': 'unmatched'
    });

    res.json({
      items: unmatchedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error('Errore nel recupero unmatched products', { error: error.message, stack: error.stack, tenantId: req.user?.tenantId });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Approva un abbinamento prodotto
 */
export const approveMatch = async (req, res) => {
  try {
    const { invoiceId, lineIndex, productId } = req.body;
    const userId = req.user._id;

    if (!isPhaseEnabled(req.tenantConfig, 'phase1')) {
      return res.status(403).json({ error: 'Phase 1 non abilitata' });
    }

    const invoice = await Invoice.findOne({ 
      _id: invoiceId, 
      tenantId: req.user.tenantId 
    });
    if (!invoice) {
      return res.status(404).json({ error: 'Fattura non trovata' });
    }

    if (lineIndex >= invoice.lineItems.length) {
      return res.status(400).json({ error: 'Indice linea non valido' });
    }

    const lineItem = invoice.lineItems[lineIndex];
    
    // Verifica che il prodotto esista E appartenga al tenant
    const product = await Product.findOne({ 
      _id: productId, 
      tenantId: req.user.tenantId 
    });
    if (!product) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    // Aggiorna la linea fattura
    lineItem.productMatchingStatus = 'approved';
    lineItem.matchedProductId = productId;
    lineItem.reviewedBy = userId;
    lineItem.reviewedAt = new Date();
    lineItem.matchingMethod = 'manual';

    await invoice.save();

    // Aggiungi prezzo al prodotto se non esiste già
    const priceData = {
      price: lineItem.unitPrice,
      currency: invoice.currency || 'EUR',
      quantity: lineItem.quantity,
      unitOfMeasure: lineItem.unitOfMeasure
    };

    const supplierData = {
      supplierId: invoice.supplierId,
      supplierVat: invoice.supplier.vatNumber,  // ✅ Cambiato da pIva
      supplierName: invoice.supplier.name
    };

    const invoiceData = {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      invoiceLineNumber: lineItem.lineNumber
    };

    product.addPriceEntry(supplierData, priceData, invoiceData);
    await product.save();

    // Aggiungi la descrizione della fattura come descrizione alternativa
    try {
      await ProductMatchingService.addAlternativeDescription(
        productId,
        lineItem.description,
        'manual_review',
        userId
      );
    } catch (descError) {
      logger.warn('Errore nell\'aggiunta descrizione alternativa', { 
        productId, 
        error: descError.message, 
        tenantId: req.user?.tenantId 
      });
    }

    res.json({
      message: 'Abbinamento approvato con successo',
      lineItem: {
        invoiceId,
        lineIndex,
        status: lineItem.productMatchingStatus,
        matchedProductId: productId
      }
    });
  } catch (error) {
    logger.error('Errore nell\'approvazione abbinamento', { 
      error: error.message, 
      stack: error.stack, 
      invoiceId: req.body?.invoiceId, 
      tenantId: req.user?.tenantId 
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Rifiuta un abbinamento prodotto
 */
export const rejectMatch = async (req, res) => {
  try {
    const { invoiceId, lineIndex, reason } = req.body;
    const userId = req.user._id;

    if (!isPhaseEnabled(req.tenantConfig, 'phase1')) {
      return res.status(403).json({ error: 'Phase 1 non abilitata' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Fattura non trovata' });
    }

    if (lineIndex >= invoice.lineItems.length) {
      return res.status(400).json({ error: 'Indice linea non valido' });
    }

    const lineItem = invoice.lineItems[lineIndex];
    
    // Aggiorna la linea fattura
    lineItem.productMatchingStatus = 'rejected';
    lineItem.matchedProductId = null;
    lineItem.reviewedBy = userId;
    lineItem.reviewedAt = new Date();
    lineItem.reviewNotes = reason;

    await invoice.save();

    res.json({
      message: 'Abbinamento rifiutato',
      lineItem: {
        invoiceId,
        lineIndex,
        status: lineItem.productMatchingStatus,
        reason
      }
    });
  } catch (error) {
    logger.error('Errore nel rifiuto abbinamento', { 
      error: error.message, 
      stack: error.stack, 
      invoiceId: req.body?.invoiceId, 
      tenantId: req.user?.tenantId 
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Crea un nuovo prodotto da una linea unmatched (Phase 2)
 */
export const createProductFromLine = async (req, res) => {
  try {
    const { invoiceId, lineIndex, productData } = req.body;
    const userId = req.user._id;
    const tenantId = req.user.tenantId;

    if (!isPhaseEnabled(req.tenantConfig, 'phase2')) {
      return res.status(403).json({ error: 'Phase 2 non abilitata' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Fattura non trovata' });
    }

    if (lineIndex >= invoice.lineItems.length) {
      return res.status(400).json({ error: 'Indice linea non valido' });
    }

    const lineItem = invoice.lineItems[lineIndex];

    // Genera codice interno univoco
    const lastProduct = await Product.findOne({ tenantId }).sort({ codeInternal: -1 });
    let nextCode = 1;
    if (lastProduct && lastProduct.codeInternal) {
      const lastCode = parseInt(lastProduct.codeInternal.replace(/\D/g, ''));
      nextCode = isNaN(lastCode) ? 1 : lastCode + 1;
    }
    const codeInternal = `PROD${nextCode.toString().padStart(6, '0')}`;

    // Crea nuovo prodotto
    const newProduct = new Product({
      tenantId,
      codeInternal,
      description: productData.description || lineItem.description,
      category: productData.category,
      unit: productData.unit || lineItem.unitOfMeasure,
      metadata: productData.metadata || {},
      descriptions: [{
        text: lineItem.description,
        normalized: ProductMatchingService.normalizeDescription(lineItem.description),
        source: 'invoice',
        frequency: 1,
        lastSeen: new Date(),
        addedBy: userId,
        confidence: 1.0 // Descrizione originale ha confidenza massima
      }]
    });

    // Aggiungi prezzo iniziale
    const priceData = {
      price: lineItem.unitPrice,
      currency: invoice.currency || 'EUR',
      quantity: lineItem.quantity,
      unitOfMeasure: lineItem.unitOfMeasure
    };

    const supplierData = {
      supplierId: invoice.supplierId,
      supplierVat: invoice.supplier.pIva,
      supplierName: invoice.supplier.name
    };

    const invoiceData = {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      invoiceLineNumber: lineItem.lineNumber
    };

    newProduct.addPriceEntry(supplierData, priceData, invoiceData);
    await newProduct.save();

    // Aggiorna la linea fattura
    lineItem.productMatchingStatus = req.tenantConfig.phase2.requireApprovalForNew ? 'pending_review' : 'approved';
    lineItem.matchedProductId = newProduct._id;
    lineItem.reviewedBy = userId;
    lineItem.reviewedAt = new Date();
    lineItem.matchingMethod = 'manual';
    lineItem.reviewNotes = 'Nuovo prodotto creato';

    await invoice.save();

    res.json({
      message: 'Nuovo prodotto creato con successo',
      product: {
        id: newProduct._id,
        codeInternal: newProduct.codeInternal,
        description: newProduct.description
      },
      lineItem: {
        invoiceId,
        lineIndex,
        status: lineItem.productMatchingStatus,
        matchedProductId: newProduct._id
      }
    });
  } catch (error) {
    logger.error('Errore nella creazione prodotto', { 
      error: error.message, 
      stack: error.stack, 
      invoiceId: req.body?.invoiceId, 
      tenantId: req.user?.tenantId 
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Cerca prodotti simili per assistere nella revisione manuale
 */
export const searchSimilarProducts = async (req, res) => {
  try {
    const { description, limit = 10, threshold = 0.3 } = req.query;
    const tenantId = req.user.tenantId;

    if (!description) {
      return res.status(400).json({ error: 'Descrizione richiesta' });
    }

    // Usa il servizio di product matching
    const similarProducts = await ProductMatchingService.findSimilarProducts(
      description,
      tenantId,
      { 
        limit: parseInt(limit), 
        threshold: parseFloat(threshold),
        includeDescriptions: true 
      }
    );

    const formattedResults = similarProducts.map(result => ({
      product: result.product,
      score: result.score,
      confidence: result.confidence,
      matchedText: result.matchedText,
      matchType: result.matchType
    }));

    res.json({ 
      query: description,
      results: formattedResults 
    });
  } catch (error) {
    logger.error('Errore nella ricerca prodotti simili', { 
      error: error.message, 
      stack: error.stack, 
      description: req.query?.description, 
      tenantId: req.user?.tenantId 
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Calcola similarità semplice tra due stringhe
 */
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  
  let matches = 0;
  words1.forEach(word1 => {
    if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
      matches++;
    }
  });
  
  return matches / Math.max(words1.length, words2.length);
}

/**
 * Ottiene statistiche della revisione manuale
 */
export const getReviewStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { period = '30d' } = req.query;

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case '90d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } };
        break;
    }

    const stats = await Invoice.aggregate([
      { $match: { tenantId, ...dateFilter } },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.productMatchingStatus',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$lineItems.matchConfidence' }
        }
      }
    ]);

    const formattedStats = {
      pending: 0,
      pending_review: 0,
      approved: 0,
      rejected: 0,
      matched: 0,
      unmatched: 0,
      total: 0,
      avgConfidence: 0
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    stats.forEach(stat => {
      if (formattedStats.hasOwnProperty(stat._id)) {
        formattedStats[stat._id] = stat.count;
        formattedStats.total += stat.count;
        
        if (stat.avgConfidence) {
          totalConfidence += stat.avgConfidence * stat.count;
          confidenceCount += stat.count;
        }
      }
    });

    if (confidenceCount > 0) {
      formattedStats.avgConfidence = totalConfidence / confidenceCount;
    }

    res.json({
      period,
      stats: formattedStats,
      efficiency: {
        reviewRate: formattedStats.total > 0 ? 
          (formattedStats.approved + formattedStats.rejected) / formattedStats.total : 0,
        approvalRate: (formattedStats.approved + formattedStats.rejected) > 0 ? 
          formattedStats.approved / (formattedStats.approved + formattedStats.rejected) : 0
      }
    });
  } catch (error) {
    logger.error('Errore nel recupero statistiche review', { 
      error: error.message, 
      stack: error.stack, 
      period: req.query?.period, 
      tenantId: req.user?.tenantId 
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};