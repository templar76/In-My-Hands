/**
 * Cache Service per ottimizzare le performance del database
 * Implementa strategie di caching per query frequenti
 */

import NodeCache from 'node-cache';
import crypto from 'crypto';

// Configurazione cache con TTL diversi per tipo di dato
const cacheConfigs = {
  // Cache per dati che cambiano raramente
  static: new NodeCache({ 
    stdTTL: 3600, // 1 ora
    checkperiod: 600, // Controlla ogni 10 minuti
    useClones: false
  }),
  
  // Cache per dati che cambiano frequentemente
  dynamic: new NodeCache({ 
    stdTTL: 300, // 5 minuti
    checkperiod: 60, // Controlla ogni minuto
    useClones: false
  }),
  
  // Cache per aggregazioni pesanti
  aggregations: new NodeCache({ 
    stdTTL: 1800, // 30 minuti
    checkperiod: 300, // Controlla ogni 5 minuti
    useClones: false
  }),
  
  // Cache per sessioni utente
  sessions: new NodeCache({ 
    stdTTL: 7200, // 2 ore
    checkperiod: 600, // Controlla ogni 10 minuti
    useClones: false
  })
};

/**
 * Genera una chiave cache basata sui parametri
 */
function generateCacheKey(prefix, params) {
  const paramString = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto.createHash('md5').update(paramString).digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * Wrapper per operazioni cache con logging
 */
function cacheOperation(cacheType, operation, key, data = null) {
  try {
    const cache = cacheConfigs[cacheType];
    if (!cache) {
      console.warn(`Cache type '${cacheType}' not found`);
      return null;
    }
    
    switch (operation) {
      case 'get':
        const result = cache.get(key);
        if (result) {
          console.log(`Cache HIT: ${key}`);
        }
        return result;
        
      case 'set':
        const success = cache.set(key, data);
        if (success) {
          console.log(`Cache SET: ${key}`);
        }
        return success;
        
      case 'del':
        cache.del(key);
        console.log(`Cache DEL: ${key}`);
        return true;
        
      case 'flush':
        cache.flushAll();
        console.log(`Cache FLUSH: ${cacheType}`);
        return true;
        
      default:
        console.warn(`Unknown cache operation: ${operation}`);
        return null;
    }
  } catch (error) {
    console.error(`Cache operation error: ${error.message}`);
    return null;
  }
}

class CacheService {
  /**
   * Cache per dati tenant (cambiano raramente)
   */
  static async getTenant(tenantId, fetchFunction) {
    const key = generateCacheKey('tenant', { tenantId });
    
    let tenant = cacheOperation('static', 'get', key);
    if (tenant) {
      return tenant;
    }
    
    tenant = await fetchFunction();
    if (tenant) {
      cacheOperation('static', 'set', key, tenant);
    }
    
    return tenant;
  }
  
  /**
   * Cache per dati utente
   */
  static async getUser(userId, tenantId, fetchFunction) {
    const key = generateCacheKey('user', { userId, tenantId });
    
    let user = cacheOperation('sessions', 'get', key);
    if (user) {
      return user;
    }
    
    user = await fetchFunction();
    if (user) {
      cacheOperation('sessions', 'set', key, user);
    }
    
    return user;
  }
  
  /**
   * Cache per lista fornitori (cambiano poco frequentemente)
   */
  static async getSuppliers(tenantId, filters, fetchFunction) {
    const key = generateCacheKey('suppliers', { tenantId, ...filters });
    
    let suppliers = cacheOperation('static', 'get', key);
    if (suppliers) {
      return suppliers;
    }
    
    suppliers = await fetchFunction();
    if (suppliers) {
      cacheOperation('static', 'set', key, suppliers);
    }
    
    return suppliers;
  }
  
  /**
   * Cache per prodotti con paginazione
   */
  static async getProducts(tenantId, queryParams, fetchFunction) {
    const key = generateCacheKey('products', { tenantId, ...queryParams });
    
    let products = cacheOperation('dynamic', 'get', key);
    if (products) {
      return products;
    }
    
    products = await fetchFunction();
    if (products) {
      cacheOperation('dynamic', 'set', key, products);
    }
    
    return products;
  }
  
  /**
   * Cache per aggregazioni pesanti (analytics, reports)
   */
  static async getAnalytics(tenantId, analysisType, params, fetchFunction) {
    const key = generateCacheKey('analytics', { tenantId, analysisType, ...params });
    
    let analytics = cacheOperation('aggregations', 'get', key);
    if (analytics) {
      return analytics;
    }
    
    analytics = await fetchFunction();
    if (analytics) {
      cacheOperation('aggregations', 'set', key, analytics);
    }
    
    return analytics;
  }
  
  /**
   * Cache per conteggi e statistiche
   */
  static async getStats(tenantId, statType, params, fetchFunction) {
    const key = generateCacheKey('stats', { tenantId, statType, ...params });
    
    let stats = cacheOperation('dynamic', 'get', key);
    if (stats) {
      return stats;
    }
    
    stats = await fetchFunction();
    if (stats) {
      cacheOperation('dynamic', 'set', key, stats);
    }
    
    return stats;
  }
  
  /**
   * Invalida cache per tenant specifico
   */
  static invalidateTenantCache(tenantId) {
    const patterns = [
      `tenant:*${tenantId}*`,
      `user:*${tenantId}*`,
      `suppliers:*${tenantId}*`,
      `products:*${tenantId}*`,
      `analytics:*${tenantId}*`,
      `stats:*${tenantId}*`
    ];
    
    Object.values(cacheConfigs).forEach(cache => {
      const keys = cache.keys();
      keys.forEach(key => {
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          if (regex.test(key)) {
            cache.del(key);
            console.log(`Cache invalidated: ${key}`);
          }
        });
      });
    });
  }
  
  /**
   * Invalida cache per prodotti quando vengono modificati
   */
  static invalidateProductCache(tenantId, productId = null) {
    const patterns = productId 
      ? [`products:*${tenantId}*`, `analytics:*${tenantId}*`, `stats:*${tenantId}*`]
      : [`products:*${tenantId}*`];
    
    Object.values(cacheConfigs).forEach(cache => {
      const keys = cache.keys();
      keys.forEach(key => {
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          if (regex.test(key)) {
            cache.del(key);
          }
        });
      });
    });
  }
  
  /**
   * Invalida cache per fornitori
   */
  static invalidateSupplierCache(tenantId, supplierId = null) {
    const patterns = [`suppliers:*${tenantId}*`, `analytics:*${tenantId}*`];
    
    Object.values(cacheConfigs).forEach(cache => {
      const keys = cache.keys();
      keys.forEach(key => {
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          if (regex.test(key)) {
            cache.del(key);
          }
        });
      });
    });
  }
  
  /**
   * Invalida cache per fatture (impatta analytics)
   */
  static invalidateInvoiceCache(tenantId) {
    const patterns = [`analytics:*${tenantId}*`, `stats:*${tenantId}*`];
    
    Object.values(cacheConfigs).forEach(cache => {
      const keys = cache.keys();
      keys.forEach(key => {
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          if (regex.test(key)) {
            cache.del(key);
          }
        });
      });
    });
  }
  
  /**
   * Ottieni statistiche cache
   */
  static getCacheStats() {
    const stats = {};
    
    Object.entries(cacheConfigs).forEach(([type, cache]) => {
      stats[type] = {
        keys: cache.keys().length,
        hits: cache.getStats().hits,
        misses: cache.getStats().misses,
        hitRate: cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses) || 0
      };
    });
    
    return stats;
  }
  
  /**
   * Pulisci tutte le cache
   */
  static flushAll() {
    Object.entries(cacheConfigs).forEach(([type, cache]) => {
      cache.flushAll();
      console.log(`Flushed ${type} cache`);
    });
  }
  
  /**
   * Middleware per cache automatica delle risposte API
   */
  static middleware(cacheType = 'dynamic', ttl = null) {
    return (req, res, next) => {
      const originalSend = res.send;
      const cacheKey = generateCacheKey('api', {
        url: req.originalUrl,
        method: req.method,
        tenantId: req.user?.tenantId,
        userId: req.user?.uid
      });
      
      // Prova a ottenere dalla cache
      const cachedResponse = cacheOperation(cacheType, 'get', cacheKey);
      if (cachedResponse && req.method === 'GET') {
        return res.json(cachedResponse);
      }
      
      // Override del metodo send per cachare la risposta
      res.send = function(data) {
        if (req.method === 'GET' && res.statusCode === 200) {
          try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            cacheOperation(cacheType, 'set', cacheKey, parsedData);
          } catch (error) {
            console.warn('Failed to cache response:', error.message);
          }
        }
        originalSend.call(this, data);
      };
      
      next();
    };
  }
}

export default CacheService;