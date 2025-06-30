import dotenv from 'dotenv';
import mongoose from 'mongoose'; // AGGIUNTO: Import mancante
import Invoice from '../src/models/Invoice.js';
import Product from '../src/models/Product.js';

// Configura dotenv per leggere il file .env dalla cartella server
dotenv.config({ path: '../.env' }); // MODIFICATO: Percorso corretto per il file .env

// Connetti al database - usa MONGO_URI invece di MONGODB_URI
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function debugProductData() {
  const tenantId = '68221dec18e64985fb2a86e6';
  const productId = '685c4004cff0fc4a78bedb02';
  const productCode = 'PROD-1750876164746-wwedfvjfw';
  
  console.log('=== DEBUG PRODUCT DATA ===');
  
  try {
    // 1. Verifica se il prodotto esiste
    const product = await Product.findById(productId);
    console.log('Product exists:', !!product);
    if (product) {
      console.log('Product codeInternal:', product.codeInternal);
      console.log('Product name:', product.name);
    }
    
    // 2. Conta tutte le fatture per questo tenant
    const totalInvoices = await Invoice.countDocuments({ 
      tenantId: new mongoose.Types.ObjectId(tenantId) 
    });
    console.log('Total invoices for tenant:', totalInvoices);
    
    // 3. Cerca fatture con questo codeInternal
    const invoicesWithCode = await Invoice.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      'lineItems.codeInternal': productCode
    });
    console.log('Invoices with codeInternal:', invoicesWithCode);
    
    // 4. Cerca fatture con matchedProductId
    const invoicesWithMatchedId = await Invoice.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      'lineItems.matchedProductId': new mongoose.Types.ObjectId(productId)
    });
    console.log('Invoices with matchedProductId:', invoicesWithMatchedId);
    
    // 5. Mostra alcuni esempi di lineItems
    const sampleInvoices = await Invoice.find({
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).limit(2).select('lineItems');
    
    console.log('Sample lineItems structure:');
    sampleInvoices.forEach((invoice, index) => {
      console.log(`Invoice ${index + 1} lineItems count:`, invoice.lineItems.length);
      if (invoice.lineItems.length > 0) {
        const firstItem = invoice.lineItems[0];
        console.log('First lineItem:', {
          codeInternal: firstItem.codeInternal,
          description: firstItem.description,
          matchedProductId: firstItem.matchedProductId,
          productMatchingStatus: firstItem.productMatchingStatus
        });
      }
    });
    
    // 6. Cerca tutti i codeInternal unici nelle fatture
    const uniqueCodes = await Invoice.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      { $unwind: '$lineItems' },
      { $group: { _id: '$lineItems.codeInternal' } },
      { $limit: 10 }
    ]);
    console.log('Sample codeInternal values in invoices:', uniqueCodes.map(c => c._id));
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
  
  console.log('========================');
  
  mongoose.disconnect();
}

debugProductData().catch(console.error);