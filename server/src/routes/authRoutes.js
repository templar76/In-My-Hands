import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { getMe, setAdminRole, register, completeTenantRegistration, updateUserProfile, changePassword, login } from '../controllers/authController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { authLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import {
  validateRegistration,
  validateTenantRegistration,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateAdminRole
} from '../middleware/authValidation.js';
import { fetchCompanyData } from '../controllers/openapiCompanyController.js';

const router = express.Router();

// POST /api/auth/register -> Inizia la registrazione del tenant (Fase 1: invia email con token)
router.post(
  '/register',
  authLimiter,
  validateRegistration,
  register
);

// POST /api/auth/registerCompany -> crea azienda, subscription e admin
// Rinominato /registerCompany in /register-full per chiarezza, o potrebbe essere rimosso/deprecato
// se il flusso a due passaggi diventa l'unico metodo.
// Per ora lo lascio ma lo faccio puntare a completeTenantRegistration, 
// assumendo che il client invii un payload completo che include un token fittizio o gestito diversamente.
// ATTENZIONE: Questo potrebbe richiedere aggiustamenti in completeTenantRegistration per gestire l'assenza di un vero token.
// Una soluzione migliore sarebbe deprecare /registerCompany o adattarlo specificamente.
// Per questo esercizio, lo commento per evitare confusione, privilegiando il nuovo flusso a due step.
/*
router.post(
  '/registerCompany', // Endpoint precedente, ora gestito da completeTenantRegistration
  [ // Le validazioni qui dovrebbero corrispondere a quelle di completeTenantRegistration
    body('companyType').notEmpty(),
    body('companyName').notEmpty(),
    body('vatNumber').notEmpty(),
    body('address').notEmpty(),
    body('contacts.email').isEmail(),
    body('contacts.phone').notEmpty(),
    body('contacts.sdiCode').notEmpty(),
    body('contacts.pec').isEmail(),
    body('admin.displayName').notEmpty(),
    body('admin.email').isEmail(),
    body('admin.role').equals('admin')
    // subscription.plan e trialDays non sono più qui, vengono dal token o fissi
  ],
  completeTenantRegistration // Modificato per usare la nuova funzione per la Fase 2
);
*/

// POST /api/auth/complete-tenant-registration -> Completa la registrazione del tenant (Fase 2)
router.post(
  '/complete-tenant-registration',
  authLimiter,
  validateTenantRegistration,
  completeTenantRegistration
);

// POST /api/auth/login -> Sets custom claims after client-side login
router.post('/login', authLimiter, validateLogin, login);

// GET /api/auth/me -> dati profilo (autenticazione richiesta)
router.get('/me', verifyFirebaseToken, getMe);

// POST /api/auth/admin/:uid -> imposta ruolo (solo admin)
router.post(
  '/admin/:uid',
  generalLimiter,
  verifyFirebaseToken,
  requireAdmin,
  validateAdminRole,
  setAdminRole
);

// PUT /api/auth/users/:uid/profile -> aggiorna il profilo utente (es. displayName)
router.put(
  '/users/:uid/profile',
  generalLimiter,
  verifyFirebaseToken,
  validateProfileUpdate,
  updateUserProfile
);

// POST /api/auth/users/change-password -> cambia la password dell'utente autenticato
router.post(
  '/users/change-password',
  authLimiter,
  verifyFirebaseToken,
  validatePasswordChange,
  changePassword
);

// Nuova route
// Rimuovi: const { fetchCompanyData } = require('../controllers/openapiCompanyController');
router.get('/fetch-company-data', fetchCompanyData);

export default router;