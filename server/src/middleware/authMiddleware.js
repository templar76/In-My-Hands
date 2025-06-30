import { auth } from '../firebaseAdmin.js';

export const verifyFirebaseToken = async (req, res, next) => {
  console.log('verifyFirebaseToken: headers.authorization:', req.headers.authorization);
  
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Token mancante o malformato',
      details: 'Formato Authorization header non corretto. Utilizzare: Bearer <token>'
    });
  }

  const idToken = authHeader.split(' ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log('Claims dal token:', JSON.stringify(decodedToken, null, 2));
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      tenantId: decodedToken.tenantId || null,
      role: decodedToken.role || 'operator'
    };
    next();
  } catch (error) {
    console.error('Errore verifica token:', error);
    return res.status(401).json({ 
      error: 'Token non valido o scaduto',
      details: error.message,
      code: error.code
    });
  }
};