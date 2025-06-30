import express from 'express';
import { importProducts, getProductInsights } from '../controllers/productImportController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { loadTenantConfig } from '../middleware/tenantConfig.js';

const router = express.Router();

// Applica middleware di autenticazione e configurazione tenant
router.use(verifyFirebaseToken);
router.use(loadTenantConfig);

// Route per import prodotti
router.post('/import', importProducts);

// Route per insights dashboard
router.get('/insights', getProductInsights);

export default router;