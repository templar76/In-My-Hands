

// server/src/middlewares/requireAdmin.js

/**
 * Middleware per verificare che l'utente abbia il claim 'admin'
 * Il middleware presuppone che verifyToken abbia popolato req.user
 */
export function requireAdmin(req, res, next) {
  console.log('[Middleware Admin] Utente:', req.user?.uid, 'Ruolo:', req.user?.role);
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato. Privilegi di amministratore richiesti.' });
  }
  next();
}