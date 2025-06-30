import mongoose from 'mongoose';
import Product from '../src/models/Product.js';
import Invoice from '../src/models/Invoice.js';
import ProductMatchingService from '../src/services/productMatchingService.js';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

/**
 * Script di migrazione per popolare il campo descriptions dei prodotti esistenti
 * utilizzando le descrizioni dalle fatture già importate
 */
async function migrateProductDescriptions() {
  try {
    console.log('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connesso a MongoDB');

    // Trova tutti i prodotti che hanno descriptions vuoto o non definito
    const productsToMigrate = await Product.find({
      $or: [
        { descriptions: { $exists: false } },
        { descriptions: { $size: 0 } }
      ]
    });

    console.log(`Trovati ${productsToMigrate.length} prodotti da migrare`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const product of productsToMigrate) {
      try {
        console.log(`Migrando prodotto ${product._id} - ${product.description}`);

        // Trova tutte le fatture che contengono questo prodotto
        const invoices = await Invoice.find({
          'lineItems.matchedProductId': product._id,
          'lineItems.productMatchingStatus': { $in: ['approved', 'matched'] }
        });

        const descriptionsToAdd = new Set();
        
        // Aggiungi la descrizione principale del prodotto
        if (product.description && product.description.trim()) {
          descriptionsToAdd.add(product.description.trim());
        }

        // Raccogli tutte le descrizioni uniche dalle fatture
        for (const invoice of invoices) {
          for (const lineItem of invoice.lineItems) {
            if (lineItem.matchedProductId && 
                lineItem.matchedProductId.toString() === product._id.toString() &&
                lineItem.description && 
                lineItem.description.trim()) {
              descriptionsToAdd.add(lineItem.description.trim());
            }
          }
        }

        // Inizializza l'array descriptions se non esiste
        if (!product.descriptions) {
          product.descriptions = [];
        }

        // Aggiungi tutte le descrizioni uniche
        for (const description of descriptionsToAdd) {
          const normalized = ProductMatchingService.normalizeDescription(description);
          
          // Verifica se la descrizione normalizzata esiste già
          const existingDesc = product.descriptions.find(
            desc => desc.normalized === normalized
          );

          if (!existingDesc) {
            product.descriptions.push({
              text: description,
              normalized,
              source: description === product.description ? 'original' : 'invoice',
              frequency: 1,
              lastSeen: new Date(),
              addedBy: null, // Migrazione automatica
              confidence: description === product.description ? 1.0 : 0.8
            });
          }
        }

        // Salva il prodotto aggiornato
        await product.save();
        migratedCount++;
        
        console.log(`✓ Prodotto ${product._id} migrato con ${product.descriptions.length} descrizioni`);
        
      } catch (productError) {
        console.error(`✗ Errore nella migrazione del prodotto ${product._id}:`, productError.message);
        errorCount++;
      }
    }

    console.log('\n=== RISULTATI MIGRAZIONE ===');
    console.log(`Prodotti migrati con successo: ${migratedCount}`);
    console.log(`Errori: ${errorCount}`);
    console.log(`Totale prodotti processati: ${productsToMigrate.length}`);

  } catch (error) {
    console.error('Errore durante la migrazione:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnesso da MongoDB');
  }
}

// Esegui la migrazione se lo script viene chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateProductDescriptions()
    .then(() => {
      console.log('Migrazione completata');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migrazione fallita:', error);
      process.exit(1);
    });
}

export default migrateProductDescriptions;