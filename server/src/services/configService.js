import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigService {
  constructor() {
    this.config = null;
    this.configPath = path.join(__dirname, '../../config/alertMonitoring.json');
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
        logger.info('Configurazione alert monitoring caricata', {
          configPath: this.configPath,
          service: 'ConfigService'
        });
      } else {
        // Configurazione di default
        this.config = {
          alertMonitoring: {
            checkIntervalMinutes: 60,
            watchdogIntervalMinutes: 5,
            maxConsecutiveErrors: 3,
            heartbeatTimeoutMinutes: 70,
            restartDelayMs: 1000,
            enabled: true,
            logging: {
              enableDebugLogs: false,
              enableHealthCheckLogs: true
            }
          }
        };
        
        logger.warn('File di configurazione non trovato, uso configurazione di default', {
          configPath: this.configPath,
          service: 'ConfigService'
        });
      }
    } catch (error) {
      logger.error('Errore nel caricamento della configurazione', {
        error: error.message,
        configPath: this.configPath,
        service: 'ConfigService'
      });
      
      // Fallback alla configurazione di default
      this.config = {
        alertMonitoring: {
          checkIntervalMinutes: 60,
          watchdogIntervalMinutes: 5,
          maxConsecutiveErrors: 3,
          heartbeatTimeoutMinutes: 70,
          restartDelayMs: 1000,
          enabled: true,
          logging: {
            enableDebugLogs: false,
            enableHealthCheckLogs: true
          }
        }
      };
    }
  }

  getAlertMonitoringConfig() {
    return this.config.alertMonitoring;
  }

  reloadConfig() {
    logger.info('Ricaricamento configurazione alert monitoring', {
      service: 'ConfigService'
    });
    this.loadConfig();
    return this.config.alertMonitoring;
  }

  updateConfig(newConfig) {
    try {
      this.config.alertMonitoring = { ...this.config.alertMonitoring, ...newConfig };
      
      // Crea la directory se non esiste
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      
      logger.info('Configurazione alert monitoring aggiornata', {
        newConfig,
        service: 'ConfigService'
      });
      
      return true;
    } catch (error) {
      logger.error('Errore nell\'aggiornamento della configurazione', {
        error: error.message,
        service: 'ConfigService'
      });
      return false;
    }
  }
}

export default new ConfigService();