import xml2js from 'xml2js';
import logger from '../../utils/logger.js';
import ProductMatchingService from '../productMatchingService.js'; // Importa la classe
import { mapPIvaToVatNumber } from '../../utils/mapping.js'; // Importa il workaround

// Funzioni di parsing estratte/adattate da old_invoiceController
export const parseXmlInvoice = async (xmlString) => {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const doc = await parser.parseStringPromise(xmlString);

    // Log della struttura del documento per debug (usa info per visibilità)
    logger.info('Struttura XML parsata', { docKeys: Object.keys(doc) });

    // Ricerca dinamica del nodo root
    let invoice = doc.FatturaElettronica || null;
    if (!invoice) {
      const rootKey = Object.keys(doc).find(key => key.endsWith('FatturaElettronica'));
      if (rootKey) {
        invoice = doc[rootKey];
        logger.info(`Nodo root trovato con chiave dinamica: ${rootKey}`);
      }
    }

    if (!invoice) {
      logger.error('Errore: nodo root FatturaElettronica non trovato', { docStructure: JSON.stringify(doc, null, 2) });
      throw new Error('Root node FatturaElettronica non trovato nel XML');
    }

    // Estrazione header con check
    const header = invoice.FatturaElettronicaHeader || {};
    const transmissionData = header.DatiTrasmissione || {};
    const supplier = header.CedentePrestatore || {};
    const customer = header.CessionarioCommittente || {};

    // Estrazione body con check
    const body = invoice.FatturaElettronicaBody || {};
    const generalData = body.DatiGenerali || {};
    const goodsData = body.DatiBeniServizi || {};

    // Parsing linee prodotto con check
    const dettaglioLinee = goodsData.DettaglioLinee || [];
    const lines = (Array.isArray(dettaglioLinee) ? dettaglioLinee : [dettaglioLinee]).map(line => ({
      numeroLinea: line.NumeroLinea || '',
      descrizione: line.Descrizione || '',
      quantita: line.Quantita || 0,
      prezzoUnitario: line.PrezzoUnitario || 0,
      uM: line.UnitaMisura || '',
      iva: line.AliquotaIVA || 0,
      codiceArticolo: line.CodiceArticolo ? line.CodiceArticolo.CodiceValore : null
    }));

    // Normalizzazione descrizioni (usando il metodo statico)
    lines.forEach(line => {
      line.descriptionStd = ProductMatchingService.normalizeDescription(line.descrizione);
    });

    const parsedInvoice = {
      header: {
        numero: generalData.DatiGeneraliDocumento ? generalData.DatiGeneraliDocumento.Numero : '',
        data: generalData.DatiGeneraliDocumento ? generalData.DatiGeneraliDocumento.Data : '',
        valuta: generalData.DatiGeneraliDocumento ? generalData.DatiGeneraliDocumento.Divisa : 'EUR'
      },
      fornitore: {
        name: supplier.DatiAnagrafici && supplier.DatiAnagrafici.Anagrafica ? supplier.DatiAnagrafici.Anagrafica.Denominazione : '',
        vatNumber: supplier.DatiAnagrafici && supplier.DatiAnagrafici.IdFiscaleIVA ? (supplier.DatiAnagrafici.IdFiscaleIVA.IdPaese || 'IT') + supplier.DatiAnagrafici.IdFiscaleIVA.IdCodice : '',
        codiceFiscale: supplier.DatiAnagrafici ? supplier.DatiAnagrafici.CodiceFiscale || null : null,
        address: formatSupplierAddress(supplier.Sede),
        // Dati REA estesi
        iscrizioneREA: {
          ufficio: supplier.IscrizioneREA?.Ufficio || null,
          numeroREA: supplier.IscrizioneREA?.NumeroREA || null,
          capitaleSociale: supplier.IscrizioneREA?.CapitaleSociale ? parseFloat(supplier.IscrizioneREA.CapitaleSociale) : null,
          socioUnico: supplier.IscrizioneREA?.SocioUnico || null,
          statoLiquidazione: supplier.IscrizioneREA?.StatoLiquidazione || null
        },
        // Contatti dettagliati
        contatti: {
          telefono: supplier.Contatti?.Telefono || null,
          fax: supplier.Contatti?.Fax || null,
          email: supplier.Contatti?.Email || null
        }
      },
      cliente: {
        name: customer.DatiAnagrafici && customer.DatiAnagrafici.Anagrafica ? customer.DatiAnagrafici.Anagrafica.Denominazione || `${customer.DatiAnagrafici.Anagrafica.Nome || ''} ${customer.DatiAnagrafici.Anagrafica.Cognome || ''}` : '',
        vatNumber: customer.DatiAnagrafici && customer.DatiAnagrafici.IdFiscaleIVA ? (customer.DatiAnagrafici.IdFiscaleIVA.IdPaese || 'IT') + customer.DatiAnagrafici.IdFiscaleIVA.IdCodice : '',
        codiceFiscale: customer.DatiAnagrafici ? customer.DatiAnagrafici.CodiceFiscale || null : null,
        address: formatCustomerAddress(customer.Sede),
        // Aggiungi anche i campi separati per il debugging
        indirizzo: customer.Sede?.Indirizzo || null,
        numeroCivico: customer.Sede?.NumeroCivico || null,
        cap: customer.Sede?.CAP || null,
        comune: customer.Sede?.Comune || null,
        provincia: customer.Sede?.Provincia || null,
        nazione: customer.Sede?.Nazione || 'IT'
      },
      lines: lines
    };
    // Applica mapping per entrambi
    parsedInvoice.fornitore = mapPIvaToVatNumber(parsedInvoice.fornitore);
    parsedInvoice.cliente = mapPIvaToVatNumber(parsedInvoice.cliente);

    return {
      success: true,
      data: parsedInvoice,
      type: 'xml'
    };
  } catch (error) {
    logger.error('Errore parsing XML', { error: error.message });
    return {
      success: false,
      error: error.message,
      type: 'xml'
    };
  }
};

// Aggiungi questa funzione helper alla fine del file
const formatCustomerAddress = (sede) => {
  if (!sede) return '';
  
  const parts = [
    sede.Indirizzo,
    sede.NumeroCivico,
    sede.CAP,
    sede.Comune,
    sede.Provincia ? `(${sede.Provincia})` : null,
    sede.Nazione || 'IT'
  ].filter(part => part && part.trim() !== '');
  
  return parts.join(', ');
};

// Mantieni anche la funzione formatSupplierAddress esistente
const formatSupplierAddress = (sede) => {
  if (!sede) return '';
  
  const parts = [
    sede.Indirizzo,
    sede.NumeroCivico,
    sede.CAP,
    sede.Comune,
    sede.Provincia ? `(${sede.Provincia})` : null,
    sede.Nazione || 'IT'
  ].filter(part => part && part.trim() !== '');
  
  return parts.join(', ');
};