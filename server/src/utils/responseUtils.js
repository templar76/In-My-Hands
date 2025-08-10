/**
 * Utility per standardizzare le risposte API
 * Fornisce un formato consistente per tutte le risposte dell'applicazione
 */

/**
 * Formatta una risposta di successo standardizzata
 * @param {Object} res - Oggetto response di Express
 * @param {*} data - Dati da includere nella risposta
 * @param {string} message - Messaggio di successo opzionale
 * @param {number} statusCode - Codice di stato HTTP (default: 200)
 * @param {Object} meta - Metadati aggiuntivi (paginazione, etc.)
 */
export const sendSuccess = (res, data = null, message = null, statusCode = 200, meta = null) => {
  const response = {
    success: true,
    timestamp: new Date().toISOString()
  };

  // Aggiungi messaggio se fornito
  if (message) {
    response.message = message;
  }

  // Aggiungi dati se forniti
  if (data !== null) {
    response.data = data;
  }

  // Aggiungi metadati se forniti (es. paginazione)
  if (meta) {
    response.meta = meta;
  }

  // Aggiungi correlation ID se presente
  if (res.req?.correlationId) {
    response.correlationId = res.req.correlationId;
  }

  return res.status(statusCode).json(response);
};

/**
 * Formatta una risposta di successo per operazioni di creazione
 * @param {Object} res - Oggetto response di Express
 * @param {*} data - Dati dell'entità creata
 * @param {string} message - Messaggio di successo
 * @param {string} location - URL della risorsa creata (opzionale)
 */
export const sendCreated = (res, data, message = 'Risorsa creata con successo', location = null) => {
  if (location) {
    res.set('Location', location);
  }
  return sendSuccess(res, data, message, 201);
};

/**
 * Formatta una risposta di successo per operazioni di aggiornamento
 * @param {Object} res - Oggetto response di Express
 * @param {*} data - Dati dell'entità aggiornata
 * @param {string} message - Messaggio di successo
 */
export const sendUpdated = (res, data, message = 'Risorsa aggiornata con successo') => {
  return sendSuccess(res, data, message, 200);
};

/**
 * Formatta una risposta di successo per operazioni di eliminazione
 * @param {Object} res - Oggetto response di Express
 * @param {string} message - Messaggio di successo
 */
export const sendDeleted = (res, message = 'Risorsa eliminata con successo') => {
  return sendSuccess(res, null, message, 200);
};

/**
 * Formatta una risposta per contenuto non modificato (304)
 * @param {Object} res - Oggetto response di Express
 */
export const sendNotModified = (res) => {
  return res.status(304).end();
};

/**
 * Formatta una risposta di successo con paginazione
 * @param {Object} res - Oggetto response di Express
 * @param {Array} data - Array di dati
 * @param {Object} pagination - Informazioni di paginazione
 * @param {string} message - Messaggio opzionale
 */
export const sendPaginated = (res, data, pagination, message = null) => {
  const meta = {
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: pagination.totalPages || Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasNext: pagination.hasNext || false,
      hasPrev: pagination.hasPrev || false
    }
  };

  return sendSuccess(res, data, message, 200, meta);
};

/**
 * Formatta una risposta di errore standardizzata
 * @param {Object} res - Oggetto response di Express
 * @param {string} message - Messaggio di errore
 * @param {number} statusCode - Codice di stato HTTP
 * @param {string} errorCode - Codice di errore specifico
 * @param {*} details - Dettagli aggiuntivi dell'errore
 */
export const sendError = (res, message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) => {
  const response = {
    success: false,
    error: message,
    errorCode,
    timestamp: new Date().toISOString()
  };

  // Aggiungi dettagli se forniti
  if (details) {
    response.details = details;
  }

  // Aggiungi correlation ID se presente
  if (res.req?.correlationId) {
    response.correlationId = res.req.correlationId;
  }

  return res.status(statusCode).json(response);
};

/**
 * Formatta una risposta di errore di validazione
 * @param {Object} res - Oggetto response di Express
 * @param {Array} validationErrors - Array di errori di validazione
 * @param {string} message - Messaggio di errore principale
 */
export const sendValidationError = (res, validationErrors, message = 'Errori di validazione rilevati') => {
  const details = validationErrors.map(err => ({
    field: err.path || err.param || err.field,
    message: err.msg || err.message,
    value: err.value,
    location: err.location
  }));

  return sendError(res, message, 400, 'VALIDATION_ERROR', details);
};

/**
 * Formatta una risposta di errore di autenticazione
 * @param {Object} res - Oggetto response di Express
 * @param {string} message - Messaggio di errore
 */
export const sendAuthError = (res, message = 'Autenticazione richiesta') => {
  res.set('WWW-Authenticate', 'Bearer realm="InMyHands API"');
  return sendError(res, message, 401, 'AUTHENTICATION_ERROR');
};

/**
 * Formatta una risposta di errore di autorizzazione
 * @param {Object} res - Oggetto response di Express
 * @param {string} message - Messaggio di errore
 */
export const sendForbiddenError = (res, message = 'Accesso negato') => {
  return sendError(res, message, 403, 'AUTHORIZATION_ERROR');
};

/**
 * Formatta una risposta di errore per risorsa non trovata
 * @param {Object} res - Oggetto response di Express
 * @param {string} resource - Nome della risorsa
 * @param {string} id - ID della risorsa (opzionale)
 */
export const sendNotFoundError = (res, resource = 'Risorsa', id = null) => {
  const message = id ? `${resource} con ID ${id} non trovata` : `${resource} non trovata`;
  return sendError(res, message, 404, 'NOT_FOUND_ERROR', { resource, id });
};

/**
 * Formatta una risposta di errore per conflitto
 * @param {Object} res - Oggetto response di Express
 * @param {string} message - Messaggio di errore
 * @param {*} details - Dettagli del conflitto
 */
export const sendConflictError = (res, message = 'Conflitto rilevato', details = null) => {
  return sendError(res, message, 409, 'CONFLICT_ERROR', details);
};

/**
 * Formatta una risposta di errore per rate limiting
 * @param {Object} res - Oggetto response di Express
 * @param {string} message - Messaggio di errore
 * @param {number} retryAfter - Secondi dopo i quali riprovare
 */
export const sendRateLimitError = (res, message = 'Troppi tentativi. Riprova più tardi', retryAfter = null) => {
  if (retryAfter) {
    res.set('Retry-After', retryAfter.toString());
  }
  return sendError(res, message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
};

/**
 * Formatta una risposta di errore per payload troppo grande
 * @param {Object} res - Oggetto response di Express
 * @param {number} maxSize - Dimensione massima consentita
 */
export const sendPayloadTooLargeError = (res, maxSize = null) => {
  const message = maxSize ? 
    `Payload troppo grande. Dimensione massima: ${maxSize} bytes` : 
    'Payload troppo grande';
  return sendError(res, message, 413, 'PAYLOAD_TOO_LARGE_ERROR', { maxSize });
};

/**
 * Formatta una risposta di errore per servizio non disponibile
 * @param {Object} res - Oggetto response di Express
 * @param {string} service - Nome del servizio
 * @param {string} message - Messaggio di errore
 */
export const sendServiceUnavailableError = (res, service = 'Servizio', message = 'Servizio temporaneamente non disponibile') => {
  return sendError(res, `${service}: ${message}`, 503, 'SERVICE_UNAVAILABLE_ERROR', { service });
};

/**
 * Middleware per aggiungere le utility di risposta all'oggetto res
 * Permette di usare res.sendSuccess(), res.sendError(), etc.
 */
export const responseUtilsMiddleware = (req, res, next) => {
  // Aggiungi metodi di successo
  res.sendSuccess = (data, message, statusCode, meta) => sendSuccess(res, data, message, statusCode, meta);
  res.sendCreated = (data, message, location) => sendCreated(res, data, message, location);
  res.sendUpdated = (data, message) => sendUpdated(res, data, message);
  res.sendDeleted = (message) => sendDeleted(res, message);
  res.sendNotModified = () => sendNotModified(res);
  res.sendPaginated = (data, pagination, message) => sendPaginated(res, data, pagination, message);

  // Aggiungi metodi di errore
  res.sendError = (message, statusCode, errorCode, details) => sendError(res, message, statusCode, errorCode, details);
  res.sendValidationError = (validationErrors, message) => sendValidationError(res, validationErrors, message);
  res.sendAuthError = (message) => sendAuthError(res, message);
  res.sendForbiddenError = (message) => sendForbiddenError(res, message);
  res.sendNotFoundError = (resource, id) => sendNotFoundError(res, resource, id);
  res.sendConflictError = (message, details) => sendConflictError(res, message, details);
  res.sendRateLimitError = (message, retryAfter) => sendRateLimitError(res, message, retryAfter);
  res.sendPayloadTooLargeError = (maxSize) => sendPayloadTooLargeError(res, maxSize);
  res.sendServiceUnavailableError = (service, message) => sendServiceUnavailableError(res, service, message);

  next();
};

/**
 * Utility per creare metadati di paginazione
 * @param {number} page - Pagina corrente
 * @param {number} limit - Elementi per pagina
 * @param {number} total - Totale elementi
 * @returns {Object} Oggetto con metadati di paginazione
 */
export const createPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * Utility per validare parametri di paginazione
 * @param {number} page - Pagina richiesta
 * @param {number} limit - Limite richiesto
 * @param {number} maxLimit - Limite massimo consentito
 * @returns {Object} Parametri validati
 */
export const validatePaginationParams = (page = 1, limit = 10, maxLimit = 100) => {
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 10));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
    skip: (validatedPage - 1) * validatedLimit
  };
};