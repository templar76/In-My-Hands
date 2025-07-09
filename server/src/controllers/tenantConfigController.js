import Tenant from '../models/Tenant.js';
import { getEnabledPhases, isPhaseEnabled } from '../middleware/tenantConfig.js';
import logger from '../utils/logger.js';

/**
 * Ottiene la configurazione completa del product matching per il tenant
 */
export const getTenantConfig = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    const config = tenant.productMatchingConfig || {};
    const enabledPhases = getEnabledPhases(config);

    res.json({
      config,
      enabledPhases,
      summary: {
        phase1Enabled: isPhaseEnabled(config, 'phase1'),
        phase2Enabled: isPhaseEnabled(config, 'phase2'),
        phase3Enabled: isPhaseEnabled(config, 'phase3'),
        totalEnabledPhases: enabledPhases.length
      }
    });
  } catch (error) {
    logger.error('Errore nel recupero configurazione tenant', {
      tenantId: req.user?.tenantId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Aggiorna la configurazione di una fase specifica
 */
export const updatePhaseConfig = async (req, res) => {
  try {
    // Cambia da req.params.phase a req.params.phaseNumber
    const { phaseNumber } = req.params;
    const updates = req.body;
    
    // Costruisci il nome completo della fase
    let phase;
    if (phaseNumber === 'globalSettings') {
      phase = 'globalSettings';
    } else {
      phase = `phase${phaseNumber}`;
    }

    if (!['phase1', 'phase2', 'phase3', 'globalSettings'].includes(phase)) {
      return res.status(400).json({ error: 'Fase non valida' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    // Inizializza la configurazione se non esiste
    if (!tenant.productMatchingConfig) {
      tenant.productMatchingConfig = {
        phase1: { enabled: false, confidenceThreshold: 0.7, autoApproveAbove: 0.9, requireManualReview: true },
        phase2: { enabled: false, handleUnmatched: true, createNewProducts: true, requireApprovalForNew: true },
        phase3: { enabled: false, analyticsLevel: 'basic', mlOptimization: false, continuousLearning: false, performanceTracking: true },
        globalSettings: {
          maxPendingReviews: 100,
          notificationThresholds: { pendingReviews: 50, lowConfidenceMatches: 20, unmatchedProducts: 30 },
          autoCleanupDays: 30
        }
      };
    }

    // Validazioni specifiche per fase
    if (phase === 'phase1') {
      if (updates.confidenceThreshold && (updates.confidenceThreshold < 0.5 || updates.confidenceThreshold > 1.0)) {
        return res.status(400).json({ error: 'Soglia di confidenza deve essere tra 0.5 e 1.0' });
      }
      if (updates.autoApproveAbove && (updates.autoApproveAbove < 0.7 || updates.autoApproveAbove > 1.0)) {
        return res.status(400).json({ error: 'Soglia auto-approvazione deve essere tra 0.7 e 1.0' });
      }
    }

    if (phase === 'phase3') {
      if (updates.analyticsLevel && !['basic', 'advanced'].includes(updates.analyticsLevel)) {
        return res.status(400).json({ error: 'Livello analytics deve essere basic o advanced' });
      }
    }

    // Verifica dipendenze tra fasi
    if (phase === 'phase2' && updates.enabled === true) {
      if (!tenant.productMatchingConfig.phase1.enabled) {
        return res.status(400).json({ error: 'Phase 2 richiede che Phase 1 sia abilitata' });
      }
    }

    if (phase === 'phase3' && updates.enabled === true) {
      if (!tenant.productMatchingConfig.phase2.enabled) {
        return res.status(400).json({ error: 'Phase 3 richiede che Phase 2 sia abilitata' });
      }
    }

    // Applica gli aggiornamenti
    Object.assign(tenant.productMatchingConfig[phase], updates);
    tenant.markModified('productMatchingConfig');
    await tenant.save();

    res.json({
      message: `Configurazione ${phase} aggiornata con successo`,
      config: tenant.productMatchingConfig[phase],
      enabledPhases: getEnabledPhases(tenant.productMatchingConfig)
    });
  } catch (error) {
    logger.error('Errore nell\'aggiornamento configurazione', {
      tenantId: req.user?.tenantId,
      phase: req.params?.phaseNumber,
      updates: req.body,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Abilita/disabilita una fase specifica
 */
export const togglePhase = async (req, res) => {
  try {
    const { phase } = req.params;
    const { enabled } = req.body;

    if (!['phase1', 'phase2', 'phase3'].includes(phase)) {
      return res.status(400).json({ error: 'Fase non valida' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    if (!tenant.productMatchingConfig) {
      return res.status(400).json({ error: 'Configurazione product matching non inizializzata' });
    }

    // Verifica dipendenze quando si disabilita
    if (enabled === false) {
      if (phase === 'phase1' && tenant.productMatchingConfig.phase2.enabled) {
        return res.status(400).json({ error: 'Non è possibile disabilitare Phase 1 mentre Phase 2 è attiva' });
      }
      if (phase === 'phase2' && tenant.productMatchingConfig.phase3.enabled) {
        return res.status(400).json({ error: 'Non è possibile disabilitare Phase 2 mentre Phase 3 è attiva' });
      }
    }

    // Verifica dipendenze quando si abilita
    if (enabled === true) {
      if (phase === 'phase2' && !tenant.productMatchingConfig.phase1.enabled) {
        return res.status(400).json({ error: 'Phase 2 richiede che Phase 1 sia abilitata' });
      }
      if (phase === 'phase3' && !tenant.productMatchingConfig.phase2.enabled) {
        return res.status(400).json({ error: 'Phase 3 richiede che Phase 2 sia abilitata' });
      }
    }

    tenant.productMatchingConfig[phase].enabled = enabled;
    tenant.markModified('productMatchingConfig');
    await tenant.save();

    res.json({
      message: `${phase} ${enabled ? 'abilitata' : 'disabilitata'} con successo`,
      phase,
      enabled,
      enabledPhases: getEnabledPhases(tenant.productMatchingConfig)
    });
  } catch (error) {
    logger.error('Errore nel toggle fase', {
      tenantId: req.user?.tenantId,
      phase: req.params?.phase,
      enabled: req.body?.enabled,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Ottiene le statistiche di utilizzo delle fasi
 */
export const getPhaseStats = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    const config = tenant.productMatchingConfig;
    if (!config) {
      return res.status(400).json({ error: 'Configurazione product matching non inizializzata' });
    }

    // Qui potresti aggiungere query per ottenere statistiche reali
    // Per ora restituiamo dati di esempio
    const stats = {
      phase1: {
        enabled: config.phase1.enabled,
        pendingReviews: 0, // Da calcolare con query su Invoice
        processedToday: 0,
        averageConfidence: 0
      },
      phase2: {
        enabled: config.phase2.enabled,
        unmatchedProducts: 0, // Da calcolare
        newProductsCreated: 0,
        processedToday: 0
      },
      phase3: {
        enabled: config.phase3.enabled,
        analyticsLevel: config.phase3.analyticsLevel,
        mlOptimization: config.phase3.mlOptimization,
        performanceImprovement: 0
      }
    };

    res.json(stats);
  } catch (error) {
    logger.error('Errore nel recupero statistiche', {
      tenantId: req.user?.tenantId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Reset della configurazione ai valori di default
 */
export const resetConfig = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    tenant.productMatchingConfig = {
      phase1: { enabled: false, confidenceThreshold: 0.7, autoApproveAbove: 0.9, requireManualReview: true },
      phase2: { enabled: false, handleUnmatched: true, createNewProducts: true, requireApprovalForNew: true },
      phase3: { enabled: false, analyticsLevel: 'basic', mlOptimization: false, continuousLearning: false, performanceTracking: true },
      globalSettings: {
        maxPendingReviews: 100,
        notificationThresholds: { pendingReviews: 50, lowConfidenceMatches: 20, unmatchedProducts: 30 },
        autoCleanupDays: 30
      }
    };

    tenant.markModified('productMatchingConfig');
    await tenant.save();

    res.json({
      message: 'Configurazione ripristinata ai valori di default',
      config: tenant.productMatchingConfig
    });
  } catch (error) {
    logger.error('Errore nel reset configurazione', {
      tenantId: req.user?.tenantId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
};