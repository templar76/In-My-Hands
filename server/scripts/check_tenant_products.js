import mongoose from 'mongoose';
import Product from '../src/models/Product.js';
import Invoice from '../src/models/Invoice.js';

const checkTenantProducts = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    const tenantId = '68865b0af056f6331c3b41a8'; // ID del tenant specifico
    
    // 1. Conta tutti i prodotti per questo tenant
    const totalProducts = await Product.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) });
    console.log(`\nTotale prodotti per il tenant ${tenantId}: ${totalProducts}`);
    
    // 2. Trova prodotti con prezzi a zero o anomali
    console.log('\n=== PRODOTTI CON PREZZI ANOMALI ===');
    
    // Trova prodotti che non hanno fornitori o hanno fornitori ma senza storico prezzi
    const productsWithoutPrices = await Product.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      $or: [
        { prices: { $size: 0 } },
        { prices: { $exists: false } },
        { 'prices.priceHistory': { $size: 0 } }
      ]
    }).sort({ createdAt: -1 });
    
    console.log(`\nTrovati ${productsWithoutPrices.length} prodotti senza prezzi o con storico prezzi vuoto:`);
    
    productsWithoutPrices.forEach((product, index) => {
      console.log(`\n--- Prodotto Senza Prezzi ${index + 1} ---`);
      console.log(`ID: ${product._id}`);
      console.log(`CodeInternal: ${product.codeInternal}`);
      console.log(`Descrizione: ${product.description}`);
      console.log(`Creato: ${product.createdAt}`);
    });
    
    // 3. Trova prodotti con prezzi a zero nelle fatture
    console.log('\n=== RIGHE FATTURA CON PREZZI ZERO ===');
    
    // Cerca nelle fatture le righe con prezzo zero o quantità zero
    const invoicesWithZeroPrices = await Invoice.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      { $unwind: '$lineItems' },
      { $match: { 
        $or: [
          { 'lineItems.unitPrice': { $eq: 0 } },
          { 'lineItems.quantity': { $eq: 0 } },
          { 'lineItems.totalPrice': { $eq: 0 } }
        ]
      }},
      { $project: {
        invoiceNumber: 1,
        invoiceDate: 1,
        supplierName: '$supplier.name',
        lineNumber: '$lineItems.lineNumber',
        description: '$lineItems.description',
        unitPrice: '$lineItems.unitPrice',
        quantity: '$lineItems.quantity',
        totalPrice: '$lineItems.totalPrice',
        matchedProductId: '$lineItems.matchedProductId',
        productMatchingStatus: '$lineItems.productMatchingStatus'
      }},
      { $sort: { invoiceDate: -1 } },
      { $limit: 50 }
    ]);
    
    console.log(`\nTrovate ${invoicesWithZeroPrices.length} righe fattura con prezzi o quantità zero (ultime 50):`);
    
    invoicesWithZeroPrices.forEach((item, index) => {
      console.log(`\n--- Riga Fattura ${index + 1} ---`);
      console.log(`Fattura: ${item.invoiceNumber} del ${new Date(item.invoiceDate).toLocaleDateString()}`);
      console.log(`Fornitore: ${item.supplierName}`);
      console.log(`Riga: ${item.lineNumber}`);
      console.log(`Descrizione: ${item.description}`);
      console.log(`Prezzo unitario: ${item.unitPrice}`);
      console.log(`Quantità: ${item.quantity}`);
      console.log(`Prezzo totale: ${item.totalPrice}`);
      console.log(`Stato matching: ${item.productMatchingStatus}`);
      console.log(`Prodotto associato: ${item.matchedProductId || 'Nessuno'}`);
    });
    
    // 4. Trova prodotti con descrizioni molto lunghe (potenzialmente note o testi informativi)
    console.log('\n=== PRODOTTI CON DESCRIZIONI MOLTO LUNGHE ===');
    
    const longDescriptionProducts = await Product.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).sort({ createdAt: -1 });
    
    const veryLongDescriptions = longDescriptionProducts.filter(p => 
      p.description && p.description.length > 100
    );
    
    console.log(`\nTrovati ${veryLongDescriptions.length} prodotti con descrizioni molto lunghe (>100 caratteri):`);
    
    veryLongDescriptions.forEach((product, index) => {
      console.log(`\n--- Prodotto Con Descrizione Lunga ${index + 1} ---`);
      console.log(`ID: ${product._id}`);
      console.log(`CodeInternal: ${product.codeInternal}`);
      console.log(`Lunghezza descrizione: ${product.description.length} caratteri`);
      console.log(`Descrizione: ${product.description.substring(0, 100)}...`);
      console.log(`Creato: ${product.createdAt}`);
      console.log(`Numero fornitori: ${product.prices ? product.prices.length : 0}`);
    });
    
    // 5. Trova prodotti con descrizioni specifiche menzionate dall'utente
    console.log('\n=== RICERCA DESCRIZIONI SPECIFICHE ===');
    
    const specificDescriptions = [
      "Contributo ambientale CONAI assolto ove dovuto",
      "Imb. non soggetti aut. d'imposta-art.12.22 D.P.R. 633/92"
    ];
    
    for (const desc of specificDescriptions) {
      const exactMatches = await Product.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        description: { $regex: new RegExp(desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      });
      
      console.log(`\nRicerca per "${desc}": ${exactMatches.length} risultati`);
      
      exactMatches.forEach((product, index) => {
        console.log(`\n--- Match Esatto ${index + 1} ---`);
        console.log(`ID: ${product._id}`);
        console.log(`CodeInternal: ${product.codeInternal}`);
        console.log(`Descrizione: ${product.description}`);
        console.log(`Creato: ${product.createdAt}`);
        console.log(`Numero fornitori: ${product.prices ? product.prices.length : 0}`);
      });
    }
    
    // 6. Analisi statistica delle descrizioni
    console.log('\n=== ANALISI STATISTICA DELLE DESCRIZIONI ===');
    
    // Raggruppa i prodotti per lunghezza della descrizione
    const descriptionLengthGroups = {};
    longDescriptionProducts.forEach(product => {
      if (!product.description) return;
      
      const length = product.description.length;
      const group = Math.floor(length / 10) * 10; // Raggruppa per decine (0-9, 10-19, ecc.)
      
      if (!descriptionLengthGroups[group]) {
        descriptionLengthGroups[group] = [];
      }
      
      descriptionLengthGroups[group].push(product);
    });
    
    console.log('Distribuzione lunghezza descrizioni:');
    Object.keys(descriptionLengthGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(group => {
      console.log(`  ${group}-${parseInt(group) + 9} caratteri: ${descriptionLengthGroups[group].length} prodotti`);
    });
    
    // 7. Analisi delle righe fattura con prezzi bassi (potenzialmente note o spese accessorie)
    console.log('\n=== RIGHE FATTURA CON PREZZI MOLTO BASSI ===');
    
    const invoicesWithLowPrices = await Invoice.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      { $unwind: '$lineItems' },
      { $match: { 
        $and: [
          { 'lineItems.unitPrice': { $gt: 0 } }, // Prezzo maggiore di zero
          { 'lineItems.unitPrice': { $lt: 1 } }  // Ma inferiore a 1 euro
        ]
      }},
      { $project: {
        invoiceNumber: 1,
        invoiceDate: 1,
        supplierName: '$supplier.name',
        lineNumber: '$lineItems.lineNumber',
        description: '$lineItems.description',
        unitPrice: '$lineItems.unitPrice',
        quantity: '$lineItems.quantity',
        totalPrice: '$lineItems.totalPrice',
        matchedProductId: '$lineItems.matchedProductId',
        productMatchingStatus: '$lineItems.productMatchingStatus'
      }},
      { $sort: { invoiceDate: -1 } },
      { $limit: 20 }
    ]);
    
    console.log(`\nTrovate ${invoicesWithLowPrices.length} righe fattura con prezzi molto bassi (<1€) (ultime 20):`);
    
    invoicesWithLowPrices.forEach((item, index) => {
      console.log(`\n--- Riga Fattura Prezzo Basso ${index + 1} ---`);
      console.log(`Fattura: ${item.invoiceNumber} del ${new Date(item.invoiceDate).toLocaleDateString()}`);
      console.log(`Fornitore: ${item.supplierName}`);
      console.log(`Riga: ${item.lineNumber}`);
      console.log(`Descrizione: ${item.description}`);
      console.log(`Prezzo unitario: ${item.unitPrice}`);
      console.log(`Quantità: ${item.quantity}`);
      console.log(`Prezzo totale: ${item.totalPrice}`);
      console.log(`Stato matching: ${item.productMatchingStatus}`);
      console.log(`Prodotto associato: ${item.matchedProductId || 'Nessuno'}`);
    });
    
  } catch (error) {
    console.error('Errore durante la verifica:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

checkTenantProducts();