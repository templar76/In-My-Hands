import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import logger from '../utils/logger.js';

// Configurazione store Redis per rate limiting distribuito (opzionale)
const createStore = () => {
  try {
    // Se Redis è disponibile, usa RedisStore
    if (process.env.REDIS_URL) {
      return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
      });
    }
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store', { error: error.message });
  }
  return undefined; // Usa memory store di default
};

// Rate limiter generale migliorato
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // massimo 100 richieste per IP
  message: {
    success: false,
    error: 'Troppe richieste, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    // Combina IP e User-Agent per una chiave più specifica
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${req.ip}:${userAgent.substring(0, 50)}`;
  },
  skip: (req) => {
    // Salta il rate limiting per richieste di health check
    return req.url === '/health' || req.url === '/api/health';
  },
  handler: (req, res) => {
    logger.warn('General rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      method: req.method,
      tenantId: req.user?.tenantId,
      userId: req.user?.uid
    });
    res.status(429).json({
      success: false,
      error: 'Troppe richieste, riprova più tardi',
      retryAfter: Math.ceil(15 * 60) // 15 minuti in secondi
    });
  }
});

// Rate limiter per autenticazione più rigoroso
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // massimo 5 tentativi di login per IP
  message: {
    success: false,
    error: 'Troppi tentativi di accesso, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    // Per l'autenticazione, usa anche l'email se disponibile
    const email = req.body?.email || '';
    return `auth:${req.ip}:${email}`;
  },
  skipSuccessfulRequests: true, // Non conta le richieste riuscite
  skipFailedRequests: false, // Conta sempre i tentativi falliti
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      email: req.body?.email,
      userAgent: req.get('User-Agent'),
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Troppi tentativi di accesso, riprova più tardi',
      retryAfter: Math.ceil(15 * 60) // 15 minuti in secondi
    });
  }
});

// Rate limiter per upload più sofisticato
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // massimo 10 upload per minuto
  message: {
    success: false,
    error: 'Troppi upload, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    // Per gli upload, considera anche l'utente autenticato
    const userId = req.user?.uid || 'anonymous';
    return `upload:${req.ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userId: req.user?.uid,
      tenantId: req.user?.tenantId,
      userAgent: req.get('User-Agent'),
      fileCount: req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : 0
    });
    res.status(429).json({
      success: false,
      error: 'Troppi upload, riprova più tardi',
      retryAfter: 60 // 1 minuto in secondi
    });
  }
});

// Rate limiter per API critiche (password reset, inviti, etc.)
export const criticalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // massimo 3 richieste per ora
  message: {
    success: false,
    error: 'Limite richieste critiche raggiunto, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    const email = req.body?.email || req.params?.email || '';
    return `critical:${req.ip}:${email}`;
  },
  handler: (req, res) => {
    logger.error('Critical rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      email: req.body?.email || req.params?.email,
      userAgent: req.get('User-Agent'),
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Limite richieste critiche raggiunto, riprova più tardi',
      retryAfter: Math.ceil(60 * 60) // 1 ora in secondi
    });
  }
});

// Rate limiter per ricerche e query
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // massimo 30 ricerche per minuto
  message: {
    success: false,
    error: 'Troppe ricerche, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    const userId = req.user?.uid || 'anonymous';
    return `search:${req.ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userId: req.user?.uid,
      searchQuery: req.query?.search,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Troppe ricerche, riprova più tardi',
      retryAfter: 60
    });
  }
});

// Rate limiter per creazione di risorse
export const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // massimo 20 creazioni per minuto
  message: {
    success: false,
    error: 'Troppe creazioni, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    const userId = req.user?.uid || 'anonymous';
    const tenantId = req.user?.tenantId || 'no-tenant';
    return `create:${req.ip}:${userId}:${tenantId}`;
  },
  handler: (req, res) => {
    logger.warn('Create rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userId: req.user?.uid,
      tenantId: req.user?.tenantId,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Troppe creazioni, riprova più tardi',
      retryAfter: 60
    });
  }
});