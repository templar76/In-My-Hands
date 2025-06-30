import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { auth } from '../firebaseAdmin.js';

export const getTenantUsers = async (req, res) => {
  try {
    const { tenantId } = req.params;
    // Assicurati che l'utente che fa la richiesta abbia il permesso di vedere gli utenti di questo tenant.
    // Questa logica di autorizzazione potrebbe essere già gestita dai middleware (requireTenant, requireAdmin).
    // Se req.user.tenantId non corrisponde a tenantId e l'utente non è un superadmin, potresti restituire un errore 403.

    const users = await User.find({ tenantId }).lean(); // Aggiunto .lean() per performance e oggetti JS semplici
    if (!users || users.length === 0) { // Modificata la condizione
      return res.status(200).json([]); // Restituisce un array vuoto con status 200 se nessun utente è trovato, come da prassi comune
    }
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error in getTenantUsers:', error);
    return res.status(500).json({ error: 'Errore nel recupero degli utenti del tenant.' });
  }
};

export const registerTenant = async (req, res) => {
  const { companyName, vatNumber, adminEmail, password, displayName } = req.body;
  if (!companyName || !vatNumber || !adminEmail || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // 1. Create Tenant
    const tenant = await Tenant.create({ name: companyName, vatNumber });
    // 2. Create Firebase user
    const userRecord = await auth.createUser({
      email: adminEmail,
      password,
      displayName: displayName || `${companyName} Admin`
    });
    // 3. Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: tenant._id.toString(),
      role: 'admin'
    });
    // 4. Save user profile in MongoDB
    await User.create({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      tenantId: tenant._id,
      role: 'admin'
    });
    // 5. Return response
    return res.status(201).json({
      tenantId: tenant._id,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    });
  } catch (err) {
    console.error('registerTenant error', err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateUserRoleInTenant = async (req, res) => {
  const { tenantId, userId } = req.params;
  const { role: newRole } = req.body;
  const requestingUserId = req.user.uid; // UID dell'admin che fa la richiesta

  if (!newRole || (newRole !== 'admin' && newRole !== 'operator')) {
    return res.status(400).json({ error: 'Ruolo non valido specificato.' });
  }

  // Un admin non può cambiare il proprio ruolo tramite questa funzione specifica
  if (userId === requestingUserId) {
    return res.status(403).json({ error: 'Non puoi modificare il tuo ruolo tramite questa interfaccia.' });
  }

  try {
    // Verifica che l'utente target esista e appartenga al tenant corretto
    const userToUpdate = await User.findOne({ uid: userId, tenantId });
    if (!userToUpdate) {
      return res.status(404).json({ error: 'Utente non trovato nel tenant specificato.' });
    }

    // Aggiorna il ruolo nel database MongoDB
    userToUpdate.role = newRole;
    await userToUpdate.save();

    // Aggiorna i custom claims in Firebase Authentication
    await auth.setCustomUserClaims(userId, { tenantId, role: newRole });

    // Invalida i token esistenti forzando l'utente a fare nuovamente il login per vedere i cambiamenti (opzionale ma consigliato)
    // await auth.revokeRefreshTokens(userId);

    return res.status(200).json({ message: 'Ruolo utente aggiornato con successo.', user: userToUpdate });
  } catch (error) {
    console.error('Errore durante l\'aggiornamento del ruolo utente:', error);
    if (error.code === 'auth/user-not-found') {
        // Questo potrebbe accadere se l'utente esiste in MongoDB ma non più in Firebase Auth (improbabile in flussi normali)
        return res.status(404).json({ error: 'Utente non trovato in Firebase Authentication.' });
    }
    return res.status(500).json({ error: 'Errore interno del server durante l\'aggiornamento del ruolo utente.' });
  }
};
