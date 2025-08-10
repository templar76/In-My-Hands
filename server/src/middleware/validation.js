import { body, param, query, validationResult } from 'express-validator';
import validator from 'validator';
import logger from '../utils/logger.js';
import { ValidationError, PayloadTooLargeError } from '../errors/CustomErrors.js';

// Middleware per gestire errori di validazione
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors', {
      errors: errors.array(),
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
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
    .replace(/eval\s*\(/gi, '')
    .replace(/Function\s*\(/gi, '')
    .replace(/setTimeout\s*\(/gi, '')
    .replace(/setInterval\s*\(/gi, '')
    .trim();
};

// Validazione personalizzata per ObjectId MongoDB
const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

// Validazioni comuni migliorate
export const validateObjectId = param('id')
  .notEmpty()
  .withMessage('ID obbligatorio')
  .custom(isValidObjectId)
  .withMessage('ID deve essere un ObjectId valido')
  .customSanitizer(sanitizeString);

export const validateTenantId = body('tenantId')
  .optional()
  .custom(isValidObjectId)
  .withMessage('TenantId deve essere un ObjectId valido')
  .customSanitizer(sanitizeString);

export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Email non valida')
  .isLength({ max: 254 })
  .withMessage('Email troppo lunga')
  .customSanitizer(sanitizeString);

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page deve essere tra 1 e 1000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit deve essere tra 1 e 100')
    .toInt()
];

// Sanitizzazione input avanzata
export const sanitizeInput = (req, res, next) => {
  // Rimuovi caratteri pericolosi da tutti i campi stringa
  const sanitizeObject = (obj, depth = 0) => {
    // Previeni attacchi di deep nesting
    if (depth > 10) {
      logger.warn('Deep nesting detected in input', {
        ip: req.ip,
        url: req.url,
        depth
      });
      return;
    }
    
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Sanitizzazione più robusta
        obj[key] = sanitizeString(obj[key]);
        
        // Controlla lunghezza massima per prevenire DoS
        if (obj[key].length > 10000) {
          obj[key] = obj[key].substring(0, 10000);
          logger.warn('String truncated due to excessive length', {
            key,
            originalLength: obj[key].length,
            ip: req.ip
          });
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        sanitizeObject(obj[key], depth + 1);
      } else if (Array.isArray(obj[key])) {
        // Limita la lunghezza degli array per prevenire DoS
        if (obj[key].length > 1000) {
          obj[key] = obj[key].slice(0, 1000);
          logger.warn('Array truncated due to excessive length', {
            key,
            originalLength: obj[key].length,
            ip: req.ip
          });
        }
        obj[key].forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            sanitizeObject(item, depth + 1);
          } else if (typeof item === 'string') {
            obj[key][index] = sanitizeString(item);
          }
        });
      }
    }
  };
  
  try {
    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);
  } catch (error) {
    logger.error('Error during input sanitization', {
      error: error.message,
      ip: req.ip,
      url: req.url
    });
    return res.status(400).json({
      success: false,
      error: 'Dati di input non validi'
    });
  }
  
  next();
};

// Middleware per prevenire NoSQL injection
export const preventNoSQLInjection = (req, res, next) => {
  const checkForInjection = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Controlla operatori MongoDB pericolosi
        const dangerousOperators = ['$where', '$regex', '$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin', '$exists', '$type'];
        if (dangerousOperators.some(op => key.startsWith(op))) {
          logger.warn('Potential NoSQL injection attempt detected', {
            key,
            value: obj[key],
            ip: req.ip,
            url: req.url
          });
          return true;
        }
        if (checkForInjection(obj[key])) return true;
      }
    }
    return false;
  };
  
  if (req.body && checkForInjection(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Richiesta non valida'
    });
  }
  
  if (req.query && checkForInjection(req.query)) {
    return res.status(400).json({
      success: false,
      error: 'Parametri di query non validi'
    });
  }
  
  next();
};

// Middleware per limitare la dimensione del payload
export const limitPayloadSize = (maxSize = 1024 * 1024) => { // Default 1MB
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      logger.warn('Payload size exceeded', {
        contentLength,
        maxSize,
        ip: req.ip,
        url: req.url
      });
      return next(new PayloadTooLargeError(maxSize));
    }
    
    next();
  };
};

// Validazioni per ricerca testuale sicura
export const validateSearchQuery = query('search')
  .optional()
  .isLength({ max: 200 })
  .withMessage('Query di ricerca troppo lunga')
  .matches(/^[a-zA-Z0-9\s\-_àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]*$/)
  .withMessage('Query di ricerca contiene caratteri non validi')
  .customSanitizer(sanitizeString);

// Validazioni per ordinamento sicuro
export const validateSortOptions = query('sort')
  .optional()
  .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name', 'email', '-email'])
  .withMessage('Opzione di ordinamento non valida')
  .customSanitizer(sanitizeString);