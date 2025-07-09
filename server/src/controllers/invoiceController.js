import { storage } from '../firebaseAdmin.js';         // il tuo bucket Firebase
import xml2js from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import InvoiceModel from '../models/Invoice.js'; // Mongo model for invoices
import Invoice from '../models/Invoice.js'; // Added for updating lineItems
import Tenant from '../models/Tenant.js'; // added import for Tenant model
import Supplier from '../models/Supplier.js'; // added import for Supplier model
import Product from '../models/Product.js'; // added import for Product model
import ProductMatchingService from '../services/productMatchingService.js';
import fuzzysort from 'fuzzysort'; // added import for fuzzy search
import logger from '../utils/logger.js'; // ✅ AGGIUNTO
// helper to normalize descriptions for internal code
const normalizeDescription = (desc) =>
  desc
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Funzione per importare automaticamente i prodotti dai DatiBeniServizi con supporto alle tre fasi
const importProductsFromInvoice = async (invoiceData, supplierId, tenantId, invoiceId, tenantConfig = null) => {
  try {
    // ✅ MIGRATO DA console.log
    logger.info('Avvio importazione prodotti da fattura', {
      supplierId,
      tenantId,
      invoiceId,
      linesCount: invoiceData.lines?.length || 0,
      hasConfig: !!tenantConfig
    });
    
    logger.debug('Dati fattura ricevuti', {
      hasLines: !!invoiceData.lines,
      linesCount: invoiceData.lines ? invoiceData.lines.length : 0,
      linesType: Array.isArray(invoiceData.lines) ? 'array' : typeof invoiceData.lines,
      supplierId,
      tenantId
    });
    
    if (!invoiceData.lines || !Array.isArray(invoiceData.lines)) {
      // ✅ MIGRATO DA console.log
      logger.warn('Nessuna linea prodotto valida trovata', {
        hasLines: !!invoiceData.lines,
        linesType: typeof invoiceData.lines,
        invoiceId,
        supplierId
      });
      return [];
    }

    // Carica tutti i prodotti esistenti del tenant per la ricerca fuzzy
    const existingProducts = await Product.find({ tenantId });
    const productList = existingProducts.map(p => ({ obj: p, key: p.descriptionStd }));

    const importResults = [];

    for (let i = 0; i < invoiceData.lines.length; i++) {
      const line = invoiceData.lines[i];
      
      // ✅ MIGRATO DA console.log
      logger.debug('Processamento linea fattura', {
        lineIndex: i + 1,
        totalLines: invoiceData.lines.length,
        numeroLinea: line.numeroLinea,
        descrizione: line.descrizione,
        quantita: line.quantita,
        prezzoUnitario: line.prezzoUnitario,
        uM: line.uM,
        supplierId,
        tenantId
      });
      
      if (!line.descrizione || line.descrizione.trim() === '') {
        // ✅ MIGRATO DA console.log
        logger.debug('Linea saltata - descrizione mancante', {
          lineIndex: i + 1,
          numeroLinea: line.numeroLinea,
          lineData: line,
          supplierId
        });
        continue;
      }

      // Normalizza la descrizione usando la stessa logica del Product model
      const descriptionStd = normalizeDescription(line.descrizione);
      
      // Usa il servizio di product matching per trovare prodotti simili
      const similarProducts = await ProductMatchingService.findSimilarProducts(
        line.descrizione,
        tenantId,
        { limit: 1, threshold: 0.3 }
      );
      
      let bestMatch = null;
      let matchConfidence = 0;
      let matchingMethod = 'none';
      
      if (similarProducts.length > 0) {
        const topMatch = similarProducts[0];
        bestMatch = topMatch.product;
        matchConfidence = topMatch.confidence;
        matchingMethod = ProductMatchingService.getMatchingMethod(matchConfidence);
      }

      // Determina status basato sulla configurazione delle fasi
      let productMatchingStatus = 'pending';
      let requiresReview = false;
      
      if (tenantConfig) {
        if (tenantConfig.phase1 && tenantConfig.phase1.enabled) {
          // Phase 1: Manual Review per low confidence matches
          if (bestMatch && matchConfidence < tenantConfig.phase1.confidenceThreshold) {
            productMatchingStatus = 'pending_review';
            requiresReview = true;
          } else if (bestMatch && matchConfidence >= tenantConfig.phase1.autoApproveAbove) {
            productMatchingStatus = 'matched';
          } else if (bestMatch) {
            productMatchingStatus = tenantConfig.phase1.requireManualReview ? 'pending_review' : 'matched';
            requiresReview = tenantConfig.phase1.requireManualReview;
          }
        } else {
          // Comportamento legacy se Phase 1 non è abilitata
          productMatchingStatus = bestMatch ? 'matched' : 'unmatched';
        }
        
        if (!bestMatch && tenantConfig.phase2 && tenantConfig.phase2.enabled) {
          // Phase 2: Handle unmatched products
          productMatchingStatus = tenantConfig.phase2.requireApprovalForNew ? 'pending_review' : 'matched';
          requiresReview = tenantConfig.phase2.requireApprovalForNew;
        }
      } else {
        // Comportamento legacy senza configurazione
        productMatchingStatus = bestMatch ? 'matched' : 'unmatched';
      }

      if (bestMatch && !requiresReview) {
        // Prodotto esistente trovato e approvato automaticamente - aggiungi nuovo prezzo allo storico
        try {
          bestMatch.addPriceEntry(
            {
              supplierId: supplierId,
              supplierVat: invoiceData.fornitore.pIva,
              supplierName: invoiceData.fornitore.name
            },
            {
              price: parseFloat(line.prezzoUnitario || 0),
              currency: invoiceData.header.valuta || 'EUR',
              quantity: parseFloat(line.quantita || 1)
              // Rimuovi unitOfMeasure da qui
            },
            {
              invoiceId: invoiceData.invoiceId,
              invoiceNumber: invoiceData.header.numero,
              invoiceDate: new Date(invoiceData.header.data),
              invoiceLineNumber: line.numeroLinea,
              purchaseDate: new Date()
            }
          );
          
          await bestMatch.save();
          
          // Aggiorna il lineItem nella fattura
          await Invoice.updateOne(
            { 
              _id: invoiceId,
              'lineItems.lineNumber': line.numeroLinea
            },
            {
              $set: {
                'lineItems.$.matchedProductId': bestMatch._id,
                'lineItems.$.productMatchingStatus': productMatchingStatus,
                'lineItems.$.codeInternal': bestMatch.codeInternal
              }
            }
          );
          
          // Aggiungi la descrizione della fattura come descrizione alternativa
          try {
            await ProductMatchingService.addAlternativeDescription(
              bestMatch._id,
              line.descrizione,
              'invoice',
              null // addedBy - sistema automatico
            );
          } catch (descError) {
            // ✅ MIGRATO DA console.warn
            logger.warn('Errore aggiunta descrizione alternativa', {
              productId: bestMatch._id,
              error: descError.message,
              descrizione: line.descrizione,
              supplierId
            });
          }
          
          importResults.push({
            action: 'price_added',
            productId: bestMatch._id,
            description: line.descrizione,
            supplier: invoiceData.fornitore.name,
            price: parseFloat(line.prezzoUnitario || 0),
            matchConfidence,
            matchingMethod,
            status: productMatchingStatus
          });
          
          // ✅ MIGRATO DA console.log
          logger.info('Prezzo aggiunto a prodotto esistente', {
            productId: bestMatch._id,
            descrizione: line.descrizione,
            supplier: invoiceData.fornitore.name,
            prezzo: line.prezzoUnitario,
            matchConfidence,
            matchingMethod,
            supplierId,
            tenantId
          });
        } catch (error) {
          // ✅ MIGRATO DA console.error
          logger.error('Errore aggiornamento prodotto esistente', {
            descrizione: line.descrizione,
            productId: bestMatch._id,
            error: error.message,
            stack: error.stack,
            supplierId,
            tenantId,
            numeroLinea: line.numeroLinea
          });
          
          importResults.push({
            action: 'error',
            description: line.descrizione,
            error: error.message
          });
        }
      } else if (bestMatch && requiresReview) {
        // Prodotto trovato ma richiede revisione manuale
        importResults.push({
          action: 'pending_review',
          description: line.descrizione,
          supplier: invoiceData.fornitore.name,
          lineNumber: line.numeroLinea,
          matchConfidence,
          matchingMethod,
          status: productMatchingStatus,
          suggestedProductId: bestMatch._id,
          suggestedProduct: {
            id: bestMatch._id,
            description: bestMatch.description,
            codeInternal: bestMatch.codeInternal
          }
        });
        
        // ✅ MIGRATO DA console.log
        logger.info('Prodotto richiede revisione manuale', {
          descrizione: line.descrizione,
          matchedProduct: bestMatch.description,
          matchConfidence,
          matchingMethod,
          supplierId,
          tenantId,
          numeroLinea: line.numeroLinea
        });
      } else if (!bestMatch && !requiresReview) {
        // Nuovo prodotto - creazione automatica (Phase 2 disabled o auto-approve)
        const codeInternal = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          const newProduct = new Product({
          codeInternal,
          tenantId,
          description: line.descrizione,
          descriptionStd, // Viene impostato automaticamente dal pre-save hook
          unit: line.uM || null,
          unitOfMeasure: line.uM || 'PZ', // Aggiungi unitOfMeasure a livello di prodotto
          metadata: {
            ean: null,
            otherCodes: line.codiceArticolo ? [line.codiceArticolo] : [],
            attributes: {
              vatRate: line.iva || 0,
              lineNumber: line.numeroLinea || null
            }
          },
          prices: [],
          // Aggiungi approvazione automatica
          approvalStatus: 'approved',
          approvedAt: new Date(),
          approvalNotes: 'Auto-approvato durante import fattura'
        });
          
          // Aggiungi il primo prezzo usando il nuovo metodo (senza unitOfMeasure)
          newProduct.addPriceEntry(
            {
              supplierId: supplierId,
              supplierVat: invoiceData.fornitore.pIva,
              supplierName: invoiceData.fornitore.name
            },
            {
              price: parseFloat(line.prezzoUnitario || 0),
              currency: invoiceData.header.valuta || 'EUR',
              quantity: parseFloat(line.quantita || 1)
              // Rimuovi unitOfMeasure da qui
            },
            {
              invoiceId: invoiceData.invoiceId,
              invoiceNumber: invoiceData.header.numero,
              invoiceDate: new Date(invoiceData.header.data),
              invoiceLineNumber: line.numeroLinea,
              purchaseDate: new Date()
            }
          );
          
          await newProduct.save();
          
          // ✅ MIGRATO DA console.log
          logger.debug('Nuovo prodotto salvato', {
            productId: newProduct._id,
            codeInternal: newProduct.codeInternal,
            descrizione: line.descrizione,
            supplierId,
            tenantId,
            numeroLinea: line.numeroLinea
          });
          
          // Aggiorna il lineItem nella fattura
          const updateResult = await Invoice.updateOne(
            { 
              _id: invoiceId,
              'lineItems.lineNumber': line.numeroLinea
            },
            {
              $set: {
                'lineItems.$.matchedProductId': newProduct._id,
                'lineItems.$.productMatchingStatus': productMatchingStatus,
                'lineItems.$.codeInternal': newProduct.codeInternal
              }
            }
          );
          
          // ✅ MIGRATO DA console.log
          logger.debug('Aggiornamento lineItem fattura', {
            numeroLinea: line.numeroLinea,
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount,
            productId: newProduct._id,
            codeInternal: newProduct.codeInternal,
            productMatchingStatus: productMatchingStatus,
            supplierId,
            tenantId
          });
          
          if (updateResult.matchedCount === 0) {
            // ✅ MIGRATO DA console.error
            logger.error('LineItem non trovato per aggiornamento', {
              numeroLinea: line.numeroLinea,
              invoiceId,
              productId: newProduct._id,
              supplierId,
              tenantId
            });
          } else if (updateResult.modifiedCount === 0) {
            // ✅ MIGRATO DA console.error
            logger.error('LineItem trovato ma non modificato', {
              numeroLinea: line.numeroLinea,
              invoiceId,
              productId: newProduct._id,
              supplierId,
              tenantId
            });
          }
          
          importResults.push({
            action: 'created',
            productId: newProduct._id,
            description: line.descrizione,
            supplier: invoiceData.fornitore.name,
            lineNumber: line.numeroLinea,
            status: productMatchingStatus
          });
          
          // ✅ MIGRATO DA console.log
          logger.info('Nuovo prodotto creato con successo', {
            productId: newProduct._id,
            descrizione: line.descrizione,
            supplier: invoiceData.fornitore.name,
            numeroLinea: line.numeroLinea,
            codeInternal: newProduct.codeInternal,
            supplierId,
            tenantId
          });
        } catch (createError) {
          // ✅ MIGRATO DA console.error
          logger.error('Errore creazione nuovo prodotto', {
            numeroLinea: line.numeroLinea,
            descrizione: line.descrizione,
            error: createError.message,
            stack: createError.stack,
            supplierId,
            tenantId
          });
          
          // Se è un errore di chiave duplicata, prova con un nuovo codice interno
          if (createError.code === 11000) {
            // ✅ MIGRATO DA console.log
            logger.warn('Tentativo retry creazione prodotto per duplicato', {
              numeroLinea: line.numeroLinea,
              descrizione: line.descrizione,
              originalError: createError.message,
              supplierId,
              tenantId
            });
            
            const newCodeInternal = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 12)}-${line.numeroLinea}`;
            
            try {
               const retryProduct = new Product({
                 codeInternal: newCodeInternal,
                 tenantId,
                 description: line.descrizione,
                 descriptionStd: descriptionStd,
                 unit: line.uM || null,
                 unitOfMeasure: line.uM || 'PZ', // Aggiungi unitOfMeasure a livello di prodotto
                 metadata: {
                   ean: null,
                   otherCodes: line.codiceArticolo ? [line.codiceArticolo] : [],
                   attributes: {
                     vatRate: line.iva || 0,
                     lineNumber: line.numeroLinea || null
                   }
                 },
                 prices: [],
                 // Aggiungi approvazione automatica
                 approvalStatus: 'approved',
                 approvedAt: new Date(),
                 approvalNotes: 'Auto-approvato durante import fattura'
               });
               
               // Aggiungi il primo prezzo usando il nuovo metodo (senza unitOfMeasure)
               retryProduct.addPriceEntry(
                 {
                   supplierId: supplierId,
                   supplierVat: invoiceData.fornitore.pIva,
                   supplierName: invoiceData.fornitore.name
                 },
                 {
                   price: parseFloat(line.prezzoUnitario || 0),
                   currency: invoiceData.header.valuta || 'EUR',
                   quantity: parseFloat(line.quantita || 1)
                   // Rimuovi unitOfMeasure da qui
                 },
                 {
                   invoiceId: invoiceData.invoiceId,
                   invoiceNumber: invoiceData.header.numero,
                   invoiceDate: new Date(invoiceData.header.data),
                   invoiceLineNumber: line.numeroLinea,
                   purchaseDate: new Date()
                 }
               );
               
               await retryProduct.save();
               
               // ✅ MIGRATO DA console.log
               logger.debug('Prodotto retry salvato', {
                 productId: retryProduct._id,
                 codeInternal: retryProduct.codeInternal,
                 numeroLinea: line.numeroLinea,
                 supplierId,
                 tenantId
               });
               
               // Aggiorna il lineItem nella fattura
               const retryUpdateResult = await Invoice.updateOne(
                 { 
                   _id: invoiceId,
                   'lineItems.lineNumber': line.numeroLinea
                 },
                 {
                   $set: {
                     'lineItems.$.matchedProductId': retryProduct._id,
                     'lineItems.$.productMatchingStatus': productMatchingStatus,
                     'lineItems.$.codeInternal': retryProduct.codeInternal
                   }
                 }
               );
               
               // ✅ MIGRATO DA console.log
               logger.debug('Aggiornamento lineItem retry', {
                 numeroLinea: line.numeroLinea,
                 matchedCount: retryUpdateResult.matchedCount,
                 modifiedCount: retryUpdateResult.modifiedCount,
                 productId: retryProduct._id,
                 codeInternal: retryProduct.codeInternal,
                 supplierId,
                 tenantId
               });
               
               if (retryUpdateResult.matchedCount === 0) {
                 // ✅ MIGRATO DA console.error
                 logger.error('LineItem non trovato per retry', {
                   numeroLinea: line.numeroLinea,
                   invoiceId,
                   productId: retryProduct._id,
                   supplierId,
                   tenantId
                 });
               } else if (retryUpdateResult.modifiedCount === 0) {
                 // ✅ MIGRATO DA console.error
                 logger.error('LineItem trovato ma non modificato in retry', {
                   numeroLinea: line.numeroLinea,
                   invoiceId,
                   productId: retryProduct._id,
                   supplierId,
                   tenantId
                 });
               }
              
              importResults.push({
                action: 'created_retry',
                productId: retryProduct._id,
                description: line.descrizione,
                supplier: invoiceData.fornitore.name,
                lineNumber: line.numeroLinea
              });
              
              // ✅ MIGRATO DA console.log
              logger.info('Prodotto creato con successo al retry', {
                productId: retryProduct._id,
                descrizione: line.descrizione,
                numeroLinea: line.numeroLinea,
                codeInternal: retryProduct.codeInternal,
                supplierId,
                tenantId
              });
            } catch (retryError) {
              // ✅ MIGRATO DA console.error
              logger.error('Errore anche al secondo tentativo', {
                numeroLinea: line.numeroLinea,
                descrizione: line.descrizione,
                error: retryError.message,
                stack: retryError.stack,
                supplierId,
                tenantId
              });
              importResults.push({
                action: 'error',
                error: retryError.message,
                description: line.descrizione,
                lineNumber: line.numeroLinea
              });
            }
          } else {
            importResults.push({
              action: 'error',
              error: createError.message,
              description: line.descrizione,
              lineNumber: line.numeroLinea
            });
          }
        }
      } else {
        // Prodotto non trovato e richiede revisione (Phase 2 enabled)
        importResults.push({
          action: 'pending_new_product_review',
          description: line.descrizione,
          supplier: invoiceData.fornitore.name,
          lineNumber: line.numeroLinea,
          status: productMatchingStatus,
          price: parseFloat(line.prezzoUnitario || 0),
          quantity: parseFloat(line.quantita || 1),
          unit: line.uM || null,
          vatRate: line.iva || 0,
          productCode: line.codiceArticolo || null
        });
        
        // ✅ MIGRATO DA console.log
        logger.info('Nuovo prodotto richiede approvazione', {
          descrizione: line.descrizione,
          supplier: invoiceData.fornitore.name,
          numeroLinea: line.numeroLinea,
          supplierId,
          tenantId
        });
      }
    }

    // ✅ MIGRATO DA console.log finale
    logger.info('Importazione prodotti completata', {
      supplierId,
      tenantId,
      invoiceId,
      totalProcessed: invoiceData.lines.length,
      resultsCount: importResults.length,
      summary: {
        created: importResults.filter(r => r.action === 'created').length,
        priceAdded: importResults.filter(r => r.action === 'price_added').length,
        pendingReview: importResults.filter(r => r.action === 'pending_review').length,
        pendingNewProduct: importResults.filter(r => r.action === 'pending_new_product_review').length,
        errors: importResults.filter(r => r.action === 'error').length
      }
    });

    return importResults;
  } catch (error) {
    // ✅ MIGRATO DA console.error
    logger.error('Errore durante importazione automatica prodotti', {
      error: error.message,
      stack: error.stack,
      supplierId,
      tenantId,
      invoiceId
    });
    // Non blocchiamo il caricamento della fattura per errori nell'importazione prodotti
    return [];
  }
};

// Funzione per trovare o creare un supplier
const findOrCreateSupplier = async (supplierData, tenantId) => {
  try {
    // Cerca supplier esistente per questo tenant
    let supplier = await Supplier.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      $or: [
        { name: supplierData.name },
        { pIva: supplierData.pIva },
        { vatNumber: supplierData.pIva },
        { codiceFiscale: supplierData.codiceFiscale }
      ]
    });

    // Se non esiste, crealo
    if (!supplier) {
      supplier = await Supplier.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: supplierData.name,
        pIva: supplierData.pIva,
        vatNumber: supplierData.pIva, // Imposta vatNumber uguale a pIva per compatibilità
        codiceFiscale: supplierData.codiceFiscale,
        pec: supplierData.pec,
        sdiCode: supplierData.sdiCode,
        address: supplierData.address,
        iscrizioneREA: supplierData.iscrizioneREA,
        contatti: supplierData.contatti
      });
      
      // ✅ MIGRATO DA console.log
      logger.info('Nuovo supplier creato', {
        supplierId: supplier._id,
        supplierName: supplier.name,
        tenantId,
        pIva: supplier.pIva
      });
    } else {
      // Aggiorna i dati del supplier esistente se necessario
      let needsUpdate = false;
      const updateData = {};
      
      if (supplierData.iscrizioneREA && (!supplier.iscrizioneREA || Object.keys(supplier.iscrizioneREA).length === 0)) {
        updateData.iscrizioneREA = supplierData.iscrizioneREA;
        needsUpdate = true;
      }
      
      if (supplierData.contatti && (!supplier.contatti || Object.keys(supplier.contatti).length === 0)) {
        updateData.contatti = supplierData.contatti;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        supplier = await Supplier.findByIdAndUpdate(supplier._id, updateData, { new: true });
        
        // ✅ MIGRATO DA console.log
        logger.info('Supplier aggiornato con nuovi dati', {
          supplierId: supplier._id,
          supplierName: supplier.name,
          tenantId,
          updateFields: Object.keys(updateData)
        });
      } else {
        // ✅ MIGRATO DA console.log
        logger.debug('Supplier esistente trovato', {
          supplierId: supplier._id,
          supplierName: supplier.name,
          tenantId,
          pIva: supplier.pIva
        });
      }
    }

    return supplier;
  } catch (error) {
    // ✅ MIGRATO DA console.error
    logger.error('Errore nella gestione del supplier', {
      error: error.message,
      stack: error.stack,
      tenantId,
      supplierData: {
        name: supplierData?.name,
        pIva: supplierData?.pIva
      }
    });
    throw new Error(`Errore nella gestione del supplier: ${error.message}`);
  }
};

const parser = new xml2js.Parser({
  explicitArray: false,
  tagNameProcessors: [xml2js.processors.stripPrefix],
  attrNameProcessors: [xml2js.processors.stripPrefix],
  ignoreAttrs: false,
  mergeAttrs: false
});

// helper: estrae e valida un campo, altrimenti lancia un errore
function get(obj, path, name) {
  const parts = path.split('.');
  let cur = obj;
  for (let p of parts) {
    cur = cur?.[p];
    if (cur == null) {
      // ✅ MIGRATO DA console.warn
      logger.warn('Campo mancante durante parsing fattura', {
        path,
        fieldName: name,
        context: 'parseBody'
      });
      return null; // Restituisce null invece di lanciare errore
    }
  }
  return cur;
}

// parsing di una singola FatturaElettronicaBody
function parseBody(body, header) {
  // ✅ MIGRATO DA console.log - Debug struttura
  logger.debug('Parsing body fattura', {
    bodyKeys: Object.keys(body),
    hasDatiGenerali: !!body.DatiGenerali,
    datiGeneraliKeys: body.DatiGenerali ? Object.keys(body.DatiGenerali) : null
  });
  
  // ✅ MIGRATO DA console.log - Debug header
  if (header) {
    logger.debug('Parsing header fattura', {
      headerKeys: Object.keys(header),
      hasCedentePrestatore: !!header.CedentePrestatore,
      cedenteKeys: header.CedentePrestatore ? Object.keys(header.CedentePrestatore) : null
    });
  } else {
    logger.warn('Header non fornito per parsing fattura');
  }
  
  // Estrazione dati di trasmissione
  const datiTrasmissione = header?.DatiTrasmissione || {};
  const transmissionData = {
    idTrasmittente: {
      idPaese: datiTrasmissione.IdTrasmittente?.IdPaese || null,
      idCodice: datiTrasmissione.IdTrasmittente?.IdCodice || null
    },
    progressivoInvio: datiTrasmissione.ProgressivoInvio || null,
    formatoTrasmissione: datiTrasmissione.FormatoTrasmissione || null,
    codiceDestinatario: datiTrasmissione.CodiceDestinatario || null,
    contattiTrasmittente: {
      telefono: datiTrasmissione.ContattiTrasmittente?.Telefono || null,
      email: datiTrasmissione.ContattiTrasmittente?.Email || null
    }
  };
  
  const doc = get(body, 'DatiGenerali.DatiGeneraliDocumento', 'DatiGeneraliDocumento');
  const invoiceHeader = {
    numero: get(doc, 'Numero', 'Numero'),
    data: get(doc, 'Data', 'Data'),
    valuta: get(doc, 'Divisa', 'Divisa'),
    totale: parseFloat(get(doc, 'ImportoTotaleDocumento', 'ImportoTotaleDocumento')),
    totaleIVA: (() => {
      const rawRiepilogo = body.DatiBeniServizi?.DatiRiepilogo;
      const riepilogoArray = Array.isArray(rawRiepilogo)
        ? rawRiepilogo
        : rawRiepilogo
        ? [rawRiepilogo]
        : [];
      return riepilogoArray.reduce(
        (sum, r, idx) =>
          sum + parseFloat(get(r, 'Imposta', `DatiRiepilogo[${idx}].Imposta`)),
        0
      );
    })()
  };

  // Supplier (CedentePrestatore) - si trova nell'header, non nel body
  let fornitore;
  try {
    // Verifica se CedentePrestatore esiste nell'header
    if (!header || !header.CedentePrestatore) {
      throw new Error('CedentePrestatore non trovato nell\'header del documento');
    }
    
    // ✅ MIGRATO DA console.log - Debug DatiAnagrafici
    if (header.CedentePrestatore.DatiAnagrafici) {
      logger.debug('DatiAnagrafici trovato', {
        datiAnagraficiKeys: Object.keys(header.CedentePrestatore.DatiAnagrafici)
      });
    } else {
      logger.warn('DatiAnagrafici non trovato in CedentePrestatore');
    }
    
    const ced = get(header, 'CedentePrestatore.DatiAnagrafici', 'CedentePrestatore.DatiAnagrafici');
    const cedSede = header.CedentePrestatore.Sede || {};
    
    // Estrai P.IVA del fornitore con prefisso IdPaese
    const fornitoreIdPaese = get(ced, 'IdFiscaleIVA.IdPaese', 'IT');
    const fornitoreIvaCode = get(ced, 'IdFiscaleIVA.IdCodice', 'Cedente.IdCodice');
    const fornitorePIva = fornitoreIvaCode ? `${fornitoreIdPaese}${fornitoreIvaCode}` : null;
    
    fornitore = {
      pIva: fornitorePIva,
      codiceFiscale: ced.CodiceFiscale || null,
      name: get(ced, 'Anagrafica.Denominazione', 'Denominazione'),
      pec: null, // PEC non presente nel file XML di esempio
      address: `${cedSede.Indirizzo || ''}, ${cedSede.CAP || ''}, ${cedSede.Comune || ''}, ${cedSede.Provincia || ''}, ${cedSede.Nazione || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ','),
      // Dati REA estesi
      iscrizioneREA: {
        ufficio: header.CedentePrestatore?.IscrizioneREA?.Ufficio || null,
        numeroREA: header.CedentePrestatore?.IscrizioneREA?.NumeroREA || null,
        capitaleSociale: header.CedentePrestatore?.IscrizioneREA?.CapitaleSociale ? parseFloat(header.CedentePrestatore.IscrizioneREA.CapitaleSociale) : null,
        socioUnico: header.CedentePrestatore?.IscrizioneREA?.SocioUnico || null,
        statoLiquidazione: header.CedentePrestatore?.IscrizioneREA?.StatoLiquidazione || null
      },
      // Contatti dettagliati
      contatti: {
        telefono: header.CedentePrestatore?.Contatti?.Telefono || null,
        fax: header.CedentePrestatore?.Contatti?.Fax || null,
        email: header.CedentePrestatore?.Contatti?.Email || null
      }
    };
  } catch (error) {
    // ✅ SOSTITUITO: console.error con logger.error
    logger.error('Errore durante estrazione dati CedentePrestatore', {
      error: error.message,
      stack: error.stack,
      context: 'parseBody',
      hasHeader: !!header,
      hasCedentePrestatore: !!(header?.CedentePrestatore)
    });
    throw new Error(`Errore nei dati del fornitore: ${error.message}`);
  }

  // Customer (CessionarioCommittente) - si trova nell'header, non nel body
  const ces = get(header, 'CessionarioCommittente.DatiAnagrafici', 'CessionarioCommittente.DatiAnagrafici');
  const cesSede = header.CessionarioCommittente.Sede || {};
  
  // Estrai P.IVA del cliente con prefisso IdPaese
  const clienteIdPaese = get(ces, 'IdFiscaleIVA.IdPaese', 'IT');
  const clienteIvaCode = get(ces, 'IdFiscaleIVA.IdCodice', 'CessionarioCommittente.IdCodice');
  const clienteIva = clienteIvaCode ? `${clienteIdPaese}${clienteIvaCode}` : null;
  
  const cliente = {
    pIva: clienteIva,
    codiceFiscale: ces.CodiceFiscale || null,
    name: get(ces, 'Anagrafica.Denominazione', 'DenominazioneCliente'),
    pec: null, // PEC non presente nel file XML di esempio
    address: `${cesSede.Indirizzo || ''}, ${cesSede.CAP || ''}, ${cesSede.Comune || ''}, ${cesSede.Provincia || ''}, ${cesSede.Nazione || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
  };



  // Lines
  const rawLines = body.DatiBeniServizi?.DettaglioLinee;
  
  // ✅ MIGRATO DA console.log
  logger.debug('Estrazione linee fattura', {
    hasRawLines: !!rawLines,
    rawLinesType: Array.isArray(rawLines) ? 'array' : typeof rawLines,
    rawLinesLength: Array.isArray(rawLines) ? rawLines.length : (rawLines ? 1 : 0)
  });
  
  // Gestione corretta di array vs singolo elemento
  let linesArray = [];
  if (rawLines) {
    if (Array.isArray(rawLines)) {
      linesArray = rawLines;
    } else {
      linesArray = [rawLines]; // Singola linea
    }
  }
  
  // ✅ MIGRATO DA console.log
  logger.debug('Linee fattura estratte', {
    linesCount: linesArray.length,
    hasValidLines: linesArray.length > 0
  });
  
  const lines = linesArray.filter(l => l).map((l, idx) => ({
    numeroLinea: get(l, 'NumeroLinea') || idx + 1,
    codiceArticolo: l.CodiceArticolo?.Codice || null,
    descrizione: get(l, 'Descrizione') || 'Descrizione non disponibile',
    uM: l.UnitaMisura || 'PZ',
    quantita: parseFloat(get(l, 'Quantita') || 0),
    prezzoUnitario: parseFloat(get(l, 'PrezzoUnitario') || 0),
    prezzoTotale: parseFloat(get(l, 'PrezzoTotale') || 0),
    iva: parseFloat(get(l, 'AliquotaIVA') || 0),
    causale: l.Causale || null,
    scontoMaggiorazione: l.ScontoMaggiorazione || null
  }));

  // Riepilogo IVA grezzo
  const rawRiepilogo = body.DatiBeniServizi?.DatiRiepilogo;
  const riepilogo = Array.isArray(rawRiepilogo) ? rawRiepilogo : [rawRiepilogo];

  // Pagamenti
  const datiPagamento = body.DatiPagamento || {};
  const rawPag = datiPagamento.DettaglioPagamento;
  let pagamenti = [];
  
  if (rawPag) {
    const pagArr = Array.isArray(rawPag) ? rawPag : [rawPag];
    pagamenti = pagArr.map(p => ({
      modalita: datiPagamento.CondizioniPagamento || p?.ModalitaPagamento || null, // CondizioniPagamento è a livello DatiPagamento
      scadenza: p?.DataScadenzaPagamento ? new Date(p.DataScadenzaPagamento) : null,
      importo: p?.ImportoPagamento ? parseFloat(p.ImportoPagamento) : 0,
      beneficiario: p?.Beneficiario || null, // Campo presente nel file XML di esempio
      iban: p?.IBAN || null // Campo presente nel file XML di esempio
    }));
  }

  // Riferimenti documenti
  const datiGenerali = body.DatiGenerali || {};
  const documentReferences = {
    ordineAcquisto: datiGenerali.DatiOrdineAcquisto ? (Array.isArray(datiGenerali.DatiOrdineAcquisto) ? datiGenerali.DatiOrdineAcquisto : [datiGenerali.DatiOrdineAcquisto]).map(ord => ({
      idDocumento: ord.IdDocumento || null,
      data: ord.Data ? new Date(ord.Data) : null,
      numeroItem: ord.NumItem || null,
      codiceCommessaConvenzione: ord.CodiceCommessaConvenzione || null,
      codiceCUP: ord.CodiceCUP || null,
      codiceCIG: ord.CodiceCIG || null
    })) : [],
    contratto: datiGenerali.DatiContratto ? (Array.isArray(datiGenerali.DatiContratto) ? datiGenerali.DatiContratto : [datiGenerali.DatiContratto]).map(contr => ({
      idDocumento: contr.IdDocumento || null,
      data: contr.Data ? new Date(contr.Data) : null,
      numeroItem: contr.NumItem || null,
      codiceCommessaConvenzione: contr.CodiceCommessaConvenzione || null,
      codiceCUP: contr.CodiceCUP || null,
      codiceCIG: contr.CodiceCIG || null
    })) : [],
    convenzione: datiGenerali.DatiConvenzione ? (Array.isArray(datiGenerali.DatiConvenzione) ? datiGenerali.DatiConvenzione : [datiGenerali.DatiConvenzione]).map(conv => ({
      idDocumento: conv.IdDocumento || null,
      data: conv.Data ? new Date(conv.Data) : null,
      numeroItem: conv.NumItem || null,
      codiceCommessaConvenzione: conv.CodiceCommessaConvenzione || null,
      codiceCUP: conv.CodiceCUP || null,
      codiceCIG: conv.CodiceCIG || null
    })) : [],
    ricezione: datiGenerali.DatiRicezione ? (Array.isArray(datiGenerali.DatiRicezione) ? datiGenerali.DatiRicezione : [datiGenerali.DatiRicezione]).map(ric => ({
      idDocumento: ric.IdDocumento || null,
      data: ric.Data ? new Date(ric.Data) : null,
      numeroItem: ric.NumItem || null
    })) : [],
    fatturePrecedenti: datiGenerali.DatiFattureCollegate ? (Array.isArray(datiGenerali.DatiFattureCollegate) ? datiGenerali.DatiFattureCollegate : [datiGenerali.DatiFattureCollegate]).map(fatt => ({
      idDocumento: fatt.IdDocumento || null,
      data: fatt.Data ? new Date(fatt.Data) : null
    })) : []
  };

  // Dati DDT
  const datiDDT = datiGenerali.DatiDDT ? (Array.isArray(datiGenerali.DatiDDT) ? datiGenerali.DatiDDT : [datiGenerali.DatiDDT]).map(ddt => ({
    numeroDDT: ddt.NumeroDDT || null,
    dataDDT: ddt.DataDDT ? new Date(ddt.DataDDT) : null,
    riferimentoNumeroLinea: ddt.RiferimentoNumeroLinea ? (Array.isArray(ddt.RiferimentoNumeroLinea) ? ddt.RiferimentoNumeroLinea.map(n => parseInt(n)) : [parseInt(ddt.RiferimentoNumeroLinea)]) : []
  })) : [];

  // Dati trasporto
  const datiTrasporto = datiGenerali.DatiTrasporto ? {
    datiAnagraficiVettore: datiGenerali.DatiTrasporto.DatiAnagraficiVettore ? {
      idFiscaleIVA: {
        idPaese: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.IdFiscaleIVA?.IdPaese || null,
        idCodice: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.IdFiscaleIVA?.IdCodice || null
      },
      codiceFiscale: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.CodiceFiscale || null,
      anagrafica: {
        denominazione: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.Anagrafica?.Denominazione || null,
        nome: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.Anagrafica?.Nome || null,
        cognome: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.Anagrafica?.Cognome || null
      },
      numeroLicenzaGuida: datiGenerali.DatiTrasporto.DatiAnagraficiVettore.NumeroLicenzaGuida || null
    } : null,
    mezzoTrasporto: datiGenerali.DatiTrasporto.MezzoTrasporto || null,
    causaTrasporto: datiGenerali.DatiTrasporto.CausaTrasporto || null,
    numeroColli: datiGenerali.DatiTrasporto.NumeroColli ? parseInt(datiGenerali.DatiTrasporto.NumeroColli) : null,
    descrizione: datiGenerali.DatiTrasporto.Descrizione || null,
    unitaMisuraPeso: datiGenerali.DatiTrasporto.UnitaMisuraPeso || null,
    pesoLordo: datiGenerali.DatiTrasporto.PesoLordo ? parseFloat(datiGenerali.DatiTrasporto.PesoLordo) : null,
    pesoNetto: datiGenerali.DatiTrasporto.PesoNetto ? parseFloat(datiGenerali.DatiTrasporto.PesoNetto) : null,
    dataOraRitiro: datiGenerali.DatiTrasporto.DataOraRitiro ? new Date(datiGenerali.DatiTrasporto.DataOraRitiro) : null,
    dataInizioTrasporto: datiGenerali.DatiTrasporto.DataInizioTrasporto ? new Date(datiGenerali.DatiTrasporto.DataInizioTrasporto) : null,
    tipoResa: datiGenerali.DatiTrasporto.TipoResa || null,
    indirizzoResa: datiGenerali.DatiTrasporto.IndirizzoResa ? {
      indirizzo: datiGenerali.DatiTrasporto.IndirizzoResa.Indirizzo || null,
      numeroCivico: datiGenerali.DatiTrasporto.IndirizzoResa.NumeroCivico || null,
      cap: datiGenerali.DatiTrasporto.IndirizzoResa.CAP || null,
      comune: datiGenerali.DatiTrasporto.IndirizzoResa.Comune || null,
      provincia: datiGenerali.DatiTrasporto.IndirizzoResa.Provincia || null,
      nazione: datiGenerali.DatiTrasporto.IndirizzoResa.Nazione || null
    } : null,
    dataOraConsegna: datiGenerali.DatiTrasporto.DataOraConsegna ? new Date(datiGenerali.DatiTrasporto.DataOraConsegna) : null
  } : null;

  // Allegati
  const allegati = body.Allegati ? (Array.isArray(body.Allegati) ? body.Allegati : [body.Allegati]).map(all => ({
    nomeAttachment: all.NomeAttachment || null,
    algoritmoCompressione: all.AlgoritmoCompressione || null,
    formatoAttachment: all.FormatoAttachment || null,
    descrizioneAttachment: all.DescrizioneAttachment || null,
    attachment: all.Attachment || null
  })) : [];

  return { 
    header: invoiceHeader, 
    fornitore, 
    cliente, 
    lines, 
    riepilogo, 
    pagamenti,
    transmissionData,
    documentReferences,
    datiDDT,
    datiTrasporto,
    allegati
  };
}

export const uploadInvoice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file inviato' });
    }
    const { originalname, mimetype, buffer } = req.file;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID non trovato nella richiesta' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(400).json({ error: 'Tenant non trovato' });
    }
    
    // Carica la configurazione del product matching per il tenant
    const tenantConfig = tenant.productMatchingConfig || null;

    // salva localmente
    const dataDir = path.resolve(process.cwd(), 'Data', tenantId);
    fs.mkdirSync(dataDir, { recursive: true });
    const destFilename = `${Date.now()}_${originalname}`;
    const localPath = path.join(dataDir, destFilename);
    fs.writeFileSync(localPath, buffer);

    // parsing XML
    if (!/\.xml$/i.test(originalname) && mimetype !== 'application/xml') {
      throw new Error('Formato non supportato, solo XML');
    }
    const xml = buffer.toString('utf8');
    const doc = await parser.parseStringPromise(xml);
    
    // ✅ SOSTITUITO: console.log con logger.debug
    logger.debug('Struttura documento XML parsato', {
      docKeys: Object.keys(doc),
      tenantId,
      filename: originalname,
      context: 'uploadInvoice'
    });
    
    // Gestione robusta dei namespace - cerca FatturaElettronica con o senza namespace
    let fatturaElettronica = doc.FatturaElettronica;
    if (!fatturaElettronica) {
      // Cerca tra tutte le chiavi per trovare FatturaElettronica
      const keys = Object.keys(doc);
      const fatturaKey = keys.find(key => key.includes('FatturaElettronica'));
      if (fatturaKey) {
        fatturaElettronica = doc[fatturaKey];
        
        // ✅ MIGRATO DA console.log
        logger.debug('Elemento fattura trovato con namespace', {
          fatturaKey,
          tenantId,
          originalname
        });
      }
    }
    
    if (!fatturaElettronica) {
      throw new Error('Struttura XML non valida: elemento FatturaElettronica non trovato');
    }
    
    const bodies = fatturaElettronica.FatturaElettronicaBody;
    const arrBodies = Array.isArray(bodies) ? bodies : [bodies];
    const header = fatturaElettronica.FatturaElettronicaHeader;
    
    // ✅ MIGRATO DA console.log - Debug header
    if (!header) {
      logger.error('FatturaElettronicaHeader mancante', {
        tenantId,
        originalname,
        docKeys: Object.keys(doc)
      });
      throw new Error('FatturaElettronicaHeader non trovato nel documento');
    }

    // estrai e salva ciascuna fattura
    const saved = [];
    for (let i = 0; i < arrBodies.length; i++) {
      const inv = parseBody(arrBodies[i], header);
      // Verifica che almeno uno dei dati del cliente corrisponda al tenant
      const pivaMatches = inv.cliente.pIva && inv.cliente.pIva === tenant.vatNumber;
      const cfMatches = inv.cliente.codiceFiscale && inv.cliente.codiceFiscale === tenant.codiceFiscale;
      
      if (!pivaMatches && !cfMatches) {
        // ✅ MIGRATO DA console.log
        logger.warn('Dati cliente non corrispondono al tenant', {
          tenantId,
          invoiceIndex: i,
          tenant: {
            vatNumber: tenant.vatNumber,
            codiceFiscale: tenant.codiceFiscale
          },
          clienteFattura: {
            pIva: inv.cliente.pIva,
            codiceFiscale: inv.cliente.codiceFiscale
          },
          matches: {
            pivaMatches,
            cfMatches
          }
        });
        
        return res.status(400).json({
          error: 'Dati cliente P.IVA o C.F. non corrispondono ai dati del tenant',
          invoiceIndex: i,
          invoiceCliente: inv.cliente,
          tenantData: { vatNumber: tenant.vatNumber, codiceFiscale: tenant.codiceFiscale }
        });
      }

      // Trova o crea il supplier con dati estesi
      const supplier = await findOrCreateSupplier({
        name: inv.fornitore.name,
        pIva: inv.fornitore.pIva,
        codiceFiscale: inv.fornitore.codiceFiscale,
        pec: inv.fornitore.pec,
        sdiCode: inv.fornitore.sdiCode,
        address: inv.fornitore.address,
        iscrizioneREA: inv.fornitore.iscrizioneREA,
        contatti: inv.fornitore.contatti
      }, tenantId);

      // Controllo anti-duplicazione fattura
      const invoiceDate = new Date(inv.header.data || new Date());
      const existingInvoice = await InvoiceModel.findOne({
        supplierId: supplier._id,
        invoiceNumber: inv.header.numero || 'N/A',
        invoiceDate: invoiceDate
      });

      if (existingInvoice) {
        return res.status(409).json({
          error: 'Fattura già presente',
          details: {
            supplier: supplier.name,
            invoiceNumber: inv.header.numero || 'N/A',
            invoiceDate: invoiceDate.toISOString().split('T')[0],
            existingInvoiceId: existingInvoice._id
          }
        });
      }

      const rec = await InvoiceModel.create({
        tenantId,
        supplierId: supplier._id,
        // Dati di trasmissione SDI
        transmissionData: inv.transmissionData,
        supplier: {
          name: inv.fornitore.name,
          pIva: inv.fornitore.pIva,
          codiceFiscale: inv.fornitore.codiceFiscale,
          pec: inv.fornitore.pec,
          address: inv.fornitore.address,
          iscrizioneREA: inv.fornitore.iscrizioneREA,
          contatti: inv.fornitore.contatti
        },
        customer: {
          name: inv.cliente.name,
          pIva: inv.cliente.pIva,
          codiceFiscale: inv.cliente.codiceFiscale,
          pec: inv.cliente.pec,
          address: inv.cliente.address
        },
        // Riferimenti documenti
        documentReferences: inv.documentReferences,
        // Dati DDT
        datiDDT: inv.datiDDT,
        // Dati trasporto
        datiTrasporto: inv.datiTrasporto,
        // Allegati
        allegati: inv.allegati,
        invoiceNumber: inv.header.numero || 'N/A',
        invoiceDate: new Date(inv.header.data || new Date()),
        totalAmount: parseFloat(inv.header.totale || 0),
        totalVAT: parseFloat(inv.header.totaleIVA || 0),
        currency: inv.header.valuta || 'EUR',
        lineItems: inv.lines.map(line => ({
          lineNumber: line.numeroLinea || null,
          description: line.descrizione || 'N/A',
          quantity: line.quantita || 1,
          unitPrice: line.prezzoUnitario || 0,
          total: line.prezzoTotale || 0,
          vatRate: line.iva || 0,
          unitOfMeasure: line.uM || 'PZ',
          discount: 0,
          surcharge: 0,
          code: line.codiceArticolo || null,
          reason: line.causale || null,
          // Sconti e maggiorazioni dettagliati (da implementare nel parsing se necessario)
          scontiMaggiorazioni: [],
          altriDatiGestionali: [],
          ritenuta: null,
          discountSurcharge: line.scontoMaggiorazione || null
        })),
        vatSummary: inv.riepilogo.map(r => ({
          vatRate: parseFloat(r.AliquotaIVA || 0),
          taxableAmount: parseFloat(r.ImponibileImporto || 0),
          vatAmount: parseFloat(r.Imposta || 0),
          exemptionNature: r.Natura || null,
          exemptionReference: r.RiferimentoNormativo || null,
          // Campi aggiuntivi IVA
          esigibilitaIVA: r.EsigibilitaIVA || null,
          riferimentoNormativo: r.RiferimentoNormativo || null,
          speseAccessorie: r.SpeseAccessorie ? parseFloat(r.SpeseAccessorie) : null,
          arrotondamento: r.Arrotondamento ? parseFloat(r.Arrotondamento) : null
        })),
        paymentData: inv.pagamenti.map(p => ({
          paymentMethod: p.modalita || null,
          dueDate: p.scadenza ? new Date(p.scadenza) : null,
          amount: parseFloat(p.importo || 0),
          beneficiary: p.beneficiario || null,
          iban: p.iban || null
        })),
        path: localPath,
        rawMetadata: {
          header: inv.header,
          lines: inv.lines,
          riepilogo: inv.riepilogo,
          pagamenti: inv.pagamenti,
          transmissionData: inv.transmissionData,
          documentReferences: inv.documentReferences,
          datiDDT: inv.datiDDT,
          datiTrasporto: inv.datiTrasporto,
          allegati: inv.allegati
        }
      });
      saved.push(rec);
      
      // Importa automaticamente i prodotti dai DatiBeniServizi con configurazione tenant
      await importProductsFromInvoice({...inv, invoiceId: rec._id}, supplier._id, tenantId, rec._id, tenantConfig);
    }

    return res.status(201).json({ invoices: saved });
  } catch (err) {
    // ✅ MIGRATO DA console.error
    logger.error('Errore upload fattura', {
      error: err.message,
      stack: err.stack,
      tenantId: req.user?.tenantId,
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype
    });
    let status = 500;
    let errorMessage = 'Errore interno del server durante il caricamento della fattura.';

    if (err.message.startsWith('Campo obbligatorio mancante:')) {
      status = 400;
      errorMessage = `Dati mancanti nella fattura: ${err.message}`;
    } else if (err.message.includes('Formato non supportato')) {
      status = 400;
      errorMessage = `Formato file non supportato: ${err.message}`;
    } else if (err.message.startsWith('Errore')) {
      status = 400;
      errorMessage = `Errore di validazione: ${err.message}`;
    }

    return res.status(status).json({ error: errorMessage, details: err.message });
  }
};

/**
 * GET /api/invoices
 * Recupera la lista delle fatture con filtri e paginazione
 */
export const getInvoices = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      supplierId = '', 
      startDate = '', 
      endDate = '',
      sortBy = 'invoiceDate',
      sortOrder = 'desc'
    } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    // Costruisci il filtro
    const filter = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    // Filtro per fornitore
    if (supplierId) {
      filter.supplierId = new mongoose.Types.ObjectId(supplierId);
    }

    // Filtro per data
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    // Filtro per ricerca (numero fattura o fornitore)
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Configurazione ordinamento
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calcola skip per paginazione
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Aggregation pipeline per includere i dati del fornitore
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      {
        $unwind: {
          path: '$supplier',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          invoiceNumber: 1,
          invoiceDate: 1,
          totalAmount: 1,
          totalVAT: 1,
          currency: 1,
          status: 1,
          createdAt: 1,
          supplier: {
            _id: '$supplier._id',
            name: '$supplier.name',
            pIva: '$supplier.pIva'
          },
          lineItemsCount: { $size: { $ifNull: ['$lineItems', []] } }
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // Esegui aggregation
    const invoices = await InvoiceModel.aggregate(pipeline);

    // Conta il totale per la paginazione
    const totalCount = await InvoiceModel.countDocuments(filter);

    res.json({
      invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + invoices.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    // ✅ MIGRATO DA console.error
    logger.error('Errore recupero lista fatture', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      query: req.query
    });
    res.status(500).json({ error: 'Errore nel recupero delle fatture' });
  }
};

/**
 * GET /api/invoices/:id
 * Recupera i dettagli di una singola fattura
 */
export const getInvoiceDetails = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    const invoice = await InvoiceModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).populate('supplierId', 'name pIva codiceFiscale email phone address');

    if (!invoice) {
      return res.status(404).json({ error: 'Fattura non trovata' });
    }

    res.json(invoice);
  } catch (error) {
    // ✅ MIGRATO DA console.error
    logger.error('Errore recupero dettagli fattura', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      invoiceId: req.params?.id
    });
    res.status(500).json({ error: 'Errore nel recupero dei dettagli della fattura' });
  }
};

/**
 * GET /api/invoices/stats
 * Statistiche generali delle fatture
 */
export const getInvoicesStats = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId mancante' });
    }

    const filter = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const stats = await InvoiceModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalVAT: { $sum: '$totalVAT' },
          avgAmount: { $avg: '$totalAmount' },
          minAmount: { $min: '$totalAmount' },
          maxAmount: { $max: '$totalAmount' }
        }
      }
    ]);

    // Trend mensile
    const monthlyTrend = await InvoiceModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      stats: stats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        totalVAT: 0,
        avgAmount: 0,
        minAmount: 0,
        maxAmount: 0
      },
      monthlyTrend
    });
  } catch (error) {
    // ✅ MIGRATO DA console.error
    logger.error('Errore recupero statistiche fatture', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      query: req.query
    });
    res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
  }
};