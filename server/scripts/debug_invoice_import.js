import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const debugInvoiceImport = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    // Simula i dati di una fattura come nel controller
    const invoiceData = {
      invoiceId: new mongoose.Types.ObjectId(),
      fornitore: {
        pIva: 'IT02008090470',
        name: 'It-Globaltech srl'
      },
      header: {
        numero: 'FAT001',
        data: '2025-06-15',
        valuta: 'EUR'
      }
    };
    
    const line = {
      descrizione: 'Test Product Import',
      prezzoUnitario: '150.00',
      quantita: '2',
      uM: 'pz',
      numeroLinea: 1,
      iva: 22
    };
    
    const supplierId = new mongoose.Types.ObjectId();
    const tenantId = new mongoose.Types.ObjectId('68221dec18e64985fb2a86e6'); // Usa un tenant ID esistente
    
    console.log('\n=== SIMULAZIONE IMPORTAZIONE FATTURA ===');
    console.log('Dati fattura:', invoiceData);
    console.log('Riga prodotto:', line);
    
    // Crea un nuovo prodotto come nel controller
    console.log('\n=== CREAZIONE NUOVO PRODOTTO ===');
    const newProduct = new Product({
      tenantId: tenantId,
      codeInternal: `PROD_${Date.now()}`,
      description: line.descrizione,
      descriptionStd: line.descrizione.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
      category: 'Imported',
      subcategory: 'From Invoice',
      brand: null,
      model: null,
      specifications: {
        weight: null,
        dimensions: null,
        color: null,
        material: null,
        ean: null,
        otherCodes: line.codiceArticolo ? [line.codiceArticolo] : [],
        attributes: {
          vatRate: line.iva || 0,
          lineNumber: line.numeroLinea || null
        }
      },
      prices: []
    });
    
    console.log(`Prodotto creato: ${newProduct._id}`);
    console.log(`Descrizione: ${newProduct.description}`);
    console.log(`Prices array iniziale: ${newProduct.prices.length} entries`);
    
    // Aggiungi il prezzo usando addPriceEntry come nel controller
    console.log('\n=== CHIAMATA addPriceEntry ===');
    
    const supplierData = {
      supplierId: supplierId,
      supplierVat: invoiceData.fornitore.pIva,
      supplierName: invoiceData.fornitore.name
    };
    
    const priceData = {
      price: parseFloat(line.prezzoUnitario || 0),
      currency: invoiceData.header.valuta || 'EUR',
      quantity: parseFloat(line.quantita || 1),
      unitOfMeasure: line.uM || null
    };
    
    const invoiceDataForPrice = {
      invoiceId: invoiceData.invoiceId,
      invoiceNumber: invoiceData.header.numero,
      invoiceDate: new Date(invoiceData.header.data),
      invoiceLineNumber: line.numeroLinea,
      purchaseDate: new Date()
    };
    
    console.log('Supplier data:', supplierData);
    console.log('Price data:', priceData);
    console.log('Invoice data:', invoiceDataForPrice);
    
    try {
      newProduct.addPriceEntry(supplierData, priceData, invoiceDataForPrice);
      console.log('✅ addPriceEntry completato');
    } catch (error) {
      console.error('❌ Errore in addPriceEntry:', error);
      return;
    }
    
    console.log('\n=== STATO DOPO addPriceEntry ===');
    console.log(`Prices array: ${newProduct.prices.length} entries`);
    
    if (newProduct.prices.length > 0) {
      const supplier = newProduct.prices[0];
      console.log(`Primo fornitore:`);
      console.log(`  - ID: ${supplier.supplierId}`);
      console.log(`  - Nome: ${supplier.supplierName}`);
      console.log(`  - VAT: ${supplier.supplierVat}`);
      console.log(`  - PriceHistory: ${supplier.priceHistory.length} entries`);
      
      if (supplier.priceHistory.length > 0) {
        const entry = supplier.priceHistory[0];
        console.log(`  - Entry: €${entry.price} - ${entry.invoiceNumber} - ${entry.invoiceDate}`);
      }
    }
    
    // Salva il prodotto
    console.log('\n=== SALVATAGGIO ===');
    try {
      await newProduct.save();
      console.log('✅ Prodotto salvato con successo');
    } catch (error) {
      console.error('❌ Errore durante il salvataggio:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error(`  - ${key}: ${error.errors[key].message}`);
        });
      }
      return;
    }
    
    // Ricarica e verifica
    console.log('\n=== VERIFICA FINALE ===');
    const savedProduct = await Product.findById(newProduct._id);
    
    console.log(`Prodotto ricaricato: ${savedProduct._id}`);
    console.log(`Prices array: ${savedProduct.prices.length} entries`);
    
    if (savedProduct.prices.length > 0) {
      const supplier = savedProduct.prices[0];
      console.log(`Fornitore salvato:`);
      console.log(`  - Nome: ${supplier.supplierName}`);
      console.log(`  - VAT: ${supplier.supplierVat}`);
      console.log(`  - PriceHistory: ${supplier.priceHistory.length} entries`);
      
      if (supplier.priceHistory.length > 0) {
        console.log(`  ✅ PriceHistory presente!`);
        supplier.priceHistory.forEach((entry, index) => {
          console.log(`    Entry ${index + 1}: €${entry.price} - ${entry.invoiceNumber}`);
        });
      } else {
        console.log(`  ❌ PriceHistory vuoto!`);
      }
    }
    
  } catch (error) {
    console.error('Errore generale:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

debugInvoiceImport();