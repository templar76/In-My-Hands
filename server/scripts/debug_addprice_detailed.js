import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const debugAddPriceEntry = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    // Trova un prodotto esistente
    const product = await Product.findOne({}).sort({ createdAt: -1 });
    if (!product) {
      console.log('Nessun prodotto trovato');
      return;
    }
    
    console.log('\n=== PRIMA DEL TEST ===');
    console.log(`Prodotto ID: ${product._id}`);
    console.log(`Descrizione: ${product.description}`);
    console.log(`Numero fornitori: ${product.prices.length}`);
    
    if (product.prices.length > 0) {
      console.log(`Primo fornitore:`);
      console.log(`  - Nome: ${product.prices[0].supplierName || 'N/A'}`);
      console.log(`  - VAT: ${product.prices[0].supplierVat || 'N/A'}`);
      console.log(`  - PriceHistory: ${product.prices[0].priceHistory ? product.prices[0].priceHistory.length : 0} entries`);
    }
    
    // Test del metodo addPriceEntry con dati più semplici
    console.log('\n=== CHIAMATA addPriceEntry ===');
    
    // Usa il primo fornitore esistente se presente
    let supplierData;
    if (product.prices.length > 0) {
      supplierData = {
        supplierId: product.prices[0].supplierId,
        supplierVat: product.prices[0].supplierVat,
        supplierName: product.prices[0].supplierName
      };
      console.log('Usando fornitore esistente per aggiungere nuovo prezzo');
    } else {
      supplierData = {
        supplierId: new mongoose.Types.ObjectId(),
        supplierVat: '12345678901',
        supplierName: 'Test Supplier'
      };
      console.log('Creando nuovo fornitore');
    }
    
    const priceData = {
      price: 99.99,
      currency: 'EUR',
      quantity: 1,
      unitOfMeasure: 'pz'
    };
    
    // Usa un invoiceId fittizio ma valido
    const invoiceData = {
      invoiceId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), // ObjectId fisso per test
      invoiceNumber: 'TEST001',
      invoiceDate: new Date(),
      invoiceLineNumber: 1,
      purchaseDate: new Date()
    };
    
    console.log('Dati supplier:', supplierData);
    console.log('Dati prezzo:', priceData);
    console.log('Dati fattura:', invoiceData);
    
    // Chiama addPriceEntry
    console.log('\nChiamando addPriceEntry...');
    try {
      product.addPriceEntry(supplierData, priceData, invoiceData);
      console.log('addPriceEntry completato senza errori');
    } catch (error) {
      console.error('Errore in addPriceEntry:', error);
      return;
    }
    
    console.log('\n=== DOPO addPriceEntry (prima del save) ===');
    console.log(`Numero fornitori: ${product.prices.length}`);
    
    // Trova il fornitore che abbiamo modificato
    const targetSupplier = product.prices.find(p => p.supplierVat === supplierData.supplierVat);
    if (targetSupplier) {
      console.log(`Fornitore target:`);
      console.log(`  - Nome: ${targetSupplier.supplierName}`);
      console.log(`  - VAT: ${targetSupplier.supplierVat}`);
      console.log(`  - PriceHistory: ${targetSupplier.priceHistory.length} entries`);
      
      if (targetSupplier.priceHistory.length > 0) {
        console.log(`  - Ultimo entry: €${targetSupplier.priceHistory[targetSupplier.priceHistory.length - 1].price} - ${targetSupplier.priceHistory[targetSupplier.priceHistory.length - 1].invoiceNumber}`);
      }
    }
    
    // Salva il prodotto
    console.log('\n=== SALVATAGGIO ===');
    try {
      await product.save();
      console.log('Prodotto salvato con successo');
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      return;
    }
    
    // Ricarica il prodotto dal database
    console.log('\n=== RICARICA DAL DATABASE ===');
    const reloadedProduct = await Product.findById(product._id);
    
    console.log(`Numero fornitori dopo ricarica: ${reloadedProduct.prices.length}`);
    
    const reloadedSupplier = reloadedProduct.prices.find(p => p.supplierVat === supplierData.supplierVat);
    if (reloadedSupplier) {
      console.log(`Fornitore dopo ricarica:`);
      console.log(`  - Nome: ${reloadedSupplier.supplierName}`);
      console.log(`  - VAT: ${reloadedSupplier.supplierVat}`);
      console.log(`  - PriceHistory: ${reloadedSupplier.priceHistory.length} entries`);
      
      if (reloadedSupplier.priceHistory.length > 0) {
        console.log(`  ✅ PriceHistory salvato correttamente!`);
        reloadedSupplier.priceHistory.forEach((entry, index) => {
          console.log(`    Entry ${index + 1}: €${entry.price} - ${entry.invoiceNumber} - ${entry.invoiceDate}`);
        });
      } else {
        console.log(`  ❌ PriceHistory ancora vuoto dopo il salvataggio!`);
      }
    } else {
      console.log(`❌ Fornitore non trovato dopo ricarica!`);
    }
    
  } catch (error) {
    console.error('Errore durante il debug:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

debugAddPriceEntry();