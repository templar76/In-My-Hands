import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { getMe, setAdminRole, register, completeTenantRegistration, updateUserProfile, changePassword, login } from '../controllers/authController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { body, validationResult } from 'express-validator';
import { fetchCompanyData } from '../controllers/openapiCompanyController.js';

const router = express.Router();

// POST /api/auth/register -> Inizia la registrazione del tenant (Fase 1: invia email con token)
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Deve essere un indirizzo email valido.'),
    body('plan').optional().isIn(['free', 'monthly', 'annual']).withMessage('Piano non valido.')
  ],
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
  [
    body('token').notEmpty().withMessage('Il token è obbligatorio.'),
    body('companyType').notEmpty().withMessage('Il tipo di azienda è obbligatorio.'),
    body('companyName').notEmpty().withMessage('Il nome dell\'azienda è obbligatorio.'),
    body('vatNumber').notEmpty().withMessage('La Partita IVA è obbligatoria.'),
    body('codiceFiscale').notEmpty().withMessage('Il Codice Fiscale è obbligatorio.'), // Aggiungi questa riga
    body('address').notEmpty().withMessage('L\'indirizzo è obbligatorio.'),
    body('contacts.email').isEmail().withMessage('L\'email di contatto dell\'azienda deve essere valida.'),
    body('contacts.phone').notEmpty().withMessage('Il telefono di contatto dell\'azienda è obbligatorio.'),
    body('contacts.sdiCode').notEmpty().withMessage('Il codice SDI è obbligatorio.'),
    body('contacts.pec').isEmail().withMessage('La PEC deve essere un indirizzo email valido.'),
    body('admin.displayName').notEmpty().withMessage('Il nome visualizzato dell\'admin è obbligatorio.'),
    body('admin.password').isLength({ min: 6 }).withMessage('La password deve essere di almeno 6 caratteri.')
  ],
  completeTenantRegistration
);

// POST /api/auth/login -> Sets custom claims after client-side login
router.post('/login', login);

// GET /api/auth/me -> dati profilo (autenticazione richiesta)
router.get('/me', verifyFirebaseToken, getMe);

// POST /api/auth/admin/:uid -> imposta ruolo (solo admin)
router.post(
  '/admin/:uid',
  verifyFirebaseToken,
  requireAdmin,
  setAdminRole
);

// PUT /api/auth/users/:uid/profile -> aggiorna il profilo utente (es. displayName)
router.put(
  '/users/:uid/profile', // La rotta è /api/auth/users/:uid/profile
  verifyFirebaseToken,
  [
    body('displayName').notEmpty().trim().withMessage('Il displayName è obbligatorio e non può essere vuoto.')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  updateUserProfile
);

// POST /api/auth/users/change-password -> cambia la password dell'utente autenticato
router.post(
  '/users/change-password',
  verifyFirebaseToken,
  [
    body('newPassword').isLength({ min: 6 }).withMessage('La nuova password deve essere di almeno 6 caratteri.')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Non è necessario controllare currentPassword qui perché Firebase Admin SDK non la richiede per l'aggiornamento.
    // La logica di Firebase gestisce la sicurezza dell'operazione basandosi sull'autenticazione dell'utente (via token).
    next();
  },
  changePassword
);

// Nuova route
// Rimuovi: const { fetchCompanyData } = require('../controllers/openapiCompanyController');
router.get('/fetch-company-data', fetchCompanyData);

export default router;