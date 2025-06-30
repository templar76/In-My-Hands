import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireTenant } from '../middleware/requireTenant.js';
import {
    acceptInvitation,
    checkExistingUser,
    createTenantUser,
    deleteInvitation, // Aggiunto per coerenza sebbene non usato direttamente qui per reinvio
    getTenantInvitations, // Aggiunto per coerenza
    resendInvitation // Aggiunto per la nuova funzionalità
   } from '../controllers/invitationController.js';

const router = express.Router();

// POST /api/invitations/accept 
// Accetta un invito pubblico
router.post('/invitations/accept', acceptInvitation);

// POST /api/tenants/:tenantId/invitations/:invitationId/resend
// Rispedisce un invito. Richiede autenticazione e che l'utente sia admin del tenant.
router.post('/tenants/:tenantId/invitations/:invitationId/resend', 
    verifyFirebaseToken, 
    requireTenant, // Assicura che l'utente appartenga al tenant specificato nella rotta
    requireAdmin, // Assicura che l'utente sia un admin
    resendInvitation
);

export default router;
