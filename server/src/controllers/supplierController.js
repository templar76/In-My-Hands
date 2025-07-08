import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import Invoice from '../models/Invoice.js';

/**
 * GET /api/suppliers/analytics
 * Restituisce statistiche aggregate sui fornitori per la dashboard
 */
export const getSuppliersAnalytics = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Costruisci filtro date
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };
    if (Object.keys(dateFilter).length > 0) {
      matchStage.invoiceDate = dateFilter;
    }

    // Aggregazione principale per statistiche fornitori
    const suppliersStats = await Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$supplierId',
          totalSpent: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
          lastInvoiceDate: { $max: '$invoiceDate' },
          firstInvoiceDate: { $min: '$invoiceDate' },
          avgInvoiceAmount: { $avg: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: '$supplier' },
      {
        $project: {
          supplierId: '$_id',
          supplierName: '$supplier.name',
          supplierPIva: '$supplier.pIva',
          totalSpent: 1,
          invoiceCount: 1,
          lastInvoiceDate: 1,
          firstInvoiceDate: 1,
          avgInvoiceAmount: 1
        }
      },
      { $sort: { totalSpent: -1 } }
    ]);

    // Calcola totale generale per percentuali
    const totalSpent = suppliersStats.reduce((sum, supplier) => sum + supplier.totalSpent, 0);
    
    // Aggiungi percentuali
    const suppliersWithPercentage = suppliersStats.map(supplier => ({
      ...supplier,
      percentageOfTotal: totalSpent > 0 ? (supplier.totalSpent / totalSpent * 100) : 0
    }));

    // Calcola metriche di concentrazione
    const top3Percentage = suppliersWithPercentage
      .slice(0, 3)
      .reduce((sum, supplier) => sum + supplier.percentageOfTotal, 0);
    
    const top5Percentage = suppliersWithPercentage
      .slice(0, 5)
      .reduce((sum, supplier) => sum + supplier.percentageOfTotal, 0);
    
    const top10Percentage = suppliersWithPercentage
      .slice(0, 10)
      .reduce((sum, supplier) => sum + supplier.percentageOfTotal, 0);

    // Calcola indice di concentrazione Herfindahl
    const herfindahlIndex = suppliersWithPercentage
      .reduce((sum, supplier) => sum + Math.pow(supplier.percentageOfTotal, 2), 0);

    // Statistiche generali
    const analytics = {
      totalSuppliers: suppliersStats.length,
      totalSpent,
      totalInvoices: suppliersStats.reduce((sum, supplier) => sum + supplier.invoiceCount, 0),
      avgSpentPerSupplier: suppliersStats.length > 0 ? totalSpent / suppliersStats.length : 0,
      concentrationMetrics: {
        top3Percentage: Math.round(top3Percentage * 100) / 100,
        top5Percentage: Math.round(top5Percentage * 100) / 100,
        top10Percentage: Math.round(top10Percentage * 100) / 100,
        herfindahlIndex: Math.round(herfindahlIndex * 100) / 100
      },
      topSuppliers: suppliersWithPercentage.slice(0, 10),
      contractualPowerInsights: {
        highDependency: suppliersWithPercentage.filter(s => s.percentageOfTotal > 20),
        mediumDependency: suppliersWithPercentage.filter(s => s.percentageOfTotal > 10 && s.percentageOfTotal <= 20),
        diversificationLevel: herfindahlIndex < 1500 ? 'Alta' : herfindahlIndex < 2500 ? 'Media' : 'Bassa'
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error in getSuppliersAnalytics:', error);
    res.status(500).json({ error: 'Errore nel recupero delle statistiche fornitori' });
  }
};

/**
 * GET /api/suppliers/spending-analysis
 * Analisi dettagliata della spesa per fornitore con trend temporali
 */
export const getSpendingAnalysis = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate, supplierId, groupBy = 'month' } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };

    // Filtro date
    if (startDate || endDate) {
      matchStage.invoiceDate = {};
      if (startDate) matchStage.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchStage.invoiceDate.$lte = new Date(endDate);
    }

    // Filtro fornitore specifico
    if (supplierId) {
      matchStage.supplierId = new mongoose.Types.ObjectId(supplierId);
    }

    // Definisci raggruppamento temporale
    let dateGrouping;
    switch (groupBy) {
      case 'day':
        dateGrouping = {
          year: { $year: '$invoiceDate' },
          month: { $month: '$invoiceDate' },
          day: { $dayOfMonth: '$invoiceDate' }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$invoiceDate' },
          week: { $week: '$invoiceDate' }
        };
        break;
      case 'year':
        dateGrouping = {
          year: { $year: '$invoiceDate' }
        };
        break;
      default: // month
        dateGrouping = {
          year: { $year: '$invoiceDate' },
          month: { $month: '$invoiceDate' }
        };
    }

    const spendingTrends = await Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            supplierId: '$supplierId',
            period: dateGrouping
          },
          totalSpent: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id.supplierId',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: '$supplier' },
      {
        $project: {
          supplierId: '$_id.supplierId',
          supplierName: '$supplier.name',
          period: '$_id.period',
          totalSpent: 1,
          invoiceCount: 1,
          avgAmount: 1
        }
      },
      { $sort: { 'period.year': 1, 'period.month': 1, 'period.day': 1, 'period.week': 1 } }
    ]);
    // Aggregazione per timeline (dati aggregati per il grafico)
    const timeline = await Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: dateGrouping,
          totalSpent: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);

    res.json({
      trends: spendingTrends, // dati per fornitore
      timeline: timeline      // dati aggregati per il grafico
    });
  } catch (error) {
    console.error('Error in getSpendingAnalysis:', error);
    res.status(500).json({ error: 'Errore nell\'analisi della spesa' });
  }
};

/**
 * GET /api/suppliers/search
 * Ricerca fornitori con filtri
 */
export const searchSuppliers = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { 
      q, // query di ricerca
      page = 1, 
      limit = 20, 
      sortBy = 'totalSpent', 
      sortOrder = 'desc',
      minSpent,
      maxSpent,
      startDate,
      endDate
    } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Costruisci pipeline di aggregazione
    const pipeline = [];

    // Match iniziale per tenantId nelle fatture
    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };

    // Filtro date
    if (startDate || endDate) {
      matchStage.invoiceDate = {};
      if (startDate) matchStage.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchStage.invoiceDate.$lte = new Date(endDate);
    }

    pipeline.push({ $match: matchStage });

    // Raggruppa per fornitore
    pipeline.push({
      $group: {
        _id: '$supplierId',
        totalSpent: { $sum: '$totalAmount' },
        invoiceCount: { $sum: 1 },
        lastInvoiceDate: { $max: '$invoiceDate' },
        avgInvoiceAmount: { $avg: '$totalAmount' }
      }
    });

    // Lookup supplier details
    pipeline.push({
      $lookup: {
        from: 'suppliers',
        let: { supplierId: '$_id', tenantId: new mongoose.Types.ObjectId(tenantId) },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$supplierId'] },
                  { $eq: ['$tenantId', '$$tenantId'] }
                ]
              }
            }
          }
        ],
        as: 'supplier'
      }
    });

    pipeline.push({ $unwind: '$supplier' });

    // Filtro per nome fornitore (ricerca testuale)
    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { 'supplier.name': { $regex: q, $options: 'i' } },
            { 'supplier.pIva': { $regex: q, $options: 'i' } },
            { 'supplier.codiceFiscale': { $regex: q, $options: 'i' } }
          ]
        }
      });
    }

    // Filtro per range di spesa
    if (minSpent || maxSpent) {
      const spentFilter = {};
      if (minSpent) spentFilter.$gte = parseFloat(minSpent);
      if (maxSpent) spentFilter.$lte = parseFloat(maxSpent);
      pipeline.push({ $match: { totalSpent: spentFilter } });
    }

    // Proiezione finale
    pipeline.push({
      $project: {
        supplierId: '$_id',
        supplierName: '$supplier.name',
        supplierPIva: '$supplier.pIva',
        supplierCodiceFiscale: '$supplier.codiceFiscale',
        supplierEmail: '$supplier.email',
        supplierPhone: '$supplier.phone',
        totalSpent: 1,
        invoiceCount: 1,
        lastInvoiceDate: 1,
        avgInvoiceAmount: 1,
        isActive: '$supplier.isActive'
      }
    });

    // Ordinamento
    const sortStage = {};
    sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortStage });

    // Paginazione
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const suppliers = await Invoice.aggregate(pipeline);

    // Count totale per paginazione
    const countPipeline = pipeline.slice(0, -2); // Rimuovi skip e limit
    countPipeline.push({ $count: 'total' });
    const countResult = await Invoice.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    res.json({
      suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in searchSuppliers:', error);
    res.status(500).json({ error: 'Errore nella ricerca fornitori' });
  }
};

/**
 * GET /api/suppliers/:id/details
 * Dettagli specifici di un fornitore
 */
export const getSupplierDetails = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: supplierId } = req.params;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Verifica che il fornitore esista E appartenga al tenant
    const supplier = await Supplier.findOne({
      _id: new mongoose.Types.ObjectId(supplierId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Fornitore non trovato' });
    }

    // Costruisci filtro per le fatture
    const invoiceFilter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      supplierId: new mongoose.Types.ObjectId(supplierId)
    };

    if (startDate || endDate) {
      invoiceFilter.invoiceDate = {};
      if (startDate) invoiceFilter.invoiceDate.$gte = new Date(startDate);
      if (endDate) invoiceFilter.invoiceDate.$lte = new Date(endDate);
    }

    // Statistiche del fornitore
    const stats = await Invoice.aggregate([
      { $match: invoiceFilter },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$totalAmount' },
          totalVAT: { $sum: '$totalVAT' },
          invoiceCount: { $sum: 1 },
          avgInvoiceAmount: { $avg: '$totalAmount' },
          minInvoiceAmount: { $min: '$totalAmount' },
          maxInvoiceAmount: { $max: '$totalAmount' },
          firstInvoiceDate: { $min: '$invoiceDate' },
          lastInvoiceDate: { $max: '$invoiceDate' }
        }
      }
    ]);

    // Trend mensile
    const monthlyTrend = await Invoice.aggregate([
      { $match: invoiceFilter },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          totalSpent: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Ultime fatture
    const recentInvoices = await Invoice.find(invoiceFilter)
      .select('invoiceNumber invoiceDate totalAmount totalVAT currency')
      .sort({ invoiceDate: -1 })
      .limit(10);

    // Top prodotti da questo fornitore
    const topProducts = await Invoice.aggregate([
      { $match: invoiceFilter },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: {
            productId: '$lineItems.matchedProductId', // Usa l'ObjectId del prodotto
            description: '$lineItems.description' // Mantieni anche la descrizione per il display
          },
          totalQuantity: { $sum: '$lineItems.quantity' },
          totalSpent: { $sum: '$lineItems.total' },
          avgPrice: { $avg: '$lineItems.unitPrice' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    const supplierDetails = {
      supplier: {
        _id: supplier._id,
        name: supplier.name,
        pIva: supplier.pIva,
        codiceFiscale: supplier.codiceFiscale,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        pec: supplier.pec,
        website: supplier.website,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt
      },
      statistics: stats[0] || {
        totalSpent: 0,
        totalVAT: 0,
        invoiceCount: 0,
        avgInvoiceAmount: 0,
        minInvoiceAmount: 0,
        maxInvoiceAmount: 0,
        firstInvoiceDate: null,
        lastInvoiceDate: null
      },
      monthlyTrend,
      recentInvoices,
      topProducts
    };

    res.json(supplierDetails);
  } catch (error) {
    console.error('Error in getSupplierDetails:', error);
    res.status(500).json({ error: 'Errore nel recupero dei dettagli fornitore' });
  }
};

/**
 * GET /api/suppliers/contractual-power
 * Analisi specifica del potere contrattuale
 */
export const getContractualPowerAnalysis = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Usa la stessa logica di getSuppliersAnalytics ma focalizzata sul potere contrattuale
    const analytics = await getSuppliersAnalytics(req, res);
    
    // Se la risposta è già stata inviata, non fare nulla
    if (res.headersSent) return;

    // Altrimenti, estrai solo le metriche di potere contrattuale
    // Questa funzione potrebbe essere chiamata internamente
    
  } catch (error) {
    console.error('Error in getContractualPowerAnalysis:', error);
    res.status(500).json({ error: 'Errore nell\'analisi del potere contrattuale' });
  }
};

/**
 * GET /api/suppliers
 * Restituisce tutti i fornitori per il tenant corrente
 */
export const getAllSuppliers = async (req, res) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Trova tutti i fornitori unici dalle fatture del tenant
    const suppliers = await Invoice.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId)
        }
      },
      {
        $group: {
          _id: '$supplierId',
          supplierName: { $first: '$supplier.name' }, // Corretto: usa supplier.name
          lastInvoiceDate: { $max: '$invoiceDate' }
        }
      },
      {
        $project: {
          _id: 1,
          supplierName: 1,
          name: '$supplierName', // Alias per compatibilità
          lastInvoiceDate: 1
        }
      },
      {
        $sort: { supplierName: 1 }
      }
    ]);

    res.json(suppliers);
  } catch (error) {
    console.error('Errore nel recupero fornitori:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * PUT /api/suppliers/:id
 * Aggiorna i dati di un fornitore
 */
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.user;
    const updateData = req.body;

    console.log('UpdateSupplier - ID ricevuto:', id);
    console.log('UpdateSupplier - TenantId:', tenantId);
    console.log('UpdateSupplier - Dati da aggiornare:', updateData);

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Validazione ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('UpdateSupplier - ID non valido:', id);
      return res.status(400).json({ error: 'ID fornitore non valido' });
    }

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      console.log('UpdateSupplier - TenantId non valido:', tenantId);
      return res.status(400).json({ error: 'TenantId non valido' });
    }

    // Validazione: rimuovi campi non editabili per sicurezza
    const nonEditableFields = ['pIva', 'codiceFiscale', '_id', 'tenantId', 'createdAt', 'updatedAt'];
    nonEditableFields.forEach(field => delete updateData[field]);

    // Validazione email se presente
    if (updateData.email && updateData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({ error: 'Formato email non valido' });
      }
    }

    // Validazione telefono se presente (formato italiano)
    if (updateData.phone && updateData.phone.trim()) {
      const phoneRegex = /^[+]?[0-9\s\-\(\)]{8,15}$/;
      if (!phoneRegex.test(updateData.phone.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Formato telefono non valido' });
      }
    }

    // Validazione URL sito web se presente
    if (updateData.website && updateData.website.trim()) {
      try {
        new URL(updateData.website.startsWith('http') ? updateData.website : `https://${updateData.website}`);
      } catch {
        return res.status(400).json({ error: 'Formato URL sito web non valido' });
      }
    }

    // Prima verifica se il fornitore esiste
    const existingSupplier = await Supplier.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    console.log('UpdateSupplier - Fornitore esistente trovato:', !!existingSupplier);
    
    if (!existingSupplier) {
      console.log('UpdateSupplier - Fornitore non trovato con ID:', id, 'e TenantId:', tenantId);
      return res.status(404).json({ error: 'Fornitore non trovato' });
    }

    // Aggiorna il fornitore
    const supplier = await Supplier.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log('UpdateSupplier - Fornitore aggiornato:', !!supplier);

    res.json({
      success: true,
      message: 'Fornitore aggiornato con successo',
      supplier
    });

  } catch (error) {
    console.error('Errore nell\'aggiornamento fornitore:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Dati non validi: ' + error.message });
    }
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

