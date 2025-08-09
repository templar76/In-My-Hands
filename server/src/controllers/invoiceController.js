import logger from '../utils/logger.js';
//import Invoice from '../models/Invoice.js'; // ✅ AGGIUNTO - Import mancante
import ProductImportService from '../services/productImportService.js';
import SupplierService from '../services/supplierService.js';
import InvoiceParsingService from '../services/invoiceParsingService.js';
import InvoiceSaveService from '../services/invoiceSaveService.js';
import InvoiceQueryService from '../services/invoiceQueryService.js';
import InvoiceUploadService from '../services/invoiceUploadService.js';
import InvoiceProcessingService from '../services/invoiceProcessingService.js';
import InvoiceUploadOnlyService from '../services/invoiceUploadOnlyService.js';
import ProcessingJobService from '../services/processingJobService.js'; // ✅ AGGIUNTO - Import mancante

/**
 * Controller per la gestione delle fatture
 * Questo controller è stato refactorizzato per utilizzare servizi dedicati
 * e rispettare il limite di 800 righe per file
 */

// ==================== UPLOAD ENDPOINTS ====================

/**
 * Upload di una singola fattura XML
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const uploadInvoice = async (req, res) => {
  try {
    logger.info('Avvio upload singola fattura', {
      tenantId: req.user.tenantId,
      userId: req.user.uid,
      hasFile: !!req.file
    });

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nessun file caricato' 
      });
    }

    const result = await InvoiceUploadService.uploadSingleInvoice(
      req.file,
      req.user.tenantId
      // ❌ Rimuovere: req.user.uid
    );

    logger.info('Upload singola fattura completato', {
      tenantId: req.user.tenantId,
      success: result.success,
      invoiceId: result.invoiceId
    });

    res.json(result);
  } catch (error) {
    // Nel blocco catch della funzione uploadInvoice
    try {
      // Gestisci errori di validazione - SALVA NEL JOB
      if (error.code === 'VALIDATION_FAILED' && error.validationErrors) {
        // Trova il job e aggiorna il file con gli errori di validazione
        await ProcessingJobService.updateFileValidationErrors(
          jobId, // Devi passare il jobId dal contesto
          filename, // Nome del file che ha generato l'errore
          error.validationErrors
        );
        
        // Restituisci successo ma con stato di validazione fallita
        return res.json({
          success: true,
          message: 'File caricato ma con errori di validazione',
          jobId: jobId,
          validationFailed: true
        });
      }
    
    // Gestisci errori di fattura duplicata
    if (error.code === 'DUPLICATE_INVOICE') {
    return res.status(409).json({
    success: false,
    message: 'Fattura duplicata: già presente nel sistema',
    error: error.message,
    existingInvoiceId: error.existingInvoiceId,
    validationErrors: error.validationErrors
    });
    }
    
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'upload della fattura',
      error: error.message
    });
    } catch (error) {
    logger.error('Errore upload singola fattura', {
    error: error.message,
    stack: error.stack,
    tenantId: req.user?.tenantId,
    userId: req.user?.uid
    });
    
    // Gestisci errori di validazione
    if (error.code === 'VALIDATION_FAILED' && error.validationErrors) {
    // Trova il job e aggiorna il file con gli errori di validazione
    await ProcessingJobService.updateFileValidationErrors(
    jobId, // Devi passare il jobId dal contesto
    filename, // Nome del file che ha generato l'errore
    error.validationErrors
    );
    
    // Restituisci successo ma con stato di validazione fallita
    return res.json({
    success: true,
    message: 'File caricato ma con errori di validazione',
    jobId: jobId,
    validationFailed: true
    });
    }
    
    res.status(500).json({
    success: false,
    message: 'Errore durante l\'upload della fattura',
    error: error.message
    });
    }
  }
};

/**
 * Upload multiplo di fatture con tracking (NUOVO FLUSSO)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const uploadInvoicesWithTracking = async (req, res) => {
  try {
    logger.info('Avvio upload multiplo con tracking (nuovo flusso)', {
      tenantId: req.user.tenantId,
      userId: req.user.uid,
      filesCount: req.files?.length || 0
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nessun file caricato'
      });
    }

    // NUOVO: Solo upload, senza elaborazione automatica
    const result = await InvoiceUploadOnlyService.uploadFilesOnly(
      req.files,
      req.user.tenantId,
      req.user.uid
    );

    logger.info('Upload completato (nuovo flusso)', {
      tenantId: req.user.tenantId,
      jobId: result.jobId,
      filesCount: req.files.length
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore upload multiplo con tracking (nuovo flusso)', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante l\'upload',
      error: error.message
    });
  }
};

/**
 * Avvia l'elaborazione di un job già caricato
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const startProcessingJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;

    logger.info('Avvio elaborazione job', {
      jobId,
      tenantId,
      userId: req.user.uid
    });

    // ✅ AGGIUNTO: Log di debug
    logger.debug('Controller: Prima di getJobStatus', {
      jobId,
      tenantId,
      ProcessingJobServiceExists: !!ProcessingJobService
    });

    // Verifica che il job esista e sia in stato 'uploaded'
    const job = await ProcessingJobService.getJobStatus(jobId, tenantId);
    
    // ✅ AGGIUNTO: Log di debug
    logger.debug('Controller: Dopo getJobStatus', {
      jobId,
      jobExists: !!job,
      jobStatus: job?.status
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job non trovato'
      });
    }

    // Modifica la condizione esistente
    if (!['uploaded', 'pending', 'failed'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: `Impossibile avviare l'elaborazione. Stato attuale: ${job.status}`
      });
    }

    // ✅ AGGIUNTO: Log di debug
    logger.debug('Controller: Prima di startProcessingFromJob', {
      jobId,
      tenantId
    });

    // Avvia l'elaborazione
    const result = await InvoiceProcessingService.startProcessingFromJob(jobId, tenantId, req.user.uid);

    logger.info('Elaborazione job avviata', {
      jobId,
      tenantId,
      success: result.success
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore avvio elaborazione job', {
      error: error.message,
      stack: error.stack,
      jobId: req.params.jobId,
      tenantId: req.user?.tenantId
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante l\'avvio dell\'elaborazione',
      error: error.message
    });
  }
};

/**
 * Upload multiplo di fatture (legacy)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const uploadInvoices = async (req, res) => {
  try {
    logger.info('Avvio upload multiplo legacy', {
      tenantId: req.user.tenantId,
      userId: req.user.uid,
      filesCount: req.files?.length || 0
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nessun file caricato'
      });
    }

    const result = await InvoiceUploadService.uploadMultipleInvoices(
      req.files,
      req.user.tenantId,
      req.user.uid
    );

    logger.info('Upload multiplo legacy completato', {
      tenantId: req.user.tenantId,
      successCount: result.results?.filter(r => r.success).length || 0,
      totalCount: result.results?.length || 0
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore upload multiplo legacy', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante l\'upload delle fatture',
      error: error.message
    });
  }
};

// ==================== QUERY ENDPOINTS ====================

/**
 * Recupera lista fatture con filtri e paginazione
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getInvoices = async (req, res) => {
  try {
    logger.debug('Richiesta lista fatture', {
      tenantId: req.user.tenantId,
      query: req.query
    });

    const options = {
      ...req.query,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : null,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : null
    };

    const result = await InvoiceQueryService.getInvoices(
      req.user.tenantId,
      options
    );

    logger.debug('Lista fatture recuperata', {
      tenantId: req.user.tenantId,
      count: result.invoices?.length || 0,
      total: result.pagination?.total
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore recupero lista fatture', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero delle fatture',
      error: error.message
    });
  }
};

/**
 * Recupera dettagli di una singola fattura
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getInvoiceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.debug('Richiesta dettagli fattura', {
      tenantId: req.user.tenantId,
      invoiceId: id
    });

    const result = await InvoiceQueryService.getInvoiceDetails(
      id,
      req.user.tenantId
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    logger.debug('Dettagli fattura recuperati', {
      tenantId: req.user.tenantId,
      invoiceId: id,
      hasInvoice: !!result.invoice
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore recupero dettagli fattura', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      invoiceId: req.params?.id
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dei dettagli della fattura',
      error: error.message
    });
  }
};

/**
 * Recupera statistiche delle fatture
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getInvoicesStats = async (req, res) => {
  try {
    logger.debug('Richiesta statistiche fatture', {
      tenantId: req.user.tenantId
    });

    const result = await InvoiceQueryService.getInvoicesStats(
      req.user.tenantId
    );

    logger.debug('Statistiche fatture recuperate', {
      tenantId: req.user.tenantId,
      totalInvoices: result.general?.totalInvoices
    });

    // ✅ CORREZIONE: Restituisci le statistiche generali direttamente
    res.json({ stats: result.general });
  } catch (error) {
    logger.error('Errore recupero statistiche fatture', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero delle statistiche',
      error: error.message
    });
  }
};

// ==================== PROCESSING ENDPOINTS ====================

/**
 * Recupera stato di un job di processing
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getProcessingStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user.tenantId;
    const cacheKey = `${tenantId}:${jobId}`;
    
    // Controlla se abbiamo una risposta in cache recente
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse && (Date.now() - cachedResponse.timestamp < CACHE_TTL)) {
      return res.json(cachedResponse.data);
    }
    
    logger.debug('Richiesta stato processing', {
      tenantId,
      jobId
    });

    const result = await InvoiceProcessingService.getProcessingStatus(
      jobId,
      tenantId
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Salva la risposta in cache
    responseCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore recupero stato processing', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      jobId: req.params?.jobId
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dello stato del processing',
      error: error.message
    });
  }
};

/**
 * Recupera tutti i job di processing per il tenant
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getProcessingJobs = async (req, res) => {
  try {
    logger.debug('Richiesta lista job processing', {
      tenantId: req.user.tenantId,
      query: req.query
    });

    const result = await InvoiceProcessingService.getProcessingJobs(
      req.user.tenantId,
      req.query
    );

    logger.debug('Lista job processing recuperata', {
      tenantId: req.user.tenantId,
      count: result.jobs?.length || 0
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore recupero lista job processing', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dei job di processing',
      error: error.message
    });
  }
};

// ==================== SUPPLIER ENDPOINTS ====================

/**
 * Recupera lista fornitori
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getSuppliers = async (req, res) => {
  try {
    logger.debug('Richiesta lista fornitori', {
      tenantId: req.user.tenantId,
      query: req.query
    });

    const result = await SupplierService.getSuppliers(
      req.user.tenantId,
      req.query
    );

    logger.debug('Lista fornitori recuperata', {
      tenantId: req.user.tenantId,
      count: result.suppliers?.length || 0,
      total: result.total
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore recupero lista fornitori', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dei fornitori',
      error: error.message
    });
  }
};

/**
 * Recupera dettagli di un singolo fornitore
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getSupplierDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.debug('Richiesta dettagli fornitore', {
      tenantId: req.user.tenantId,
      supplierId: id
    });

    const result = await SupplierService.getSupplierById(
      id,
      req.user.tenantId
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    logger.debug('Dettagli fornitore recuperati', {
      tenantId: req.user.tenantId,
      supplierId: id,
      hasSupplier: !!result.supplier
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore recupero dettagli fornitore', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      supplierId: req.params?.id
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dei dettagli del fornitore',
      error: error.message
    });
  }
};

// ==================== UTILITY ENDPOINTS ====================

/**
 * Recupera tipi di file supportati
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getSupportedFileTypes = async (req, res) => {
  try {
    const result = InvoiceUploadService.getSupportedFileTypes();
    res.json(result);
  } catch (error) {
    logger.error('Errore recupero tipi file supportati', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dei tipi di file supportati',
      error: error.message
    });
  }
};

// ==================== LEGACY FUNCTIONS ====================
// Queste funzioni sono mantenute per compatibilità ma utilizzano i nuovi servizi

/**
 * Importa prodotti da una fattura (legacy)
 * @param {Object} invoiceData - Dati della fattura
 * @param {string} supplierId - ID del fornitore
 * @param {string} tenantId - ID del tenant
 * @param {string} invoiceId - ID della fattura
 * @param {Object} tenantConfig - Configurazione del tenant
 * @returns {Promise<Array>} Risultati dell'importazione
 */
export const importProductsFromInvoice = async (invoiceData, supplierId, tenantId, invoiceId, tenantConfig = null) => {
  try {
    logger.info('Chiamata legacy importProductsFromInvoice', {
      supplierId,
      tenantId,
      invoiceId,
      linesCount: invoiceData.lines?.length || 0
    });

    return await ProductImportService.importProductsFromInvoice(
      invoiceData,
      supplierId,
      tenantId,
      invoiceId,
      tenantConfig
    );
  } catch (error) {
    logger.error('Errore importazione prodotti legacy', {
      error: error.message,
      stack: error.stack,
      supplierId,
      tenantId,
      invoiceId
    });
    throw error;
  }
};

// Export default per compatibilità
export default {
  uploadInvoice,
  uploadInvoices,
  uploadInvoicesWithTracking,
  startProcessingJob, // ✅ AGGIUNTO - Export mancante
  getInvoices,
  getInvoiceDetails,
  getInvoicesStats,
  getProcessingStatus,
  getProcessingJobs,
  getSuppliers,
  getSupplierDetails,
  getSupportedFileTypes,
  importProductsFromInvoice
};

// Aggiungi questi endpoint dopo getProcessingJobs

/**
 * Cancella un job di elaborazione
 */
export const cancelProcessingJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tenantId } = req.user;
    
    logger.debug('Richiesta cancellazione job', { jobId, tenantId });
    
    await InvoiceProcessingService.cancelProcessingJob(jobId, tenantId);
    
    logger.info('Job cancellato con successo', { jobId, tenantId });
    
    res.json({
      success: true,
      message: 'Job cancellato con successo'
    });
  } catch (error) {
    logger.error('Errore cancellazione job', {
      error: error.message,
      jobId: req.params?.jobId,
      tenantId: req.user?.tenantId
    });
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Riavvia un job di elaborazione
 */
export const restartProcessingJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tenantId } = req.user;
    
    logger.debug('Richiesta riavvio job', { jobId, tenantId });
    
    await InvoiceProcessingService.restartProcessingJob(jobId, tenantId);
    
    logger.info('Job riavviato con successo', { jobId, tenantId });
    
    res.json({
      success: true,
      message: 'Job riavviato con successo'
    });
  } catch (error) {
    logger.error('Errore riavvio job', {
      error: error.message,
      jobId: req.params?.jobId,
      tenantId: req.user?.tenantId
    });
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Elimina un job di elaborazione
 */
export const deleteProcessingJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tenantId } = req.user;
    
    logger.debug('Richiesta eliminazione job', { jobId, tenantId });
    
    await InvoiceProcessingService.deleteProcessingJob(jobId, tenantId);
    
    logger.info('Job eliminato con successo', { jobId, tenantId });
    
    res.json({
      success: true,
      message: 'Job eliminato con successo'
    });
  } catch (error) {
    logger.error('Errore eliminazione job', {
      error: error.message,
      jobId: req.params?.jobId,
      tenantId: req.user?.tenantId
    });
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
