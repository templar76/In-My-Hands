import express from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { 
  uploadInvoice, 
  getInvoices, 
  getInvoiceDetails, 
  getInvoicesStats 
} from '../controllers/invoiceController.js';

const router = express.Router();
// salviamo in memoria per poi spostare su Firebase Storage
const storageEngine = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'application/xml', 'text/xml'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo file PDF e XML sono consentiti'), false);
  }
};
const upload = multer({
  storage: storageEngine,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // max 10MB
});

/**
 * POST /api/invoices
 * body form-data: file=<XML o PDF>
 * header: Authorization: Bearer <token>
 */
router.post(
  '/upload',
  verifyFirebaseToken,
  upload.single('file'),
  (err, req, res, next) => {
    // catch multer errors and unsupported format errors
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
 * GET /api/invoices
 * Recupera lista fatture con filtri e paginazione
 */
router.get('/', verifyFirebaseToken, getInvoices);

/**
 * GET /api/invoices/stats
 * Statistiche delle fatture
 */
router.get('/stats', verifyFirebaseToken, getInvoicesStats);

/**
 * GET /api/invoices/:id
 * Dettagli di una singola fattura
 */
router.get('/:id', verifyFirebaseToken, getInvoiceDetails);

// Rimuovi questa duplicazione (righe 68-87)
/**
 * POST /api/invoices/upload
 * Upload e parsing fattura
 */
router.post(
  '/upload',
  verifyFirebaseToken,
  upload.single('file'),
  (err, req, res, next) => {
    // catch multer errors and unsupported format errors
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(415).json({ error: err.message });
    }
    next();
  },
  uploadInvoice
);

export default router;