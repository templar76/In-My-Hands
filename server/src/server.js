import alertMonitoringService from './services/alertMonitoringService.js';
import productRoutes from './routes/productRoutes.js';
import productImportRoutes from './routes/productImportRoutes.js';
import productDuplicateRoutes from './routes/productDuplicateRoutes.js';
import alertRoutes from './routes/alertRoutes.js';

// ... existing code ...

// Avvia il servizio di monitoraggio alert
alertMonitoringService.start();

// Gestione graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM ricevuto, chiusura graceful...');
  alertMonitoringService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT ricevuto, chiusura graceful...');
  alertMonitoringService.stop();
  process.exit(0);
});

// Routes - ORDINE IMPORTANTE per evitare conflitti
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/suppliers', supplierRoutes);

// Specifico per import (prima delle routes generiche)
app.use('/api/products/import', productImportRoutes);

// Routes per duplicati (specifiche) - NUOVO PERCORSO
app.use('/api/product-duplicates', productDuplicateRoutes);

// Routes generiche prodotti (per ultime)
app.use('/api/products', productRoutes);

// Product matching
app.use('/api/product-matching', productMatching);

// Routes
app.use('/api/alerts', alertRoutes);

// Product matching
app.use('/api/product-matching', productMatching);