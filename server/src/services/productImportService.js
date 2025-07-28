import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import ProductMatchingService from './productMatchingService.js';
import logger from '../utils/logger.js';
import { mapPIvaToVatNumber } from '../utils/mapping.js';

// helper to normalize descriptions for internal code
const normalizeDescription = (desc) => {
  let normalized = desc.toLowerCase();
  // Rimuovi pattern temporali variabili
  normalized = normalized.replace(/mese\s+[a-z]+\s+\d{4}/gi, 'mese');
  normalized = normalized.replace(/pagamento mensile/gi, '');
  normalized = normalized.replace(/canone mensile/gi, 'canone');
  normalized = normalized.replace(/\/\/.*$/gi, ''); // Rimuovi commenti dopo //
  normalized = normalized.replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

// Funzione per verificare se una riga è un prodotto valido o una nota/riferimento
const isValidProductLine = (line) => {
  if (!line.descrizione || line.descrizione.trim() === '') {
    return false;
  }
  
  const description = line.descrizione.toLowerCase();
  
  // Verifica prezzo e quantità (un prodotto valido dovrebbe avere prezzo e quantità)
  const hasValidPrice = line.prezzoUnitario > 0 || line.prezzoTotale > 0;
  const hasValidQuantity = line.quantita > 0;
  
  // Pattern che indicano note, riferimenti o informazioni non relative a prodotti
  const nonProductPatterns = [
    // Riferimenti a DDT
    /\bddt\b.*\d+/,
    /\bdoc\w*\s+di\s+trasporto\b/,
    /\bbolla\s+di\s+accompagnamento\b/,
    
    // Riferimenti normativi
    /\bassolve\s+agli\s+obblighi\b/,
    /\bdecreto\b/,
    /\bd\.?lgs\.?\b/,
    /\bd\.?m\.?\b/,
    /\blegge\b/,
    /\bnormativa\b/,
    /\bentrato\s+in\s+vigore\b/,
    
    // Note legali/fiscali
    /\bnon\s+si\s+accettano\s+reclami\b/,
    /\btrascorsi\s+\d+\s+g(?:iorni)?\b/,
    /\bricevimento\s+della\s+merce\b/,
    /\biva\s+non\s+soggett[ia]\b/,
    /\bart\w*\s+\d+/,
    /\bcomma\s+\d+/,
    /\bai\s+sensi\b/,
    
    // Codici di riferimento non prodotti
    /\bnr\s+iscr\b/,
    /\bcodice\s+[a-z0-9]+\b/,
    
    // Informazioni di pagamento
    /\bpagamento\b/,
    /\bscadenza\b/,
    /\bbonifico\b/,
    /\bcoordinate\s+bancarie\b/,
    /\biban\b/,
    
    // Pattern specifici per note CONAI e imballaggi
    /\bcontributo\s+ambientale\s+conai\b/,
    /\bconai\s+assolto\b/,
    /\bimb\.?\s+non\s+soggett[io]\b/,
    /\bd\.?p\.?r\.?\s+633\/92\b/,
    /\baut\.?\s+d'imposta\b/,
  ];
  
  // Se la descrizione contiene uno dei pattern non-prodotto
  for (const pattern of nonProductPatterns) {
    if (pattern.test(description)) {
      return false;
    }
  }
  
  // Caratteristiche che indicano un prodotto valido anche con prezzo o quantità zero
  const isLikelyProduct = () => {
    // Verifica se la descrizione è di lunghezza ragionevole (non troppo lunga, non troppo corta)
    const reasonableLength = description.length > 5 && description.length < 100;
    
    // Verifica se contiene codici prodotto tipici
    const hasProductCode = /\b[a-z0-9]{4,}\b/.test(description);
    
    // Verifica se contiene unità di misura tipiche
    const hasUnitOfMeasure = /\b(pz|kg|lt|mt|cm|mm|gr|ml)\b/i.test(description);
    
    // Verifica se contiene dimensioni tipiche di prodotti
    const hasDimensions = /\b\d+\s*[xX]\s*\d+\b/.test(description);
    
    // Verifica se contiene materiali tipici
    const hasMaterials = /\b(acciaio|plastica|legno|carta|vetro|alluminio|ferro)\b/i.test(description);
    
    return reasonableLength && (hasProductCode || hasUnitOfMeasure || hasDimensions || hasMaterials);
  };
  
  // Pattern che indicano note informative anche con quantità = 1
  const informativeNotePatterns = [
    /\brif\w*\b/,
    /\bvedi\b/,
    /\bnota\b/,
    /\binfo\w*\b/,
    /\bcontributo\b/,
    /\bassolto\b/,
    /\bove\s+dovuto\b/,
    /\bimb\.?\b/,
    /\bart\.?\s*\d+/,
    /\bspese\s+di\s+trasporto\b/,
    /\bspese\s+accessorie\b/,
    /\bspese\s+bancarie\b/,
    /\bspese\s+amministrative\b/,
    /\bspese\s+di\s+spedizione\b/,
    /\bcontributo\s+spese\b/,
    /\bimballaggio\b/,
    /\bimballo\b/,
  ];
  
  // Se la descrizione contiene uno dei pattern di note informative
  for (const pattern of informativeNotePatterns) {
    if (pattern.test(description)) {
      return false;
    }
  }
  
  // Se la riga ha prezzo zero, è probabilmente una nota anche se ha quantità = 1
  if (!hasValidPrice) {
    // A meno che non abbia caratteristiche molto specifiche di un prodotto
    return isLikelyProduct() && (
      // Deve avere almeno due di queste caratteristiche per essere considerato un prodotto gratuito
      (hasValidQuantity && /\b(omaggio|gratuito|campione)\b/i.test(description)) ||
      (hasValidQuantity && description.length < 50 && /\b[a-z0-9]{5,}\b/.test(description))
    );
  }
  
  // Se ha prezzo valido ma quantità zero, potrebbe essere un errore di inserimento
  if (hasValidPrice && !hasValidQuantity) {
    // Controlliamo se sembra un prodotto valido
    return isLikelyProduct();
  }
  
  // Se ha sia prezzo che quantità validi, è probabilmente un prodotto
  return true;
};

// Funzione per importare automaticamente i prodotti dai DatiBeniServizi con supporto alle tre fasi
export const importProductsFromInvoice = async (invoiceData, supplierId, tenantId, invoiceId, tenantConfig = null) => {
  try {
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
    const skippedLines = [];

    for (let i = 0; i < invoiceData.lines.length; i++) {
      const line = invoiceData.lines[i];
      
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
      
      // Verifica se la linea è un prodotto valido o una nota/riferimento
      if (!isValidProductLine(line)) {
        logger.info('Linea saltata - non è un prodotto valido', {
          lineIndex: i + 1,
          numeroLinea: line.numeroLinea,
          descrizione: line.descrizione,
          supplierId,
          tenantId
        });
        
        skippedLines.push({
          lineNumber: line.numeroLinea,
          description: line.descrizione,
          reason: 'non_product_line'
        });
        
        // Aggiorna lo stato della linea nella fattura
        await Invoice.updateOne(
          { 
            _id: invoiceId,
            'lineItems.lineNumber': line.numeroLinea
          },
          {
            $set: {
              'lineItems.$.productMatchingStatus': 'skipped',
              'lineItems.$.matchingNotes': 'Linea non riconosciuta come prodotto'
            }
          }
        );
        
        continue;
      }
      
      if (!line.descrizione || line.descrizione.trim() === '') {
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
      
      logger.debug('Tentativo matching prodotto', {
        descrizioneOriginale: line.descrizione,
        descrizioneNormalizzata: descriptionStd,
        numeroLinea: line.numeroLinea,
        tenantId
      });
      
      // Usa il servizio di product matching per trovare prodotti simili
      // Usa soglia più alta per il matching
      const similarProducts = await ProductMatchingService.findSimilarProducts(
        line.descrizione,
        tenantId,
        { limit: 5, threshold: 0.7 } // ✅ Soglia migliorata
      );
      
      logger.debug('Risultati matching', {
        numeroLinea: line.numeroLinea,
        prodottiTrovati: similarProducts.length,
        prodotti: similarProducts.map(p => ({
          id: p.product._id,
          descrizione: p.product.description,
          confidence: p.confidence
        }))
      });
      
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
          // Recupera il documento Mongoose completo invece di usare l'oggetto lean
          const productDocument = await Product.findById(bestMatch._id);
          if (!productDocument) {
            logger.error('Prodotto non trovato nel database', {
              productId: bestMatch._id,
              invoiceId,
              lineNumber: line.numeroLinea
            });
            continue;
          }
          
          // Applica il mapping per standardizzare vatNumber
          invoiceData = mapPIvaToVatNumber(invoiceData);
          productDocument.addPriceEntry(
            {
              supplierId: supplierId,
              supplierVat: invoiceData.fornitore.vatNumber,  // Modificato da pIva a vatNumber
              supplierName: invoiceData.fornitore.name
            },
            {
              price: parseFloat(line.prezzoUnitario || 0),
              currency: invoiceData.header.valuta || 'EUR',
              quantity: parseFloat(line.quantita || 1)
            },
            {
              invoiceId: invoiceId,
              invoiceNumber: invoiceData.header.numero,
              invoiceDate: new Date(invoiceData.header.data),
              invoiceLineNumber: line.numeroLinea,
              purchaseDate: new Date()
            }
          );
          
          await productDocument.save();
          
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
              tenantId,  // <-- Usa il vero tenantId invece di 'invoice'
              'invoice', // <-- Sposta 'invoice' qui come source
              null // addedBy - sistema automatico
            );
          } catch (descError) {
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
          // Applica il mapping per standardizzare vatNumber
          mapPIvaToVatNumber(invoiceData.fornitore);
          
          const newProduct = new Product({
            codeInternal,
            tenantId,
            description: line.descrizione,
            descriptionStd,
            unit: line.uM || null,
            unitOfMeasure: line.uM || 'PZ',
            metadata: {
              ean: null,
              otherCodes: line.codiceArticolo ? [line.codiceArticolo] : [],
              attributes: {
                vatRate: line.iva || 0,
                lineNumber: line.numeroLinea || null
              }
            },
            prices: [],
            approvalStatus: 'approved',
            approvedAt: new Date(),
            approvalNotes: 'Auto-approvato durante import fattura'
          });
          
          // Aggiungi il primo prezzo usando il nuovo metodo
          newProduct.addPriceEntry(
            {
              supplierId: supplierId,
              supplierVat: invoiceData.fornitore.vatNumber,  // Modificato da pIva a vatNumber
              supplierName: invoiceData.fornitore.name
            },
            {
              price: parseFloat(line.prezzoUnitario || 0),
              currency: invoiceData.header.valuta || 'EUR',
              quantity: parseFloat(line.quantita || 1)
            },
            {
              invoiceId: invoiceId,  // Usa il parametro invoiceId invece di invoiceData.invoiceId
              invoiceNumber: invoiceData.header.numero,
              invoiceDate: new Date(invoiceData.header.data),
              invoiceLineNumber: line.numeroLinea,
              purchaseDate: new Date()
            }
          );
          
          await newProduct.save();
          
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
            logger.error('LineItem non trovato per aggiornamento', {
              numeroLinea: line.numeroLinea,
              invoiceId,
              productId: newProduct._id,
              supplierId,
              tenantId
            });
          } else if (updateResult.modifiedCount === 0) {
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
                descriptionStd,
                unit: line.uM || null,
                unitOfMeasure: line.uM || 'PZ',
                metadata: {
                  ean: null,
                  otherCodes: line.codiceArticolo ? [line.codiceArticolo] : [],
                  attributes: {
                    vatRate: line.iva || 0,
                    lineNumber: line.numeroLinea || null
                  }
                },
                prices: [],
                approvalStatus: 'approved',
                approvedAt: new Date(),
                approvalNotes: 'Auto-approvato durante import fattura (retry)'
              });
              
              // Aggiungi il primo prezzo usando il nuovo metodo
              retryProduct.addPriceEntry(
                {
                  supplierId: supplierId,
                  supplierVat: invoiceData.fornitore.vatNumber,
                  supplierName: invoiceData.fornitore.name
                },
                {
                  price: parseFloat(line.prezzoUnitario || 0),
                  currency: invoiceData.header.valuta || 'EUR',
                  quantity: parseFloat(line.quantita || 1)
                },
                {
                  invoiceId: invoiceId,
                  invoiceNumber: invoiceData.header.numero,
                  invoiceDate: new Date(invoiceData.header.data),
                  invoiceLineNumber: line.numeroLinea,
                  purchaseDate: new Date()
                }
              );
              
              await retryProduct.save();
              
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
                logger.error('LineItem non trovato per retry', {
                  numeroLinea: line.numeroLinea,
                  invoiceId,
                  productId: retryProduct._id,
                  supplierId,
                  tenantId
                });
              } else if (retryUpdateResult.modifiedCount === 0) {
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
                lineNumber: line.numeroLinea,
                status: productMatchingStatus
              });
              
              logger.info('Prodotto creato con successo al retry', {
                productId: retryProduct._id,
                descrizione: line.descrizione,
                numeroLinea: line.numeroLinea,
                codeInternal: retryProduct.codeInternal,
                supplierId,
                tenantId
              });
            } catch (retryError) {
              logger.error('Errore anche nel retry creazione prodotto', {
                numeroLinea: line.numeroLinea,
                descrizione: line.descrizione,
                retryError: retryError.message,
                originalError: createError.message,
                supplierId,
                tenantId
              });
              
              importResults.push({
                action: 'error',
                description: line.descrizione,
                error: `Errore creazione prodotto: ${createError.message}. Retry fallito: ${retryError.message}`
              });
            }
          } else {
            // Altri tipi di errore
            importResults.push({
              action: 'error',
              description: line.descrizione,
              error: createError.message
            });
          }
        }
      } else {
        // Nuovo prodotto che richiede approvazione (Phase 2 enabled con requireApprovalForNew)
        importResults.push({
          action: 'pending_review',
          description: line.descrizione,
          supplier: invoiceData.fornitore.name,
          lineNumber: line.numeroLinea,
          status: productMatchingStatus,
          isNewProduct: true
        });
        
        logger.info('Nuovo prodotto richiede approvazione', {
          descrizione: line.descrizione,
          supplier: invoiceData.fornitore.name,
          numeroLinea: line.numeroLinea,
          supplierId,
          tenantId
        });
      }
    }

    logger.info('Importazione prodotti completata', {
      totalLines: invoiceData.lines.length,
      resultsCount: importResults.length,
      supplierId,
      tenantId,
      invoiceId
    });

    return importResults;
  } catch (error) {
    logger.error('Errore durante importazione prodotti', {
      error: error.message,
      stack: error.stack,
      supplierId,
      tenantId,
      invoiceId
    });
    throw error;
  }
};

export default {
  importProductsFromInvoice
};