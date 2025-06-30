import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from 'dotenv';
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

dotenv.config();


// Risolvo il percorso al JSON dal .env
const serviceAccountPath = path.resolve(
  __dirname,
  '..',
  (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || 'serviceAccountKey.json')
);

// Carico il JSON con le credenziali
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Inizializzo Admin SDK
const app = initializeApp({
  credential: cert(serviceAccount),
});
// Inizializza Firebase Authentication 
const auth = getAuth(app);
// Inizializza Firebase Storage
const storage = getStorage(app);
// Esporta l'istanza di Firebase Authentication, Storage, ecc.
export { app, auth, storage };