import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI non definito in .env');
  process.exit(1);
}

console.log(`Tentativo di connessione a MongoDB con URI: ${uri}`);
mongoose.connect(uri, {

})
  .then(() => {
    console.log('Connesso a MongoDB Atlas');
  })
  .catch((err) => {
    console.error('Errore di connessione a MongoDB:', err);
  });

export default mongoose;
