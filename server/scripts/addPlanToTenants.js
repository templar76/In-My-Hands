import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ottieni il percorso del file corrente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carica le variabili d'ambiente dal file .env nella directory server
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Connessione a MongoDB
const connectDB = async () => {
  try {
    // Usa MONGO_URI invece di MONGODB_URI
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI non trovato nelle variabili d\'ambiente');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connesso a MongoDB');
  } catch (error) {
    console.error('❌ Errore connessione MongoDB:', error.message);
    process.exit(1);
  }
};

// Schema Tenant (versione semplificata per lo script)
const tenantSchema = new mongoose.Schema({
  companyType: String,
  companyName: String,
  vatNumber: String,
  codiceFiscale: String,
  address: String,
  plan: { type: String, enum: ['free', 'monthly', 'annual'], default: 'free' },
  contacts: {
    email: String,
    phone: String,
    sdiCode: String,
    pec: String
  },
  productMatchingConfig: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const Tenant = mongoose.model('Tenant', tenantSchema);

const addPlanToTenants = async () => {
  try {
    console.log('🚀 Inizio migrazione: aggiunta campo plan ai tenant...');
    
    // Trova tutti i tenant che non hanno il campo plan
    const tenantsWithoutPlan = await Tenant.find({
      $or: [
        { plan: { $exists: false } },
        { plan: null },
        { plan: '' }
      ]
    });
    
    console.log(`📊 Trovati ${tenantsWithoutPlan.length} tenant senza campo plan`);
    
    if (tenantsWithoutPlan.length === 0) {
      console.log('✅ Tutti i tenant hanno già il campo plan configurato');
      return;
    }
    
    // Mostra i tenant che verranno aggiornati
    console.log('📋 Tenant che verranno aggiornati:');
    tenantsWithoutPlan.forEach((tenant, index) => {
      console.log(`   ${index + 1}. ${tenant.companyName} (${tenant.vatNumber})`);
    });
    
    // Aggiorna tutti i tenant impostando plan = 'free'
    const updateResult = await Tenant.updateMany(
      {
        $or: [
          { plan: { $exists: false } },
          { plan: null },
          { plan: '' }
        ]
      },
      {
        $set: { plan: 'free' }
      }
    );
    
    console.log(`✅ Aggiornati ${updateResult.modifiedCount} tenant con plan = 'free'`);
    
    // Verifica finale
    const allTenants = await Tenant.find({});
    const tenantsWithPlan = await Tenant.find({ plan: { $exists: true, $ne: null, $ne: '' } });
    
    console.log('📈 Riepilogo finale:');
    console.log(`   - Totale tenant: ${allTenants.length}`);
    console.log(`   - Tenant con campo plan: ${tenantsWithPlan.length}`);
    
    // Mostra la distribuzione dei piani
    const planDistribution = await Tenant.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('📊 Distribuzione piani:');
    planDistribution.forEach(item => {
      console.log(`   - ${item._id || 'undefined'}: ${item.count} tenant`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  }
};

const main = async () => {
  try {
    console.log('🔧 Caricamento configurazione...');
    console.log(`📁 Directory script: ${__dirname}`);
    console.log(`🔗 MONGO_URI: ${process.env.MONGO_URI ? 'Configurato' : 'NON TROVATO'}`);
    
    await connectDB();
    await addPlanToTenants();
    console.log('🎉 Migrazione completata con successo!');
  } catch (error) {
    console.error('💥 Errore durante l\'esecuzione dello script:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connessione MongoDB chiusa');
    process.exit(0);
  }
};

// Esegui lo script
main();