import helmet from 'helmet';
import logger from '../utils/logger.js';

// Middleware per headers di sicurezza
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Middleware per rilevare tentativi di attacco
export const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /(<script[^>]*>.*?<\/script>)/gi,
    /(union.*select|select.*from|insert.*into|delete.*from)/gi,
    /(\.\.\/)|(\.\.\\)/g,
    /(<iframe|<object|<embed)/gi
  ];
  
  const checkForPatterns = (obj, path = '') => {
    for (let key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof obj[key] === 'string') {
        for (let pattern of suspiciousPatterns) {
          if (pattern.test(obj[key])) {
            logger.warn('Suspicious activity detected', {
              pattern: pattern.toString(),
              field: currentPath,
              value: obj[key].substring(0, 100),
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              url: req.url
            });
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkForPatterns(obj[key], currentPath)) return true;
      }
    }
    return false;
  };
  
  let suspicious = false;
  if (req.body) suspicious = checkForPatterns(req.body);
  if (!suspicious && req.query) suspicious = checkForPatterns(req.query);
  if (!suspicious && req.params) suspicious = checkForPatterns(req.params);
  
  if (suspicious) {
    return res.status(400).json({
      error: 'Richiesta non valida',
      message: 'Contenuto sospetto rilevato'
    });
  }
  
  next();
};

// Middleware per forzare HTTPS in produzione
export const forceHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    logger.info('Redirecting to HTTPS', { url: req.url, ip: req.ip });
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};