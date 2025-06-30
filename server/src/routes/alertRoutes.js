import express from 'express';
import {
  createAlert,
  getUserAlerts,
  updateAlert,
  deleteAlert,
  toggleAlert,
  testAlert
} from '../controllers/alertController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Tutte le route richiedono autenticazione
router.use(authenticateToken);

// CRUD Operations
router.post('/', createAlert);                    // POST /api/alerts
router.get('/', getUserAlerts);                   // GET /api/alerts
router.put('/:alertId', updateAlert);             // PUT /api/alerts/:alertId
router.delete('/:alertId', deleteAlert);          // DELETE /api/alerts/:alertId

// Operazioni speciali
router.patch('/:alertId/toggle', toggleAlert);    // PATCH /api/alerts/:alertId/toggle
router.post('/:alertId/test', testAlert);         // POST /api/alerts/:alertId/test

export default router;