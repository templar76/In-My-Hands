/**
 * Script per applicare gli indici del database MongoDB
 * Questo script applica tutti gli indici definiti in database-indexes.js
 */

import mongoose from 'mongoose';
import databaseIndexes from '../config/database-indexes.js';
import dotenv from 'dotenv';
dotenv.config();

// Colori per output console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.magenta}${msg}${colors.reset}`)
};

/**
 * Applica gli indici per una collezione specifica
 * Migliora la gestione degli indici esistenti
 */
async function applyIndexesForCollection(collectionName, indexes) {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    log.info(`Applicando indici per la collezione: ${collectionName}`);
    
    // Ottieni gli indici esistenti
    const existingIndexes = await collection.listIndexes().toArray();
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const indexConfig of indexes) {
      const { fields, options } = indexConfig;
      const indexName = options.name || Object.keys(fields).join('_');
      
      try {
        // Controlla se esiste già un indice con la stessa struttura
        const existingIndex = existingIndexes.find(idx => {
          // Confronta le chiavi dell'indice
          const existingKeys = JSON.stringify(idx.key);
          const newKeys = JSON.stringify(fields);
          return existingKeys === newKeys || idx.name === indexName;
        });
        
        if (existingIndex) {
          log.warning(`  Indice '${indexName}' già esistente (nome: '${existingIndex.name}') - saltato`);
          skipped++;
          continue;
        }
        
        // Crea l'indice
        await collection.createIndex(fields, options);
        log.success(`  Indice '${indexName}' creato con successo`);
        created++;
        
      } catch (error) {
        // Gestisci errori specifici per indici duplicati
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.code === 85) {
          log.warning(`  Indice '${indexName}' già esistente (rilevato durante creazione) - saltato`);
          skipped++;
        } else {
          log.error(`  Errore creando indice '${indexName}': ${error.message}`);
          errors++;
        }
      }
    }
    
    log.info(`Collezione ${collectionName}: ${created} creati, ${skipped} saltati, ${errors} errori`);
    return { created, skipped, errors };
    
  } catch (error) {
    log.error(`Errore generale per collezione ${collectionName}: ${error.message}`);
    return { created: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Analizza le performance degli indici esistenti
 * Compatibile con MongoDB Atlas
 */
async function analyzeIndexPerformance() {
  try {
    log.header('\n=== ANALISI PERFORMANCE INDICI ===');
    const db = mongoose.connection.db;
    
    for (const collectionName of Object.keys(databaseIndexes)) {
      try {
        const collection = db.collection(collectionName);
        
        // Usa countDocuments invece di stats per compatibilità Atlas
        const documentCount = await collection.countDocuments();
        const indexes = await collection.listIndexes().toArray();
        
        log.info(`\nCollezione: ${collectionName}`);
        log.info(`  Documenti: ${documentCount.toLocaleString()}`);
        log.info(`  Indici: ${indexes.length}`);
        
        // Mostra informazioni sugli indici
        for (const index of indexes) {
          if (index.name !== '_id_') {
            log.info(`    - ${index.name}: ${JSON.stringify(index.key)}`);
          }
        }
        
      } catch (error) {
        log.warning(`  Collezione ${collectionName} non trovata o errore: ${error.message}`);
      }
    }
  } catch (error) {
    log.error(`Errore nell'analisi performance: ${error.message}`);
  }
}

/**
 * Verifica la salute degli indici
 * Compatibile con MongoDB Atlas
 */
async function checkIndexHealth() {
  try {
    log.header('\n=== VERIFICA SALUTE INDICI ===');
    const db = mongoose.connection.db;
    
    for (const collectionName of Object.keys(databaseIndexes)) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.listIndexes().toArray();
        
        log.info(`\nCollezione: ${collectionName}`);
        
        for (const index of indexes) {
          if (index.name === '_id_') continue; // Salta l'indice _id predefinito
          
          log.info(`  ✓ ${index.name}: ${JSON.stringify(index.key)}`);
          
          // Mostra proprietà dell'indice
          const properties = [];
          
          if (index.expireAfterSeconds !== undefined) {
            properties.push(`TTL: ${index.expireAfterSeconds}s`);
          }
          
          if (index.unique) {
            properties.push('Unico');
          }
          
          if (index.sparse) {
            properties.push('Sparse');
          }
          
          if (index.background) {
            properties.push('Background');
          }
          
          if (properties.length > 0) {
            log.info(`    Proprietà: ${properties.join(', ')}`);
          }
        }
        
      } catch (error) {
        log.warning(`  Errore verificando ${collectionName}: ${error.message}`);
      }
    }
  } catch (error) {
    log.error(`Errore nella verifica salute: ${error.message}`);
  }
}

/**
 * Verifica la connessione e compatibilità MongoDB Atlas
 */
async function verifyConnection() {
  try {
    const db = mongoose.connection.db;
    const admin = db.admin();
    
    // Test di connessione base
    await db.collection('test').findOne({});
    log.success('Connessione MongoDB Atlas verificata');
    
    // Verifica se è MongoDB Atlas
    try {
      const buildInfo = await admin.buildInfo();
      if (buildInfo.modules && buildInfo.modules.includes('enterprise')) {
        log.info('Rilevato MongoDB Atlas/Enterprise');
      }
    } catch (error) {
      // Ignora errori di buildInfo su Atlas
      log.info('Ambiente MongoDB Cloud rilevato');
    }
    
    return true;
  } catch (error) {
    log.error(`Errore verifica connessione: ${error.message}`);
    return false;
  }
}

/**
 * Funzione principale
 */
async function main() {
  try {
    log.header('=== APPLICAZIONE INDICI DATABASE MONGODB ===\n');
    
    // Connetti al database
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inmyhands';
    log.info(`Connessione a: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
    
    await mongoose.connect(mongoUri);
    log.success('Connesso al database MongoDB\n');
    
    // Verifica compatibilità
    const isConnected = await verifyConnection();
    if (!isConnected) {
      throw new Error('Impossibile verificare la connessione al database');
    }
    
    // Analizza performance prima dell'applicazione
    await analyzeIndexPerformance();
    
    // Applica gli indici
    log.header('\n=== APPLICAZIONE INDICI ===');
    
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const [collectionName, indexes] of Object.entries(databaseIndexes)) {
      const result = await applyIndexesForCollection(collectionName, indexes);
      totalCreated += result.created;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }
    
    // Riepilogo finale
    log.header('\n=== RIEPILOGO ===');
    log.info(`Indici creati: ${totalCreated}`);
    log.info(`Indici saltati: ${totalSkipped}`);
    log.info(`Errori: ${totalErrors}`);
    
    if (totalErrors === 0) {
      log.success('\nTutti gli indici sono stati applicati con successo!');
    } else {
      log.warning(`\nApplicazione completata con ${totalErrors} errori`);
    }
    
    // Verifica salute degli indici
    await checkIndexHealth();
    
    // Analizza performance dopo l'applicazione
    await analyzeIndexPerformance();
    
  } catch (error) {
    log.error(`Errore fatale: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log.info('\nDisconnesso dal database');
  }
}

// Gestione degli argomenti da linea di comando
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'apply':
    main();
    break;
  case 'analyze':
    mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inmyhands')
      .then(() => analyzeIndexPerformance())
      .then(() => mongoose.disconnect())
      .catch(console.error);
    break;
  case 'health':
    mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inmyhands')
      .then(() => checkIndexHealth())
      .then(() => mongoose.disconnect())
      .catch(console.error);
    break;
  default:
    console.log('\nUtilizzo:');
    console.log('  node apply-database-indexes.js apply   - Applica tutti gli indici');
    console.log('  node apply-database-indexes.js analyze - Analizza le performance');
    console.log('  node apply-database-indexes.js health  - Verifica la salute degli indici\n');
    break;
}