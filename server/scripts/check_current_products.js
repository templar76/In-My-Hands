import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const checkCurrentProducts = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    const products = await Product.find({}).sort({ createdAt: -1 }).limit(5);
    console.log(`\nTrovati ${products.length} prodotti (ultimi 5):`);
    
    products.forEach((product, index) => {
      console.log(`\n--- Prodotto ${index + 1} ---`);
      console.log(`ID: ${product._id}`);
      console.log(`Descrizione: ${product.description ? product.description.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`Creato: ${product.createdAt}`);
      console.log(`Numero fornitori: ${product.prices ? product.prices.length : 0}`);
      
      if (!product.prices || product.prices.length === 0) {
        console.log(`  ❌ Nessun fornitore trovato!`);
        return;
      }
      
      product.prices.forEach((priceEntry, priceIndex) => {
        console.log(`\n  Fornitore ${priceIndex + 1}:`);
        console.log(`  Nome: ${priceEntry.supplier ? priceEntry.supplier.name || 'N/A' : 'N/A'}`);
        console.log(`  VAT: ${priceEntry.supplier ? priceEntry.supplier.vatNumber || 'N/A' : 'N/A'}`);
        console.log(`  PriceHistory entries: ${priceEntry.priceHistory ? priceEntry.priceHistory.length : 0}`);
        
        if (priceEntry.priceHistory && priceEntry.priceHistory.length > 0) {
          console.log(`  ✅ PriceHistory popolato!`);
          priceEntry.priceHistory.forEach((entry, entryIndex) => {
            console.log(`    Entry ${entryIndex + 1}: €${entry.price} - ${entry.invoiceNumber}`);
          });
        } else {
          console.log(`  ❌ PriceHistory vuoto!`);
        }
      });
    });
    
  } catch (error) {
    console.error('Errore durante la verifica:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

checkCurrentProducts();