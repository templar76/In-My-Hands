

// server/src/middlewares/requireTenant.js

/**
 * Middleware per verificare che l'utente appartenga al tenant specificato nei params
 * Il middleware presuppone che verifyToken abbia popolato req.user.tenantId
 */
import logger from '../utils/logger.js';

export function requireTenant(req, res, next) {
  logger.debug('Verifica autorizzazione tenant', {
    requestedTenant: req.params.tenantId,
    userTenant: req.user?.tenantId,
    userId: req.user?.uid,
    middleware: 'requireTenant'
  });
  const { tenantId } = req.params;
  if (!req.user || req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Non autorizzato per questo tenant' });
  }
  next();
}