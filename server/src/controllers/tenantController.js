import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { auth } from '../firebaseAdmin.js';
import logger from '../utils/logger.js';

export const getTenantUsers = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const requestingUserTenantId = req.user.tenantId;
    
    logger.info('Recupero utenti tenant', { 
      tenantId, 
      requestingUserTenantId,
      requestingUserId: req.user.uid 
    });
    
    // Assicurati che l'utente che fa la richiesta abbia il permesso di vedere gli utenti di questo tenant.
    // Questa logica di autorizzazione potrebbe essere già gestita dai middleware (requireTenant, requireAdmin).
    // Se req.user.tenantId non corrisponde a tenantId e l'utente non è un superadmin, potresti restituire un errore 403.

    const users = await User.find({ tenantId }).lean(); // Aggiunto .lean() per performance e oggetti JS semplici
    
    logger.info('Utenti tenant recuperati', {
      tenantId,
      usersCount: users.length,
      requestingUserId: req.user.uid
    });
    
    if (!users || users.length === 0) { // Modificata la condizione
      return res.status(200).json([]); // Restituisce un array vuoto con status 200 se nessun utente è trovato, come da prassi comune
    }
    return res.status(200).json(users);
  } catch (error) {
    logger.error('Errore in getTenantUsers', {
      tenantId: req.params?.tenantId,
      requestingUserId: req.user?.uid,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Errore nel recupero degli utenti del tenant.' });
  }
};

export const registerTenant = async (req, res) => {
  const { companyName, vatNumber, adminEmail, password, displayName } = req.body;
  
  logger.info('Inizio registrazione tenant', {
    companyName,
    vatNumber,
    adminEmail,
    displayName
  });
  
  if (!companyName || !vatNumber || !adminEmail || !password) {
    logger.warn('Campi obbligatori mancanti per registrazione tenant', {
      missingFields: {
        companyName: !companyName,
        vatNumber: !vatNumber,
        adminEmail: !adminEmail,
        password: !password
      }
    });
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // 1. Create Tenant
    const tenant = await Tenant.create({ name: companyName, vatNumber });
    logger.info('Tenant creato', { tenantId: tenant._id, companyName });
    
    // 2. Create Firebase user
    const userRecord = await auth.createUser({
      email: adminEmail,
      password,
      displayName: displayName || `${companyName} Admin`
    });
    logger.info('Utente Firebase creato', { uid: userRecord.uid, email: adminEmail });
    
    // 3. Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: tenant._id.toString(),
      role: 'admin'
    });
    logger.debug('Custom claims impostati', { uid: userRecord.uid, tenantId: tenant._id });
    
    // 4. Save user profile in MongoDB
    await User.create({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      tenantId: tenant._id,
      role: 'admin'
    });
    logger.info('Profilo utente salvato in MongoDB', { uid: userRecord.uid, tenantId: tenant._id });
    
    // 5. Return response
    logger.info('Registrazione tenant completata', {
      tenantId: tenant._id,
      adminUid: userRecord.uid,
      companyName
    });
    
    return res.status(201).json({
      tenantId: tenant._id,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    });
  } catch (err) {
    logger.error('Errore registrazione tenant', {
      companyName,
      vatNumber,
      adminEmail,
      error: err.message,
      stack: err.stack,
      code: err.code
    });
    return res.status(500).json({ error: err.message });
  }
};

export const updateUserRoleInTenant = async (req, res) => {
  const { tenantId, userId } = req.params;
  const { role: newRole } = req.body;
  const requestingUserId = req.user.uid; // UID dell'admin che fa la richiesta

  logger.info('Inizio aggiornamento ruolo utente', {
    tenantId,
    targetUserId: userId,
    requestingUserId,
    newRole
  });

  if (!newRole || (newRole !== 'admin' && newRole !== 'operator')) {
    logger.warn('Ruolo non valido specificato', {
      tenantId,
      targetUserId: userId,
      requestingUserId,
      invalidRole: newRole
    });
    return res.status(400).json({ error: 'Ruolo non valido specificato.' });
  }

  // Un admin non può cambiare il proprio ruolo tramite questa funzione specifica
  if (userId === requestingUserId) {
    logger.warn('Tentativo di auto-modifica ruolo', {
      tenantId,
      userId: requestingUserId
    });
    return res.status(403).json({ error: 'Non puoi modificare il tuo ruolo tramite questa interfaccia.' });
  }

  try {
    // Verifica che l'utente target esista e appartenga al tenant corretto
    const userToUpdate = await User.findOne({ uid: userId, tenantId });
    if (!userToUpdate) {
      logger.warn('Utente non trovato per aggiornamento ruolo', {
        tenantId,
        targetUserId: userId,
        requestingUserId
      });
      return res.status(404).json({ error: 'Utente non trovato nel tenant specificato.' });
    }

    const oldRole = userToUpdate.role;
    
    // Aggiorna il ruolo nel database MongoDB
    userToUpdate.role = newRole;
    await userToUpdate.save();
    logger.debug('Ruolo aggiornato in MongoDB', {
      tenantId,
      targetUserId: userId,
      oldRole,
      newRole
    });

    // Aggiorna i custom claims in Firebase Authentication
    await auth.setCustomUserClaims(userId, { tenantId, role: newRole });
    logger.debug('Custom claims aggiornati in Firebase', {
      tenantId,
      targetUserId: userId,
      newRole
    });

    // Invalida i token esistenti forzando l'utente a fare nuovamente il login per vedere i cambiamenti (opzionale ma consigliato)
    // await auth.revokeRefreshTokens(userId);

    logger.info('Ruolo utente aggiornato con successo', {
      tenantId,
      targetUserId: userId,
      requestingUserId,
      oldRole,
      newRole
    });

    return res.status(200).json({ message: 'Ruolo utente aggiornato con successo.', user: userToUpdate });
  } catch (error) {
    logger.error('Errore durante aggiornamento ruolo utente', {
      tenantId,
      targetUserId: userId,
      requestingUserId,
      newRole,
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (error.code === 'auth/user-not-found') {
        // Questo potrebbe accadere se l'utente esiste in MongoDB ma non più in Firebase Auth (improbabile in flussi normali)
        return res.status(404).json({ error: 'Utente non trovato in Firebase Authentication.' });
    }
    return res.status(500).json({ error: 'Errore interno del server durante l\'aggiornamento del ruolo utente.' });
  }
};
