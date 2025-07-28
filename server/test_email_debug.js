import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Carica esplicitamente il file .env.test
dotenv.config({ path: '.env.test' });

const testEmailDelivery = async () => {
  console.log('🔍 Test completo configurazione email...');
  
  const transporter = nodemailer.createTransport({ // ✅ CORRETTO: createTransport (senza 'r')
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: true, // Abilita debug dettagliato
    logger: true // Abilita logging
  });
  
  try {
    // 1. Test connessione
    console.log('\n🔄 1. Testing connessione SMTP...');
    await transporter.verify();
    console.log('✅ Connessione SMTP OK');
    
    // 2. Test invio a email diversa (per escludere problemi specifici Gmail)
    const testEmails = [
      'sandrofani@gmail.com',
      // Aggiungi altre email se disponibili per test
    ];
    
    for (const email of testEmails) {
      console.log(`\n🔄 2. Testing invio a ${email}...`);
      
      const result = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: `Test Email Delivery - ${new Date().toISOString()}`,
        html: `
          <h2>Test Email Delivery</h2>
          <p>Questa è una email di test inviata il: <strong>${new Date().toLocaleString()}</strong></p>
          <p>Se ricevi questa email, la configurazione SMTP funziona correttamente.</p>
          <hr>
          <small>Server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</small>
        `,
        envelope: {
          from: process.env.SMTP_USER,
          to: email
        }
      });
      
      console.log(`✅ Email inviata a ${email}:`);
      console.log('   MessageID:', result.messageId);
      console.log('   Response:', result.response);
      console.log('   Envelope:', result.envelope);
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    if (error.code) console.error('   Codice errore:', error.code);
    if (error.response) console.error('   Response server:', error.response);
  }
};

testEmailDelivery();