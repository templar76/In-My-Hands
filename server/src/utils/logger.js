// Logger semplice per il progetto
const logger = {
  info: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${message}`, meta);
    }
  },
  warn: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${message}`, meta);
    }
  },
  error: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[ERROR] ${message}`, meta);
    }
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, meta);
    }
  }
};

export default logger;