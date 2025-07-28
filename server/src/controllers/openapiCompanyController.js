import axios from 'axios';
import logger from '../utils/logger.js'; // Aggiungi .js qui

export const fetchCompanyData = async (req, res) => {
  const { vatCode_taxCode_or_id } = req.query;

  // Validazione input
  if (!vatCode_taxCode_or_id) {
    return res.status(400).json({ success: false, message: 'Parametro vatCode_taxCode_or_id richiesto.' });
  }

  // Validazione P.IVA (11 numeri) o Codice Fiscale (11 numeri se inizia con cifra, 16 alfanumerici se inizia con lettera)
  const isNumeric = /^[0-9]+$/;
  const isAlphanumeric = /^[A-Z0-9]+$/i;
  if (vatCode_taxCode_or_id.length === 11 && isNumeric.test(vatCode_taxCode_or_id)) {
    // Valido come P.IVA o CF numerico
  } else if (vatCode_taxCode_or_id.length === 16 && isAlphanumeric.test(vatCode_taxCode_or_id) && /^[A-Z]/i.test(vatCode_taxCode_or_id)) {
    // Valido come CF alfanumerico
  } else {
    return res.status(400).json({ success: false, message: 'Formato non valido per P.IVA o Codice Fiscale.' });
  }

  try {
    const response = await axios.get(
      `https://company.openapi.com/IT-start/${vatCode_taxCode_or_id}`,
      { headers: { 'Authorization': `Bearer ${process.env.OPENAPI_KEY}` } }
    );

    if (response.status === 200 && response.data.success) {
      const companyData = response.data.data[0]; // Assumendo struttura con array data

      // Controllo activityStatus
      const acceptedStatuses = ['ATTIVA', 'REGISTRATA'];
      if (!acceptedStatuses.includes(companyData.activityStatus)) {
        return res.status(400).json({ success: false, message: 'Partita IVA non attiva o non accettata.' });
      }

      // Mappa i campi necessari
      const mappedData = {
        companyName: companyData.companyName,
        vatNumber: companyData.vatCode,
        codiceFiscale: companyData.taxCode,
        country: 'IT', // Aggiungiamo il campo country basato sull'API utilizzata
        address: `${companyData.address.registeredOffice.streetName || ''}, ${companyData.address.registeredOffice.zipCode || ''} ${companyData.address.registeredOffice.town || ''} (${companyData.address.registeredOffice.province || ''})`,
        sdiCode: companyData.sdiCode,
        // Aggiungi altri campi se necessari dalla struttura data
      };

      return res.json({ success: true, data: mappedData });
    } else {
      // Gestione errori API
      const errorCode = response.data.error || response.status;
      let userMessage = 'Errore nel recupero dati. Inserisci manualmente.';
      if (errorCode === 402) {
        logger.error('Errore pagamento API OpenAPI', { error: response.data.message });
      } else if (errorCode === 404) {
        userMessage = 'Azienda non trovata.';
      } else if (errorCode === 406) {
        userMessage = 'P.IVA o Codice Fiscale non valido.';
      }
      return res.status(response.status).json({ success: false, message: userMessage });
    }
  } catch (error) {
    logger.error('Errore chiamata API OpenAPI', { error: error.message });
    return res.status(500).json({ success: false, message: 'Errore server. Inserisci manualmente.' });
  }
};