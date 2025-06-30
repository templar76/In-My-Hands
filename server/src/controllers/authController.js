import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import TenantRegistrationToken from '../models/TenantRegistrationToken.js'; // Importa il nuovo modello
import { auth } from '../firebaseAdmin.js';
import nodemailer from 'nodemailer';
import { validationResult } from 'express-validator';
import Subscription from '../models/Subscription.js';
import crypto from 'crypto'; // Per generare il token

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'; // Assicurati che CLIENT_URL sia configurato nel .env

// Fase 1: Inizia la registrazione del tenant, invia email con token
export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, plan = 'free' } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Un utente con questa email esiste già.' });
    }

    const existingToken = await TenantRegistrationToken.findOne({ email });
    if (existingToken) {
      return res.status(400).json({ error: 'Una richiesta di registrazione per questa email è già in corso.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await TenantRegistrationToken.create({
      email,
      token,
      plan,
      expiresAt,
    });

    const completeRegistrationLink = `${CLIENT_URL}/complete-tenant-registration?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"In My Hands" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Completa la registrazione del tuo Tenant su In My Hands',
      html: `
        <p>Ciao,</p>
        <p>Grazie per aver iniziato la registrazione del tuo tenant su In My Hands.</p>
        <p>Per completare la registrazione, clicca sul seguente link:</p>
        <p><a href="${completeRegistrationLink}">${completeRegistrationLink}</a></p>
        <p>Questo link scadrà tra 24 ore.</p>
        <p>Se non hai richiesto tu questa registrazione, puoi ignorare questa email.</p>
      `,
    });

    return res.status(200).json({ message: 'Email di conferma inviata. Controlla la tua casella di posta per completare la registrazione.' });

  } catch (err) {
    console.error('Error in initiateTenantRegistration:', err);
    return res.status(500).json({ error: 'Errore interno del server durante l\'avvio della registrazione.' });
  }
};

// Fase 2: Completa la registrazione del tenant usando il token
export const completeTenantRegistration = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { 
    token,
    companyType, companyName, vatNumber, address,
    contacts: { email: companyEmail, phone, sdiCode, pec },
    metadata,
    admin: { displayName, password }
  } = req.body;

  try {
    const registrationToken = await TenantRegistrationToken.findOne({ token });
    if (!registrationToken) {
      return res.status(400).json({ error: 'Token di registrazione non valido o scaduto.' });
    }
    if (registrationToken.expiresAt < new Date()) {
      await TenantRegistrationToken.deleteOne({ token });
      return res.status(400).json({ error: 'Token di registrazione scaduto.' });
    }

    const adminEmail = registrationToken.email;
    const plan = registrationToken.plan;

    const existingUserInMongo = await User.findOne({ email: adminEmail });
    if (existingUserInMongo) {
      return res.status(409).json({ error: 'Un utente con questa email è già registrato nel sistema.' });
    }

    const existingTenantByVat = await Tenant.findOne({ vatNumber });
    if (existingTenantByVat) {
      return res.status(409).json({ error: 'Un tenant con questa Partita IVA è già registrato.' });
    }

    const tenant = await Tenant.create({
      companyType, companyName, vatNumber, address,
      contacts: { email: companyEmail, phone, sdiCode, pec },
      metadata
    });

    const startDate = new Date();
    const subscriptionInput = req.body.subscription || {};
    const trialDays = (plan === 'free' ? 365 : 0);
    const trialEndsAt = trialDays
      ? new Date(startDate.getTime() + trialDays * 24 * 3600 * 1000)
      : undefined;
    const renewalAt = plan === 'annual'
      ? new Date(startDate.getTime() + 365 * 24 * 3600 * 1000)
      : plan === 'monthly'
        ? new Date(startDate.getTime() + 30 * 24 * 3600 * 1000)
        : undefined;
    const subscription = await Subscription.create({
      tenantId: tenant._id,
      plan,
      status: 'active',
      startDate,
      trialEndsAt,
      renewalAt
    });

    let userRecord;
    if (!password) {
      return res.status(400).json({ error: 'La password per l\'utente admin è obbligatoria.' });
    }

    try {
      userRecord = await auth.createUser({
        email: adminEmail,
        password: password,
        displayName: displayName
      });
      console.log(`New Firebase user created for admin. UID: ${userRecord.uid}`);
    } catch (firebaseError) {
      if (firebaseError.code === 'auth/email-already-exists') {
        console.error(`Firebase user with email ${adminEmail} already exists, though TenantRegistrationToken was present.`);
        return res.status(409).json({ error: 'Un utente Firebase con questa email esiste già. Contatta il supporto.' });
      }
      console.error('Error creating Firebase user:', firebaseError);
      throw firebaseError;
    }

    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: tenant._id.toString(),
      role: 'admin'
    });

    let newUser;
    try {
      const userData = {
        uid: userRecord.uid,
        tenantId: tenant._id,
        email: adminEmail,
        displayName: displayName,
        role: 'admin'
      };
      newUser = await User.create(userData);
      console.log(`New user created in MongoDB. UID: ${newUser.uid}`);
    } catch (mongoError) {
      console.error('Error saving user in MongoDB:', mongoError);
      throw mongoError;
    }

    await TenantRegistrationToken.deleteOne({ token });

    return res.status(201).json({
      message: 'Registrazione completata con successo.',
      tenantId: tenant._id,
      adminUid: userRecord.uid
    });
  } catch (err) {
    console.error('Error in completeTenantRegistration:', err);
    return res.status(500).json({ error: 'Errore interno del server durante il completamento della registrazione.' });
  }
};




export const getMe = async (req, res) => {
  console.log('authController - getMe: START. req.user:', JSON.stringify(req.user, null, 2));
  try {
    // req.user è impostato dal middleware verifyFirebaseToken
    const user = await User.findOne({ uid: req.user.uid }).lean(); // .lean() per un oggetto JS semplice
    console.log('authController - getMe: User found in DB:', JSON.stringify(user, null, 2));
    if (!user) {
      console.error('authController - getMe: User not found in local DB for UID:', req.user.uid);
      return res.status(404).json({ error: 'Utente non trovato nel database locale.' });
    }

    let companyName = null;
    let tenantDetailsForPayload = null; // Variabile per contenere l'oggetto tenant completo o solo companyName
    if (user.tenantId) {
      console.log(`authController - getMe: User has tenantId: ${user.tenantId}. Fetching tenant details.`);
      const tenant = await Tenant.findById(user.tenantId).select('companyName companyType').lean(); // Seleziona i campi necessari
      if (tenant) {
        console.log('authController - getMe: Tenant found:', JSON.stringify(tenant, null, 2));
        companyName = tenant.companyName;
        tenantDetailsForPayload = tenant; // Invia l'oggetto tenant con companyName e companyType
      } else {
        console.log('authController - getMe: Tenant NOT found for tenantId:', user.tenantId);
      }
    } else {
      console.log('authController - getMe: User does NOT have a tenantId.');
    }

    // Restituisci i dati dell'utente, inclusi tenantId e role
    // Questi dovrebbero provenire dal DB locale che è la fonte di verità dopo la registrazione/login iniziale
    const responsePayload = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      tenantId: user.tenantId, // Assicurati che questo sia popolato correttamente
      role: user.role, // Assicurati che questo sia popolato correttamente
      // companyName: companyName, // companyName è ora dentro tenant
      tenant: tenantDetailsForPayload, // Includi i dettagli del tenant (companyName, companyType)
      // Aggiungi altri campi necessari, es. subscription details se memorizzati in User
    };
    console.log('authController - getMe: Sending responsePayload:', JSON.stringify(responsePayload, null, 2));
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Errore in getMe:', error);
    return res.status(500).json({ error: 'Errore nel recupero del profilo utente.' });
  }
};



// Funzione per aggiornare il profilo utente (es. displayName)
export const changePassword = async (req, res) => {
  const { newPassword } = req.body;
  const uid = req.user.uid; // uid dall'utente autenticato tramite verifyFirebaseToken

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'La nuova password deve essere di almeno 6 caratteri.' });
  }

  try {
    await auth.updateUser(uid, {
      password: newPassword,
    });
    // Non è necessario aggiornare l'utente in MongoDB qui a meno che non si memorizzi l'hash della password,
    // il che non è raccomandato quando si usa Firebase Auth.
    return res.status(200).json({ message: 'Password aggiornata con successo.' });
  } catch (error) {
    console.error('Errore durante l\'aggiornamento della password in Firebase:', error);
    // Mappa i codici di errore di Firebase a messaggi più user-friendly se necessario
    let errorMessage = 'Errore durante l\'aggiornamento della password.';
    if (error.code === 'auth/weak-password') {
      errorMessage = 'La password fornita è troppo debole.';
    }
    // Altri codici di errore specifici di Firebase potrebbero essere gestiti qui
    return res.status(500).json({ message: errorMessage, error: error.message });
  }
};

export const updateUserProfile = async (req, res) =>{
  const { uid } = req.params; // UID dalla rotta
  const authenticatedUserUid = req.user.uid; // UID dal token
  const { displayName } = req.body; // displayName dal client

  console.log(`[updateUserProfile] Received request to update UID: ${uid}. Authenticated UID: ${authenticatedUserUid}`);
  console.log(`[updateUserProfile] Received displayName from client: "${displayName}"`);

  // Verifica che l'utente stia modificando il proprio profilo
  if (uid !== authenticatedUserUid) {
    return res.status(403).json({ error: 'Non autorizzato a modificare questo profilo utente.' });
  }

  const trimmedDisplayName = displayName.trim();
  console.log(`[updateUserProfile] Trimmed displayName: "${trimmedDisplayName}"`);

  // La validazione di displayName è già fatta nella rotta con express-validator.
  // Se il middleware di validazione passa, trimmedDisplayName non dovrebbe essere vuoto.

  try {
    // Aggiorna in MongoDB
    const updatedUserFromDB = await User.findOneAndUpdate(
      { uid: authenticatedUserUid },
      { $set: { displayName: trimmedDisplayName } }, // Usa trimmedDisplayName
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUserFromDB) {
      console.error(`[updateUserProfile] User not found in DB for UID: ${authenticatedUserUid}`);
      return res.status(404).json({ error: 'Utente non trovato nel database.' });
    }
    console.log(`[updateUserProfile] User updated in DB. New displayName: "${updatedUserFromDB.displayName}"`);

    // Aggiorna in Firebase Authentication
    await auth.updateUser(authenticatedUserUid, {
      displayName: trimmedDisplayName // Usa trimmedDisplayName
    });
    console.log(`[updateUserProfile] User updated in Firebase Auth. UID: ${authenticatedUserUid}`);

    // Prepara la risposta, includendo i dettagli del tenant per coerenza con getMe
    let tenantDetailsForPayload = null;
    if (updatedUserFromDB.tenantId) {
      const tenant = await Tenant.findById(updatedUserFromDB.tenantId).select('companyName companyType').lean();
      if (tenant) {
        tenantDetailsForPayload = tenant;
      }
    }
    
    const responseUser = {
        uid: updatedUserFromDB.uid,
        email: updatedUserFromDB.email,
        displayName: updatedUserFromDB.displayName,
        tenantId: updatedUserFromDB.tenantId,
        role: updatedUserFromDB.role,
        tenant: tenantDetailsForPayload // Includi l'oggetto tenant come in getMe
    };

    console.log('[updateUserProfile] Sending response:', JSON.stringify({ user: responseUser }, null, 2));
    return res.status(200).json({ user: responseUser });
  } catch (error) {
    console.error('[updateUserProfile] Error:', error);
    if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'Utente non trovato in Firebase Authentication.' });
    }
    return res.status(500).json({ error: 'Errore interno del server durante l\'aggiornamento del profilo.' });
  }
};

/**
 * POST /api/auth/admin/:uid
 * Imposta il ruolo ('operator' o 'admin') di un utente (solo admin)
 */
export const setAdminRole = async (req, res) => {
  const targetUid = req.params.uid;
  const { role } = req.body;
  if (!['operator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ruolo non valido' });
  }
  try {
    // Imposto i custom claims su Firebase Auth
    const claims = { role };
    if (req.user.tenantId) {
      claims.tenantId = req.user.tenantId;
    }
    await auth.setCustomUserClaims(targetUid, claims);
    // Aggiorno il ruolo nel profilo MongoDB
    await User.findOneAndUpdate({ uid: targetUid }, { role }, { new: true });
    return res.json({ uid: targetUid, role });
  } catch (err) {
    console.error('setAdminRole error:', err);
    return res.status(500).json({ error: err.message });
  }
};
