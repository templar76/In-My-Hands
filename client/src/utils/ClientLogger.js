// src/utils/ClientLogger.js
import { getApiUrl } from './apiConfig';

class ClientLogger {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.logLevel = process.env.REACT_APP_LOG_LEVEL || 'debug';
    this.enableServerLogging = process.env.REACT_APP_ENABLE_SERVER_LOGGING === 'true';
    this.enableLocalStorage = process.env.REACT_APP_ENABLE_LOCAL_STORAGE === 'true';
    this.maxLocalStorageLogs = 100;
    this.retryQueue = [];
    
    // Inizializza il retry dei log falliti
    this.initRetryMechanism();
  }

  // Metodi principali di logging
  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }

  info(message, context = {}) {
    if (this.shouldLog('info')) {
      this.log('info', message, context);
    }
  }

  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      this.log('warn', message, context);
    }
  }

  error(message, context = {}) {
    if (this.shouldLog('error')) {
      this.log('error', message, context);
    }
  }

  // Metodo principale di logging
  log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        environment: this.environment
      }
    };

    // Console logging (sempre attivo in development)
    if (this.environment === 'development') {
      this.logToConsole(level, message, logEntry.context);
    }

    // Local storage (solo in development se abilitato)
    if (this.enableLocalStorage && this.environment === 'development') {
      this.logToLocalStorage(logEntry);
    }

    // Server logging (beta e production per warn/error, development se abilitato)
    if (this.shouldSendToServer(level)) {
      this.logToServer(logEntry);
    }
  }

  // Determina se il log deve essere inviato al server
  shouldSendToServer(level) {
    if (!this.enableServerLogging) return false;
    
    switch (this.environment) {
      case 'development':
        return false; // In development non inviamo al server
      case 'beta':
        return ['warn', 'error'].includes(level);
      case 'production':
        return ['warn', 'error'].includes(level);
      default:
        return false;
    }
  }

  // Determina se il log deve essere processato
  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  // Log alla console
  logToConsole(level, message, context) {
    const style = this.getConsoleStyle(level);
    const timestamp = new Date().toLocaleTimeString();
    
    switch (level) {
      case 'debug':
        console.debug(`%c[${timestamp}] DEBUG: ${message}`, style, context);
        break;
      case 'info':
        console.info(`%c[${timestamp}] INFO: ${message}`, style, context);
        break;
      case 'warn':
        console.warn(`%c[${timestamp}] WARN: ${message}`, style, context);
        break;
      case 'error':
        console.error(`%c[${timestamp}] ERROR: ${message}`, style, context);
        break;
    }
  }

  // Stili per la console
  getConsoleStyle(level) {
    const styles = {
      debug: 'color: #888; font-weight: normal;',
      info: 'color: #2196F3; font-weight: bold;',
      warn: 'color: #FF9800; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;'
    };
    return styles[level] || styles.info;
  }

  // Log al localStorage
  logToLocalStorage(logEntry) {
    try {
      const logs = JSON.parse(localStorage.getItem('clientLogs') || '[]');
      logs.push(logEntry);
      
      // Mantieni solo gli ultimi N log
      if (logs.length > this.maxLocalStorageLogs) {
        logs.splice(0, logs.length - this.maxLocalStorageLogs);
      }
      
      localStorage.setItem('clientLogs', JSON.stringify(logs));
    } catch (error) {
      console.error('Errore nel salvare log in localStorage:', error);
    }
  }

  // Log al server
  async logToServer(logEntry) {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/client-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      // Aggiungi alla coda di retry
      this.retryQueue.push(logEntry);
      console.warn('Errore nell\'invio log al server, aggiunto alla coda di retry:', error);
    }
  }

  // Meccanismo di retry
  initRetryMechanism() {
    // Retry ogni 30 secondi
    setInterval(() => {
      this.processRetryQueue();
    }, 30000);
  }

  async processRetryQueue() {
    if (this.retryQueue.length === 0) return;

    const logsToRetry = [...this.retryQueue];
    this.retryQueue = [];

    for (const logEntry of logsToRetry) {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/client-logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logEntry)
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (error) {
        // Se fallisce ancora, rimetti in coda (max 3 tentativi)
        if (!logEntry.retryCount) logEntry.retryCount = 0;
        if (logEntry.retryCount < 3) {
          logEntry.retryCount++;
          this.retryQueue.push(logEntry);
        }
      }
    }
  }

  // Utility per ottenere i log dal localStorage
  getLocalLogs() {
    try {
      return JSON.parse(localStorage.getItem('clientLogs') || '[]');
    } catch (error) {
      console.error('Errore nel leggere log da localStorage:', error);
      return [];
    }
  }

  // Utility per pulire i log dal localStorage
  clearLocalLogs() {
    try {
      localStorage.removeItem('clientLogs');
    } catch (error) {
      console.error('Errore nel pulire log da localStorage:', error);
    }
  }
}

// Esporta un'istanza singleton
const logger = new ClientLogger();
export default logger;