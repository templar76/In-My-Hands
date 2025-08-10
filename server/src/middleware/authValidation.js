import { body, param, validationResult } from 'express-validator';
import validator from 'validator';
import logger from '../utils/logger.js';
import { ValidationError } from '../errors/CustomErrors.js';

// Middleware per gestire errori di validazione specifici per auth
export const handleAuthValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Auth validation errors', {
      errors: errors.array(),
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return next(ValidationError.fromExpressValidator(errors.array()));
  }
  next();
};

// Validazione personalizzata per password sicura
const isStrongPassword = (value) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumbers = /\d/.test(value);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
  
  return value.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
};

// Validazione personalizzata per Partita IVA italiana
const isValidItalianVAT = (value) => {
  const vatRegex = /^IT[0-9]{11}$/;
  return vatRegex.test(value) || /^[0-9]{11}$/.test(value);
};

// Validazione personalizzata per Codice Fiscale italiano
const isValidItalianFiscalCode = (value) => {
  const fiscalCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
  return fiscalCodeRegex.test(value.toUpperCase());
};

// Validazione personalizzata per codice SDI
const isValidSDICode = (value) => {
  const sdiRegex = /^[A-Z0-9]{7}$/;
  return sdiRegex.test(value.toUpperCase()) || value.toUpperCase() === '0000000';
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

// Validazioni per registrazione
export const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Deve essere un indirizzo email valido')
    .isLength({ max: 254 })
    .withMessage('Email troppo lunga')
    .custom((value) => {
      if (!validator.isEmail(value)) {
        throw new Error('Formato email non valido');
      }
      return true;
    }),
  
  body('plan')
    .optional()
    .isIn(['free', 'monthly', 'annual'])
    .withMessage('Piano non valido. Valori accettati: free, monthly, annual')
    .customSanitizer(sanitizeString),
  
  handleAuthValidationErrors
];

// Validazioni per completamento registrazione tenant
export const validateTenantRegistration = [
  body('token')
    .notEmpty()
    .withMessage('Il token è obbligatorio')
    .isLength({ min: 10, max: 500 })
    .withMessage('Token non valido')
    .customSanitizer(sanitizeString),
  
  body('companyType')
    .notEmpty()
    .withMessage('Il tipo di azienda è obbligatorio')
    .isIn(['srl', 'spa', 'snc', 'sas', 'ss', 'ditta_individuale', 'altro'])
    .withMessage('Tipo di azienda non valido')
    .customSanitizer(sanitizeString),
  
  body('companyName')
    .notEmpty()
    .withMessage('Il nome dell\'azienda è obbligatorio')
    .isLength({ min: 2, max: 200 })
    .withMessage('Il nome dell\'azienda deve essere tra 2 e 200 caratteri')
    .matches(/^[a-zA-Z0-9\s\-\.&'àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]+$/)
    .withMessage('Il nome dell\'azienda contiene caratteri non validi')
    .customSanitizer(sanitizeString),
  
  body('vatNumber')
    .notEmpty()
    .withMessage('La Partita IVA è obbligatoria')
    .custom(isValidItalianVAT)
    .withMessage('Partita IVA italiana non valida')
    .customSanitizer(sanitizeString),
  
  body('codiceFiscale')
    .notEmpty()
    .withMessage('Il Codice Fiscale è obbligatorio')
    .custom(isValidItalianFiscalCode)
    .withMessage('Codice Fiscale italiano non valido')
    .customSanitizer(sanitizeString),
  
  body('address')
    .notEmpty()
    .withMessage('L\'indirizzo è obbligatorio')
    .isLength({ min: 5, max: 500 })
    .withMessage('L\'indirizzo deve essere tra 5 e 500 caratteri')
    .customSanitizer(sanitizeString),
  
  body('contacts.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('L\'email di contatto dell\'azienda deve essere valida')
    .customSanitizer(sanitizeString),
  
  body('contacts.phone')
    .notEmpty()
    .withMessage('Il telefono di contatto dell\'azienda è obbligatorio')
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numero di telefono non valido')
    .customSanitizer(sanitizeString),
  
  body('contacts.sdiCode')
    .notEmpty()
    .withMessage('Il codice SDI è obbligatorio')
    .custom(isValidSDICode)
    .withMessage('Codice SDI non valido')
    .customSanitizer(sanitizeString),
  
  body('contacts.pec')
    .isEmail()
    .normalizeEmail()
    .withMessage('La PEC deve essere un indirizzo email valido')
    .customSanitizer(sanitizeString),
  
  body('admin.displayName')
    .notEmpty()
    .withMessage('Il nome visualizzato dell\'admin è obbligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('Il nome deve essere tra 2 e 100 caratteri')
    .matches(/^[a-zA-Z\s\-\'àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]+$/)
    .withMessage('Il nome contiene caratteri non validi')
    .customSanitizer(sanitizeString),
  
  body('admin.password')
    .isLength({ min: 8 })
    .withMessage('La password deve essere di almeno 8 caratteri')
    .custom(isStrongPassword)
    .withMessage('La password deve contenere almeno: 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale'),
  
  handleAuthValidationErrors
];

// Validazioni per login
export const validateLogin = [
  body('token')
    .notEmpty()
    .withMessage('Token Firebase obbligatorio')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Token non valido')
    .customSanitizer(sanitizeString),
  
  handleAuthValidationErrors
];

// Validazioni per aggiornamento profilo
export const validateProfileUpdate = [
  param('uid')
    .notEmpty()
    .withMessage('UID utente obbligatorio')
    .isLength({ min: 10, max: 128 })
    .withMessage('UID non valido')
    .customSanitizer(sanitizeString),
  
  body('displayName')
    .notEmpty()
    .withMessage('Il displayName è obbligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('Il nome deve essere tra 2 e 100 caratteri')
    .matches(/^[a-zA-Z\s\-\'àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]+$/)
    .withMessage('Il nome contiene caratteri non validi')
    .customSanitizer(sanitizeString),
  
  handleAuthValidationErrors
];

// Validazioni per cambio password
export const validatePasswordChange = [
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nuova password deve essere di almeno 8 caratteri')
    .custom(isStrongPassword)
    .withMessage('La password deve contenere almeno: 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale'),
  
  handleAuthValidationErrors
];

// Validazioni per impostazione ruolo admin
export const validateAdminRole = [
  param('uid')
    .notEmpty()
    .withMessage('UID utente obbligatorio')
    .isLength({ min: 10, max: 128 })
    .withMessage('UID non valido')
    .customSanitizer(sanitizeString),
  
  handleAuthValidationErrors
];