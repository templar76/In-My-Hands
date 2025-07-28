import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tenant from '../src/models/Tenant.js';

dotenv.config({ path: '.env.test' });

async function initTenantConfig() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connesso a MongoDB');

    const tenantId = '68865b0af056f6331c3b41a8';
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      console.log('❌ Tenant non trovato');
      return;
    }

    // Inizializza configurazione product matching
    tenant.productMatchingConfig = {
      phase1: { 
        enabled: true,
        confidenceThreshold: 0.8, // Aggiornato da 0.7 a 0.8 per allinearsi con productMatchingService
        autoApproveAbove: 0.9, 
        requireManualReview: false
      },
      phase2: { 
        enabled: true,
        handleUnmatched: true, // Aggiunto campo mancante
        createNewProducts: true, // Aggiunto campo mancante
        requireApprovalForNew: false
      },
      phase3: { 
        enabled: false,
        analyticsLevel: 'basic', // Aggiunto campo mancante
        mlOptimization: false, // Aggiunto campo mancante
        continuousLearning: false, // Aggiunto campo mancante
        performanceTracking: true // Aggiunto campo mancante
      },
      globalSettings: { // Aggiunta sezione mancante
        maxPendingReviews: 100,
        notificationThresholds: { pendingReviews: 50, lowConfidenceMatches: 20, unmatchedProducts: 30 },
        autoCleanupDays: 30
      }
    };

    await tenant.save();
    console.log('✅ Configurazione product matching inizializzata!');
    console.log('\nConfigurazione impostata:');
    console.log('- Phase 1: Matching automatico abilitato (soglia 0.8, auto-approvazione 0.9)');
    console.log('- Phase 2: Creazione automatica nuovi prodotti abilitata');
    console.log('- Phase 3: Disabilitata');

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

initTenantConfig();