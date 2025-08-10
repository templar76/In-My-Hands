import { body, param, validationResult } from 'express-validator';
import validator from 'validator';
import logger from '../utils/logger.js';
import { ValidationError, AuthorizationError } from '../errors/CustomErrors.js';

// Middleware per gestire errori di validazione specifici per inviti
export const handleInvitationValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Invitation validation errors', {
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

// Validazione personalizzata per token di invito
const isValidInvitationToken = (value) => {
  // Token deve essere alfanumerico con possibili trattini e underscore
  return /^[a-zA-Z0-9\-_]{20,100}$/.test(value);
};

// Validazione personalizzata per ruoli utente
const isValidUserRole = (value) => {
  const validRoles = ['admin', 'user', 'viewer', 'editor'];
  return validRoles.includes(value);
};

// Validazioni per accettazione invito
export const validateAcceptInvitation = [
  body('token')
    .notEmpty()
    .withMessage('Token di invito obbligatorio')
    .custom(isValidInvitationToken)
    .withMessage('Token di invito non valido')
    .customSanitizer(sanitizeString),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email non valida')
    .isLength({ max: 254 })
    .withMessage('Email troppo lunga')
    .customSanitizer(sanitizeString),
  
  body('displayName')
    .notEmpty()
    .withMessage('Nome visualizzato obbligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('Il nome deve essere tra 2 e 100 caratteri')
    .matches(/^[a-zA-Z\s\-\'àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]+$/)
    .withMessage('Il nome contiene caratteri non validi')
    .customSanitizer(sanitizeString),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('La password deve essere di almeno 8 caratteri')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('La password deve contenere almeno: una maiuscola, una minuscola, un numero e un carattere speciale'),
  
  body('acceptTerms')
    .isBoolean()
    .withMessage('Accettazione termini deve essere un valore booleano')
    .custom((value) => {
      if (value !== true) {
        throw new Error('Devi accettare i termini e condizioni');
      }
      return true;
    }),
  
  handleInvitationValidationErrors
];

// Validazioni per creazione invito
export const validateCreateInvitation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email non valida')
    .isLength({ max: 254 })
    .withMessage('Email troppo lunga')
    .customSanitizer(sanitizeString),
  
  body('role')
    .notEmpty()
    .withMessage('Ruolo obbligatorio')
    .custom(isValidUserRole)
    .withMessage('Ruolo non valido')
    .customSanitizer(sanitizeString),
  
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Messaggio troppo lungo (max 500 caratteri)')
    .customSanitizer(sanitizeString),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Data di scadenza deve essere in formato ISO8601')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      const maxExpiry = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 giorni
      
      if (expiryDate <= now) {
        throw new Error('La data di scadenza deve essere futura');
      }
      
      if (expiryDate > maxExpiry) {
        throw new Error('La data di scadenza non può essere superiore a 30 giorni');
      }
      
      return true;
    }),
  
  handleInvitationValidationErrors
];

// Validazioni per parametri tenant e invito
export const validateTenantInvitationParams = [
  param('tenantId')
    .notEmpty()
    .withMessage('Tenant ID obbligatorio')
    .custom(isValidObjectId)
    .withMessage('Tenant ID deve essere un ObjectId valido')
    .customSanitizer(sanitizeString),
  
  param('invitationId')
    .notEmpty()
    .withMessage('Invitation ID obbligatorio')
    .custom(isValidObjectId)
    .withMessage('Invitation ID deve essere un ObjectId valido')
    .customSanitizer(sanitizeString),
  
  handleInvitationValidationErrors
];

// Validazioni per verifica utente esistente
export const validateCheckExistingUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email non valida')
    .isLength({ max: 254 })
    .withMessage('Email troppo lunga')
    .customSanitizer(sanitizeString),
  
  handleInvitationValidationErrors
];

// Validazioni per creazione utente tenant
export const validateCreateTenantUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email non valida')
    .isLength({ max: 254 })
    .withMessage('Email troppo lunga')
    .customSanitizer(sanitizeString),
  
  body('displayName')
    .notEmpty()
    .withMessage('Nome visualizzato obbligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('Il nome deve essere tra 2 e 100 caratteri')
    .matches(/^[a-zA-Z\s\-\'àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]+$/)
    .withMessage('Il nome contiene caratteri non validi')
    .customSanitizer(sanitizeString),
  
  body('role')
    .notEmpty()
    .withMessage('Ruolo obbligatorio')
    .custom(isValidUserRole)
    .withMessage('Ruolo non valido')
    .customSanitizer(sanitizeString),
  
  body('tenantId')
    .notEmpty()
    .withMessage('Tenant ID obbligatorio')
    .custom(isValidObjectId)
    .withMessage('Tenant ID deve essere un ObjectId valido')
    .customSanitizer(sanitizeString),
  
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('La password deve essere di almeno 8 caratteri')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('La password deve contenere almeno: una maiuscola, una minuscola, un numero e un carattere speciale'),
  
  handleInvitationValidationErrors
];

// Middleware per validare la coerenza dei dati di invito
export const validateInvitationConsistency = (req, res, next) => {
  const { tenantId } = req.params;
  const userTenantId = req.user?.tenantId;
  
  // Verifica che l'utente appartenga al tenant dell'invito
  if (tenantId && userTenantId && tenantId !== userTenantId.toString()) {
    return next(new AuthorizationError(
      'Non autorizzato ad accedere agli inviti di questo tenant',
      { requestedTenantId: tenantId, userTenantId: userTenantId.toString() }
    ));
  }
  
  next();
};

// Middleware per limitare il numero di inviti per tenant
export const validateInvitationLimits = async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    
    // Qui potresti implementare logica per controllare:
    // - Numero massimo di inviti attivi per tenant
    // - Numero massimo di inviti per giorno
    // - Limiti basati sul piano di abbonamento
    
    // Esempio di implementazione base:
    const maxActiveInvitations = 50; // Limite esempio
    
    // Nota: Questa è una validazione di esempio
    // In un'implementazione reale, dovresti controllare il database
    
    next();
  } catch (error) {
    logger.error('Error validating invitation limits', {
      error: error.message,
      tenantId: req.user?.tenantId
    });
    
    return res.status(500).json({
      success: false,
      error: 'Errore nella validazione dei limiti di invito'
    });
  }
};