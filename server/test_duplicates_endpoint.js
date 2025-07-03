const axios = require('axios');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Carica le variabili d'ambiente
dotenv.config();

// Configurazione Firebase Admin usando variabili d'ambiente
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
  
  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  } catch (error) {
    console.error('❌ Errore configurazione Firebase Admin:', error.message);
    console.log('💡 Assicurati di avere il file serviceAccountKey.json o configura FIREBASE_SERVICE_ACCOUNT_PATH');
  }
}

// Configurazione da variabili d'ambiente
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

// Verifica configurazione
function checkConfiguration() {
  console.log('🔧 Configurazione corrente:');
  console.log('   API_BASE_URL:', API_BASE_URL);
  console.log('   TEST_USER_EMAIL:', TEST_USER_EMAIL);
  console.log('   FIREBASE_PROJECT_ID:', FIREBASE_PROJECT_ID || 'NON CONFIGURATO');
  console.log('   MONGO_URI:', process.env.MONGO_URI ? 'CONFIGURATO' : 'NON CONFIGURATO');
  console.log('');
  
  if (!FIREBASE_PROJECT_ID) {
    console.warn('⚠️  FIREBASE_PROJECT_ID non configurato nel file .env');
  }
}

async function generateTestToken() {
  try {
    // Genera un custom token per l'utente di test
    const customToken = await admin.auth().createCustomToken(TEST_USER_EMAIL);
    console.log('✅ Custom token generato per:', TEST_USER_EMAIL);
    return customToken;
  } catch (error) {
    console.error('❌ Errore nella generazione del token:', error.message);
    throw error;
  }
}

async function testDuplicatesEndpoint() {
  try {
    console.log('🚀 Avvio test endpoint duplicati...');
    console.log('📍 URL di test:', `${API_BASE_URL}/api/product-duplicates`);
    
    // Genera il token di test
    const token = await generateTestToken();
    
    // Test 1: GET /api/product-duplicates
    console.log('\n📋 Test 1: Recupero duplicati');
    const response = await axios.get(`${API_BASE_URL}/api/product-duplicates`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Status:', response.status);
    console.log('✅ Headers:', response.headers['content-type']);
    console.log('✅ Dati ricevuti:', {
      groups: response.data.groups?.length || 0,
      totalProducts: response.data.groups?.reduce((acc, group) => acc + (group.products?.length || 0), 0) || 0
    });
    
    // Test 2: Verifica struttura dati
    console.log('\n🔍 Test 2: Verifica struttura dati');
    if (response.data.groups && response.data.groups.length > 0) {
      const firstGroup = response.data.groups[0];
      console.log('✅ Primo gruppo:', {
        groupId: firstGroup.groupId,
        productsCount: firstGroup.products?.length || 0,
        firstProduct: firstGroup.products?.[0] ? {
          id: firstGroup.products[0]._id,
          supplier: firstGroup.products[0].supplierName,
          description: firstGroup.products[0].description?.substring(0, 50) + '...'
        } : 'Nessun prodotto'
      });
      
      // Test 3: Test merge (solo se ci sono gruppi)
      if (firstGroup.groupId && firstGroup.products?.length > 1) {
        console.log('\n🔄 Test 3: Test merge (simulato)');
        console.log('⚠️  Merge non eseguito per sicurezza, ma endpoint disponibile:');
        console.log(`   POST ${API_BASE_URL}/api/product-duplicates/${encodeURIComponent(firstGroup.groupId)}/merge`);
      }
      
      // Test 4: Test ignore (solo se ci sono gruppi)
      if (firstGroup.groupId) {
        console.log('\n🚫 Test 4: Test ignore (simulato)');
        console.log('⚠️  Ignore non eseguito per sicurezza, ma endpoint disponibile:');
        console.log(`   POST ${API_BASE_URL}/api/product-duplicates/${encodeURIComponent(firstGroup.groupId)}/ignore`);
      }
    } else {
      console.log('ℹ️  Nessun gruppo di duplicati trovato');
    }
    
    console.log('\n🎉 Test completato con successo!');
    
  } catch (error) {
    console.error('\n❌ Errore durante il test:');
    console.error('📍 URL:', error.config?.url);
    console.error('📊 Status:', error.response?.status);
    console.error('📝 Message:', error.message);
    console.error('📄 Response Data:', error.response?.data);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Suggerimento: Assicurati che il server sia in esecuzione');
      console.error(`   URL configurato: ${API_BASE_URL}`);
      console.error('   Comando: cd server && npm run dev');
    }
    
    if (error.response?.status === 401) {
      console.error('\n💡 Suggerimento: Problema di autenticazione');
      console.error('   - Verifica FIREBASE_PROJECT_ID nel file .env');
      console.error('   - Controlla che il serviceAccountKey.json sia presente');
      console.error('   - Verifica che l\'utente di test esista nel progetto Firebase');
    }
    
    if (error.response?.status === 404) {
      console.error('\n💡 Suggerimento: Endpoint non trovato');
      console.error('   - Verifica che le route siano configurate correttamente in server.js');
      console.error('   - Controlla che productDuplicateRoutes sia montato su /api/product-duplicates');
    }
  }
}

// Test di connettività di base
async function testServerConnectivity() {
  try {
    console.log('🔗 Test connettività server...');
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Server raggiungibile');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`❌ Server non raggiungibile su ${API_BASE_URL}`);
      console.error('💡 Avvia il server con: cd server && npm run dev');
    } else {
      console.log('⚠️  Endpoint /health non disponibile, ma server potrebbe essere attivo');
    }
    return false;
  }
}

// Esecuzione principale
async function main() {
  console.log('🧪 === TEST ENDPOINT DUPLICATI PRODOTTI ===\n');
  
  // Mostra configurazione
  checkConfiguration();
  
  // Test connettività
  await testServerConnectivity();
  
  // Test principale
  await testDuplicatesEndpoint();
}

// Esegui il test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testDuplicatesEndpoint, generateTestToken };