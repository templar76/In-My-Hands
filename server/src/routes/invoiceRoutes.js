import express from 'express';
import multer from 'multer';
import path from 'path';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { loadTenantConfig } from '../middleware/tenantConfig.js'; // ← AGGIUNGERE
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
  verifyFirebaseToken,
  upload.single('file'),
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(415).json({ error: err.message });
    }
    next();
  },
  uploadInvoice
);

/**
 * POST /api/invoices/upload-multiple
 * Upload multiplo fatture (legacy)
 */
router.post(
  '/upload-multiple',
  verifyFirebaseToken,
  upload.array('files', 10),
  uploadInvoices
);

/**
 * POST /api/invoices/upload-tracked
 * Upload multiplo con tracking asincrono
 */
router.post(
  '/upload-tracked',
  verifyFirebaseToken,
  uploadLimiter,  // Aggiungi il rate limiter specifico per upload
  upload.array('files', 10),
  uploadInvoicesWithTracking
);

// ==================== QUERY ROUTES ====================

/**
 * GET /api/invoices
 * Recupera lista fatture con filtri e paginazione
 */
router.get('/', verifyFirebaseToken, getInvoices);

/**
 * GET /api/invoices/stats
 * Statistiche delle fatture
 */
router.get('/stats', verifyFirebaseToken, getInvoicesStats);

// ==================== PROCESSING ROUTES ====================
// ✅ SPOSTATO PRIMA - Le route specifiche devono venire prima di quelle con parametri

/**
 * GET /api/invoices/processing
 * Lista di tutti i job di processing
 */
router.get(
  '/processing',
  verifyFirebaseToken,
  getProcessingJobs
);

/**
 * POST /api/invoices/processing/:jobId/cancel
 * Cancella un job di processing
 */
router.post(
  '/processing/:jobId/cancel',
  verifyFirebaseToken,
  cancelProcessingJob
);

/**
 * POST /api/invoices/processing/:jobId/restart
 * Riavvia un job di processing
 */
router.post(
  '/processing/:jobId/restart',
  verifyFirebaseToken,
  restartProcessingJob
);

/**
 * DELETE /api/invoices/processing/:jobId
 * Elimina un job di processing
 */
router.delete(
  '/processing/:jobId',
  verifyFirebaseToken,
  deleteProcessingJob
);

/**
 * GET /api/invoices/processing/:jobId
 * Stato di un job di processing
 */
router.get(
  '/processing/:jobId',
  verifyFirebaseToken,
  getProcessingStatus
);

/**
 * GET /api/invoices/:id
 * Dettagli di una singola fattura
 */
router.get('/:id', verifyFirebaseToken, getInvoiceDetails);

/**
 * POST /api/invoices/processing/:jobId/start
 * Avvia elaborazione di un job caricato
 */
router.post(
  '/processing/:jobId/start',
  verifyFirebaseToken, // Aggiunto middleware di autenticazione
  startProcessingJob
);

export default router;