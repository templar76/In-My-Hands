import { body, param, query, validationResult } from 'express-validator';
import validator from 'validator';
import logger from '../utils/logger.js';
import path from 'path';
import { ValidationError } from '../errors/CustomErrors.js';

// Middleware per gestire errori di validazione specifici per fatture
export const handleInvoiceValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Invoice validation errors', {
      errors: errors.array(),
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      tenantId: req.user?.tenantId
    });
    return next(ValidationError.fromExpressValidator(errors.array()));
  }
  next();
};

// Sanitizzazione avanzata per prevenire injection
const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  
  return validator.escape(value)
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\$\{.*?\}/g, '')
    .replace(/\$\(.*?\)/g, '')
    .trim();
};

// Validazione personalizzata per ObjectId MongoDB
const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

// Validazione personalizzata per file upload
const validateFileUpload = (req, res, next) => {
  // Controlla se è presente almeno un file
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      error: 'Nessun file caricato'
    });
  }

  const files = req.files || [req.file];
  const allowedMimeTypes = [
    'application/pdf',
    'application/xml', 
    'text/xml',
    'application/pkcs7-mime', // P7M
    'application/zip'
  ];
  
  const allowedExtensions = ['.pdf', '.xml', '.p7m', '.zip'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const maxFiles = 10;

  // Verifica numero massimo di file
  if (files.length > maxFiles) {
    return res.status(400).json({
      success: false,
      error: `Massimo ${maxFiles} file consentiti`
    });
  }

  // Valida ogni file
  for (const file of files) {
    // Verifica dimensione
    if (file.size > maxFileSize) {
      return res.status(400).json({
        success: false,
        error: `File ${file.originalname} troppo grande. Massimo 10MB consentiti`
      });
    }

    // Verifica estensione
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({
        success: false,
        error: `Estensione ${ext} non supportata. Supportati: ${allowedExtensions.join(', ')}`
      });
    }

    // Verifica MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `Tipo di file ${file.mimetype} non supportato`
      });
    }

    // Verifica nome file per caratteri pericolosi
    const sanitizedName = sanitizeString(file.originalname);
    if (sanitizedName !== file.originalname) {
      return res.status(400).json({
        success: false,
        error: `Nome file ${file.originalname} contiene caratteri non validi`
      });
    }

    // Verifica che il nome file non sia vuoto dopo sanitizzazione
    if (!sanitizedName || sanitizedName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nome file non valido'
      });
    }
  }

  next();
};

// Validazioni per upload singolo
export const validateSingleUpload = [
  validateFileUpload,
  handleInvoiceValidationErrors
];

// Validazioni per upload multiplo
export const validateMultipleUpload = [
  validateFileUpload,
  handleInvoiceValidationErrors
];

// Validazioni per recupero lista fatture
export const validateInvoicesList = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page deve essere un numero intero tra 1 e 1000')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit deve essere un numero intero tra 1 e 100')
    .toInt(),
  
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled'])
    .withMessage('Status non valido')
    .customSanitizer(sanitizeString),
  
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('DateFrom deve essere una data ISO8601 valida')
    .toDate(),
  
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('DateTo deve essere una data ISO8601 valida')
    .toDate(),
  
  query('supplierId')
    .optional()
    .custom((value) => {
      // Accetta sia stringhe vuote che ObjectId validi
      return value === '' || isValidObjectId(value);
    })
    .withMessage('SupplierId deve essere un ObjectId valido o una stringa vuota')
    .customSanitizer(sanitizeString),
  
  query('search')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Search query troppo lunga')
    .customSanitizer(sanitizeString),
  
  handleInvoiceValidationErrors
];

// Validazioni per dettagli fattura
export const validateInvoiceDetails = [
  param('id')
    .notEmpty()
    .withMessage('ID fattura obbligatorio')
    .custom(isValidObjectId)
    .withMessage('ID fattura deve essere un ObjectId valido')
    .customSanitizer(sanitizeString),
  
  handleInvoiceValidationErrors
];

// Validazioni per job di processing
export const validateProcessingJob = [
  param('jobId')
    .notEmpty()
    .withMessage('Job ID obbligatorio')
    .isLength({ min: 10, max: 100 })
    .withMessage('Job ID non valido')
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('Job ID contiene caratteri non validi')
    .customSanitizer(sanitizeString),
  
  handleInvoiceValidationErrors
];

// Validazioni per statistiche fatture
export const validateInvoiceStats = [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'quarter', 'year'])
    .withMessage('Period non valido')
    .customSanitizer(sanitizeString),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('StartDate deve essere una data ISO8601 valida')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('EndDate deve essere una data ISO8601 valida')
    .toDate(),
  
  handleInvoiceValidationErrors
];

// Middleware per validare la coerenza delle date
export const validateDateRange = (req, res, next) => {
  const { dateFrom, dateTo, startDate, endDate } = req.query;
  
  // Controlla dateFrom e dateTo
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    
    if (from >= to) {
      return res.status(400).json({
        success: false,
        error: 'DateFrom deve essere precedente a DateTo'
      });
    }
    
    // Controlla che il range non sia troppo ampio (max 2 anni)
    const maxRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 anni in millisecondi
    if (to - from > maxRange) {
      return res.status(400).json({
        success: false,
        error: 'Range di date troppo ampio. Massimo 2 anni consentiti'
      });
    }
  }
  
  // Controlla startDate e endDate
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: 'StartDate deve essere precedente a EndDate'
      });
    }
  }
  
  next();
};