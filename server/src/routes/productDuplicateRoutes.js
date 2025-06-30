

import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { param, validationResult } from 'express-validator';
import {
  getDuplicateGroups,
  mergeGroup,
  ignoreGroup
} from '../controllers/productDuplicateController.js';

const router = express.Router();

// middleware to validate that :groupId is a valid MongoDB ObjectId
const validateGroupId = [
  param('groupId')
    .isMongoId()
    .withMessage('Invalid format for groupId'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

/**
 * GET /api/products/duplicates
 * Returns all duplicate product groups.
 */
router.get(
  '/duplicates',
  verifyFirebaseToken,
  getDuplicateGroups
);

/**
 * POST /api/products/duplicates/:groupId/merge
 * Merge a duplicate group by selecting one canonical product.
 */
router.post(
  '/duplicates/:groupId/merge',
  verifyFirebaseToken,
  validateGroupId,
  requireAdmin,
  mergeGroup
);

/**
 * POST /api/products/duplicates/:groupId/ignore
 * Mark all items in a duplicate group as ignored.
 */
router.post(
  '/duplicates/:groupId/ignore',
  verifyFirebaseToken,
  validateGroupId,
  requireAdmin,
  ignoreGroup
);

export default router;