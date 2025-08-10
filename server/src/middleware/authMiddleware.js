import { auth } from '../firebaseAdmin.js';
import logger from '../utils/logger.js';
import { AuthenticationError } from '../errors/CustomErrors.js';

export const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Token mancante o malformato', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    return next(new AuthenticationError(
      'Token mancante o malformato',
      { expectedFormat: 'Bearer <token>' }
    ));
  }

  const idToken = authHeader.split(' ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      tenantId: decodedToken.tenantId || null,
      role: decodedToken.role || 'operator'
    };
    
    logger.info('Token verificato con successo', {
      uid: decodedToken.uid,
      email: decodedToken.email?.substring(0, 3) + '***',
      tenantId: decodedToken.tenantId,
      role: decodedToken.role,
      customClaims: {
        hasTenantId: !!decodedToken.tenantId,
        hasRole: !!decodedToken.role,
        allClaims: Object.keys(decodedToken)
      }
    });
    
    next();
  } catch (error) {
    logger.error('Errore verifica token', {
      error: error.message,
      code: error.code,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return next(new AuthenticationError(
      'Token non valido o scaduto',
      { originalError: error.code }
    ));
  }
};