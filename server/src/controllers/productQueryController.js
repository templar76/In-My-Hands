import mongoose from 'mongoose';
import Product from '../models/Product.js';
import logger from '../utils/logger.js';
import QueryOptimizationService from '../services/queryOptimizationService.js';
import CacheService from '../services/cacheService.js';

export const getProducts = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { page = 1, limit = 10, search, category, supplierId, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId is required' });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      category,
      supplierId,
      sortBy,
      sortOrder: sortOrder === 'desc' ? -1 : 1
    };

    // Utilizza il servizio di ottimizzazione query con cache
    const result = await QueryOptimizationService.getCachedOptimizedProducts(tenantId, options);

    res.json({
      products: result.products,
      stats: result.stats,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Errore recupero prodotti', {
      tenantId: req.user?.tenantId,
      query: req.query,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProductsStats = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId is required' });
    }

    const matchStage = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    
    // Date filter for purchases
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
    }

    // Pipeline per le statistiche principali
    const statsAggregate = [
      { $match: matchStage },
      { $unwind: '$prices' },
      { $unwind: '$prices.priceHistory' },
      {
        $addFields: {
          invoiceDate: '$prices.priceHistory.invoiceDate',
          totalValue: {
            $multiply: ['$prices.priceHistory.price', '$prices.priceHistory.quantity']
          },
          quantity: '$prices.priceHistory.quantity',
          price: '$prices.priceHistory.price'
        }
      },
      // Aggiungi filtro data se specificato
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: { invoiceDate: dateFilter } }] : []),
      {
        $group: {
          _id: null,
          totalProducts: { $addToSet: '$_id' }, // Conta prodotti unici
          totalVolume: { $sum: '$totalValue' },
          totalQuantity: { $sum: '$quantity' },
          activeSuppliers: { $addToSet: '$prices.supplierId' }, // Conta fornitori unici
          allPrices: { $push: '$price' }
        }
      },
      {
        $addFields: {
          totalProducts: { $size: '$totalProducts' }, // Converti array in conteggio
          activeSuppliers: { $size: '$activeSuppliers' }, // Converti array in conteggio
          averagePrice: { $avg: '$allPrices' }
        }
      }
    ];

    // Pipeline per i trend mensili
    const monthlyTrendAggregate = [
      { $match: matchStage },
      { $unwind: '$prices' },
      { $unwind: '$prices.priceHistory' },
      {
        $addFields: {
          invoiceDate: '$prices.priceHistory.invoiceDate',
          totalValue: {
            $multiply: ['$prices.priceHistory.price', '$prices.priceHistory.quantity']
          },
          quantity: '$prices.priceHistory.quantity'
        }
      },
      // Aggiungi filtro data se specificato
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: { invoiceDate: dateFilter } }] : []),
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          totalValue: { $sum: '$totalValue' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          },
          totalValue: 1,
          totalQuantity: 1
        }
      }
    ];

    // Esegui entrambe le aggregazioni
    const [statsResult, monthlyTrend] = await Promise.all([
      Product.aggregate(statsAggregate),
      Product.aggregate(monthlyTrendAggregate)
    ]);

    const stats = statsResult[0] || {
      totalProducts: 0,
      totalVolume: 0,
      totalQuantity: 0,
      averagePrice: 0,
      uniqueActiveSuppliers: 0,
      categories: []
    };

    // Calcola la crescita mensile
    let monthlyGrowth = 0;
    let hasInsufficientData = false;

    if (monthlyTrend.length >= 2) {
      const lastMonth = monthlyTrend[monthlyTrend.length - 1];
      const previousMonth = monthlyTrend[monthlyTrend.length - 2];
      if (previousMonth.totalValue > 0) {
        monthlyGrowth = ((lastMonth.totalValue - previousMonth.totalValue) / previousMonth.totalValue) * 100;
      } else {
        hasInsufficientData = true;
      }
    } else {
      hasInsufficientData = true;
    }

    // Aggiungi le nuove metriche alle statistiche
    const enhancedStats = {
      ...stats,
      activeSuppliers: stats.activeSuppliers || 0,
      uniqueProducts: stats.totalProducts || 0,
      monthlyGrowth: hasInsufficientData ? null : Math.round(monthlyGrowth * 100) / 100,
      hasInsufficientData
    };

    res.json({
      stats: enhancedStats,
      monthlyTrend
    });
  } catch (error) {
    logger.error('Errore recupero statistiche prodotti', {
      tenantId: req.user?.tenantId,
      query: req.query,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId is required' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    // Trova il prodotto base
    const product = await Product.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).populate('prices.supplierId', 'name vatNumber');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Aggregazione per Overview - volumi mensili
    const overviewAggregate = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          $or: [
            { 'lineItems.matchedProductId': new mongoose.Types.ObjectId(id) },
            { 'lineItems.codeInternal': product.codeInternal }
          ]
        }
      },
      {
        $unwind: '$lineItems'
      },
      {
        $match: {
          $or: [
            { 
              'lineItems.matchedProductId': new mongoose.Types.ObjectId(id),
              'lineItems.productMatchingStatus': { $in: ['matched', 'approved', 'pending', 'pending_review', 'unmatched', 'rejected'] }
            },
            { 'lineItems.codeInternal': product.codeInternal }
          ]
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          totalVolume: { $sum: '$lineItems.total' },
          totalQuantity: { $sum: '$lineItems.quantity' },
          averagePrice: { $avg: '$lineItems.unitPrice' },
          minPrice: { $min: '$lineItems.unitPrice' },
          maxPrice: { $max: '$lineItems.unitPrice' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ];
    
    // Aggregazione per Purchase History
    const purchaseHistoryAggregate = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          $or: [
            { 'lineItems.matchedProductId': new mongoose.Types.ObjectId(id) },
            { 'lineItems.codeInternal': product.codeInternal }
          ]
        }
      },
      {
        $unwind: '$lineItems'
      },
      {
        $match: {
          $or: [
            { 
              'lineItems.matchedProductId': new mongoose.Types.ObjectId(id),
              'lineItems.productMatchingStatus': { $in: ['matched', 'approved', 'pending', 'pending_review', 'unmatched', 'rejected'] }
            },
            { 'lineItems.codeInternal': product.codeInternal }
          ]
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplierInfo'
        }
      },
      {
        $unwind: '$supplierInfo'
      },
      {
        $project: {
          invoiceDate: 1,
          invoiceNumber: 1,
          supplier: {
            name: '$supplierInfo.name'
          },
          quantity: '$lineItems.quantity',
          unitPrice: '$lineItems.unitPrice',
          total: '$lineItems.total',
          description: '$lineItems.description',
          unitOfMeasure: '$lineItems.unitOfMeasure'
        }
      },
      {
        $sort: { invoiceDate: -1 }
      },
      {
        $limit: 50
      }
    ];
    
    // Aggregazione per Savings
    const savingsAggregate = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          $or: [
            { 'lineItems.matchedProductId': new mongoose.Types.ObjectId(id) },
            { 'lineItems.codeInternal': product.codeInternal }
          ],
          invoiceDate: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $unwind: '$lineItems'
      },
      {
        $match: {
          $or: [
            { 
              'lineItems.matchedProductId': new mongoose.Types.ObjectId(id),
              'lineItems.productMatchingStatus': { $in: ['matched', 'approved', 'pending', 'pending_review', 'unmatched', 'rejected'] }
            },
            { 'lineItems.codeInternal': product.codeInternal }
          ]
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplierInfo'
        }
      },
      {
        $unwind: '$supplierInfo'
      },
      {
        $group: {
          _id: '$supplierId',
          supplierName: { $first: '$supplierInfo.name' },
          supplierVat: { $first: '$supplierInfo.vatNumber' },
          averagePrice: { $avg: '$lineItems.unitPrice' },
          minPrice: { $min: '$lineItems.unitPrice' },
          maxPrice: { $max: '$lineItems.unitPrice' },
          totalQuantity: { $sum: '$lineItems.quantity' },
          totalSpent: { $sum: '$lineItems.total' },
          transactionCount: { $sum: 1 },
          lastPurchase: { $max: '$invoiceDate' }
        }
      },
      {
        $sort: { averagePrice: 1 }
      }
    ];

    // Esegui tutte le aggregazioni
    const [overviewData, purchaseHistory, savingsData] = await Promise.all([
      mongoose.model('Invoice').aggregate(overviewAggregate),
      mongoose.model('Invoice').aggregate(purchaseHistoryAggregate),
      mongoose.model('Invoice').aggregate(savingsAggregate)
    ]);

    // Calcola metriche per Calculate Savings
    let potentialSavings = 0;
    let bestSupplier = null;
    let currentAveragePrice = 0;
    
    if (savingsData.length > 0) {
      bestSupplier = savingsData[0]; // Il primo è quello con prezzo più basso
      const totalQuantity = savingsData.reduce((sum, supplier) => sum + supplier.totalQuantity, 0);
      currentAveragePrice = savingsData.reduce((sum, supplier) => 
        sum + (supplier.averagePrice * supplier.totalQuantity), 0) / totalQuantity;
      
      // Calcola risparmio potenziale se si acquistasse tutto dal fornitore più conveniente
      const potentialCost = totalQuantity * bestSupplier.averagePrice;
      const currentCost = savingsData.reduce((sum, supplier) => sum + supplier.totalSpent, 0);
      potentialSavings = currentCost - potentialCost;
    }

    // Prepara risposta completa
    const response = {
      product,
      overview: {
        monthlyData: overviewData,
        totalVolume: overviewData.reduce((sum, month) => sum + month.totalVolume, 0),
        totalQuantity: overviewData.reduce((sum, month) => sum + month.totalQuantity, 0),
        averagePrice: overviewData.length > 0 ? 
          overviewData.reduce((sum, month) => sum + month.averagePrice, 0) / overviewData.length : 0,
        priceRange: {
          min: Math.min(...overviewData.map(m => m.minPrice)),
          max: Math.max(...overviewData.map(m => m.maxPrice))
        }
      },
      purchaseHistory: {
        transactions: purchaseHistory,
        totalTransactions: purchaseHistory.length
      },
      savings: {
        supplierComparison: savingsData,
        potentialSavings: Math.max(0, potentialSavings),
        bestSupplier,
        currentAveragePrice
      },
      alerts: {
        // Placeholder per future implementazioni di alert
        priceAlerts: [],
        stockAlerts: []
      }
    };

    logger.debug('Dettagli prodotto recuperati con successo', {
      tenantId: req.user?.tenantId,
      productId: req.params.id,
      overviewDataLength: overviewData.length,
      purchaseHistoryLength: purchaseHistory.length,
      savingsDataLength: savingsData.length
    });

    res.json(response);
  } catch (error) {
    logger.error('Errore recupero dettagli prodotto', {
      tenantId: req.user?.tenantId,
      productId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};