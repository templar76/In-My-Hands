import express from 'express';
import multer from 'multer';
import path from 'path';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { loadTenantConfig } from '../middleware/tenantConfig.js';
import { 
  uploadInvoice,
  uploadInvoices,
  uploadInvoicesWithTracking,
  getInvoices, 
  getInvoiceDetails, 
  getInvoicesStats,
  getProcessingStatus,
  getProcessingJobs,
  cancelProcessingJob,
  restartProcessingJob,
  deleteProcessingJob
} from '../controllers/invoiceController.js';
import { startProcessingJob } from '../controllers/invoiceController.js';
import { generalLimiter, authLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import {
  validateSingleUpload,
  validateMultipleUpload,
  validateInvoicesList,
  validateInvoiceDetails,
  validateProcessingJob,
  validateInvoiceStats,
  validateDateRange
} from '../middleware/invoiceValidation.js';
import { processingLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ✅ SPOSTATO - Configurazione multer PRIMA dell'utilizzo
const storageEngine = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/xml', 
    'text/xml',
    'application/pkcs7-mime', // P7M
    'application/zip'
  ];
  
  const allowedExtensions = ['.pdf', '.xml', '.p7m', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Formato non supportato. Supportati: XML, P7M, PDF, ZIP'), false);
  }
};

const upload = multer({
  storage: storageEngine,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // max 10MB
});

// ==================== UPLOAD ROUTES ====================

/**
 * POST /api/invoices/upload
 * Upload singola fattura
 */
router.post(
  '/upload',
  uploadLimiter,
  verifyFirebaseToken,
  upload.single('file'),
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false,
        error: 'Errore upload file',
        details: err.message 
      });
    } else if (err) {
      return res.status(415).json({ 
        success: false,
        error: 'Formato file non supportato',
        details: err.message 
      });
    }
    next();
  },
  validateSingleUpload,
  uploadInvoice
);

/**
 * POST /api/invoices/upload-multiple
 * Upload multiplo fatture (legacy)
 */
router.post(
  '/upload-multiple',
  uploadLimiter,
  verifyFirebaseToken,
  upload.array('files', 10),
  validateMultipleUpload,
  uploadInvoices
);

/**
 * POST /api/invoices/upload-tracked
 * Upload multiplo con tracking asincrono
 */
router.post(
  '/upload-tracked',
  uploadLimiter,
  verifyFirebaseToken,
  upload.array('files', 10),
  validateMultipleUpload,
  uploadInvoicesWithTracking
);

// ==================== QUERY ROUTES ====================

/**
 * GET /api/invoices
 * Recupera lista fatture con filtri e paginazione
 */
router.get('/', 
  generalLimiter,
  verifyFirebaseToken, 
  validateInvoicesList,
  validateDateRange,
  getInvoices
);

/**
 * GET /api/invoices/stats
 * Statistiche delle fatture
 */
router.get('/stats', 
  generalLimiter,
  verifyFirebaseToken, 
  validateInvoiceStats,
  validateDateRange,
  getInvoicesStats
);

// ==================== PROCESSING ROUTES ====================
// ✅ SPOSTATO PRIMA - Le route specifiche devono venire prima di quelle con parametri

/**
 * GET /api/invoices/processing
 * Lista di tutti i job di processing
 */
router.get(
  '/processing',
  generalLimiter,
  verifyFirebaseToken,
  getProcessingJobs
);

/**
 * POST /api/invoices/processing/:jobId/cancel
 * Cancella un job di processing
 */
router.post(
  '/processing/:jobId/cancel',
  generalLimiter,
  verifyFirebaseToken,
  validateProcessingJob,
  cancelProcessingJob
);

/**
 * POST /api/invoices/processing/:jobId/restart
 * Riavvia un job di processing
 */
router.post(
  '/processing/:jobId/restart',
  generalLimiter,
  verifyFirebaseToken,
  validateProcessingJob,
  restartProcessingJob
);

/**
 * DELETE /api/invoices/processing/:jobId
 * Elimina un job di processing
 */
router.delete(
  '/processing/:jobId',
  generalLimiter,
  verifyFirebaseToken,
  validateProcessingJob,
  deleteProcessingJob
);

/**
 * GET /api/invoices/processing/:jobId
 * Stato di un job di processing
 */
router.get(
  '/processing/:jobId',
  generalLimiter,
  verifyFirebaseToken,
  validateProcessingJob,
  getProcessingStatus
);

/**
 * GET /api/invoices/:id
 * Dettagli di una singola fattura
 */
router.get('/:id', 
  generalLimiter,
  verifyFirebaseToken, 
  validateInvoiceDetails,
  getInvoiceDetails
);

/**
 * POST /api/invoices/processing/:jobId/start
 * Avvia elaborazione di un job caricato
 */
router.post(
  '/processing/:jobId/start',
  generalLimiter,
  verifyFirebaseToken,
  validateProcessingJob,
  startProcessingJob
);

export default router;