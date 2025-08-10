/**
 * Query Optimization Service
 * Implementa aggregation pipelines ottimizzate per sostituire query inefficienti
 */

import mongoose from 'mongoose';
import CacheService from './cacheService.js';

class QueryOptimizationService {
  /**
   * Ottimizzazione per ottenere prodotti con dati aggregati
   * Sostituisce multiple query separate con una singola aggregation
   */
  static async getOptimizedProducts(tenantId, options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      supplierId = '',
      sortBy = 'description',
      sortOrder = 1
    } = options;

    const skip = (page - 1) * limit;
    
    // Costruisci il match stage
    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };
    
    if (search) {
      matchStage.$or = [
        { description: { $regex: search, $options: 'i' } },
        { codeInternal: { $regex: search, $options: 'i' } },
        { 'descriptions.description': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      matchStage.category = category;
    }
    
    if (supplierId) {
      matchStage['prices.supplierId'] = new mongoose.Types.ObjectId(supplierId);
    }
    
    const pipeline = [
      { $match: matchStage },
      
      // Lookup per ottenere dati delle fatture correlate
      {
        $lookup: {
          from: 'invoices',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$tenantId', new mongoose.Types.ObjectId(tenantId)] },
                    {
                      $or: [
                        { $in: ['$$productId', '$lineItems.productId'] },
                        { $in: ['$$productId', '$lineItems.matchedProductId'] }
                      ]
                    }
                  ]
                }
              }
            },
            { $unwind: '$lineItems' },
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$lineItems.productId', '$$productId'] },
                    { $eq: ['$lineItems.matchedProductId', '$$productId'] }
                  ]
                }
              }
            },
            {
              $project: {
                quantity: '$lineItems.quantita',
                unitPrice: '$lineItems.prezzoUnitario',
                totalPrice: '$lineItems.prezzoTotale',
                invoiceDate: '$invoiceData.dataDocumento',
                supplierId: '$supplierId'
              }
            }
          ],
          as: 'invoiceItems'
        }
      },
      
      // Lookup per dati fornitori
      {
        $lookup: {
          from: 'suppliers',
          localField: 'prices.supplierId',
          foreignField: '_id',
          as: 'supplierDetails'
        }
      },
      
      // Calcola metriche aggregate
      {
        $addFields: {
          // Calcola prezzo corrente (ultimo prezzo disponibile)
          currentPrice: {
            $let: {
              vars: {
                sortedPrices: {
                  $sortArray: {
                    input: '$prices',
                    sortBy: { date: -1 }
                  }
                }
              },
              in: { $arrayElemAt: ['$$sortedPrices.price', 0] }
            }
          },
          
          // Calcola prezzo migliore (più basso)
          bestPrice: {
            $min: '$prices.price'
          },
          
          // Calcola prezzo medio
          averagePrice: {
            $avg: '$prices.price'
          },
          
          // Calcola totale speso
          totalSpent: {
            $sum: '$invoiceItems.totalPrice'
          },
          
          // Calcola quantità totale acquistata
          totalQuantityPurchased: {
            $sum: '$invoiceItems.quantity'
          },
          
          // Data ultimo acquisto
          lastPurchaseDate: {
            $max: '$invoiceItems.invoiceDate'
          },
          
          // Numero di fornitori
          supplierCount: {
            $size: {
              $setUnion: ['$prices.supplierId', []]
            }
          },
          
          // Numero di acquisti
          purchaseCount: {
            $size: '$invoiceItems'
          }
        }
      },
      
      // Proiezione finale
      {
        $project: {
          _id: 1,
          tenantId: 1,
          codeInternal: 1,
          description: 1,
          descriptions: 1,
          category: 1,
          unitOfMeasure: 1,
          metadata: 1,
          approvalStatus: 1,
          ignoredDuplicate: 1,
          currentPrice: 1,
          bestPrice: 1,
          averagePrice: 1,
          totalSpent: 1,
          totalQuantityPurchased: 1,
          lastPurchaseDate: 1,
          supplierCount: 1,
          purchaseCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      
      // Ordinamento
      { $sort: { [sortBy]: sortOrder } },
      
      // Paginazione
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];
    
    const Product = mongoose.model('Product');
    const [result] = await Product.aggregate(pipeline);
    
    return {
      products: result.data,
      totalCount: result.totalCount[0]?.count || 0,
      currentPage: page,
      totalPages: Math.ceil((result.totalCount[0]?.count || 0) / limit)
    };
  }
  
  /**
   * Ottimizzazione per analytics fornitori
   * Aggregazione efficiente per analisi spese per fornitore
   */
  static async getOptimizedSupplierAnalytics(tenantId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };
    
    if (startDate || endDate) {
      matchStage['invoiceDate'] = {};
      if (startDate) matchStage['invoiceDate'].$gte = new Date(startDate);
      if (endDate) matchStage['invoiceDate'].$lte = new Date(endDate);
    }
    
    const pipeline = [
      { $match: matchStage },
      
      // Lookup per dati fornitore
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      
      { $unwind: '$supplier' },
      
      // Raggruppa per fornitore
      {
        $group: {
          _id: '$supplierId',
          supplierName: { $first: '$supplier.name' },
          supplierVatNumber: { $first: '$supplier.vatNumber' },
          totalAmount: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
          avgInvoiceAmount: { $avg: '$totalAmount' },
          minInvoiceAmount: { $min: '$totalAmount' },
          maxInvoiceAmount: { $max: '$totalAmount' },
          firstInvoiceDate: { $min: '$invoiceDate' },
          lastInvoiceDate: { $max: '$invoiceDate' },
          
          // Calcola prodotti unici per fornitore
          uniqueProducts: {
            $addToSet: {
              $map: {
                input: '$lineItems',
                as: 'item',
                in: '$$item.matchedProductId'
              }
            }
          },
          
          // Calcola totale articoli
          totalItems: {
            $sum: {
              $sum: '$lineItems.quantity'
            }
          }
        }
      },
      
      // Calcola metriche aggiuntive
      {
        $addFields: {
          uniqueProductCount: {
            $size: {
              $reduce: {
                input: '$uniqueProducts',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] }
              }
            }
          },
          
          // Calcola giorni di collaborazione
          collaborationDays: {
            $divide: [
              { $subtract: ['$lastInvoiceDate', '$firstInvoiceDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      
      // Ordinamento per importo totale
      { $sort: { totalAmount: -1 } },
      
      // Calcola percentuali sul totale
      {
        $group: {
          _id: null,
          suppliers: { $push: '$$ROOT' },
          grandTotal: { $sum: '$totalAmount' },
          totalInvoices: { $sum: '$invoiceCount' }
        }
      },
      
      {
        $project: {
          _id: 0,
          grandTotal: 1,
          totalInvoices: 1,
          suppliers: {
            $map: {
              input: '$suppliers',
              as: 'supplier',
              in: {
                _id: '$$supplier._id',
                supplierName: '$$supplier.supplierName',
                supplierVatNumber: '$$supplier.supplierVatNumber',
                totalAmount: '$$supplier.totalAmount',
                percentage: {
                  $multiply: [
                    { $divide: ['$$supplier.totalAmount', '$grandTotal'] },
                    100
                  ]
                },
                invoiceCount: '$$supplier.invoiceCount',
                avgInvoiceAmount: '$$supplier.avgInvoiceAmount',
                minInvoiceAmount: '$$supplier.minInvoiceAmount',
                maxInvoiceAmount: '$$supplier.maxInvoiceAmount',
                firstInvoiceDate: '$$supplier.firstInvoiceDate',
                lastInvoiceDate: '$$supplier.lastInvoiceDate',
                uniqueProductCount: '$$supplier.uniqueProductCount',
                totalItems: '$$supplier.totalItems',
                collaborationDays: '$$supplier.collaborationDays'
              }
            }
          }
        }
      }
    ];
    
    const Invoice = mongoose.model('Invoice');
    const [result] = await Invoice.aggregate(pipeline);
    
    return result || { suppliers: [], grandTotal: 0, totalInvoices: 0 };
  }
  
  /**
   * Ottimizzazione per analisi temporale spese
   */
  static async getOptimizedSpendingTrends(tenantId, groupBy = 'month', dateRange = {}) {
    const { startDate, endDate, supplierId } = dateRange;
    
    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };
    
    if (supplierId) {
      matchStage.supplierId = new mongoose.Types.ObjectId(supplierId);
    }
    
    if (startDate || endDate) {
      matchStage['invoiceDate'] = {};
      if (startDate) matchStage['invoiceDate'].$gte = new Date(startDate);
      if (endDate) matchStage['invoiceDate'].$lte = new Date(endDate);
    }
    
    // Definisci il raggruppamento temporale
    let dateGrouping;
    switch (groupBy) {
      case 'day':
        dateGrouping = {
          year: { $year: '$invoiceData.dataDocumento' },
          month: { $month: '$invoiceData.dataDocumento' },
          day: { $dayOfMonth: '$invoiceData.dataDocumento' }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$invoiceData.dataDocumento' },
          week: { $week: '$invoiceData.dataDocumento' }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: '$invoiceData.dataDocumento' },
          month: { $month: '$invoiceData.dataDocumento' }
        };
        break;
      case 'year':
        dateGrouping = {
          year: { $year: '$invoiceData.dataDocumento' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$invoiceData.dataDocumento' },
          month: { $month: '$invoiceData.dataDocumento' }
        };
    }
    
    const pipeline = [
      { $match: matchStage },
      
      {
        $group: {
          _id: dateGrouping,
          totalAmount: { $sum: '$invoiceData.totaleDocumento' },
          invoiceCount: { $sum: 1 },
          avgAmount: { $avg: '$invoiceData.totaleDocumento' },
          minAmount: { $min: '$invoiceData.totaleDocumento' },
          maxAmount: { $max: '$invoiceData.totaleDocumento' },
          
          // Raggruppa per fornitore nel periodo
          supplierBreakdown: {
            $push: {
              supplierId: '$supplierId',
              amount: '$invoiceData.totaleDocumento'
            }
          }
        }
      },
      
      // Calcola breakdown per fornitore
      {
        $addFields: {
          supplierStats: {
            $reduce: {
              input: '$supplierBreakdown',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [[
                      {
                        k: { $toString: '$$this.supplierId' },
                        v: {
                          $add: [
                            { $ifNull: [{ $getField: { field: { $toString: '$$this.supplierId' }, input: '$$value' } }, 0] },
                            '$$this.amount'
                          ]
                        }
                      }
                    ]]
                  }
                ]
              }
            }
          }
        }
      },
      
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          invoiceCount: 1,
          avgAmount: 1,
          minAmount: 1,
          maxAmount: 1,
          supplierStats: 1,
          
          // Crea una data rappresentativa per il periodo
          periodDate: {
            $dateFromParts: {
              year: '$_id.year',
              month: { $ifNull: ['$_id.month', 1] },
              day: { $ifNull: ['$_id.day', 1] }
            }
          }
        }
      },
      
      { $sort: { periodDate: 1 } }
    ];
    
    const Invoice = mongoose.model('Invoice');
    const result = await Invoice.aggregate(pipeline);
    
    return result;
  }
  
  /**
   * Ottimizzazione per ricerca duplicati prodotti
   */
  static async getOptimizedDuplicateGroups(tenantId) {
    const pipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          ignoredDuplicate: { $ne: true }
        }
      },
      
      {
        $group: {
          _id: '$descriptionStd',
          products: {
            $push: {
              _id: '$_id',
              codeInternal: '$codeInternal',
              description: '$description',
              category: '$category',
              unitOfMeasure: '$unitOfMeasure',
              approvalStatus: '$approvalStatus',
              priceCount: { $size: { $ifNull: ['$prices', []] } },
              createdAt: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      
      {
        $project: {
          _id: 0,
          descriptionStd: '$_id',
          products: 1,
          count: 1,
          
          // Calcola metriche per il gruppo
          categories: {
            $setUnion: ['$products.category', []]
          },
          
          totalPrices: {
            $sum: '$products.priceCount'
          },
          
          oldestProduct: {
            $min: '$products.createdAt'
          },
          
          newestProduct: {
            $max: '$products.createdAt'
          }
        }
      },
      
      { $sort: { count: -1, totalPrices: -1 } }
    ];
    
    const Product = mongoose.model('Product');
    const result = await Product.aggregate(pipeline);
    
    return result;
  }
  
  /**
   * Wrapper con cache per tutte le query ottimizzate
   */
  static async getCachedOptimizedProducts(tenantId, options = {}) {
    return CacheService.getProducts(tenantId, options, () => 
      this.getOptimizedProducts(tenantId, options)
    );
  }
  
  static async getCachedSupplierAnalytics(tenantId, dateRange = {}) {
    return CacheService.getAnalytics(tenantId, 'supplier', dateRange, () => 
      this.getOptimizedSupplierAnalytics(tenantId, dateRange)
    );
  }
  
  static async getCachedSpendingTrends(tenantId, groupBy = 'month', dateRange = {}) {
    return CacheService.getAnalytics(tenantId, 'spending', { groupBy, ...dateRange }, () => 
      this.getOptimizedSpendingTrends(tenantId, groupBy, dateRange)
    );
  }
  
  static async getCachedDuplicateGroups(tenantId) {
    return CacheService.getAnalytics(tenantId, 'duplicates', {}, () => 
      this.getOptimizedDuplicateGroups(tenantId)
    );
  }
}

export default QueryOptimizationService;