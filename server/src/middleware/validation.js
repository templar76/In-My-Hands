import { body, param, query, validationResult } from 'express-validator';
import logger from '../utils/logger.js';

// Middleware per gestire errori di validazione
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors', {
      errors: errors.array(),
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    return res.status(400).json({
      success: false,
      error: 'Dati di input non validi',
      details: errors.array()
    });
  }
  next();
};

// Validazioni comuni
export const validateObjectId = param('id').isMongoId().withMessage('ID non valido');

export const validateTenantId = body('tenantId')
  .optional()
  .isMongoId()
  .withMessage('TenantId deve essere un ObjectId valido');

export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Email non valida');

export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page deve essere >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve essere tra 1 e 100')
];

// Sanitizzazione input
export const sanitizeInput = (req, res, next) => {
  // Rimuovi caratteri pericolosi da tutti i campi stringa
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim().replace(/<script[^>]*>.*?<\/script>/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };
  
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  
  next();
};