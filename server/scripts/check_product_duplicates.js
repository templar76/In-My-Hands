import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const checkProductDuplicates = async () => {
  try {
    await mongoose.connect('mongodb+srv://application:rLD1zfOaXtbKnIFU@cluster0.peplrpi.mongodb.net?retryWrites=true&w=majority');
    console.log('Connesso a MongoDB');
    
    // 1. Verifica duplicati per codeInternal
    console.log('\n=== VERIFICA DUPLICATI CODEINTERNAL ===');
    const codeInternalDuplicates = await Product.aggregate([
      {
        $group: {
          _id: '$codeInternal',
          count: { $sum: 1 },
          products: { $push: { id: '$_id', description: '$description', createdAt: '$createdAt' } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log(`Trovati ${codeInternalDuplicates.length} gruppi di duplicati per codeInternal:`);
    codeInternalDuplicates.forEach((group, index) => {
      console.log(`\n--- Gruppo ${index + 1} (${group.count} duplicati) ---`);
      console.log(`CodeInternal: ${group._id}`);
      group.products.forEach((product, pIndex) => {
        console.log(`  ${pIndex + 1}. ID: ${product.id}`);
        console.log(`     Descrizione: ${product.description ? product.description.substring(0, 60) + '...' : 'N/A'}`);
        console.log(`     Creato: ${product.createdAt}`);
      });
    });
    
    // 2. Verifica duplicati per descrizione standardizzata
    console.log('\n\n=== VERIFICA DUPLICATI DESCRIZIONE STANDARDIZZATA ===');
    const descriptionDuplicates = await Product.aggregate([
      {
        $group: {
          _id: '$descriptionStd',
          count: { $sum: 1 },
          products: { $push: { 
            id: '$_id', 
            codeInternal: '$codeInternal',
            description: '$description', 
            createdAt: '$createdAt' 
          } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10 // Limita ai primi 10 per non sovraccaricare l'output
      }
    ]);
    
    console.log(`Trovati ${descriptionDuplicates.length} gruppi di duplicati per descrizione (primi 10):`);
    descriptionDuplicates.forEach((group, index) => {
      console.log(`\n--- Gruppo ${index + 1} (${group.count} duplicati) ---`);
      console.log(`DescriptionStd: ${group._id}`);
      group.products.forEach((product, pIndex) => {
        console.log(`  ${pIndex + 1}. ID: ${product.id}`);
        console.log(`     CodeInternal: ${product.codeInternal}`);
        console.log(`     Descrizione: ${product.description ? product.description.substring(0, 60) + '...' : 'N/A'}`);
        console.log(`     Creato: ${product.createdAt}`);
      });
    });
    
    // 3. Statistiche generali
    console.log('\n\n=== STATISTICHE GENERALI ===');
    const totalProducts = await Product.countDocuments({});
    const uniqueCodeInternals = await Product.distinct('codeInternal').then(arr => arr.length);
    const uniqueDescriptions = await Product.distinct('descriptionStd').then(arr => arr.length);
    
    console.log(`Totale prodotti: ${totalProducts}`);
    console.log(`CodeInternal unici: ${uniqueCodeInternals}`);
    console.log(`Descrizioni standardizzate uniche: ${uniqueDescriptions}`);
    console.log(`Duplicati codeInternal: ${totalProducts - uniqueCodeInternals}`);
    console.log(`Duplicati descrizione: ${totalProducts - uniqueDescriptions}`);
    
    // 4. Verifica pattern codeInternal
    console.log('\n\n=== ANALISI PATTERN CODEINTERNAL ===');
    const codePatterns = await Product.aggregate([
      {
        $project: {
          codeInternal: 1,
          pattern: {
            $cond: {
              if: { $regexMatch: { input: '$codeInternal', regex: /^PROD-\d+-\w+-\d+$/ } },
              then: 'PROD-timestamp-random-lineNumber',
              else: {
                $cond: {
                  if: { $regexMatch: { input: '$codeInternal', regex: /^PROD-\d+-\w+$/ } },
                  then: 'PROD-timestamp-random',
                  else: 'other'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$pattern',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('Pattern codeInternal trovati:');
    codePatterns.forEach(pattern => {
      console.log(`  ${pattern._id}: ${pattern.count} prodotti`);
    });
    
  } catch (error) {
    console.error('Errore durante la verifica:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnesso da MongoDB');
  }
};

checkProductDuplicates();