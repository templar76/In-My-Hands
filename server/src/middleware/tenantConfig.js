import Tenant from '../models/Tenant.js';

/**
 * Middleware per caricare e verificare la configurazione del product matching del tenant
 */
export const loadTenantConfig = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID non trovato' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    // Assicurati che la configurazione esista con valori di default
    if (!tenant.productMatchingConfig) {
      tenant.productMatchingConfig = {
        phase1: { enabled: true, confidenceThreshold: 0.7, autoApproveAbove: 0.9, requireManualReview: false },
        phase2: { enabled: true, handleUnmatched: true, createNewProducts: true, requireApprovalForNew: false },
        phase3: { enabled: false, analyticsLevel: 'basic', mlOptimization: false, continuousLearning: false, performanceTracking: true },
        globalSettings: {
          maxPendingReviews: 100,
          notificationThresholds: { pendingReviews: 50, lowConfidenceMatches: 20, unmatchedProducts: 30 },
          autoCleanupDays: 30
        }
      };
      await tenant.save();
    }

    req.tenantConfig = tenant.productMatchingConfig;
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Errore nel caricamento configurazione tenant:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Middleware per verificare se una specifica fase è abilitata
 */
export const requirePhase = (phase) => {
  return (req, res, next) => {
    if (!req.tenantConfig) {
      return res.status(500).json({ error: 'Configurazione tenant non caricata' });
    }

    const phaseConfig = req.tenantConfig[phase];
    if (!phaseConfig || !phaseConfig.enabled) {
      return res.status(403).json({ 
        error: `Fase ${phase} non abilitata per questo tenant`,
        phase,
        enabled: false
      });
    }

    next();
  };
};

/**
 * Middleware per verificare se l'utente è admin del tenant
 */
export const requireTenantAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori del tenant' });
  }
  next();
};

/**
 * Utility per ottenere la configurazione di una fase specifica
 */
export const getPhaseConfig = (tenantConfig, phase) => {
  return tenantConfig[phase] || null;
};

/**
 * Utility per verificare se una fase è abilitata
 */
export const isPhaseEnabled = (tenantConfig, phase) => {
  const phaseConfig = tenantConfig[phase];
  return phaseConfig && phaseConfig.enabled;
};

/**
 * Utility per ottenere tutte le fasi abilitate
 */
export const getEnabledPhases = (tenantConfig) => {
  const phases = [];
  if (isPhaseEnabled(tenantConfig, 'phase1')) phases.push('phase1');
  if (isPhaseEnabled(tenantConfig, 'phase2')) phases.push('phase2');
  if (isPhaseEnabled(tenantConfig, 'phase3')) phases.push('phase3');
  return phases;
};