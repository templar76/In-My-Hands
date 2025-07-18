import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

// Configurazione del trasportatore email per Alert System
const createAlertTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.ALERT_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.ALERT_SMTP_PORT) || 587,
    secure: process.env.ALERT_SMTP_SECURE === 'true',
    auth: {
      user: process.env.ALERT_SMTP_USER,
      pass: process.env.ALERT_SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Invia email di alert
export const sendAlertEmail = async (alertData) => {
  const {
    to,
    alertType,
    productName,
    supplierName,
    currentPrice,
    thresholdPrice,
    triggerReason,
    productId
  } = alertData;

  const transporter = createAlertTransporter();

  const subject = `🚨 Alert Prezzo: ${productName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">🚨 Alert Prezzo Attivato</h2>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Dettagli Prodotto</h3>
        <p><strong>Prodotto:</strong> ${productName}</p>
        <p><strong>Fornitore:</strong> ${supplierName}</p>
        <p><strong>Prezzo Attuale:</strong> €${currentPrice}</p>
        ${thresholdPrice ? `<p><strong>Soglia Impostata:</strong> €${thresholdPrice}</p>` : ''}
      </div>
      
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
        <h4>Motivo dell'Alert</h4>
        <p>${triggerReason}</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="${process.env.CLIENT_URL}/products/${productId}" 
           style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Visualizza Prodotto
        </a>
      </div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      
      <p style="color: #666; font-size: 12px;">
        Questo è un messaggio automatico del sistema In My Hands.<br>
        Per modificare le impostazioni degli alert, accedi alla tua dashboard.
      </p>
    </div>
  `;

  const mailOptions = {
    from: process.env.ALERT_SMTP_FROM || process.env.ALERT_SMTP_USER,
    to,
    subject,
    html
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Email di alert inviata con successo', {
      recipient: to,
      alertType,
      productName,
      productId
    });
  } catch (error) {
    logger.error('Errore nell\'invio dell\'email di alert', {
      error: error.message,
      stack: error.stack,
      recipient: to,
      alertType,
      productName,
      productId
    });
    throw error;
  }
};