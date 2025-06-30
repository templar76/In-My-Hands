import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function fixProductMatching() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connesso a MongoDB');

    // Leggi il file invoiceController.js
    const filePath = './src/controllers/invoiceController.js';
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Trova la sezione da sostituire (dopo bestMatch.save())
    const searchPattern = /await bestMatch\.save\(\);\s*\/\/ Aggiungi la descrizione della fattura come descrizione alternativa/;
    const replacement = `await bestMatch.save();
    
    // Aggiorna il lineItem nella fattura con il matchedProductId
    await Invoice.updateOne(
      { 
        _id: invoiceId,
        'lineItems.lineNumber': line.numeroLinea
      },
      {
        $set: {
          'lineItems.$.matchedProductId': bestMatch._id,
          'lineItems.$.productMatchingStatus': productMatchingStatus,
          'lineItems.$.codeInternal': bestMatch.codeInternal
        }
      }
    );
    
    // Aggiungi la descrizione della fattura come descrizione alternativa`;
    
    if (searchPattern.test(content)) {
      content = content.replace(searchPattern, replacement);
      console.log('✅ Aggiornato il codice per bestMatch');
    } else {
      console.log('⚠️ Pattern per bestMatch non trovato');
    }
    
    // Trova la sezione per i nuovi prodotti (dopo newProduct.save())
    const newProductPattern = /await newProduct\.save\(\);\s*importResults\.push\(/;
    const newProductReplacement = `await newProduct.save();
    
    // Aggiorna il lineItem nella fattura con il nuovo prodotto
    await Invoice.updateOne(
      { 
        _id: invoiceId,
        'lineItems.lineNumber': line.numeroLinea
      },
      {
        $set: {
          'lineItems.$.matchedProductId': newProduct._id,
          'lineItems.$.productMatchingStatus': productMatchingStatus,
          'lineItems.$.codeInternal': newProduct.codeInternal
        }
      }
    );
    
    importResults.push(`;
    
    if (newProductPattern.test(content)) {
      content = content.replace(newProductPattern, newProductReplacement);
      console.log('✅ Aggiornato il codice per newProduct');
    } else {
      console.log('⚠️ Pattern per newProduct non trovato');
    }
    
    // Salva il file aggiornato
    fs.writeFileSync(filePath, content);
    console.log('✅ File invoiceController.js aggiornato!');
    
    console.log('\n🎯 Ora riavvia il server e ricarica una fattura per testare.');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixProductMatching();