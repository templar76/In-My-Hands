import xml2js from 'xml2js';
import logger from '../utils/logger.js';

/**
 * Parsa i dati del corpo della fattura (DatiBeniServizi)
 * @param {Object} fatturaBody - Corpo della fattura XML
 * @returns {Array} - Array delle linee prodotto
 */
export const parseInvoiceBody = (fatturaBody) => {
  try {
    const lines = [];
    
    if (!fatturaBody.DatiBeniServizi) {
      logger.warn('DatiBeniServizi non trovato nel corpo della fattura');
      return lines;
    }

    const datiBeniServizi = Array.isArray(fatturaBody.DatiBeniServizi) 
      ? fatturaBody.DatiBeniServizi 
      : [fatturaBody.DatiBeniServizi];

    datiBeniServizi.forEach((item, index) => {
      try {
        const line = {
          numeroLinea: item.NumeroLinea ? parseInt(item.NumeroLinea[0]) : index + 1,
          descrizione: item.Descrizione ? item.Descrizione[0] : '',
          quantita: item.Quantita ? parseFloat(item.Quantita[0]) : 1,
          prezzoUnitario: item.PrezzoUnitario ? parseFloat(item.PrezzoUnitario[0]) : 0,
          prezzoTotale: item.PrezzoTotale ? parseFloat(item.PrezzoTotale[0]) : 0,
          iva: item.AliquotaIVA ? parseFloat(item.AliquotaIVA[0]) : 0,
          uM: item.UnitaMisura ? item.UnitaMisura[0] : 'PZ',
          codiceArticolo: item.CodiceArticolo ? item.CodiceArticolo[0] : null,
          scontoMaggiorazione: item.ScontoMaggiorazione || null,
          ritenuta: item.Ritenuta || null,
          altriDatiGestionali: item.AltriDatiGestionali || null
        };

        // Calcola il prezzo totale se non presente
        if (!line.prezzoTotale && line.quantita && line.prezzoUnitario) {
          line.prezzoTotale = line.quantita * line.prezzoUnitario;
        }

        lines.push(line);
      } catch (itemError) {
        logger.error('Errore parsing linea prodotto', {
          error: itemError.message,
          lineIndex: index,
          item
        });
      }
    });

    logger.debug('Parsing corpo fattura completato', {
      totalLines: lines.length,
      originalItems: datiBeniServizi.length
    });

    return lines;
  } catch (error) {
    logger.error('Errore parsing corpo fattura', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Parsa i dati dell'header della fattura (DatiGenerali)
 * @param {Object} fatturaHeader - Header della fattura XML
 * @returns {Object} - Dati dell'header parsati
 */
export const parseInvoiceHeader = (fatturaHeader) => {
  try {
    const datiGenerali = fatturaHeader.DatiGenerali?.[0] || {};
    const datiGeneraliDocumento = datiGenerali.DatiGeneraliDocumento?.[0] || {};
    
    const header = {
      numero: datiGeneraliDocumento.Numero?.[0] || '',
      data: datiGeneraliDocumento.Data?.[0] || '',
      tipoDocumento: datiGeneraliDocumento.TipoDocumento?.[0] || 'TD01',
      valuta: datiGeneraliDocumento.Divisa?.[0] || 'EUR',
      causale: datiGeneraliDocumento.Causale || [],
      art73: datiGeneraliDocumento.Art73?.[0] || null,
      
      // Dati Ordine di Acquisto
      datiOrdineAcquisto: datiGenerali.DatiOrdineAcquisto || null,
      
      // Dati Contratto
      datiContratto: datiGenerali.DatiContratto || null,
      
      // Dati Convenzione
      datiConvenzione: datiGenerali.DatiConvenzione || null,
      
      // Dati Ricezione
      datiRicezione: datiGenerali.DatiRicezione || null,
      
      // Dati Fatture Collegate
      datiFattureCollegate: datiGenerali.DatiFattureCollegate || null,
      
      // Dati SAL
      datiSAL: datiGenerali.DatiSAL || null,
      
      // Dati DDT
      datiDDT: datiGenerali.DatiDDT || null,
      
      // Dati Trasporto
      datiTrasporto: datiGenerali.DatiTrasporto || null,
      
      // Fattura Principale
      fatturaPrincipale: datiGenerali.FatturaPrincipale || null
    };

    logger.debug('Parsing header fattura completato', {
      numero: header.numero,
      data: header.data,
      tipoDocumento: header.tipoDocumento,
      valuta: header.valuta
    });

    return header;
  } catch (error) {
    logger.error('Errore parsing header fattura', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Parsa i dati di trasmissione della fattura
 * @param {Object} datiTrasmissione - Dati di trasmissione XML
 * @returns {Object} - Dati di trasmissione parsati
 */
export const parseTransmissionData = (datiTrasmissione) => {
  try {
    if (!datiTrasmissione) {
      logger.warn('Dati trasmissione non trovati');
      return {};
    }

    const transmission = {
      idTrasmittente: {
        idPaese: datiTrasmissione.IdTrasmittente?.[0]?.IdPaese?.[0] || '',
        idCodice: datiTrasmissione.IdTrasmittente?.[0]?.IdCodice?.[0] || ''
      },
      progressivoInvio: datiTrasmissione.ProgressivoInvio?.[0] || '',
      formatoTrasmissione: datiTrasmissione.FormatoTrasmissione?.[0] || 'FPR12',
      codiceDestinatario: datiTrasmissione.CodiceDestinatario?.[0] || '',
      contattiTrasmittente: {
        telefono: datiTrasmissione.ContattiTrasmittente?.[0]?.Telefono?.[0] || null,
        email: datiTrasmissione.ContattiTrasmittente?.[0]?.Email?.[0] || null
      },
      pecDestinatario: datiTrasmissione.PECDestinatario?.[0] || null
    };

    logger.debug('Parsing dati trasmissione completato', {
      idTrasmittente: transmission.idTrasmittente,
      progressivoInvio: transmission.progressivoInvio,
      formatoTrasmissione: transmission.formatoTrasmissione
    });

    return transmission;
  } catch (error) {
    logger.error('Errore parsing dati trasmissione', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Parsa i dati del fornitore (CedentePrestatore)
 * @param {Object} cedentePrestatore - Dati del cedente/prestatore XML
 * @returns {Object} - Dati del fornitore parsati
 */
export const parseSupplierData = (cedentePrestatore) => {
  try {
    if (!cedentePrestatore) {
      logger.warn('Dati cedente/prestatore non trovati');
      return {};
    }

    const datiAnagrafici = cedentePrestatore.DatiAnagrafici?.[0] || {};
    const sede = cedentePrestatore.Sede?.[0] || {};
    const contatti = cedentePrestatore.Contatti?.[0] || {};

    const supplier = {
      name: datiAnagrafici.Anagrafica?.[0]?.Denominazione?.[0] || 
            `${datiAnagrafici.Anagrafica?.[0]?.Nome?.[0] || ''} ${datiAnagrafici.Anagrafica?.[0]?.Cognome?.[0] || ''}`.trim(),
      
      // ✅ CORREZIONE: Sostituito pIva con vatNumber
      vatNumber: datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0] ? 
        (datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0].startsWith('IT') ? 
        datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0] : 
        'IT' + datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0]) : null,
      
      codiceFiscale: datiAnagrafici.CodiceFiscale?.[0] || null,
      regimeFiscale: datiAnagrafici.RegimeFiscale?.[0] || null,
      
      // Dati sede
      indirizzo: sede.Indirizzo?.[0] || null,
      numeroCivico: sede.NumeroCivico?.[0] || null,
      cap: sede.CAP?.[0] || null,
      comune: sede.Comune?.[0] || null,
      provincia: sede.Provincia?.[0] || null,
      nazione: sede.Nazione?.[0] || 'IT',
      
      // Contatti
      telefono: contatti.Telefono?.[0] || null,
      fax: contatti.Fax?.[0] || null,
      email: contatti.Email?.[0] || null,
      
      // Altri dati
      iscrizioneREA: cedentePrestatore.IscrizioneREA || null,
      riferimentoAmministrazione: cedentePrestatore.RiferimentoAmministrazione || null
    };

    logger.debug('Dati fornitore estratti:', supplier);
    logger.debug('Parsing dati fornitore completato', {
      name: supplier.name,
      vatNumber: supplier.vatNumber,  // ✅ Cambiato da pIva
      codiceFiscale: supplier.codiceFiscale
    });

    return supplier;
  } catch (error) {
    logger.error('Errore parsing dati fornitore', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Parsa i dati del cliente (CessionarioCommittente)
 * @param {Object} cessionarioCommittente - Dati del cessionario/committente XML
 * @returns {Object} - Dati del cliente parsati
 */
export const parseCustomerData = (cessionarioCommittente) => {
  try {
    if (!cessionarioCommittente) {
      logger.warn('Dati cessionario/committente non trovati');
      return {};
    }

    const datiAnagrafici = cessionarioCommittente.DatiAnagrafici?.[0] || {};
    const sede = cessionarioCommittente.Sede?.[0] || {};

    const customer = {
      name: datiAnagrafici.Anagrafica?.[0]?.Denominazione?.[0] || 
            `${datiAnagrafici.Anagrafica?.[0]?.Nome?.[0] || ''} ${datiAnagrafici.Anagrafica?.[0]?.Cognome?.[0] || ''}`.trim(),
      
      // ✅ CORREZIONE: Sostituito pIva con vatNumber
      vatNumber: datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0] ? 
        (datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0].startsWith('IT') ? 
        datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0] : 
        'IT' + datiAnagrafici.IdFiscaleIVA?.[0]?.IdCodice?.[0]) : null,
      
      codiceFiscale: datiAnagrafici.CodiceFiscale?.[0] || null,
      
      // Dati sede
      indirizzo: sede.Indirizzo?.[0] || null,
      numeroCivico: sede.NumeroCivico?.[0] || null,
      cap: sede.CAP?.[0] || null,
      comune: sede.Comune?.[0] || null,
      provincia: sede.Provincia?.[0] || null,
      nazione: sede.Nazione?.[0] || 'IT'
    };

    logger.debug('Dati cliente estratti:', customer);
    logger.debug('Parsing dati cliente completato', {
      name: customer.name,
      vatNumber: customer.vatNumber,  // ✅ Cambiato da pIva
      codiceFiscale: customer.codiceFiscale
    });

    return customer;
  } catch (error) {
    logger.error('Errore parsing dati cliente', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Parsa l'intero XML della fattura
 * @param {string} xmlContent - Contenuto XML della fattura
 * @returns {Promise<Object>} - Dati della fattura parsati
 */
export const parseInvoiceXML = async (xmlContent) => {
  try {
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(xmlContent);
    
    const fatturaElettronica = result['p:FatturaElettronica'] || result.FatturaElettronica;
    if (!fatturaElettronica) {
      throw new Error('Struttura XML fattura non valida');
    }

    const fatturaHeader = fatturaElettronica.FatturaElettronicaHeader?.[0];
    const fatturaBody = fatturaElettronica.FatturaElettronicaBody?.[0];

    if (!fatturaHeader || !fatturaBody) {
      throw new Error('Header o Body della fattura mancanti');
    }

    // Parsa le varie sezioni
    const transmissionData = parseTransmissionData(fatturaHeader.DatiTrasmissione?.[0]);
    logger.debug('Dati trasmissione estratti:', transmissionData);
    const supplierData = parseSupplierData(fatturaHeader.CedentePrestatore?.[0]);
    const customerData = parseCustomerData(fatturaHeader.CessionarioCommittente?.[0]);
    const headerData = parseInvoiceHeader(fatturaBody);
    logger.debug('Header estratti:', headerData);
    const lines = parseInvoiceBody(fatturaBody);

    const parsedInvoice = {
      transmissionData,
      fornitore: supplierData,
      cliente: customerData,
      header: headerData,
      lines,
      rawXML: xmlContent
    };

    logger.info('Parsing XML fattura completato', {
      numeroFattura: headerData.numero,
      dataFattura: headerData.data,
      fornitore: supplierData.name,
      cliente: customerData.name,
      numeroLinee: lines.length
    });

    return parsedInvoice;
  } catch (error) {
    logger.error('Errore parsing XML fattura', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export default {
  parseInvoiceBody,
  parseInvoiceHeader,
  parseTransmissionData,
  parseSupplierData,
  parseCustomerData,
  parseInvoiceXML
};