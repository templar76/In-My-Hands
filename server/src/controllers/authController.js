import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import TenantRegistrationToken from '../models/TenantRegistrationToken.js';
import { auth } from '../firebaseAdmin.js';
import nodemailer from 'nodemailer';
import { validationResult } from 'express-validator';
import Subscription from '../models/Subscription.js';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  BusinessLogicError,
  ExternalServiceError
} from '../errors/CustomErrors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendCreated, sendError } from '../utils/responseUtils.js';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'; // Assicurati che CLIENT_URL sia configurato nel .env

// ✅ Configura il transporter SMTP centralizzato (come in invitationController)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Fase 1: Inizia la registrazione del tenant, invia email con token
// ✅ Usa FRONTEND_URL invece di CLIENT_URL per coerenza
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const register = asyncHandler(async (req, res) => {
  const { email, plan = 'free' } = req.body;

  // ✅ Log delle variabili SMTP per debugging (senza bloccare)
  logger.debug('Configurazione SMTP', {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpFrom: process.env.SMTP_FROM,
    smtpFromLength: process.env.SMTP_FROM?.length
  });

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('Un utente con questa email esiste già.', { email });
  }

  const existingToken = await TenantRegistrationToken.findOne({ email });
  if (existingToken) {
    throw new ConflictError('Una richiesta di registrazione per questa email è già in corso.', { email });
  }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await TenantRegistrationToken.create({
      email,
      token,
      plan,
      expiresAt,
    });

    // ✅ Cambia questa riga
    const completeRegistrationLink = `${FRONTEND_URL}/complete-tenant-registration?token=${token}`;
    
    // ✅ Aggiungi logging per debug
    logger.debug('Link di registrazione generato', {
      frontendUrl: FRONTEND_URL,
      completeLink: completeRegistrationLink,
      token: token.substring(0, 8) + '...'
    });

    // ✅ Gestione errori specifica per l'invio email
    try {
      const emailResult = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Completa la registrazione del tuo Tenant su In My Hands',
        // ✅ Aggiungi envelope per specificare il mittente del Return-Path
        envelope: {
          from: process.env.SMTP_USER, // Usa l'indirizzo SMTP_USER come mittente
          to: email
        },
        html: `
          <p>Ciao,</p>
          <p>Grazie per aver iniziato la registrazione del tuo tenant su In My Hands.</p>
          <p>Per completare la registrazione, clicca sul seguente link:</p>
          <p><a href="${completeRegistrationLink}">${completeRegistrationLink}</a></p>
          <p>Questo link scadrà tra 24 ore.</p>
          <p>Se non hai richiesto tu questa registrazione, puoi ignorare questa email.</p>
        `,
      });
      
      logger.info('Email di registrazione tenant inviata con successo', { 
        email, 
        token: token.substring(0, 8) + '...',
        plan,
        messageId: emailResult.messageId,
        response: emailResult.response,
        envelope: emailResult.envelope
      });
      
    } catch (emailError) {
      logger.error('Errore invio email registrazione tenant', {
        email,
        error: emailError.message,
        stack: emailError.stack,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpFrom: process.env.SMTP_FROM
      });
      
      await TenantRegistrationToken.deleteOne({ token });
      
      return res.status(500).json({ 
        error: `Errore nell'invio dell'email di registrazione: ${emailError.message}` 
      });
    }

    sendCreated(res, { 
      message: 'Email di conferma inviata. Controlla la tua casella di posta per completare la registrazione.' 
    });
});

// Fase 2: Completa la registrazione del tenant usando il token
export const completeTenantRegistration = asyncHandler(async (req, res) => {
  const { 
    token,
    companyType, companyName, vatNumber, codiceFiscale, address,
    country = 'IT', // Aggiungiamo il campo country con default 'IT'
    contacts: { email: companyEmail, phone, sdiCode, pec },
    metadata,
    admin: { displayName, password }
  } = req.body;
    const registrationToken = await TenantRegistrationToken.findOne({ token });
    if (!registrationToken) {
      throw new AuthenticationError('Token di registrazione non valido o scaduto.', { token });
    }
    if (registrationToken.expiresAt < new Date()) {
      await TenantRegistrationToken.deleteOne({ token });
      throw new AuthenticationError('Token di registrazione scaduto.', { token });
    }

    const adminEmail = registrationToken.email;
    const plan = registrationToken.plan;

    const existingUserInMongo = await User.findOne({ email: adminEmail });
    if (existingUserInMongo) {
      return res.status(409).json({ error: 'Un utente con questa email è già registrato nel sistema.' });
    }

    // Normalizza il VAT number aggiungendo il prefisso del paese se non presente
    let normalizedVatNumber = vatNumber;
    if (country && !vatNumber.startsWith(country)) {
      normalizedVatNumber = `${country}${vatNumber}`;
      logger.debug('Normalizzato VAT number con prefisso paese', {
        original: vatNumber,
        normalized: normalizedVatNumber,
        country
      });
    }

    const existingTenantByVat = await Tenant.findOne({ vatNumber: normalizedVatNumber });
    if (existingTenantByVat) {
      return res.status(409).json({ error: 'Un tenant con questa Partita IVA è già registrato.' });
    }

    const tenant = await Tenant.create({
      companyType, companyName, country, address,
      vatNumber: normalizedVatNumber, // Usiamo il VAT number normalizzato
      codiceFiscale,
      plan, // Aggiunto il campo plan
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
      logger.info('New Firebase user created for admin', { uid: userRecord.uid });
    } catch (firebaseError) {
      if (firebaseError.code === 'auth/email-already-exists') {
        logger.error('Firebase user already exists', { email: adminEmail, error: 'TenantRegistrationToken was present but Firebase user exists' });
        throw new ConflictError('Un utente Firebase con questa email esiste già. Contatta il supporto.', { email: adminEmail });
      }
      logger.error('Error creating Firebase user', { error: firebaseError.message, stack: firebaseError.stack });
      throw new ExternalServiceError('Errore durante la creazione dell\'utente Firebase', { 
        service: 'Firebase Auth',
        code: firebaseError.code,
        message: firebaseError.message
      });
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
      logger.info('New user created in MongoDB', { uid: newUser.uid });
    } catch (mongoError) {
      logger.error('Error saving user in MongoDB', { error: mongoError.message, stack: mongoError.stack });
      throw mongoError;
    }

    await TenantRegistrationToken.deleteOne({ token });

    sendCreated(res, {
      message: 'Registrazione completata con successo.',
      tenantId: tenant._id,
      adminUid: userRecord.uid
    });
});

export const login = asyncHandler(async (req, res) => {
  // The client sends the token, not uid.
  const { token } = req.body;
  if (!token) {
    throw new ValidationError('Token non fornito', { field: 'token' });
  }

  const decodedToken = await auth.verifyIdToken(token);
  const user = await User.findOne({ uid: decodedToken.uid }).lean();

  if (!user) {
    throw new NotFoundError('Utente non trovato nel nostro database.', { uid: decodedToken.uid });
  }

  // Set custom claims for the user.
  await auth.setCustomUserClaims(user.uid, {
    tenantId: user.tenantId.toString(),
    role: user.role,
  });

  // The client should refresh the token to get the new claims.
  sendSuccess(res, { message: 'Login successful. Custom claims set.' });
});

export const getMe = asyncHandler(async (req, res) => {
  logger.info('authController - getMe: START', { 
    user: req.user,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'missing',
      userAgent: req.headers['user-agent']
    }
  });
  
  const user = await User.findOne({ uid: req.user.uid }).lean();
  logger.info('authController - getMe: User query result', { 
    found: !!user,
    uid: req.user.uid,
    userFields: user ? Object.keys(user) : 'none'
  });
  
  if (!user) {
    logger.error('authController - getMe: User not found in local DB', { uid: req.user.uid });
    throw new NotFoundError('Utente non trovato nel database locale.', { uid: req.user.uid });
  }

  let companyName = null;
  let tenantDetailsForPayload = null;
  if (user.tenantId) {
    logger.info('authController - getMe: User has tenantId, fetching tenant details', { tenantId: user.tenantId });
    const tenant = await Tenant.findById(user.tenantId).select('companyName companyType').lean();
    if (tenant) {
      logger.info('authController - getMe: Tenant found', { 
        tenantId: tenant._id,
        companyName: tenant.companyName,
        companyType: tenant.companyType
      });
      companyName = tenant.companyName;
      tenantDetailsForPayload = tenant;
    } else {
      logger.warn('authController - getMe: Tenant NOT found', { tenantId: user.tenantId });
    }
  } else {
    logger.warn('authController - getMe: User does NOT have a tenantId', { uid: user.uid });
  }

  const responsePayload = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    tenantId: user.tenantId,
    role: user.role,
    tenant: tenantDetailsForPayload,
  };
  
  logger.info('authController - getMe: tenantDetailsForPayload check', {
    tenantDetailsForPayload,
    hasTenantDetails: !!tenantDetailsForPayload,
    tenantKeys: tenantDetailsForPayload ? Object.keys(tenantDetailsForPayload) : 'none'
  });
  
  logger.info('authController - getMe: Sending responsePayload', { 
    uid: responsePayload.uid,
    email: responsePayload.email ? responsePayload.email.substring(0, 3) + '***' : 'missing',
    displayName: responsePayload.displayName,
    tenantId: responsePayload.tenantId,
    role: responsePayload.role,
    hasTenant: !!responsePayload.tenant,
    tenantInPayload: responsePayload.tenant
  });
  sendSuccess(res, responsePayload);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  // Validazione password
  if (!newPassword || newPassword.length < 6) {
    throw new ValidationError('La password deve essere di almeno 6 caratteri', { field: 'newPassword' });
  }

  try {
    await auth.updateUser(req.user.uid, {
      password: newPassword
    });

    sendSuccess(res, { message: 'Password aggiornata con successo' });
  } catch (firebaseError) {
    throw new ExternalServiceError('Errore durante l\'aggiornamento della password', {
      service: 'Firebase Auth',
      code: firebaseError.code,
      message: firebaseError.message
    });
  }
});

export const updateUserProfile = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const authenticatedUserUid = req.user.uid;
  const { displayName } = req.body;

  logger.debug('updateUserProfile request received', { 
    targetUid: uid, 
    authenticatedUid: authenticatedUserUid, 
    displayName 
  });

  // Verifica che l'utente stia modificando il proprio profilo
  if (uid !== authenticatedUserUid) {
    throw new AuthorizationError('Non autorizzato a modificare questo profilo utente.', {
      targetUid: uid,
      authenticatedUid: authenticatedUserUid
    });
  }

  const trimmedDisplayName = displayName.trim();
  logger.debug('updateUserProfile trimmed displayName', { trimmedDisplayName });

  const updatedUserFromDB = await User.findOneAndUpdate(
    { uid: authenticatedUserUid },
    { $set: { displayName: trimmedDisplayName } },
    { new: true, runValidators: true }
  ).lean();

  if (!updatedUserFromDB) {
    logger.error('updateUserProfile: User not found in DB', { uid: authenticatedUserUid });
    throw new NotFoundError('Utente non trovato nel database.', { uid: authenticatedUserUid });
  }
  logger.info('updateUserProfile: User updated in DB', { 
    uid: authenticatedUserUid, 
    newDisplayName: updatedUserFromDB.displayName 
  });

  try {
    await auth.updateUser(authenticatedUserUid, {
      displayName: trimmedDisplayName
    });
    logger.info('updateUserProfile: User updated in Firebase Auth', { uid: authenticatedUserUid });
  } catch (firebaseError) {
    if (firebaseError.code === 'auth/user-not-found') {
      throw new NotFoundError('Utente non trovato in Firebase Authentication.', { uid: authenticatedUserUid });
    }
    throw new ExternalServiceError('Errore durante l\'aggiornamento del profilo in Firebase', {
      service: 'Firebase Auth',
      code: firebaseError.code,
      message: firebaseError.message
    });
  }

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
      tenant: tenantDetailsForPayload
  };

  logger.debug('updateUserProfile sending response', { 
    uid: authenticatedUserUid,
    responseUser: {
      uid: responseUser.uid,
      displayName: responseUser.displayName,
      tenantId: responseUser.tenantId
    }
  });
  sendSuccess(res, { user: responseUser });
});

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
    logger.error('setAdminRole error', { error: err.message, stack: err.stack, targetUid });
    return res.status(500).json({ error: err.message });
  }
};
