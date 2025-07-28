import Invoice from '../models/Invoice.js';
import Supplier from '../models/Supplier.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * Ottieni lista fatture con filtri e paginazione
 * @param {string} tenantId - ID del tenant
 * @param {Object} options - Opzioni di filtro e paginazione
 * @returns {Promise<Object>} - Lista fatture con metadati
 */
export const getInvoices = async (tenantId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'invoiceDate',
      sortOrder = 'desc',
      search = '',
      supplierId = null,
      dateFrom = null,
      dateTo = null,
      minAmount = null,
      maxAmount = null,
      status = null
    } = options;

    const query = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    // Filtro per fornitore
    if (supplierId) {
      query.supplierId = supplierId;
    }

    // Filtro per data
    if (dateFrom || dateTo) {
      query.invoiceDate = {};
      if (dateFrom) query.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo) query.invoiceDate.$lte = new Date(dateTo);
    }

    // Filtro per importo
    if (minAmount !== null || maxAmount !== null) {
      query.totalAmount = {};
      if (minAmount !== null) query.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount !== null) query.totalAmount.$lte = parseFloat(maxAmount);
    }

    // Filtro per ricerca testuale
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Filtro per status (se implementato)
    if (status) {
      query.status = status;
    }

    // Calcola skip per paginazione
    const skip = (page - 1) * limit;

    // Costruisci sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Esegui query con aggregation per includere dati fornitore
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplierDetails'
        }
      },
      {
        $addFields: {
          supplierDetails: { $arrayElemAt: ['$supplierDetails', 0] }
        }
      },
      { $sort: sort },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                invoiceNumber: 1,
                invoiceDate: 1,
                totalAmount: 1,
                totalVAT: 1,
                currency: 1,
                // Riga 103
                supplier: {
                  _id: '$supplierDetails._id',
                  name: '$supplierDetails.name',
                  vatNumber: '$supplierDetails.vatNumber'  // ✅ Cambiato da pIva
                },
                customer: 1,
                lineItems: { $size: '$lineItems' },
                'metadata.importedAt': 1
              }
            }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const [result] = await Invoice.aggregate(pipeline);
    const invoices = result.data || [];
    const total = result.totalCount[0]?.count || 0;

    logger.debug('Query fatture completata', {
      tenantId,
      page,
      limit,
      total,
      returned: invoices.length,
      filters: { search, supplierId, dateFrom, dateTo, minAmount, maxAmount }
    });

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        search,
        supplierId,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
        status
      }
    };
  } catch (error) {
    logger.error('Errore recupero fatture', {
      error: error.message,
      stack: error.stack,
      tenantId,
      options
    });
    throw error;
  }
};

/**
 * Ottieni dettagli di una singola fattura
 * @param {string} invoiceId - ID della fattura
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Dettagli fattura
 */
export const getInvoiceDetails = async (invoiceId, tenantId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return {
        success: false,
        message: 'ID fattura non valido',
        invoice: null
      };
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).populate('supplierId', 'name vatNumber codiceFiscale address contatti phone email');

    if (!invoice) {
      return {
        success: false,
        message: `Fattura con ID ${invoiceId} non trovata`,
        invoice: null
      };
    }

    logger.debug('Dettagli fattura recuperati', {
      invoiceId,
      numeroFattura: invoice.invoiceNumber,
      dataFattura: invoice.invoiceDate,
      tenantId
    });

    return {
      success: true,
      invoice: invoice
    };
  } catch (error) {
    logger.error('Errore recupero dettagli fattura', {
      error: error.message,
      invoiceId,
      tenantId
    });
    
    return {
      success: false,
      message: 'Errore durante il recupero dei dettagli della fattura',
      error: error.message,
      invoice: null
    };
  }
};

/**
 * Ottieni statistiche delle fatture
 * @param {string} tenantId - ID del tenant
 * @param {Object} options - Opzioni per le statistiche
 * @returns {Promise<Object>} - Statistiche
 */
export const getInvoicesStats = async (tenantId, options = {}) => {
  try {
    const {
      year = new Date().getFullYear(),
      supplierId = null
    } = options;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      invoiceDate: {
        $gte: startDate,
        $lt: endDate
      }
    };

    if (supplierId) {
      matchStage.supplierId = new mongoose.Types.ObjectId(supplierId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalVAT: { $sum: '$totalVAT' },
          avgAmount: { $avg: '$totalAmount' },
          minAmount: { $min: '$totalAmount' },
          maxAmount: { $max: '$totalAmount' },
          uniqueSuppliers: { $addToSet: '$supplierId' }
        }
      },
      {
        $addFields: {
          uniqueSuppliersCount: { $size: '$uniqueSuppliers' }
        }
      },
      {
        $project: {
          uniqueSuppliers: 0
        }
      }
    ];

    const monthlyPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalVAT: { $sum: '$totalVAT' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      }
    ];

    const [generalStats, monthlyStats] = await Promise.all([
      Invoice.aggregate(pipeline),
      Invoice.aggregate(monthlyPipeline)
    ]);

    const stats = generalStats[0] || {
      totalInvoices: 0,
      totalAmount: 0,
      totalVAT: 0,
      avgAmount: 0,
      minAmount: 0,
      maxAmount: 0,
      uniqueSuppliersCount: 0
    };

    // Formatta statistiche mensili
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthData = monthlyStats.find(m => m._id.month === i + 1);
      return {
        month: i + 1,
        count: monthData?.count || 0,
        totalAmount: monthData?.totalAmount || 0,
        totalVAT: monthData?.totalVAT || 0
      };
    });

    logger.debug('Statistiche fatture calcolate', {
      tenantId,
      year,
      supplierId,
      totalInvoices: stats.totalInvoices,
      totalAmount: stats.totalAmount
    });

    return {
      general: stats,
      monthly: monthlyData,
      period: {
        year,
        startDate,
        endDate
      }
    };
  } catch (error) {
    logger.error('Errore calcolo statistiche fatture', {
      error: error.message,
      stack: error.stack,
      tenantId,
      options
    });
    throw error;
  }
};

/**
 * Cerca fatture per numero o fornitore
 * @param {string} tenantId - ID del tenant
 * @param {string} searchTerm - Termine di ricerca
 * @param {Object} options - Opzioni di ricerca
 * @returns {Promise<Array>} - Risultati ricerca
 */
export const searchInvoices = async (tenantId, searchTerm, options = {}) => {
  try {
    const { limit = 10 } = options;

    const query = {
      tenantId: new mongoose.Types.ObjectId(tenantId), // ✅ FIX: Convert to ObjectId
      $or: [
        { invoiceNumber: { $regex: searchTerm, $options: 'i' } },
        { 'supplier.name': { $regex: searchTerm, $options: 'i' } },
        { 'customer.name': { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const invoices = await Invoice.find(query)
      .select('invoiceNumber invoiceDate totalAmount supplier.name customer.name')
      .sort({ invoiceDate: -1 })
      .limit(limit)
      .lean();

    logger.debug('Ricerca fatture completata', {
      tenantId,
      searchTerm,
      resultsCount: invoices.length
    });

    return invoices;
  } catch (error) {
    logger.error('Errore ricerca fatture', {
      error: error.message,
      tenantId,
      searchTerm,
      options
    });
    throw error;
  }
};

export default {
  getInvoices,
  getInvoiceDetails,
  getInvoicesStats,
  searchInvoices
};