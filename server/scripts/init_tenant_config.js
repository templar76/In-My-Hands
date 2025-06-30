import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tenant from '../src/models/Tenant.js';

dotenv.config();

async function initTenantConfig() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connesso a MongoDB');

    const tenantId = '68221dec18e64985fb2a86e6';
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      console.log('❌ Tenant non trovato');
      return;
    }

    // Inizializza configurazione product matching
    tenant.productMatchingConfig = {
      phase1: {
        enabled: true,
        confidenceThreshold: 0.7,
        autoApproveAbove: 0.9,
        requireManualReview: false
      },
      phase2: {
        enabled: true,
        requireApprovalForNew: false
      },
      phase3: {
        enabled: false
      }
    };

    await tenant.save();
    console.log('✅ Configurazione product matching inizializzata!');
    console.log('\nConfigurazione impostata:');
    console.log('- Phase 1: Matching automatico abilitato (soglia 0.7, auto-approvazione 0.9)');
    console.log('- Phase 2: Creazione automatica nuovi prodotti abilitata');
    console.log('- Phase 3: Disabilitata');

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

initTenantConfig();