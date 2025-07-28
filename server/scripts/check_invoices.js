import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Invoice from '../src/models/Invoice.js';

dotenv.config({ path: '.env.test' });

async function checkInvoices() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connesso a MongoDB');
    
    // Verifica il tenantId corrente (dovrebbe essere quello dell'utente loggato)
    const tenantId = '68221dec18e64985fb2a86e6'; // Sostituisci con il tuo tenantId
    
    console.log('🔍 Controllo fatture per tenantId:', tenantId);
    
    // Conta tutte le fatture per questo tenant
    const totalInvoices = await Invoice.countDocuments({ tenantId });
    console.log('📊 Totale fatture trovate:', totalInvoices);
    
    // Mostra le prime 5 fatture
    const sampleInvoices = await Invoice.find({ tenantId })
      .limit(5)
      .select('invoiceNumber invoiceDate totalAmount supplier.name')
      .lean();
    
    console.log('📋 Esempi di fatture:');
    sampleInvoices.forEach((invoice, index) => {
      console.log(`${index + 1}. ${invoice.invoiceNumber} - ${invoice.invoiceDate} - €${invoice.totalAmount} - ${invoice.supplier?.name || 'N/A'}`);
    });
    
    // Verifica anche senza filtro tenantId
    const totalAllInvoices = await Invoice.countDocuments({});
    console.log('📊 Totale fatture in tutto il database:', totalAllInvoices);
    
    if (totalAllInvoices > 0 && totalInvoices === 0) {
      console.log('⚠️  Ci sono fatture nel database ma non per questo tenantId');
      
      // Mostra i tenantId presenti
      const tenantIds = await Invoice.distinct('tenantId');
      console.log('🏢 TenantId presenti nel database:', tenantIds);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnesso da MongoDB');
  }
}

checkInvoices();