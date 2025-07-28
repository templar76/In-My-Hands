import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import { findOrCreateSupplier } from './supplierService.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { mapPIvaToVatNumber } from '../utils/mapping.js';

/**
 * Salva una fattura nel database dopo il parsing
 * @param {Object} parsedData - Dati della fattura parsati
 * @param {string} tenantId - ID del tenant
 * @param {string} clientData - Dati del client per validazione
 * @returns {Promise<Object>} - Fattura salvata
 */
export const saveInvoiceFromParsedData = async (parsedData, tenantId) => {
  try {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant non trovato');
    }

    // Validazione del cliente usando i dati estratti dalla fattura
    const clientData = parsedData.cliente;
    const validationErrors = [];
    // Aggiungi questo log subito dopo la riga 22
logger.debug('Dati per validazione vatNumber', {
  hasClientData: !!clientData,
  clientVatNumber: clientData?.vatNumber,
  tenantVatNumber: tenant?.vatNumber,
  tenantId
});
    // Controllo più robusto per evitare errori undefined
    if (clientData && clientData.vatNumber && tenant.vatNumber && tenant.vatNumber !== clientData.vatNumber) {
      validationErrors.push({
        type: 'vatNumber_mismatch',
        message: `VatNumber cliente (${clientData.vatNumber}) non corrisponde al tenant (${tenant.vatNumber})`,
        severity: 'error'
      });
      
      // Log dell'errore e BLOCCA il salvataggio
      logger.error('Fattura rifiutata per VatNumber non corrispondente', {
        clientVatNumber: clientData.vatNumber,
        tenantVatNumber: tenant.vatNumber,
        tenantId
      });
      
      // Restituisci l'errore invece di continuare
      const error = new Error('Validazione fallita: VatNumber non corrispondente');
      error.validationErrors = validationErrors;
      error.code = 'VALIDATION_FAILED';
      throw error;
    }

    // Trova o crea il fornitore
    const supplier = await findOrCreateSupplier(parsedData.fornitore, tenantId);
    
    // Applica mapping per vatNumber se necessario
    mapPIvaToVatNumber(supplier);
    
    logger.debug('Fornitore gestito', {
      supplierId: supplier._id,
      supplierName: supplier.name,
      isNew: !supplier.createdAt || supplier.createdAt.getTime() === supplier.updatedAt.getTime()
    });

    // Controlla duplicati (usando vatNumber)
    const existingInvoice = await Invoice.findOne({
      tenantId,
      'supplier.vatNumber': supplier.vatNumber,
      invoiceNumber: parsedData.header.numero,
      invoiceDate: new Date(parsedData.header.data)
    });

    if (existingInvoice) {
      validationErrors.push({
        type: 'duplicate_invoice',
        message: `Fattura ${parsedData.header.numero} del ${parsedData.header.data} già esistente per questo fornitore`,
        severity: 'warning'
      });
    }

    // Prepara i line items
    const lineItems = parsedData.lines.map((line, index) => ({
      lineNumber: line.numeroLinea || index + 1,
      description: line.descrizione || '',
      quantity: line.quantita || 1,
      unitPrice: line.prezzoUnitario || 0,
      total: line.prezzoTotale || (line.quantita * line.prezzoUnitario),
      vatRate: line.iva || 0,
      unitOfMeasure: line.uM || 'PZ',
      discount: line.sconto || 0,
      surcharge: line.maggiorazione || 0,
      code: line.codiceArticolo || null,
      reason: line.natura || null,
      scontiMaggiorazioni: line.scontoMaggiorazione || null,
      altriDatiGestionali: line.altriDatiGestionali || null,
      ritenuta: line.ritenuta || null,
      discountSurcharge: line.scontoMaggiorazione || null,
      
      // Campi per product matching (inizialmente vuoti)
      productMatchingStatus: 'pending',
      matchConfidence: 0,
      matchedProductId: null,
      matchingMethod: 'none',
      reviewedBy: null,
      normalizedDescription: line.descrizione ? line.descrizione.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim() : '',
      matchingMetadata: {},
      alternativeMatches: []
    }));

    // Calcola totali
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalVAT = lineItems.reduce((sum, item) => sum + ((item.total || 0) * (item.vatRate || 0) / 100), 0);

    // Definisci la funzione helper PRIMA della creazione dell'oggetto
    const formatCustomerAddress = (customerData) => {
      if (!customerData) return '';
      
      const parts = [
        customerData.indirizzo,
        customerData.numeroCivico,
        customerData.comune,
        customerData.provincia,
        customerData.cap,
        customerData.nazione || 'IT'
      ].filter(part => part && part.trim() !== '');
      
      return parts.join(', ');
    };
    
    // Crea la nuova fattura (RIMUOVI TUTTE LE SEZIONI DUPLICATE)
    const newInvoice = new Invoice({
      tenantId,
      supplierId: supplier._id,
      
      // Aggiungi i validationErrors
      validationErrors,
      
      // Dati di trasmissione
      transmissionData: {
        idTrasmittente: parsedData.transmissionData?.idTrasmittente || {},
        progressivoInvio: parsedData.transmissionData?.progressivoInvio || '',
        formatoTrasmissione: parsedData.transmissionData?.formatoTrasmissione || 'FPR12',
        codiceDestinatario: parsedData.transmissionData?.codiceDestinatario || '',
        contattiTrasmittente: parsedData.transmissionData?.contattiTrasmittente || {},
        pecDestinatario: parsedData.transmissionData?.pecDestinatario || null
      },
      
      // Dati fornitore
      supplier: {
        name: supplier.name,
        vatNumber: supplier.vatNumber,
        codiceFiscale: supplier.codiceFiscale,
        address: supplier.address,
        contacts: supplier.contacts || {},
        fiscalRegime: supplier.fiscalRegime
      },
      
      // Dati cliente
      customer: {
        name: parsedData.cliente?.name || 'Cliente Sconosciuto',
        vatNumber: parsedData.cliente?.vatNumber || null,
        codiceFiscale: parsedData.cliente?.codiceFiscale || null,
        address: formatCustomerAddress(parsedData.cliente || {})
      },
      
      // Riferimenti documento
      documentReferences: {
        datiOrdineAcquisto: parsedData.header?.datiOrdineAcquisto || null,
        datiContratto: parsedData.header?.datiContratto || null,
        datiConvenzione: parsedData.header?.datiConvenzione || null,
        datiRicezione: parsedData.header?.datiRicezione || null,
        datiFattureCollegate: parsedData.header?.datiFattureCollegate || null,
        datiSAL: parsedData.header?.datiSAL || null
      },
      
      // Dati DDT
      datiDDT: parsedData.header?.datiDDT || null,
      
      // Dati trasporto
      datiTrasporto: parsedData.header?.datiTrasporto || null,
      
      // Allegati
      allegati: [],
      
      // Dati fattura
      invoiceNumber: parsedData.header.numero,
      invoiceDate: new Date(parsedData.header.data),
      totalAmount,
      totalVAT,
      currency: parsedData.header.valuta || 'EUR',
      
      // Line items
      lineItems,
      
      // Path
      path: parsedData.originalFileName ? `/invoices/${parsedData.originalFileName}` : `/invoices/${uuidv4()}.xml`,
      
      // Metadati (UNA SOLA VOLTA)
      metadata: {
        importedAt: new Date(),
        importMethod: 'xml_upload',
        originalFileName: parsedData.originalFileName || null,
        fileSize: parsedData.fileSize || null,
        processingTime: parsedData.processingTime || null,
        xmlStructure: {
          tipoDocumento: parsedData.header.tipoDocumento,
          formatoTrasmissione: parsedData.transmissionData?.formatoTrasmissione,
          causale: parsedData.header.causale
        },
        rawXML: parsedData.rawXML
      }
    });

    // Salva la fattura
    const savedInvoice = await newInvoice.save();
    
    logger.info('Fattura salvata con successo', {
      invoiceId: savedInvoice._id,
      numeroFattura: savedInvoice.invoiceNumber,
      dataFattura: savedInvoice.invoiceDate,
      supplierId: savedInvoice.supplierId,
      totalAmount: savedInvoice.totalAmount,
      lineItemsCount: savedInvoice.lineItems.length,
      tenantId
    });

    return savedInvoice;
  } catch (error) {
    logger.error('Errore salvataggio fattura', {
      error: error.message,
      stack: error.stack,
      numeroFattura: parsedData?.header?.numero,
      dataFattura: parsedData?.header?.data,
      fornitore: parsedData?.fornitore?.name,
      tenantId
    });
    throw error;
  }
};

/**
 * Aggiorna una fattura esistente
 * @param {string} invoiceId - ID della fattura
 * @param {Object} updateData - Dati da aggiornare
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Fattura aggiornata
 */
export const updateInvoice = async (invoiceId, updateData, tenantId) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: invoiceId, tenantId },
      {
        ...updateData,
        'metadata.updatedAt': new Date()
      },
      { new: true }
    );

    if (!invoice) {
      throw new Error(`Fattura con ID ${invoiceId} non trovata`);
    }

    logger.info('Fattura aggiornata', {
      invoiceId: invoice._id,
      numeroFattura: invoice.invoiceNumber,
      updatedFields: Object.keys(updateData),
      tenantId
    });

    return invoice;
  } catch (error) {
    logger.error('Errore aggiornamento fattura', {
      error: error.message,
      invoiceId,
      updateData,
      tenantId
    });
    throw error;
  }
};

/**
 * Elimina una fattura
 * @param {string} invoiceId - ID della fattura
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<boolean>} - Successo dell'operazione
 */
export const deleteInvoice = async (invoiceId, tenantId) => {
  try {
    const result = await Invoice.deleteOne({
      _id: invoiceId,
      tenantId
    });

    if (result.deletedCount === 0) {
      throw new Error(`Fattura con ID ${invoiceId} non trovata`);
    }

    logger.info('Fattura eliminata', {
      invoiceId,
      tenantId
    });

    return true;
  } catch (error) {
    logger.error('Errore eliminazione fattura', {
      error: error.message,
      invoiceId,
      tenantId
    });
    throw error;
  }
};

/**
 * Verifica se una fattura è duplicata
 * @param {Object} invoiceData - Dati della fattura
 * @param {string} tenantId - ID del tenant
 * @param {string} supplierId - ID del fornitore
 * @returns {Promise<Object|null>} - Fattura duplicata se trovata
 */
export const checkDuplicateInvoice = async (invoiceData, tenantId, supplierId) => {
  try {
    const existingInvoice = await Invoice.findOne({
      tenantId,
      supplierId,
      invoiceNumber: invoiceData.numero,
      invoiceDate: new Date(invoiceData.data)
    });

    if (existingInvoice) {
      logger.debug('Fattura duplicata trovata', {
        existingId: existingInvoice._id,
        numeroFattura: invoiceData.numero,
        dataFattura: invoiceData.data,
        supplierId,
        tenantId
      });
    }

    return existingInvoice;
  } catch (error) {
    logger.error('Errore controllo duplicati', {
      error: error.message,
      invoiceData,
      tenantId,
      supplierId
    });
    throw error;
  }
};

export default {
  saveInvoiceFromParsedData,
  updateInvoice,
  deleteInvoice,
  checkDuplicateInvoice
};
