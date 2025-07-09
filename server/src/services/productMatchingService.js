import Product from '../models/Product.js';
import fuzzysort from 'fuzzysort';
import logger from '../utils/logger.js';

/**
 * Servizio per la gestione del matching dei prodotti
 * Implementa la logica per le tre fasi del sistema di product matching
 */
class ProductMatchingService {
  /**
   * Normalizza una descrizione per il matching
   * @param {string} description - Descrizione da normalizzare
   * @returns {string} Descrizione normalizzata
   */
  static normalizeDescription(description) {
    if (!description) return '';
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Cerca prodotti simili usando fuzzy matching
   * @param {string} description - Descrizione da cercare
   * @param {string} tenantId - ID del tenant
   * @param {Object} options - Opzioni di ricerca
   * @returns {Array} Array di prodotti con score di similarità
   */
  static async findSimilarProducts(description, tenantId, options = {}) {
    const {
      limit = 10,
      threshold = 0.3,
      includeDescriptions = true
    } = options;

    try {
      // Ottieni tutti i prodotti del tenant
      const products = await Product.find({ tenantId }).lean();
      
      if (!products.length) {
        return [];
      }

      const normalizedQuery = this.normalizeDescription(description);
      const results = [];

      for (const product of products) {
        // Cerca nella descrizione principale
        const mainResult = fuzzysort.single(normalizedQuery, product.descriptionStd || product.description);
        let bestScore = mainResult ? mainResult.score : -Infinity;
        let bestTarget = product.description;
        let matchType = 'main';

        // Se abilitato, cerca anche nelle descrizioni alternative
        if (includeDescriptions && product.descriptions && product.descriptions.length > 0) {
          for (const desc of product.descriptions) {
            const altResult = fuzzysort.single(normalizedQuery, desc.normalizedText || desc.text);
            if (altResult && altResult.score > bestScore) {
              bestScore = altResult.score;
              bestTarget = desc.text;
              matchType = 'alternative';
            }
          }
        }

        // Aggiungi ai risultati se supera la soglia
        if (bestScore > threshold * 1000) { // fuzzysort usa score negativi, più alto è meglio
          results.push({
            product,
            score: bestScore,
            confidence: Math.min(Math.max((bestScore + 1000) / 1000, 0), 1), // Normalizza tra 0 e 1
            matchedText: bestTarget,
            matchType
          });
        }
      }

      // Ordina per score decrescente e limita i risultati
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      logger.error('Errore nella ricerca di prodotti simili', {
        error: error.message,
        stack: error.stack,
        description,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Determina il metodo di matching basato sulla confidence
   * @param {number} confidence - Livello di confidenza (0-1)
   * @returns {string} Metodo di matching
   */
  static getMatchingMethod(confidence) {
    if (confidence >= 0.95) return 'exact';
    if (confidence >= 0.8) return 'high_fuzzy';
    if (confidence >= 0.6) return 'medium_fuzzy';
    if (confidence >= 0.4) return 'low_fuzzy';
    return 'very_low_fuzzy';
  }

  /**
   * Determina lo status del matching basato sulla configurazione delle fasi
   * @param {Object} matchResult - Risultato del matching
   * @param {Object} tenantConfig - Configurazione del tenant
   * @returns {Object} Status e informazioni del matching
   */
  static determineMatchingStatus(matchResult, tenantConfig) {
    const result = {
      status: 'pending',
      requiresReview: false,
      autoApproved: false,
      reason: ''
    };

    if (!tenantConfig) {
      // Comportamento legacy senza configurazione
      result.status = matchResult ? 'matched' : 'unmatched';
      result.autoApproved = !!matchResult;
      result.reason = 'legacy_mode';
      return result;
    }

    // Phase 1: Product Matching
    if (matchResult && tenantConfig.phase1?.enabled) {
      const confidence = matchResult.confidence;
      const phase1Config = tenantConfig.phase1;

      if (confidence >= phase1Config.autoApproveAbove) {
        result.status = 'matched';
        result.autoApproved = true;
        result.reason = 'high_confidence_auto_approve';
      } else if (confidence < phase1Config.confidenceThreshold) {
        result.status = 'pending_review';
        result.requiresReview = true;
        result.reason = 'low_confidence_requires_review';
      } else {
        if (phase1Config.requireManualReview) {
          result.status = 'pending_review';
          result.requiresReview = true;
          result.reason = 'manual_review_required';
        } else {
          result.status = 'matched';
          result.autoApproved = true;
          result.reason = 'medium_confidence_auto_approve';
        }
      }
    } else if (matchResult) {
      // Phase 1 disabilitata ma match trovato
      result.status = 'matched';
      result.autoApproved = true;
      result.reason = 'phase1_disabled_auto_approve';
    }

    // Phase 2: New Product Creation
    if (!matchResult && tenantConfig.phase2?.enabled) {
      const phase2Config = tenantConfig.phase2;
      
      if (phase2Config.requireApprovalForNew) {
        result.status = 'pending_review';
        result.requiresReview = true;
        result.reason = 'new_product_requires_approval';
      } else {
        result.status = 'unmatched';
        result.autoApproved = true;
        result.reason = 'new_product_auto_create';
      }
    } else if (!matchResult) {
      // Phase 2 disabilitata
      result.status = 'unmatched';
      result.autoApproved = true;
      result.reason = 'phase2_disabled_auto_create';
    }

    return result;
  }

  /**
   * Aggiunge una descrizione alternativa a un prodotto
   * @param {string} productId - ID del prodotto
   * @param {string} description - Nuova descrizione
   * @param {string} source - Fonte della descrizione
   * @param {string} addedBy - ID dell'utente che ha aggiunto la descrizione
   * @returns {Object} Prodotto aggiornato
   */
  static async addAlternativeDescription(productId, description, tenantId, source = 'manual', addedBy = null) {
    try {
      const product = await Product.findOne({ 
        _id: productId, 
        tenantId 
      });
      if (!product) {
        throw new Error('Prodotto non trovato');
      }

      const normalizedText = this.normalizeDescription(description);
      
      // Verifica se la descrizione esiste già
      const existingDesc = product.descriptions?.find(
        desc => desc.normalizedText === normalizedText
      );

      if (existingDesc) {
        // Aggiorna frequenza e ultima vista
        existingDesc.frequency += 1;
        existingDesc.lastSeen = new Date();
      } else {
        // Aggiungi nuova descrizione
        if (!product.descriptions) {
          product.descriptions = [];
        }
        
        product.descriptions.push({
          text: description,
          normalizedText,
          source,
          frequency: 1,
          lastSeen: new Date(),
          addedBy,
          confidence: 0.8 // Default confidence per descrizioni manuali
        });
      }

      await product.save();
      return product;
    } catch (error) {
      logger.error('Errore nell\'aggiunta di descrizione alternativa', {
        error: error.message,
        stack: error.stack,
        productId,
        description,
        tenantId,
        source,
        addedBy
      });
      throw error;
    }
  }

  /**
   * Ottiene statistiche sui matching per un tenant
   * @param {string} tenantId - ID del tenant
   * @param {Object} dateRange - Range di date per le statistiche
   * @returns {Object} Statistiche sui matching
   */
  static async getMatchingStats(tenantId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      
      // Qui implementeremo le query per ottenere statistiche
      // Per ora restituiamo dati placeholder
      return {
        totalProducts: await Product.countDocuments({ tenantId }),
        totalMatches: 0, // Da implementare con Invoice line items
        pendingReviews: 0, // Da implementare
        autoApproved: 0, // Da implementare
        manuallyApproved: 0, // Da implementare
        rejected: 0, // Da implementare
        averageConfidence: 0, // Da implementare
        matchingMethods: {
          exact: 0,
          high_fuzzy: 0,
          medium_fuzzy: 0,
          low_fuzzy: 0,
          very_low_fuzzy: 0
        }
      };
    } catch (error) {
      logger.error('Errore nel calcolo delle statistiche', {
        error: error.message,
        stack: error.stack,
        tenantId,
        dateRange
      });
      throw error;
    }
  }
}

export default ProductMatchingService;