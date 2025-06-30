import mongoose from 'mongoose';
import Product from './src/models/Product.js';

const testAddPriceMethod = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    // Crea un prodotto semplice
    const tenantId = new mongoose.Types.ObjectId('68221dec18e64985fb2a86e6');
    
    const newProduct = new Product({
      tenantId: tenantId,
      codeInternal: `TEST_METHOD_${Date.now()}`,
      description: 'Test Method Product',
      descriptionStd: 'test method product',
      category: 'Test',
      subcategory: 'Method',
      brand: null,
      model: null,
      specifications: {
        weight: null,
        dimensions: null,
        color: null,
        material: null,
        ean: null,
        otherCodes: [],
        attributes: {}
      },
      prices: []
    });
    
    console.log('\n=== PRODOTTO CREATO ===');
    console.log(`ID: ${newProduct._id}`);
    console.log(`Prices array: ${newProduct.prices.length}`);
    
    // Dati per addPriceEntry
    const supplierData = {
      supplierId: new mongoose.Types.ObjectId(),
      supplierVat: 'IT98765432109',
      supplierName: 'Test Method Supplier'
    };
    
    const priceData = {
      price: 150.00,
      currency: 'EUR',
      quantity: 1,
      unitOfMeasure: 'pz'
    };
    
    const invoiceData = {
      invoiceId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      invoiceNumber: 'TEST001',
      invoiceDate: new Date(),
      invoiceLineNumber: 1,
      purchaseDate: new Date()
    };
    
    console.log('\n=== CHIAMATA addPriceEntry ===');
    console.log('Supplier:', supplierData);
    console.log('Price:', priceData);
    console.log('Invoice:', invoiceData);
    
    // Usa il metodo addPriceEntry del modello
    newProduct.addPriceEntry(supplierData, priceData, invoiceData);
    
    console.log('\n=== DOPO addPriceEntry ===');
    console.log(`Prices array: ${newProduct.prices.length}`);
    if (newProduct.prices.length > 0) {
      const supplier = newProduct.prices[0];
      console.log(`Supplier:`);
      console.log(`  - Nome: ${supplier.supplierName}`);
      console.log(`  - VAT: ${supplier.supplierVat}`);
      console.log(`  - PriceHistory: ${supplier.priceHistory.length} entries`);
      
      if (supplier.priceHistory.length > 0) {
        console.log(`  - Entry 0: €${supplier.priceHistory[0].price} - ${supplier.priceHistory[0].invoiceNumber}`);
      }
    }
    
    // Salva
    console.log('\n=== SALVATAGGIO ===');
    try {
      await newProduct.save();
      console.log('✅ Salvato con successo');
    } catch (error) {
      console.error('❌ Errore salvataggio:', error.message);
      console.error('Dettagli errore:', error);
      return;
    }
    
    // Ricarica e verifica
    console.log('\n=== VERIFICA DOPO SALVATAGGIO ===');
    const reloaded = await Product.findById(newProduct._id);
    
    console.log(`Prices array ricaricato: ${reloaded.prices.length}`);
    if (reloaded.prices.length > 0) {
      const supplier = reloaded.prices[0];
      console.log(`Supplier ricaricato:`);
      console.log(`  - Nome: ${supplier.supplierName}`);
      console.log(`  - VAT: ${supplier.supplierVat}`);
      console.log(`  - PriceHistory: ${supplier.priceHistory.length} entries`);
      
      if (supplier.priceHistory.length > 0) {
        console.log(`  ✅ PriceHistory salvato correttamente!`);
        supplier.priceHistory.forEach((entry, index) => {
          console.log(`    Entry ${index}: €${entry.price} - ${entry.invoiceNumber} - ${entry.invoiceDate}`);
        });
      } else {
        console.log(`  ❌ PriceHistory ancora vuoto!`);
      }
    }
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

testAddPriceMethod();