import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  logger.error('MongoDB URI not defined in environment variables', {
    component: 'database',
    action: 'connection_init',
    error: 'MONGO_URI_MISSING'
  });
  process.exit(1);
}

logger.info('Attempting MongoDB connection', {
  component: 'database',
  action: 'connection_attempt',
  uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Nasconde credenziali
});

mongoose.connect(uri, {})
  .then(() => {
    logger.info('Successfully connected to MongoDB Atlas', {
      component: 'database',
      action: 'connection_success',
      status: 'connected'
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', {
      component: 'database',
      action: 'connection_failed',
      error: err.message,
      stack: err.stack
    });
  });

export default mongoose;
