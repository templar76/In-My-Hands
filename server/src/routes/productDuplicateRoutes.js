

import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getDuplicateGroups,
  mergeGroup,
  ignoreGroup
} from '../controllers/productDuplicateController.js';

const router = express.Router();

/**
 * GET /api/product-duplicates
 * Returns all duplicate product groups.
 */
router.get(
  '/',
  verifyFirebaseToken,
  getDuplicateGroups
);

/**
 * POST /api/product-duplicates/:groupId/merge
 * Merge a duplicate group by selecting one canonical product.
 */
router.post(
  '/:groupId/merge',
  verifyFirebaseToken,
  requireAdmin,
  mergeGroup
);

/**
 * POST /api/product-duplicates/:groupId/ignore
 * Mark all items in a duplicate group as ignored.
 */
router.post(
  '/:groupId/ignore',
  verifyFirebaseToken,
  requireAdmin,
  ignoreGroup
);

export default router;