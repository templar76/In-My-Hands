import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import {
  getProducts,
  getProductsStats,
  getProductDetails
} from '../controllers/productQueryController.js';
import {
  updateProductPrice
} from '../controllers/productUpdateController.js';

const router = express.Router();

/**
 * @route GET /api/products
 * @desc Get all products with pagination and filters
 * @access Private
 */
router.get('/', verifyFirebaseToken, getProducts);

/**
 * @route GET /api/products/stats
 * @desc Get product statistics
 * @access Private
 */
router.get('/stats', verifyFirebaseToken, getProductsStats);

/**
 * @route GET /api/products/:id
 * @desc Get product details
 * @access Private
 */
router.get('/:id', verifyFirebaseToken, getProductDetails);

/**
 * @route PUT /api/products/price
 * @desc Update product price
 * @access Private
 */
router.put('/price', verifyFirebaseToken, updateProductPrice);

export default router;