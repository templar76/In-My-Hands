import Supplier from '../models/Supplier.js';
import logger from '../utils/logger.js';

// Aggiungi questa funzione helper
const formatAddress = (supplierData) => {
  if (typeof supplierData.address === 'string' && supplierData.address.trim()) {
    return supplierData.address.trim();
  }
  
  const parts = [
    supplierData.indirizzo,
    supplierData.numeroCivico,
    supplierData.cap,
    supplierData.comune,
    supplierData.provincia ? `(${supplierData.provincia})` : null,
    supplierData.nazione || 'IT'
  ].filter(part => part && part.trim() !== '');
  
  return parts.join(', ');
};

// RIMUOVI TUTTO IL CODICE DALLE RIGHE 24-41 (il newSupplier fuori posto)
// E mantieni solo la funzione findOrCreateSupplier:

/**
 * Trova o crea un fornitore basato sui dati della fattura
 * @param {Object} supplierData - Dati del fornitore dalla fattura
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Fornitore trovato o creato
 */
export const findOrCreateSupplier = async (supplierData, tenantId) => {
  try {
    logger.debug('Ricerca fornitore', {
      vatNumber: supplierData.vatNumber,
      codiceFiscale: supplierData.codiceFiscale,
      name: supplierData.name,
      tenantId
    });

    // Cerca prima per vatNumber se presente
    let supplier = null;
    if (supplierData.vatNumber) {
      supplier = await Supplier.findOne({
        tenantId,
        vatNumber: supplierData.vatNumber
      });
    }

    // Se non trovato per vatNumber, cerca per codice fiscale
    if (!supplier && supplierData.codiceFiscale) {
      supplier = await Supplier.findOne({
        tenantId,
        codiceFiscale: supplierData.codiceFiscale
      });
    }

    if (supplier) {
      // Aggiorna sempre i campi se forniti nei nuovi dati
      let updates = {};
      if (supplierData.codiceFiscale && supplier.codiceFiscale !== supplierData.codiceFiscale) {
        updates.codiceFiscale = supplierData.codiceFiscale;
      }
      if (supplierData.indirizzo) {
        const newAddress = formatAddress(supplierData);
        if (supplier.address !== newAddress) {
          updates.address = newAddress;
        }
      }
      // Aggiorna vatNumber se necessario
      if (supplierData.vatNumber && supplier.vatNumber !== supplierData.vatNumber) {
        updates.vatNumber = supplierData.vatNumber;
      }
      
      if (Object.keys(updates).length > 0) {
        await Supplier.updateOne({ _id: supplier._id }, { $set: updates });
        supplier = await Supplier.findById(supplier._id);
        logger.debug('Aggiornamenti applicati al fornitore esistente', { supplierId: supplier._id, updates });
      } else {
        logger.debug('Nessun aggiornamento necessario per fornitore esistente', { supplierId: supplier._id });
      }
      
      logger.debug('Fornitore esistente trovato', {
        supplierId: supplier._id,
        name: supplier.name,
        vatNumber: supplier.vatNumber,
        tenantId
      });
      logger.debug('Fornitore gestito', { isNew: false });
      return supplier;
    }
  
    // Crea nuovo fornitore
    const addressStr = formatAddress(supplierData);
    const newSupplier = new Supplier({
      tenantId,
      name: supplierData.name || 'Fornitore Sconosciuto',
      vatNumber: supplierData.vatNumber || null,
      codiceFiscale: supplierData.codiceFiscale || null,
      address: addressStr || null,
      contacts: {
        email: supplierData.email || null,
        phone: supplierData.telefono || null,
        fax: supplierData.fax || null
      },
      fiscalRegime: supplierData.regimeFiscale || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  
    await newSupplier.save();
  
    logger.info('Nuovo fornitore creato', {
      supplierId: newSupplier._id,
      name: newSupplier.name,
      vatNumber: newSupplier.vatNumber,
      codiceFiscale: newSupplier.codiceFiscale,
      address: newSupplier.address,
      tenantId
    });
    logger.debug('Fornitore gestito', { isNew: true });
    return newSupplier;
  } catch (error) {
    logger.error('Errore nella gestione del fornitore', {
      error: error.message,
      stack: error.stack,
      supplierData,
      tenantId
    });
    throw error;
  }
};

/**
 * Aggiorna i dati di un fornitore esistente
 * @param {string} supplierId - ID del fornitore
 * @param {Object} updateData - Dati da aggiornare
 * @returns {Promise<Object>} - Fornitore aggiornato
 */
export const updateSupplier = async (supplierId, updateData) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      {
        ...updateData,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!supplier) {
      throw new Error(`Fornitore con ID ${supplierId} non trovato`);
    }

    logger.info('Fornitore aggiornato', {
      supplierId: supplier._id,
      name: supplier.name,
      updatedFields: Object.keys(updateData)
    });

    return supplier;
  } catch (error) {
    logger.error('Errore aggiornamento fornitore', {
      error: error.message,
      supplierId,
      updateData
    });
    throw error;
  }
};

/**
 * Ottieni tutti i fornitori di un tenant
 * @param {string} tenantId - ID del tenant
 * @param {Object} options - Opzioni di filtro e paginazione
 * @returns {Promise<Object>} - Lista fornitori con metadati
 */
export const getSuppliers = async (tenantId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      isActive = true
    } = options;

    const query = { tenantId };
    
    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { vatNumber: { $regex: search, $options: 'i' } },
        { codiceFiscale: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Supplier.countDocuments(query)
    ]);

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Errore recupero fornitori', {
      error: error.message,
      tenantId,
      options
    });
    throw error;
  }
};

/**
 * Ottieni un fornitore per ID
 * @param {string} supplierId - ID del fornitore
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Fornitore
 */
export const getSupplierById = async (supplierId, tenantId) => {
  try {
    const supplier = await Supplier.findOne({
      _id: supplierId,
      tenantId
    });

    if (!supplier) {
      throw new Error(`Fornitore con ID ${supplierId} non trovato`);
    }

    return supplier;
  } catch (error) {
    logger.error('Errore recupero fornitore', {
      error: error.message,
      supplierId,
      tenantId
    });
    throw error;
  }
};

/**
 * Disattiva un fornitore
 * @param {string} supplierId - ID del fornitore
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Fornitore disattivato
 */
export const deactivateSupplier = async (supplierId, tenantId) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: supplierId, tenantId },
      {
        isActive: false,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!supplier) {
      throw new Error(`Fornitore con ID ${supplierId} non trovato`);
    }

    logger.info('Fornitore disattivato', {
      supplierId: supplier._id,
      name: supplier.name,
      tenantId
    });

    return supplier;
  } catch (error) {
    logger.error('Errore disattivazione fornitore', {
      error: error.message,
      supplierId,
      tenantId
    });
    throw error;
  }
};

export default {
  findOrCreateSupplier,
  updateSupplier,
  getSuppliers,
  getSupplierById,
  deactivateSupplier
};