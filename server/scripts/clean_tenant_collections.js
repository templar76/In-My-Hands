import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Invoice from '../src/models/Invoice.js';
import Product from '../src/models/Product.js';
import Supplier from '../src/models/Supplier.js';

// Carica esplicitamente il file .env.test
dotenv.config({ path: '.env.test' });

async function cleanTenantCollections() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connesso a MongoDB');
    
    // Specifica il tenantId per cui vuoi pulire le collezioni
    const tenantId = '68865b0af056f6331c3b41a8'; // Sostituisci con il tenantId corretto
    
    console.log(`🧹 Pulizia collezioni per tenantId: ${tenantId}`);
    
    // Conta i documenti prima della pulizia
    const invoicesBefore = await Invoice.countDocuments({ tenantId });
    const productsBefore = await Product.countDocuments({ tenantId });
    const suppliersBefore = await Supplier.countDocuments({ tenantId });
    
    console.log('📊 Documenti prima della pulizia:');
    console.log(`- Fatture: ${invoicesBefore}`);
    console.log(`- Prodotti: ${productsBefore}`);
    console.log(`- Fornitori: ${suppliersBefore}`);
    
    // Elimina i documenti per il tenant specificato
    const invoiceResult = await Invoice.deleteMany({ tenantId });
    const productResult = await Product.deleteMany({ tenantId });
    const supplierResult = await Supplier.deleteMany({ tenantId });
    
    console.log('🗑️ Risultati pulizia:');
    console.log(`- Fatture eliminate: ${invoiceResult.deletedCount}`);
    console.log(`- Prodotti eliminati: ${productResult.deletedCount}`);
    console.log(`- Fornitori eliminati: ${supplierResult.deletedCount}`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnesso da MongoDB');
  }
}

cleanTenantCollections();