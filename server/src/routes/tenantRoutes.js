import express from 'express';
import { registerTenant } from '../controllers/tenantController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
 createTenantUser,
 checkExistingUser,
 deleteInvitation // Importa la funzione per eliminare l'invito
} from '../controllers/invitationController.js';
import { getTenantUsers, updateUserRoleInTenant } from '../controllers/tenantController.js';
import { getTenantInvitations } from '../controllers/invitationController.js'; // Importa la nuova funzione

const router = express.Router();

// Public: register new tenant + admin
router.post('/', registerTenant);

// Protected: GET /api/tenants/:tenantId/users - Recupera tutti gli utenti di un tenant
router.get(
  '/:tenantId/users',
  verifyFirebaseToken,
  requireAdmin, // o requireTenant a seconda della logica di business desiderata
  requireTenant, // Assicura che l'admin appartenga al tenant richiesto o sia un superadmin
  getTenantUsers
);

// Protected: get tenant info (example)
router.get('/:tenantId', verifyFirebaseToken, requireTenant, async (req, res) => {
  const tenantId = req.params.tenantId;
  // You can fetch and return tenant data
  const tenant = await import('../models/Tenant.js').then(m => m.default.findById(tenantId));
  return res.json(tenant);
});

// POST /api/tenants/:tenantId/users - Crea un utente nel tenant (admin del tenant)
router.post(
  '/:tenantId/users',
  (req, res, next) => {
    console.log('[tenantRoutes] Before verifyFirebaseToken - req.body:', JSON.stringify(req.body));
    next();
  },
  verifyFirebaseToken,
  (req, res, next) => {
    console.log('[tenantRoutes] After verifyFirebaseToken, Before requireAdmin - req.body:', JSON.stringify(req.body));
    console.log('[tenantRoutes] After verifyFirebaseToken, Before requireAdmin - req.user:', JSON.stringify(req.user));
    next();
  },
  requireAdmin,
  (req, res, next) => {
    console.log('[tenantRoutes] After requireAdmin, Before requireTenant - req.body:', JSON.stringify(req.body));
    next();
  },
  requireTenant,
  (req, res, next) => {
    console.log('[tenantRoutes] After requireTenant, Before createTenantUser - req.body:', JSON.stringify(req.body));
    next();
  },
  createTenantUser
);

// GET /api/tenants/:tenantId/users/check - Verifica esistenza utente nel tenant (admin del tenant)
router.get(
  '/:tenantId/users/check',
  verifyFirebaseToken,
  requireAdmin, // Mantenendo requireAdmin come da invitationRoutes originale
  // requireTenant, // Opzionalmente aggiungere se la logica lo richiede
  checkExistingUser
);

// Protected: GET /api/tenants/:tenantId/invitations - Recupera tutti gli inviti per un tenant
router.get(
  '/:tenantId/invitations',
  verifyFirebaseToken,
  requireAdmin,
  requireTenant,
  getTenantInvitations
);

// Protected: PUT /api/tenants/:tenantId/users/:userId/role - Aggiorna il ruolo di un utente nel tenant
router.put(
  '/:tenantId/users/:userId/role',
  verifyFirebaseToken,
  requireAdmin,
  requireTenant,
  updateUserRoleInTenant
);

// Protected: DELETE /api/tenants/:tenantId/invitations/:invitationId - Elimina un invito specifico
router.delete(
  '/:tenantId/invitations/:invitationId',
  verifyFirebaseToken,
  requireAdmin,
  requireTenant,
  deleteInvitation
);

export default router;