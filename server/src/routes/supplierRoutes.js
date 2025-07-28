import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import {
  getAllSuppliers,
  getSuppliersAnalytics,
  getSpendingAnalysis,
  searchSuppliers,
  getSupplierDetails,
  getContractualPowerAnalysis,
  updateSupplier // ← Nuovo import
} from '../controllers/supplierController.js';

const router = express.Router();

// Applica middleware di autenticazione a tutte le routes
router.use(verifyFirebaseToken);

/**
 * GET /api/suppliers
 * Restituisce tutti i fornitori per il dropdown dei filtri
 */
router.get('/', getAllSuppliers); // ← Aggiungi questa route

/**
 * GET /api/suppliers/analytics
 * Statistiche aggregate sui fornitori per la dashboard
 * Query params: startDate, endDate
 */
router.get('/analytics', getSuppliersAnalytics);

/**
 * GET /api/suppliers/spending-analysis
 * Analisi dettagliata della spesa con trend temporali
 * Query params: startDate, endDate, supplierId, groupBy (day|week|month|year)
 */
router.get('/spending-analysis', getSpendingAnalysis);

/**
 * GET /api/suppliers/search
 * Ricerca fornitori con filtri e paginazione
 * Query params: q, page, limit, sortBy, sortOrder, minSpent, maxSpent, startDate, endDate
 */
router.get('/search', searchSuppliers);

/**
 * GET /api/suppliers/contractual-power
 * Analisi specifica del potere contrattuale
 * Query params: startDate, endDate
 */
router.get('/contractual-power', getContractualPowerAnalysis);

/**
 * GET /api/suppliers/:id/details
 * Dettagli specifici di un fornitore
 * Params: id (supplierId)
 * Query params: startDate, endDate
 */
router.get('/:id/details', getSupplierDetails);

/**
 * PUT /api/suppliers/:id
 * Aggiorna i dati di un fornitore
 * Params: id (supplierId)
 * // Riga 64
 * Body: dati da aggiornare (esclusi vatNumber e codiceFiscale)  // ✅ Cambiato da pIva
 */
router.put('/:id', updateSupplier);

export default router;