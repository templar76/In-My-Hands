import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const debugStepByStep = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    // Crea un prodotto semplice
    const tenantId = new mongoose.Types.ObjectId('68221dec18e64985fb2a86e6');
    
    const newProduct = new Product({
      tenantId: tenantId,
      codeInternal: `DEBUG_${Date.now()}`,
      description: 'Debug Product',
      descriptionStd: 'debug product',
      category: 'Test',
      subcategory: 'Debug',
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
      supplierVat: 'IT12345678901',
      supplierName: 'Debug Supplier'
    };
    
    const priceData = {
      price: 100.00,
      currency: 'EUR',
      quantity: 1,
      unitOfMeasure: 'pz'
    };
    
    const invoiceData = {
      invoiceId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      invoiceNumber: 'DEBUG001',
      invoiceDate: new Date(),
      invoiceLineNumber: 1,
      purchaseDate: new Date()
    };
    
    console.log('\n=== DATI PER addPriceEntry ===');
    console.log('Supplier:', supplierData);
    console.log('Price:', priceData);
    console.log('Invoice:', invoiceData);
    
    // Esegui addPriceEntry manualmente step by step
    console.log('\n=== ESECUZIONE MANUALE addPriceEntry ===');
    
    // Step 1: Cerca supplier esistente
    console.log('Step 1: Cerca supplier esistente...');
    let supplier = newProduct.prices.find(p => p.supplierVat === supplierData.supplierVat);
    console.log(`Supplier trovato: ${supplier ? 'SI' : 'NO'}`);
    
    if (!supplier) {
      console.log('Step 2: Crea nuovo supplier...');
      supplier = {
        supplierId: supplierData.supplierId,
        supplierVat: supplierData.supplierVat,
        supplierName: supplierData.supplierName,
        priceHistory: [],
        lastUpdated: new Date()
      };
      console.log('Supplier creato:', supplier);
      
      console.log('Step 3: Aggiungi supplier al prodotto...');
      newProduct.prices.push(supplier);
      console.log(`Prices array dopo push: ${newProduct.prices.length}`);
    }
    
    // Step 4: Crea nuovo price entry
    console.log('Step 4: Crea nuovo price entry...');
    const newPriceEntry = {
      price: priceData.price,
      currency: priceData.currency || 'EUR',
      quantity: priceData.quantity || 1,
      unitOfMeasure: priceData.unitOfMeasure,
      invoiceId: invoiceData.invoiceId,
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDate: invoiceData.invoiceDate,
      invoiceLineNumber: invoiceData.invoiceLineNumber,
      purchaseDate: invoiceData.purchaseDate || new Date(),
      notes: priceData.notes
    };
    console.log('Price entry creato:', newPriceEntry);
    
    // Step 5: Aggiungi al priceHistory
    console.log('Step 5: Aggiungi al priceHistory...');
    console.log(`PriceHistory prima: ${supplier.priceHistory.length} entries`);
    supplier.priceHistory.push(newPriceEntry);
    console.log(`PriceHistory dopo push: ${supplier.priceHistory.length} entries`);
    
    // Verifica che il supplier nell'array sia lo stesso
    console.log('Step 5.1: Verifica riferimento supplier...');
    const supplierInArray = newProduct.prices[0];
    console.log(`Supplier in array === supplier locale: ${supplierInArray === supplier}`);
    console.log(`PriceHistory in array: ${supplierInArray.priceHistory.length} entries`);
    
    // Step 6: Aggiorna lastUpdated
    console.log('Step 6: Aggiorna lastUpdated...');
    supplier.lastUpdated = new Date();
    supplierInArray.lastUpdated = new Date();
    
    // Step 7: markModified
    console.log('Step 7: markModified...');
    newProduct.markModified('prices');
    console.log('markModified chiamato');
    
    // Verifica di nuovo dopo markModified
    console.log('Step 7.1: Verifica dopo markModified...');
    console.log(`PriceHistory supplier locale: ${supplier.priceHistory.length} entries`);
    console.log(`PriceHistory in array: ${newProduct.prices[0].priceHistory.length} entries`);
    
    // Verifica stato prima del salvataggio
    console.log('\n=== STATO PRIMA DEL SALVATAGGIO ===');
    console.log(`Prices array: ${newProduct.prices.length}`);
    if (newProduct.prices.length > 0) {
      const s = newProduct.prices[0];
      console.log(`Supplier 0:`);
      console.log(`  - Nome: ${s.supplierName}`);
      console.log(`  - VAT: ${s.supplierVat}`);
      console.log(`  - PriceHistory: ${s.priceHistory.length} entries`);
      
      if (s.priceHistory.length > 0) {
        console.log(`  - Entry 0: €${s.priceHistory[0].price} - ${s.priceHistory[0].invoiceNumber}`);
      }
    }
    
    // Salva
    console.log('\n=== SALVATAGGIO ===');
    try {
      await newProduct.save();
      console.log('✅ Salvato con successo');
    } catch (error) {
      console.error('❌ Errore salvataggio:', error.message);
      return;
    }
    
    // Ricarica e verifica
    console.log('\n=== VERIFICA DOPO SALVATAGGIO ===');
    const reloaded = await Product.findById(newProduct._id);
    
    console.log(`Prices array ricaricato: ${reloaded.prices.length}`);
    if (reloaded.prices.length > 0) {
      const s = reloaded.prices[0];
      console.log(`Supplier ricaricato:`);
      console.log(`  - Nome: ${s.supplierName}`);
      console.log(`  - VAT: ${s.supplierVat}`);
      console.log(`  - PriceHistory: ${s.priceHistory.length} entries`);
      
      if (s.priceHistory.length > 0) {
        console.log(`  ✅ PriceHistory salvato!`);
        s.priceHistory.forEach((entry, index) => {
          console.log(`    Entry ${index}: €${entry.price} - ${entry.invoiceNumber}`);
        });
      } else {
        console.log(`  ❌ PriceHistory vuoto!`);
      }
    }
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

debugStepByStep();