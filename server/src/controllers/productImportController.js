import Product from '../models/Product.js';
import ProductMatchingService from '../services/productMatchingService.js';
import { loadTenantConfig } from '../middleware/tenantConfig.js';
import mongoose from 'mongoose';

/**
 * POST /api/products/import
 * Importa prodotti utilizzando il sistema di matching configurabile
 */
export const importProducts = async (req, res) => {
  try {
    const { lines } = req.body;
    const tenantId = req.user.tenantId;
    const tenantConfig = req.tenantConfig;
    const results = [];

    // Conta i prodotti esistenti per determinare se è un tenant "nuovo"
    const existingProductsCount = await Product.countDocuments({ tenantId });
    const isNewTenant = existingProductsCount === 0;
    
    // Flag per tracciare se abbiamo incontrato duplicati in questa sessione
    let duplicatesFound = false;
    let duplicateStats = {
      totalDuplicates: 0,
      highConfidenceMatches: 0,
      lowConfidenceMatches: 0
    };

    for (const line of lines) {
      // 1) Normalizza descrizione usando il service
      const normalizedDescription = ProductMatchingService.normalizeDescription(line.description);

      // 2) Cerca prodotti simili usando il service
      const similarProducts = await ProductMatchingService.findSimilarProducts(
        normalizedDescription,
        tenantId,
        {
          limit: 5,
          threshold: tenantConfig?.phase1?.confidenceThreshold || 0.7,
          includeAlternativeDescriptions: tenantConfig?.globalSettings?.enableAlternativeDescriptions || true
        }
      );

      const bestMatch = similarProducts.length > 0 ? similarProducts[0] : null;
      const matchConfidence = bestMatch ? bestMatch.confidence : 0;

      // 3) Determina lo status usando la configurazione del tenant
      const matchingResult = ProductMatchingService.determineMatchingStatus(
        bestMatch ? { product: bestMatch.product, confidence: matchConfidence } : null,
        tenantConfig
      );

      if (bestMatch && matchingResult.status === 'matched') {
        // Duplicato trovato - attiva la modalità controlli
        duplicatesFound = true;
        duplicateStats.totalDuplicates++;
        
        if (matchConfidence >= 0.8) {
          duplicateStats.highConfidenceMatches++;
        } else {
          duplicateStats.lowConfidenceMatches++;
        }
        
        const prod = await Product.findOne({ 
          _id: bestMatch.product._id, 
          tenantId 
        });
        const supplierExists = prod.suppliers?.some(s => 
          s.supplierId?.toString() === line.supplierId?.toString()
        );

        if (!supplierExists && matchConfidence >= (tenantConfig?.phase1?.autoApproveAbove || 0.9)) {
          const updatedProd = await Product.findOneAndUpdate(
            { _id: bestMatch.product._id, tenantId },
            {
              $push: {
                suppliers: {
                  supplierId: line.supplierId,
                  supplierVat: line.supplierVat,
                  price: line.price,
                  currency: line.currency,
                  lastUpdated: new Date()
                }
              }
            },
            { new: true }
          );

          // Aggiungi descrizione alternativa se diversa
          if (line.description !== bestMatch.product.description) {
            await ProductMatchingService.addAlternativeDescription(
              bestMatch.product._id,
              line.description,
              'invoice',
              req.user._id
            );
          }

          results.push({
            line,
            status: 'updated',
            product: updatedProd,
            matchConfidence,
            matchingMethod: ProductMatchingService.getMatchingMethod(matchConfidence)
          });
        } else {
          results.push({
            line,
            status: 'duplicate',
            product: prod,
            matchConfidence,
            suggestion: duplicatesFound && isNewTenant ? 
              'Primo duplicato rilevato. Considera di attivare i controlli di approvazione nelle impostazioni.' : null
          });
        }
      } else if (matchingResult.status === 'pending_review') {
        duplicatesFound = true;
        duplicateStats.totalDuplicates++;
        duplicateStats.lowConfidenceMatches++;
        
        results.push({
          line,
          status: 'pending_review',
          reason: matchingResult.reason,
          suggestedMatches: similarProducts,
          matchConfidence
        });
      } else {
        // Nuovo prodotto - logica semplificata
        const shouldAutoApprove = isNewTenant || 
                                 (tenantConfig?.phase2?.enabled && !tenantConfig?.phase2?.requireApprovalForNew);

        if (shouldAutoApprove) {
          const newProduct = new Product({
            tenantId,
            codeInternal: await generateUniqueCode(tenantId),
            description: line.description,
            descriptions: [{
              text: line.description,
              normalized: normalizedDescription,
              source: 'invoice',
              addedBy: req.user._id
            }],
            suppliers: [{
              supplierId: line.supplierId,
              supplierVat: line.supplierVat,
              price: line.price,
              currency: line.currency,
              lastUpdated: new Date()
            }],
            metadata: line.metadata,
            // Approvazione automatica per tenant nuovi
            approvalStatus: 'approved',
            approvedBy: req.user._id,
            approvedAt: new Date(),
            approvalNotes: isNewTenant ? 
              'Auto-approvato (tenant nuovo)' : 
              'Auto-approvato durante import'
          });

          const savedProduct = await newProduct.save();
          results.push({
            line,
            status: 'created',
            product: savedProduct
          });
        } else {
          results.push({
            line,
            status: 'requires_approval',
            reason: 'Nuovo prodotto richiede approvazione manuale'
          });
        }
      }
    }

    // Prepara la risposta con insights e suggerimenti
    const response = { 
      results,
      insights: {
        isNewTenant,
        existingProductsCount,
        duplicatesFound,
        duplicateStats,
        totalProcessed: lines.length,
        created: results.filter(r => r.status === 'created').length,
        updated: results.filter(r => r.status === 'updated').length,
        duplicates: results.filter(r => r.status === 'duplicate').length,
        pendingReview: results.filter(r => r.status === 'pending_review').length
      },
      suggestions: duplicatesFound && isNewTenant ? {
        enableControls: true,
        message: 'Sono stati rilevati potenziali duplicati. Ti consigliamo di attivare i controlli di approvazione nelle impostazioni per una gestione più precisa.',
        recommendedSettings: {
          'phase2.enabled': true,
          'phase2.requireApprovalForNew': true,
          'phase1.confidenceThreshold': 0.8
        }
      } : null
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('importProducts error', err);
    return res.status(500).json({ error: 'Errore durante import prodotti' });
  }
};

// Funzione helper per generare codici univoci
const generateUniqueCode = async (tenantId) => {
  const count = await Product.countDocuments({ tenantId });
  return `PROD-${tenantId.toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;
};

/**
 * GET /api/products/insights
 * Fornisce insights sui prodotti e duplicati per la dashboard
 */
export const getProductInsights = async (req, res) => {
  try {
    console.log('getProductInsights called for tenantId:', req.user.tenantId);
    const tenantId = req.user.tenantId;
    const { timeframe = '30d' } = req.query;
    
    // Validate and convert tenantId to ObjectId
    if (!tenantId) {
      console.error('TenantId missing from request');
      return res.status(400).json({ error: 'TenantId is required' });
    }
    
    let tenantObjectId;
    try {
      tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    } catch (err) {
      console.error('Invalid tenantId format:', tenantId, err);
      return res.status(400).json({ error: 'Invalid tenantId format' });
    }
    
    console.log('Using tenantObjectId:', tenantObjectId);
    
    // Calcola la data di inizio basata sul timeframe
    const startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    console.log('Fetching total products...');
    // Usa tenantObjectId invece di tenantId nelle query
    const totalProducts = await Product.countDocuments({ tenantId: tenantObjectId });
    console.log('Total products:', totalProducts);
    
    const recentProducts = await Product.countDocuments({ 
      tenantId: tenantObjectId, 
      createdAt: { $gte: startDate } 
    });
    console.log('Recent products:', recentProducts);
    
    // Continua con il resto delle query usando tenantObjectId...
    
    // Prodotti in attesa di approvazione
    const pendingApproval = await Product.countDocuments({ 
      tenantId, 
      approvalStatus: 'pending' 
    });
    
    // Prodotti con più fornitori (potenziali duplicati risolti)
    const productsWithMultipleSuppliers = await Product.countDocuments({
      tenantId,
      'suppliers.1': { $exists: true }
    });
    
    // Analisi delle descrizioni duplicate
    const duplicateDescriptions = await Product.aggregate([
      { $match: { tenantId } },
      { $group: {
        _id: '$description',
        count: { $sum: 1 },
        products: { $push: '$_id' }
      }},
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Trend di creazione prodotti negli ultimi giorni
    const productTrend = await Product.aggregate([
      { $match: { 
        tenantId, 
        createdAt: { $gte: startDate } 
      }},
      { $group: {
        _id: { 
          $dateToString: { 
            format: '%Y-%m-%d', 
            date: '$createdAt' 
          }
        },
        count: { $sum: 1 }
      }},
      { $sort: { '_id': 1 } }
    ]);

    const insights = {
      overview: {
        totalProducts,
        recentProducts,
        pendingApproval,
        productsWithMultipleSuppliers,
        duplicateRisk: duplicateDescriptions.length
      },
      duplicateAnalysis: {
        potentialDuplicates: duplicateDescriptions.length,
        topDuplicates: duplicateDescriptions.slice(0, 5).map(d => ({
          description: d._id,
          count: d.count,
          productIds: d.products
        }))
      },
      trends: {
        productCreation: productTrend
      },
      recommendations: []
    };
    
    // Genera raccomandazioni basate sui dati
    if (pendingApproval > 10) {
      insights.recommendations.push({
        type: 'warning',
        title: 'Molti prodotti in attesa',
        message: `Hai ${pendingApproval} prodotti in attesa di approvazione. Considera di rivedere le impostazioni di auto-approvazione.`,
        action: 'review_settings'
      });
    }
    
    if (duplicateDescriptions.length > 5) {
      insights.recommendations.push({
        type: 'info',
        title: 'Duplicati rilevati',
        message: `Sono stati trovati ${duplicateDescriptions.length} gruppi di prodotti con descrizioni simili. Considera di unificarli.`,
        action: 'review_duplicates'
      });
    }
    
    if (totalProducts === 0) {
      insights.recommendations.push({
        type: 'success',
        title: 'Primo import',
        message: 'Questo è il tuo primo import! I prodotti verranno approvati automaticamente per semplificare l\'inizio.',
        action: 'none'
      });
    }

    return res.status(200).json(insights);
  } catch (err) {
    console.error('getProductInsights error details:', {
      message: err.message,
      stack: err.stack,
      tenantId: req.user?.tenantId
    });
    return res.status(500).json({ error: 'Errore durante recupero insights' });
  }
};