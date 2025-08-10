import express from 'express';
import helmet from 'helmet';
import { generalLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput, preventNoSQLInjection, limitPayloadSize } from './middleware/validation.js';
import authRoutes from './routes/authRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import { 
  errorHandler, 
  notFoundHandler, 
  correlationIdMiddleware,
  setupGlobalErrorHandlers 
} from './middleware/errorHandler.js';
import { attachResponseUtils } from './utils/responseUtils.js';

const app = express();

// Setup global error handlers
setupGlobalErrorHandlers();

// Middleware di correlazione per tracking errori
app.use(correlationIdMiddleware);

// Middleware di sicurezza
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach response utilities
app.use(attachResponseUtils);

// Middleware di validazione globale
app.use(limitPayloadSize(10 * 1024 * 1024)); // 10MB limit
app.use(sanitizeInput);
app.use(preventNoSQLInjection);
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/alerts', alertRoutes);

// 404 handler (deve essere prima dell'error handler)
app.use('*', notFoundHandler);

// Centralized error handling middleware (deve essere l'ultimo)
app.use(errorHandler);

export default app;