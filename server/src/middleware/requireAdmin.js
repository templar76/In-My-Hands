

import logger from '../utils/logger.js';
import { AuthorizationError } from '../errors/CustomErrors.js';

// server/src/middlewares/requireAdmin.js

/**
 * Middleware per verificare che l'utente abbia il claim 'admin'
 * Il middleware presuppone che verifyToken abbia popolato req.user
 */
export function requireAdmin(req, res, next) {
  logger.debug('Verifica privilegi amministratore', {
    userId: req.user?.uid,
    userRole: req.user?.role,
    middleware: 'requireAdmin'
  });
  if (!req.user || req.user.role !== 'admin') {
    return next(new AuthorizationError(
      'Accesso negato. Privilegi di amministratore richiesti.',
      { requiredRole: 'admin', currentRole: req.user?.role || 'none' }
    ));
  }
  next();
}