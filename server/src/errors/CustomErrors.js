/**
 * Classi di errore personalizzate per InMyHands
 * Forniscono una gestione strutturata e tipizzata degli errori
 */

/**
 * Classe base per tutti gli errori personalizzati
 */
export class BaseError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distingue errori operazionali da bug del sistema
    
    // Mantiene lo stack trace corretto
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializza l'errore per il logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Formatta l'errore per la risposta API
   */
  toApiResponse() {
    return {
      success: false,
      error: this.message,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details })
    };
  }
}

/**
 * Errori di validazione dei dati
 */
export class ValidationError extends BaseError {
  constructor(message = 'Dati di input non validi', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }

  static fromExpressValidator(errors) {
    const details = errors.map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
      location: err.location
    }));
    
    return new ValidationError('Errori di validazione rilevati', details);
  }
}

/**
 * Errori di autenticazione
 */
export class AuthenticationError extends BaseError {
  constructor(message = 'Autenticazione fallita', details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Errori di autorizzazione
 */
export class AuthorizationError extends BaseError {
  constructor(message = 'Accesso negato', details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Errori di risorse non trovate
 */
export class NotFoundError extends BaseError {
  constructor(resource = 'Risorsa', id = null) {
    const message = id ? `${resource} con ID ${id} non trovata` : `${resource} non trovata`;
    super(message, 404, 'NOT_FOUND_ERROR', { resource, id });
  }
}

/**
 * Errori di conflitto (es. duplicati)
 */
export class ConflictError extends BaseError {
  constructor(message = 'Conflitto rilevato', details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Errori di database
 */
export class DatabaseError extends BaseError {
  constructor(message = 'Errore del database', originalError = null) {
    const details = originalError ? {
      originalMessage: originalError.message,
      code: originalError.code,
      name: originalError.name
    } : null;
    
    super(message, 500, 'DATABASE_ERROR', details);
    this.originalError = originalError;
  }

  static fromMongoError(mongoError) {
    let message = 'Errore del database';
    let statusCode = 500;
    let errorCode = 'DATABASE_ERROR';

    // Gestione errori MongoDB specifici
    switch (mongoError.code) {
      case 11000: // Duplicate key
        message = 'Risorsa già esistente';
        statusCode = 409;
        errorCode = 'DUPLICATE_RESOURCE';
        break;
      case 121: // Document validation failed
        message = 'Validazione documento fallita';
        statusCode = 400;
        errorCode = 'DOCUMENT_VALIDATION_ERROR';
        break;
      default:
        if (mongoError.name === 'ValidationError') {
          message = 'Errore di validazione del modello';
          statusCode = 400;
          errorCode = 'MODEL_VALIDATION_ERROR';
        }
    }

    const error = new DatabaseError(message, mongoError);
    error.statusCode = statusCode;
    error.errorCode = errorCode;
    return error;
  }
}

/**
 * Errori di logica di business
 */
export class BusinessLogicError extends BaseError {
  constructor(message = 'Errore di logica di business', details = null) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR', details);
  }
}

/**
 * Errori di servizi esterni
 */
export class ExternalServiceError extends BaseError {
  constructor(service = 'Servizio esterno', message = 'Servizio temporaneamente non disponibile', details = null) {
    super(`${service}: ${message}`, 503, 'EXTERNAL_SERVICE_ERROR', { service, ...details });
  }
}

/**
 * Errori di rate limiting
 */
export class RateLimitError extends BaseError {
  constructor(message = 'Troppi tentativi. Riprova più tardi', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
  }
}

/**
 * Errori di payload troppo grande
 */
export class PayloadTooLargeError extends BaseError {
  constructor(maxSize = null) {
    const message = maxSize ? 
      `Payload troppo grande. Dimensione massima: ${maxSize} bytes` : 
      'Payload troppo grande';
    super(message, 413, 'PAYLOAD_TOO_LARGE_ERROR', { maxSize });
  }
}

/**
 * Errori di timeout
 */
export class TimeoutError extends BaseError {
  constructor(operation = 'Operazione', timeout = null) {
    const message = timeout ? 
      `${operation} scaduta dopo ${timeout}ms` : 
      `${operation} scaduta`;
    super(message, 408, 'TIMEOUT_ERROR', { operation, timeout });
  }
}

/**
 * Utility per verificare se un errore è operazionale
 */
export const isOperationalError = (error) => {
  return error instanceof BaseError && error.isOperational;
};

/**
 * Utility per creare errori da codici HTTP
 */
export const createErrorFromStatusCode = (statusCode, message = null, details = null) => {
  switch (statusCode) {
    case 400:
      return new ValidationError(message || 'Richiesta non valida', details);
    case 401:
      return new AuthenticationError(message || 'Autenticazione richiesta', details);
    case 403:
      return new AuthorizationError(message || 'Accesso negato', details);
    case 404:
      return new NotFoundError(message || 'Risorsa non trovata', details);
    case 409:
      return new ConflictError(message || 'Conflitto rilevato', details);
    case 413:
      return new PayloadTooLargeError(details?.maxSize);
    case 422:
      return new BusinessLogicError(message || 'Errore di logica di business', details);
    case 429:
      return new RateLimitError(message || 'Troppi tentativi', details?.retryAfter);
    case 500:
    default:
      return new BaseError(message || 'Errore interno del server', statusCode || 500, 'INTERNAL_ERROR', details);
  }
};