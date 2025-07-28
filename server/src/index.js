import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './firebaseAdmin.js';
import './mongo.js';
import { auth } from './firebaseAdmin.js';
import authRoutes from './routes/authRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import productRoutes from './routes/productRoutes.js';
import productImportRoutes from './routes/productImportRoutes.js';
import productDuplicateRoutes from './routes/productDuplicateRoutes.js';
import productMatchingRoutes from './routes/productMatching.js';
import supplierRoutes from './routes/supplierRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import logger from './utils/logger.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders, detectSuspiciousActivity, forceHTTPS } from './middleware/security.js';
import { sanitizeInput } from './middleware/validation.js';
import clientLogsRoutes from './routes/clientLogs.js';
import compression from 'compression';
import alertMonitoringService from './services/alertMonitoringService.js';

dotenv.config();

// Gestori globali di errori con Winston
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
    reason: reason,
    promise: promise
  });
  process.exit(1);
});

const app = express();

// Sicurezza: Abilita il trust proxy per l'identificazione corretta dell'IP dietro Nginx
app.set('trust proxy', 1); // 1 = primo hop (il nostro reverse proxy)

// Sicurezza: Forza HTTPS in produzione
app.use(forceHTTPS);

// Sicurezza: Headers di sicurezza
app.use(securityHeaders);

// CORS configurazione sicura
const allowedOrigins = [process.env.FRONTEND_URL];
if (process.env.FRONTEND_URLS) {
  allowedOrigins.push(...process.env.FRONTEND_URLS.split(','));
}

app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza origin (mobile apps, Postman, etc.) solo in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (!origin) {
      logger.warn('Request without origin blocked', { timestamp: new Date().toISOString() });
      return callback(new Error('Origin required'), false);
    }
    
    if (allowedOrigins.indexOf(origin) === -1) {
      logger.warn('CORS policy violation', { origin, allowedOrigins });
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting (applicato prima delle route)
app.use(generalLimiter);

// Middleware di logging con Winston
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Parsing JSON con limite di dimensione
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sicurezza: Sanitizzazione input
app.use(sanitizeInput);

// Sicurezza: Rilevamento attività sospette
app.use(detectSuspiciousActivity);

// Body logging con Winston (solo in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      logger.debug(`Request body for ${req.method} ${req.url}`, {
        body: req.body,
        contentType: req.get('Content-Type')
      });
    }
    next();
  });
}

// Rate limiting specifico per auth
app.use('/api/auth', authLimiter);

// Compressione gzip (aggiungere dopo i middleware di sicurezza)
app.use(compression());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api', invitationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/products/import', productImportRoutes);
app.use('/api/product-duplicates', productDuplicateRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-matching', productMatchingRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/client-logs', clientLogsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.all('*', (req, res) => {
  logger.warn('404 - Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (deve essere l'ultimo)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server listening on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
  
  // Avvia il servizio di monitoraggio alert
  alertMonitoringService.start();
  logger.info('🔔 Alert Monitoring Service avviato');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  
  // Ferma il servizio di monitoraggio
  alertMonitoringService.stop();
  
  server.close(() => {
    logger.info('💥 Process terminated!');
    process.exit(0);
  });
});