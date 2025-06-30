

// server/src/middlewares/requireTenant.js

/**
 * Middleware per verificare che l'utente appartenga al tenant specificato nei params
 * Il middleware presuppone che verifyToken abbia popolato req.user.tenantId
 */
export function requireTenant(req, res, next) {
  console.log('[Middleware Tenant] Richiesto tenant:', req.params.tenantId, 'Utente tenant:', req.user?.tenantId);
  const { tenantId } = req.params;
  if (!req.user || req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Non autorizzato per questo tenant' });
  }
  next();
}