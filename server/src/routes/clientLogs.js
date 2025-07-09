// server/src/routes/clientLogs.js
import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/client-logs
router.post('/', async (req, res) => {
  try {
    const { timestamp, level, message, context } = req.body;
    
    // Valida i dati ricevuti
    if (!timestamp || !level || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: timestamp, level, message' 
      });
    }

    // Log strutturato con prefisso CLIENT
    const logMessage = `[CLIENT] ${message}`;
    const logContext = {
      ...context,
      clientTimestamp: timestamp,
      source: 'client'
    };

    // Usa il logger strutturato del server
    switch (level) {
      case 'debug':
        logger.debug(logMessage, logContext);
        break;
      case 'info':
        logger.info(logMessage, logContext);
        break;
      case 'warn':
        logger.warn(logMessage, logContext);
        break;
      case 'error':
        logger.error(logMessage, logContext);
        break;
      default:
        logger.info(logMessage, logContext);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Errore nel processare log client', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;