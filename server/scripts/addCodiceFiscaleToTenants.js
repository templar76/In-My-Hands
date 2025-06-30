import mongoose from 'mongoose';
import Tenant from '../src/models/Tenant.js'; // Assicurati che il percorso sia corretto
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/templar76/@PROGETTI_APP/In_My_Hands/Code/Ver_01b_GPT_subscription/in-my-hands/server/.env' }); // Carica le variabili d'ambiente dal file .env del server

const MONGODB_URI = process.env.MONGO_URI; // Assicurati che questa variabile sia definita nel tuo .env

async function addCodiceFiscaleToExistingTenants() {
  if (!MONGODB_URI) {
    console.error('MONGO_URI non è definito nel file .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connesso a MongoDB.');

    const tenantsWithoutCodiceFiscale = await Tenant.find({ codiceFiscale: { $exists: false } });

    if (tenantsWithoutCodiceFiscale.length === 0) {
      console.log('Nessun tenant senza codiceFiscale trovato. Nessun aggiornamento necessario.');
      mongoose.connection.close();
      return;
    }

    console.log(`Trovati ${tenantsWithoutCodiceFiscale.length} tenant da aggiornare.`);

    for (const tenant of tenantsWithoutCodiceFiscale) {
      // Qui dovrai decidere come generare o ottenere il codice fiscale per ogni tenant.
      // Questo è un esempio. Potresti doverlo chiedere all'utente o recuperarlo da un'altra fonte.
      const newCodiceFiscale = `CF_${tenant.vatNumber || tenant._id}`; // Esempio: usa P.IVA o ID come base

      try {
        await Tenant.updateOne(
          { _id: tenant._id },
          { $set: { codiceFiscale: newCodiceFiscale } }
        );
        console.log(`Aggiornato tenant ${tenant.companyName} con codiceFiscale: ${newCodiceFiscale}`);
      } catch (error) {
        if (error.code === 11000) { // Errore di duplicato (se codiceFiscale è unique)
          console.warn(`Attenzione: Codice Fiscale duplicato per ${tenant.companyName}. Saltato. Errore: ${error.message}`);
        } else {
          console.error(`Errore durante l'aggiornamento del tenant ${tenant.companyName}: ${error.message}`);
        }
      }
    }

    console.log('Aggiornamento completato.');
  } catch (error) {
    console.error('Errore di connessione o durante l\'operazione:', error);
  } finally {
    mongoose.connection.close();
    console.log('Connessione a MongoDB chiusa.');
  }
}

addCodiceFiscaleToExistingTenants();