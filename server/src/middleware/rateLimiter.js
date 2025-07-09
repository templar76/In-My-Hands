import rateLimit from 'express-rate-limit';

// Rate limiter generale
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // max 100 richieste per IP
  message: 'Troppe richieste da questo IP, riprova più tardi.'
});

// Rate limiter per autenticazione
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // max 5 tentativi di login
  skipSuccessfulRequests: true
});

// Rate limiter per upload
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10 // max 10 upload al minuto
});