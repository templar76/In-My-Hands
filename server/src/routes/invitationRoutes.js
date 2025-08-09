import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { authLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import {
  validateAcceptInvitation,
  validateCreateInvitation,
  validateTenantInvitationParams,
  validateCheckExistingUser,
  validateCreateTenantUser,
  validateInvitationConsistency,
  validateInvitationLimits
} from '../middleware/invitationValidation.js';
import {
    acceptInvitation,
    checkExistingUser,
    createTenantUser,
    deleteInvitation,
    getTenantInvitations,
    resendInvitation
} from '../controllers/invitationController.js';

const router = express.Router();

// POST /api/invitations/accept 
// Accetta un invito pubblico
router.post('/invitations/accept', 
  authLimiter,
  validateAcceptInvitation,
  acceptInvitation
);

// POST /api/tenants/:tenantId/invitations/:invitationId/resend
// Rispedisce un invito. Richiede autenticazione e che l'utente sia admin del tenant.
router.post('/tenants/:tenantId/invitations/:invitationId/resend', 
  authLimiter,
  verifyFirebaseToken, 
  requireTenant, 
  requireAdmin,
  validateTenantInvitationParams,
  validateInvitationConsistency,
  resendInvitation
);

// GET /api/tenants/:tenantId/invitations
// Recupera tutti gli inviti di un tenant
router.get('/tenants/:tenantId/invitations',
  generalLimiter,
  verifyFirebaseToken,
  requireTenant,
  requireAdmin,
  validateTenantInvitationParams,
  validateInvitationConsistency,
  getTenantInvitations
);

// POST /api/tenants/:tenantId/invitations
// Crea un nuovo invito per il tenant
router.post('/tenants/:tenantId/invitations',
  authLimiter,
  verifyFirebaseToken,
  requireTenant,
  requireAdmin,
  validateTenantInvitationParams,
  validateCreateInvitation,
  validateInvitationConsistency,
  validateInvitationLimits,
  createTenantUser
);

// DELETE /api/tenants/:tenantId/invitations/:invitationId
// Elimina un invito
router.delete('/tenants/:tenantId/invitations/:invitationId',
  generalLimiter,
  verifyFirebaseToken,
  requireTenant,
  requireAdmin,
  validateTenantInvitationParams,
  validateInvitationConsistency,
  deleteInvitation
);

// POST /api/invitations/check-existing-user
// Verifica se un utente esiste già
router.post('/invitations/check-existing-user',
  generalLimiter,
  verifyFirebaseToken,
  validateCheckExistingUser,
  checkExistingUser
);

export default router;
