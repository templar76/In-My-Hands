import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import Invitation from '../models/Invitation.js';
import { auth } from '../firebaseAdmin.js';
import logger from '../utils/logger.js';

// Configura il transporter SMTP
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

/**
* GET /api/tenants/:tenantId/users/check?email=<email>
 * Ritorna { exists: true } se un utente con quella email è già nel tenant
*/
export const checkExistingUser = async (req, res) => {
  const { tenantId } = req.params;
  const { email } = req.query;
  if (!email) {
  return res.status(400).json({ error: 'Email mancante per il controllo' });
  }
  try {
    const exists = await User.exists({ tenantId, email });
    return res.json({ exists: Boolean(exists) });
      } catch (err) {
        logger.error('Errore durante il controllo utente esistente', {
          tenantId,
          email,
          error: err.message,
          stack: err.stack
        });
        return res.status(500).json({ error: err.message });
        }
};






/**
 * Crea un invito per nuovi operatori del tenant e invia l'email
 */
// Implementazione completa per creazione utenti nel tenant
// Rimozione codice residuo fuori posto
// Funzione createTenantUser correttamente chiusa
// Nella funzione createTenantUser, dopo aver processato tutti i risultati:
export const createTenantUser = async (req, res) => {
  const { tenantId } = req.params;
  logger.debug('Richiesta creazione utente tenant ricevuta', { tenantId });
  logger.debug('Dati richiesta ricevuti', { body: req.body });
  const { emails, role } = req.body;
  
  if (!emails?.length || !role) {
    logger.warn('Validazione fallita per creazione utente tenant', {
      tenantId,
      emailsLength: emails?.length,
      role,
      rawEmails: emails
    });
    return res.status(400).json({ error: 'Email e ruolo obbligatori' });
  }

  try {
    const results = await Promise.all(emails.map(async (email) => {
      try {
        // Genera un token univoco per l'invito
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni

        // Costruisci l'URL di invito
        const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;

        try {
          // Tenta di inviare l'email di invito
          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Invito a In My Hands',
            html: `
              <h1>Benvenuto in In My Hands!</h1>
              <p>Sei stato invitato a unirti come ${role}.</p>
              <p>Per completare la registrazione, clicca sul seguente link:</p>
              <a href="${inviteUrl}">${inviteUrl}</a>
              <p>Questo link scadrà tra 7 giorni.</p>
            `
          });

          // Crea il record dell'invito nel database SOLO SE l'email è stata inviata con successo
          const invitation = await Invitation.create({
            email,
            tenantId,
            role,
            token,
            expiresAt
          });

          return { email, token, inviteUrl, emailSent: true, invitationId: invitation._id };
        } catch (emailError) {
          logger.error('Errore invio email invito', {
            email,
            tenantId,
            error: emailError.message,
            stack: emailError.stack
          });
          return { email, emailSent: false, error: `Errore nell'invio dell'email: ${emailError.message}` };
        }
      } catch (error) {
        logger.error('Errore creazione invito', {
          email,
          tenantId,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }));

    // ✅ NUOVO: Controlla se ci sono stati errori nell'invio email
    const hasEmailErrors = results.some(result => result.emailSent === false);
    const allEmailsFailed = results.every(result => result.emailSent === false);
    
    if (allEmailsFailed) {
      // Se tutte le email sono fallite, restituisci un errore
      return res.status(500).json({
        error: 'Impossibile inviare le email di invito. Verificare la configurazione SMTP.',
        results
      });
    } else if (hasEmailErrors) {
      // Se alcune email sono fallite, restituisci un warning con status 207 (Multi-Status)
      return res.status(207).json({
        message: 'Alcuni inviti sono stati creati ma non è stato possibile inviare tutte le email.',
        results
      });
    }
    
    // Tutti gli inviti sono stati inviati con successo
    return res.status(201).json(results);
  } catch (err) {
    logger.error('Errore generale creazione utente tenant', {
      tenantId,
      emails,
      role,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/tenants/:tenantId/invitations/:invitationId
 * Elimina un invito specifico.
 * Accessibile solo agli admin del tenant.
 */
export const deleteInvitation = async (req, res) => {
  const { tenantId, invitationId } = req.params;

  try {
    const invitation = await Invitation.findOne({ _id: invitationId, tenantId });

    if (!invitation) {
      return res.status(404).json({ error: 'Invito non trovato o non appartenente al tenant specificato.', emailSent: false });
    }

    await Invitation.deleteOne({ _id: invitationId });
    logger.info('Invito eliminato con successo', { tenantId, invitationId });

    return res.status(200).json({ message: 'Invito eliminato con successo.' });
  } catch (error) {
    logger.error('Errore eliminazione invito', {
      tenantId,
      invitationId,
      error: error.message,
      stack: error.stack
    });
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID invito non valido.' });
    }
    return res.status(500).json({ error: `Errore interno del server durante l'eliminazione dell'invito.` });
  }
};

/**
 * Accetta un invito pubblico e crea l'utente
 */
export const acceptInvitation = async (req, res) => {
  const { token, password, displayName } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token e password sono obbligatori' });
  }
  try {
    const invitation = await Invitation.findOne({ token });
    if (!invitation) {
      return res.status(400).json({ error: 'Invito non valido' });
    }
    if (invitation.expiresAt < new Date()) {
      await Invitation.deleteOne({ token });
      return res.status(400).json({ error: 'Invito scaduto' });
    }

    const userRecord = await auth.createUser({
      email: invitation.email,
      password,
      displayName: displayName || undefined
    });
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: invitation.tenantId.toString(),
      role: invitation.role
    });
    await User.create({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      tenantId: invitation.tenantId,
      role: invitation.role
    });
    await Invitation.deleteOne({ token });

    return res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      tenantId: invitation.tenantId,
      role: invitation.role
    });
  } catch (err) {
    logger.error('Errore accettazione invito', {
      token,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: err.message });
  }
};



// Funzione createInvitation rimossa dal blocco duplicato

/**
 * GET /api/tenants/:tenantId/invitations
 * Recupera tutti gli inviti inviati per un dato tenant.
 * Accessibile solo agli admin del tenant.
 */
/**
 * POST /api/tenants/:tenantId/invitations/:invitationId/resend
 * Reinvia un invito esistente.
 * Accessibile solo agli admin del tenant.
 */
export const resendInvitation = async (req, res) => {
  const { tenantId, invitationId } = req.params;

  try {
    let invitation = await Invitation.findOne({ _id: invitationId, tenantId });

    if (!invitation) {
      return res.status(404).json({ error: 'Invito non trovato o non appartenente al tenant specificato.', emailSent: false });
    }

    // Se l'invito è già stato accettato (es. non esiste più perché cancellato dopo l'accettazione) o se l'utente esiste già
    // Questo controllo è più complesso perché l'invito viene cancellato dopo l'accettazione.
    // Per ora, ci concentriamo sul reinvio basato sull'esistenza dell'invito stesso.

    const userExists = await User.exists({ email: invitation.email, tenantId: invitation.tenantId });
    if (userExists) {
      return res.status(400).json({ error: 'Un utente con questa email esiste già nel tenant. L\'invito non può essere rispedito.' });
    }

    let emailSent = false;
    let newInviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${invitation.token}`;

    // Se l'invito è scaduto, genera un nuovo token e aggiorna la data di scadenza
    if (invitation.expiresAt < new Date()) {
      invitation.token = crypto.randomBytes(32).toString('hex');
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await invitation.save();
      newInviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${invitation.token}`;
      logger.info('Token invito rigenerato per invito scaduto', {
        invitationId,
        tenantId,
        newExpiresAt: invitation.expiresAt
      });
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: invitation.email,
        subject: 'Invito a In My Hands (Reinvio)',
        html: `
          <h1>Benvenuto in In My Hands!</h1>
          <p>Questo è un reinvio del tuo invito per unirti come ${invitation.role}.</p>
          <p>Per completare la registrazione, clicca sul seguente link:</p>
          <a href="${newInviteUrl}">${newInviteUrl}</a>
          <p>Questo link scadrà il ${invitation.expiresAt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}.</p>
        `
      });
      logger.info('Email reinvio inviata con successo', {
        email: invitation.email,
        invitationId,
        tenantId
      });
      return res.status(200).json({ 
        message: 'Email di invito inviata nuovamente con successo.', 
        invitation: invitation, 
        inviteUrl: newInviteUrl,
        emailSent: true 
      });
    } catch (emailError) {
      logger.error('Errore invio email reinvito', {
        email: invitation.email,
        invitationId,
        tenantId,
        error: emailError.message,
        stack: emailError.stack
      });
      return res.status(200).json({ 
        message: "Invito aggiornato, ma si è verificato un errore nell'invio dell'email.",
        invitation: invitation, 
        inviteUrl: newInviteUrl,
        emailSent: false 
      });
    }

  } catch (error) {
    logger.error('Errore generale reinvio invito', {
      tenantId,
      invitationId,
      error: error.message,
      stack: error.stack
    });
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID invito non valido.' });
    }
    return res.status(500).json({ error: `Errore interno del server durante il reinvio dell'invito.` });
  }
};

export const getTenantInvitations = async (req, res) => {
  const { tenantId } = req.params;

  try {
    const invitations = await Invitation.find({ tenantId }).sort({ createdAt: -1 }).lean();

    if (!invitations) {
      return res.status(200).json({ invitations: [] });
    }

    logger.debug('Inviti recuperati con successo', {
      tenantId,
      count: invitations.length
    });

    return res.status(200).json({ invitations });
  } catch (error) {
    logger.error('Errore recupero inviti tenant', {
      tenantId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Errore interno del server durante il recupero degli inviti.' });
  }
};