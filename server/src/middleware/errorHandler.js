/**
 * Middleware centralizzato per la gestione degli errori
 * Gestisce tutti gli errori dell'applicazione con logging strutturato
 */

import logger from '../utils/logger.js';
import {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  BusinessLogicError,
  ExternalServiceError,
  RateLimitError,
  PayloadTooLargeError,
  TimeoutError,
  isOperationalError
} from '../errors/CustomErrors.js';

/**
 * Middleware principale per la gestione degli errori
 * Deve essere l'ultimo middleware nell'applicazione
 */
export const errorHandler = (error, req, res, next) => {
  // Se la risposta è già stata inviata, passa al gestore di errori di Express
  if (res.headersSent) {
    return next(error);
  }

  // Converte errori non strutturati in errori personalizzati
  const structuredError = normalizeError(error);

  // Log dell'errore con contesto completo
  logError(structuredError, req);

  // Invia risposta di errore al client
  sendErrorResponse(structuredError, res);
};

/**
 * Normalizza errori di diversi tipi in errori strutturati
 */
const normalizeError = (error) => {
  // Se è già un errore personalizzato, restituiscilo così com'è
  if (error instanceof BaseError) {
    return error;
  }

  // Gestione errori MongoDB/Mongoose
  if (error.name === 'MongoError' || error.name === 'MongoServerError' || error.code) {
    return DatabaseError.fromMongoError(error);
  }

  // Gestione errori di validazione Mongoose
  if (error.name === 'ValidationError' && error.errors) {
    const details = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value,
      kind: err.kind
    }));
    return new ValidationError('Errore di validazione del modello', details);
  }

  // Gestione errori CastError (ObjectId non validi)
  if (error.name === 'CastError') {
    return new ValidationError(
      `Valore non valido per il campo ${error.path}`,
      {
        field: error.path,
        value: error.value,
        expectedType: error.kind
      }
    );
  }

  // Gestione errori JWT
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Token JWT non valido');
  }

  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token JWT scaduto');
  }

  // Gestione errori di sintassi JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return new ValidationError('JSON malformato nella richiesta');
  }

  // Gestione errori di timeout
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    return new TimeoutError('Operazione di rete');
  }

  // Gestione errori HTTP generici
  if (error.status || error.statusCode) {
    const statusCode = error.status || error.statusCode;
    return createErrorFromStatusCode(statusCode, error.message);
  }

  // Errore generico non gestito
  return new BaseError(
    process.env.NODE_ENV === 'production' 
      ? 'Errore interno del server' 
      : error.message || 'Errore sconosciuto',
    500,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development' ? { originalError: error.message, stack: error.stack } : null
  );
};

/**
 * Crea errori da codici di stato HTTP
 */
const createErrorFromStatusCode = (statusCode, message) => {
  switch (statusCode) {
    case 400:
      return new ValidationError(message || 'Richiesta non valida');
    case 401:
      return new AuthenticationError(message || 'Autenticazione richiesta');
    case 403:
      return new AuthorizationError(message || 'Accesso negato');
    case 404:
      return new NotFoundError(message || 'Risorsa non trovata');
    case 409:
      return new ConflictError(message || 'Conflitto rilevato');
    case 413:
      return new PayloadTooLargeError();
    case 422:
      return new BusinessLogicError(message || 'Errore di logica di business');
    case 429:
      return new RateLimitError(message || 'Troppi tentativi');
    case 503:
      return new ExternalServiceError('Servizio esterno', message || 'Servizio non disponibile');
    default:
      return new BaseError(message || 'Errore interno del server', statusCode || 500);
  }
};

/**
 * Log strutturato degli errori
 */
const logError = (error, req) => {
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      stack: error.stack,
      details: error.details
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length')
    },
    user: req.user ? {
      uid: req.user.uid,
      email: req.user.email?.substring(0, 3) + '***',
      tenantId: req.user.tenantId,
      role: req.user.role
    } : null,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId || generateCorrelationId()
  };

  // Log con livello appropriato basato sul tipo di errore
  if (error.statusCode >= 500) {
    logger.error('Server Error', logData);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', logData);
  } else {
    logger.info('Handled Error', logData);
  }

  // Log aggiuntivo per errori critici
  if (!isOperationalError(error) || error.statusCode >= 500) {
    logger.error('Critical Error Details', {
      errorType: 'CRITICAL',
      isOperational: isOperationalError(error),
      originalError: error.originalError,
      fullStack: error.stack
    });
  }
};

/**
 * Invia risposta di errore standardizzata al client
 */
const sendErrorResponse = (error, res) => {
  const response = {
    success: false,
    error: error.message,
    errorCode: error.errorCode,
    timestamp: error.timestamp
  };

  // Aggiungi dettagli solo se appropriato
  if (error.details && shouldIncludeDetails(error)) {
    response.details = error.details;
  }

  // Aggiungi informazioni di debug in sviluppo
  if (process.env.NODE_ENV === 'development' && error.statusCode >= 500) {
    response.debug = {
      stack: error.stack,
      originalError: error.originalError
    };
  }

  // Aggiungi header specifici per alcuni tipi di errore
  if (error instanceof RateLimitError && error.details?.retryAfter) {
    res.set('Retry-After', error.details.retryAfter.toString());
  }

  if (error instanceof AuthenticationError) {
    res.set('WWW-Authenticate', 'Bearer realm="InMyHands API"');
  }

  res.status(error.statusCode).json(response);
};

/**
 * Determina se includere i dettagli dell'errore nella risposta
 */
const shouldIncludeDetails = (error) => {
  // Includi sempre i dettagli per errori di validazione
  if (error instanceof ValidationError) {
    return true;
  }

  // Includi dettagli per errori di business logic
  if (error instanceof BusinessLogicError) {
    return true;
  }

  // Non includere dettagli per errori di sicurezza
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return false;
  }

  // Non includere dettagli per errori del database in produzione
  if (error instanceof DatabaseError && process.env.NODE_ENV === 'production') {
    return false;
  }

  return process.env.NODE_ENV === 'development';
};

/**
 * Genera un ID di correlazione per tracciare le richieste
 */
const generateCorrelationId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Middleware per catturare errori asincroni
 * Wrapper per funzioni async che automaticamente cattura errori
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware per gestire 404 (route non trovate)
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError('Endpoint', req.originalUrl);
  next(error);
};

/**
 * Middleware per aggiungere correlation ID alle richieste
 */
export const correlationIdMiddleware = (req, res, next) => {
  req.correlationId = req.get('X-Correlation-ID') || generateCorrelationId();
  res.set('X-Correlation-ID', req.correlationId);
  next();
};

/**
 * Gestore per promise rejection non gestite
 */
export const setupGlobalErrorHandlers = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });
    
    // In produzione, termina il processo dopo aver loggato
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    
    // Termina sempre il processo per uncaught exceptions
    process.exit(1);
  });
};