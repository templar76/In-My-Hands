import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './firebaseAdmin.js';           // inizializza Admin SDK
import './mongo.js';
import { auth } from './firebaseAdmin.js';
import authRoutes from './routes/authRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import productRoutes from './routes/productRoutes.js'; // AGGIUNTA: Import delle rotte principali dei prodotti
import productImportRoutes from './routes/productImportRoutes.js';
import productDuplicateRoutes from './routes/productDuplicateRoutes.js';
import productMatchingRoutes from './routes/productMatching.js';
import supplierRoutes from './routes/supplierRoutes.js';

dotenv.config();

// Gestori globali di errori
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(error.name, error.message);
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(reason);
  // In futuro, potresti voler chiudere il server qui in modo più controllato
  // server.close(() => {
  //   process.exit(1);
  // });
  process.exit(1); // Per ora, usciamo direttamente
});

const app = express();

const allowedOrigins = [process.env.FRONTEND_URL];
if (process.env.FRONTEND_URLS) {
  // Se FRONTEND_URLS contiene più URL separati da virgola
  // allowedOrigins.push(...process.env.FRONTEND_URLS.split(','));
  // Per ora, assumendo che FRONTEND_URLS sia un singolo URL o una lista gestita diversamente
  allowedOrigins.push(process.env.FRONTEND_URLS);
}

app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza origin (come mobile apps o curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });


app.use(express.json());
app.use((req, res, next) => {
  // Log req.body solo per metodi che tipicamente hanno un corpo
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Usare JSON.stringify per una migliore visualizzazione di oggetti e undefined
    console.log(`[Global Body Logger] Parsed req.body for ${req.method} ${req.url}:`, JSON.stringify(req.body));
  }
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api', invitationRoutes);

// ORDINE IMPORTANTE per evitare conflitti
// Specifico per import (prima delle routes generiche)
app.use('/api/products/import', productImportRoutes);  // ✅ CORRETTO

// Routes per duplicati (specifiche)
app.use('/api/product-duplicates', productDuplicateRoutes);

// Routes generiche prodotti (per ultime)
app.use('/api/products', productRoutes);

// Product matching system
app.use('/api/product-matching', productMatchingRoutes);

// Supplier analytics routes
app.use('/api/suppliers', supplierRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// Aggiungiamo un gestore per SIGTERM per un graceful shutdown (opzionale ma buona pratica)
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});

// Aggiungi dopo i middleware esistenti
app.use((err, req, res, next) => {
  console.error('Errore:', err.stack);
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message 
  });
});
app.use('/api/invoices', invoiceRoutes);