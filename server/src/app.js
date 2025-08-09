import express from 'express';
import helmet from 'helmet';
import { generalLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput, preventNoSQLInjection, limitPayloadSize } from './middleware/validation.js';
import authRoutes from './routes/authRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';

const app = express();

// Middleware di sicurezza
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Errore interno del server'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trovato'
  });
});

export default app;