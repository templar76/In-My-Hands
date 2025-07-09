import { auth } from '../firebaseAdmin.js';
import logger from '../utils/logger.js';

export const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Token mancante o malformato', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    return res.status(401).json({ 
      error: 'Token mancante o malformato',
      details: 'Formato Authorization header non corretto. Utilizzare: Bearer <token>'
    });
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
    
    logger.debug('Token verificato con successo', {
      uid: decodedToken.uid,
      email: decodedToken.email?.substring(0, 3) + '***',
      tenantId: decodedToken.tenantId
    });
    
    next();
  } catch (error) {
    logger.error('Errore verifica token', {
      error: error.message,
      code: error.code,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({ 
      error: 'Token non valido o scaduto',
      details: 'Autenticazione fallita'
    });
  }
};