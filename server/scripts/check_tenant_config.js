import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tenant from '../src/models/Tenant.js';

dotenv.config();

async function checkTenantConfig() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connesso a MongoDB');

    const tenantId = '68221dec18e64985fb2a86e6';
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      console.log('❌ Tenant non trovato');
      return;
    }

    console.log('\n📋 Configurazione Product Matching:');
    console.log('Configurazione esistente:', !!tenant.productMatchingConfig);
    
    if (tenant.productMatchingConfig) {
      console.log('\nDettagli configurazione:');
      console.log('Phase 1 (Product Matching):');
      console.log('  - Abilitata:', tenant.productMatchingConfig.phase1?.enabled || false);
      console.log('  - Soglia confidenza:', tenant.productMatchingConfig.phase1?.confidenceThreshold || 'non impostata');
      console.log('  - Auto-approvazione sopra:', tenant.productMatchingConfig.phase1?.autoApproveAbove || 'non impostata');
      console.log('  - Richiede revisione manuale:', tenant.productMatchingConfig.phase1?.requireManualReview || false);
      
      console.log('\nPhase 2 (Nuovi Prodotti):');
      console.log('  - Abilitata:', tenant.productMatchingConfig.phase2?.enabled || false);
      console.log('  - Richiede approvazione per nuovi:', tenant.productMatchingConfig.phase2?.requireApprovalForNew || false);
    } else {
      console.log('❌ Nessuna configurazione trovata!');
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkTenantConfig();