import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { loadTenantConfig, requirePhase, requireTenantAdmin } from '../middleware/tenantConfig.js';
import {
  getTenantConfig,
  updatePhaseConfig,
  togglePhase,
  getPhaseStats,
  resetConfig
} from '../controllers/tenantConfigController.js';
import {
  getPendingReviews,
  getUnmatchedProducts,
  approveMatch,
  rejectMatch,
  createProductFromLine,
  searchSimilarProducts,
  getReviewStats
} from '../controllers/manualReviewController.js';

const router = express.Router();

// Middleware per tutte le route
router.use(verifyFirebaseToken);
router.use(loadTenantConfig);

// === TENANT CONFIGURATION ROUTES ===

// Get current tenant configuration
router.get('/config', getTenantConfig);

// Update specific phase configuration (admin only)
router.put('/config/phase/:phaseNumber', requireTenantAdmin, updatePhaseConfig);

// Toggle phase on/off (admin only)
router.post('/config/phase/:phaseNumber/toggle', requireTenantAdmin, togglePhase);

// Get phase statistics
router.get('/config/stats', getPhaseStats);

// Reset configuration to defaults (admin only)
router.post('/config/reset', requireTenantAdmin, resetConfig);

// === MANUAL REVIEW ROUTES (PHASE 1 & 2) ===

// Get pending reviews for Phase 1 (product matching)
router.get('/reviews/pending', requirePhase('phase1'), getPendingReviews);

// Get unmatched products for Phase 2 (new product creation)
router.get('/reviews/unmatched', requirePhase('phase2'), getUnmatchedProducts);

// Approve a product match (Phase 1)
router.post('/reviews/:reviewId/approve', requirePhase('phase1'), approveMatch);

// Reject a product match (Phase 1)
router.post('/reviews/:reviewId/reject', requirePhase('phase1'), rejectMatch);

// Create new product from unmatched line (Phase 2)
router.post('/reviews/:reviewId/create-product', requirePhase('phase2'), createProductFromLine);

// Search for similar products (helper for manual review)
router.get('/search/similar', searchSimilarProducts);

// Get manual review statistics
router.get('/reviews/stats', getReviewStats);

// === PHASE 3 ROUTES (Future Implementation) ===
// These routes will be implemented when Phase 3 (ML-based matching) is developed

// Train ML model (admin only)
// router.post('/ml/train', requireTenantAdmin, requirePhaseEnabled(3), trainMLModel);

// Get ML model status
// router.get('/ml/status', requirePhaseEnabled(3), getMLModelStatus);

// Update ML model parameters (admin only)
// router.put('/ml/parameters', requireTenantAdmin, requirePhaseEnabled(3), updateMLParameters);

export default router;