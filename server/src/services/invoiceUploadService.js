import { storage } from '../firebaseAdmin.js';
import { processFile, processFiles } from './parsers/dispatcher_import.js';
import { parseInvoiceXML } from './invoiceParsingService.js';
import { saveInvoiceFromParsedData } from './invoiceSaveService.js';
import { importProductsFromInvoice } from './productImportService.js';
import Tenant from '../models/Tenant.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Carica un singolo file XML di fattura
 * @param {Object} file - File caricato
 * @param {string} tenantId - ID del tenant
 * @param {Object} clientData - Dati del client
 * @returns {Promise<Object>} - Risultato dell'upload
 */
export const uploadSingleInvoice = async (file, tenantId) => {
  const startTime = Date.now();
  let localFilePath = null;
  
  try {
    logger.info('Inizio upload singola fattura', {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      tenantId
    });

    // Validazione file
    if (!file.originalname.toLowerCase().endsWith('.xml')) {
      throw new Error('Solo file XML sono supportati');
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File troppo grande. Limite: 10MB');
    }

    // Genera nome file unico
    const fileName = `${uuidv4()}_${file.originalname}`;
    const firebasePath = `invoices/${tenantId}/${fileName}`;
    
    // Salva temporaneamente il file localmente
    const tempDir = '/tmp';
    localFilePath = path.join(tempDir, fileName);
    
    await fs.promises.writeFile(localFilePath, file.buffer);
    
    logger.debug('File salvato temporaneamente', {
      localPath: localFilePath,
      fileName,
      tenantId
    });

    // Leggi e parsa il contenuto XML
    const xmlContent = await fs.promises.readFile(localFilePath, 'utf8');
    const parsedData = await parseInvoiceXML(xmlContent);
    
    // Aggiungi metadati del file
    parsedData.originalFileName = file.originalname;
    parsedData.fileSize = file.size;
    parsedData.processingTime = Date.now() - startTime;

    // Salva la fattura nel database
    const savedInvoice = await saveInvoiceFromParsedData(parsedData, tenantId);
    
    logger.info('Fattura salvata nel database', {
      invoiceId: savedInvoice._id,
      numeroFattura: savedInvoice.invoiceNumber,
      tenantId
    });

    // Carica su Firebase Storage
    try {
      const bucket = storage.bucket();
      await bucket.upload(localFilePath, {
        destination: firebasePath,
        metadata: {
          metadata: {
            tenantId,
            invoiceId: savedInvoice._id.toString(),
            originalName: file.originalname,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      logger.debug('File caricato su Firebase Storage', {
        firebasePath,
        invoiceId: savedInvoice._id,
        tenantId
      });
    } catch (storageError) {
      logger.warn('Errore caricamento Firebase Storage', {
        error: storageError.message,
        firebasePath,
        invoiceId: savedInvoice._id,
        tenantId
      });
      // Non bloccare il processo se il caricamento su storage fallisce
    }

    // Importa prodotti dalla fattura
    try {
      const tenant = await Tenant.findById(tenantId);
      const tenantConfig = tenant?.productMatchingConfig || null; // ← CORREGGERE: era tenant?.configuration
      
      const importResults = await importProductsFromInvoice(
        parsedData,
        savedInvoice.supplierId,
        tenantId,
        savedInvoice._id,
        tenantConfig
      );
      
      logger.info('Importazione prodotti completata', {
        invoiceId: savedInvoice._id,
        importResults: importResults.length,
        tenantId
      });
    } catch (importError) {
      logger.error('Errore importazione prodotti', {
        error: importError.message,
        invoiceId: savedInvoice._id,
        tenantId
      });
      // Non bloccare il processo se l'importazione prodotti fallisce
    }

    const processingTime = Date.now() - startTime;
    
    logger.info('Upload singola fattura completato', {
      invoiceId: savedInvoice._id,
      numeroFattura: savedInvoice.invoiceNumber,
      processingTime,
      tenantId
    });

    return {
      success: true,
      invoice: {
        id: savedInvoice._id,
        invoiceNumber: savedInvoice.invoiceNumber,
        invoiceDate: savedInvoice.invoiceDate,
        totalAmount: savedInvoice.totalAmount,
        supplier: savedInvoice.supplier,
        lineItemsCount: savedInvoice.lineItems.length
      },
      processingTime
    };
  } catch (error) {
    logger.error('Errore upload singola fattura', {
      error: error.message,
      stack: error.stack,
      fileName: file?.originalname,
      tenantId
    });
    
    throw error;
  } finally {
    // Pulisci file temporaneo
    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
        logger.debug('File temporaneo eliminato', { localFilePath });
      } catch (cleanupError) {
        logger.warn('Errore eliminazione file temporaneo', {
          error: cleanupError.message,
          localFilePath
        });
      }
    }
  }
};

/**
 * Carica multipli file di fatture
 * @param {Array} files - Array di file caricati
 * @param {string} tenantId - ID del tenant
 * @param {Object} clientData - Dati del client
 * @returns {Promise<Object>} - Risultato dell'upload multiplo
 */
export const uploadMultipleInvoices = async (files, tenantId, clientData) => {
  const startTime = Date.now();
  
  try {
    logger.info('Inizio upload multiplo fatture', {
      filesCount: files.length,
      tenantId
    });

    if (!files || files.length === 0) {
      throw new Error('Nessun file fornito');
    }

    if (files.length > 10) {
      throw new Error('Massimo 10 file per upload');
    }

    // Processa i file usando il dispatcher
    const results = await processFiles(files, {
      tenantId,
      clientData,
      maxFiles: 10,
      allowedTypes: ['xml', 'p7m', 'zip'],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    });

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const processingTime = Date.now() - startTime;

    logger.info('Upload multiplo completato', {
      totalFiles: files.length,
      successCount,
      errorCount,
      processingTime,
      tenantId
    });

    return {
      success: true,
      summary: {
        totalFiles: files.length,
        successCount,
        errorCount,
        processingTime
      },
      results
    };
  } catch (error) {
    logger.error('Errore upload multiplo fatture', {
      error: error.message,
      stack: error.stack,
      filesCount: files?.length,
      tenantId
    });
    
    throw error;
  }
};

/**
 * Processa un singolo file attraverso il dispatcher
 * @param {Object} file - File da processare
 * @param {Object} options - Opzioni di processamento
 * @returns {Promise<Object>} - Risultato del processamento
 */
export const processSingleFile = async (file, options = {}) => {
  try {
    const {
      tenantId,
      // ❌ Rimuovere: clientData,
      saveToStorage = true,
      importProducts = true
    } = options;

    logger.debug('Inizio processamento singolo file', {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      tenantId
    });

    // Usa il dispatcher per processare il file
    const parseResult = await processFile(file);

    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Errore nel parsing del file');
    }

    // Salva la fattura parsata
    const savedInvoice = await saveInvoiceFromParsedData(parseResult.result, tenantId);

    // Opzionale: importa prodotti
    if (importProducts) {
      const tenant = await Tenant.findById(tenantId);
      const tenantConfig = tenant?.configuration || null;
      await importProductsFromInvoice(
        parseResult.result,
        savedInvoice.supplierId,
        tenantId,
        savedInvoice._id,
        tenantConfig
      );
    }

    // TODO: Aggiungi logica per saveToStorage se necessario (caricamento su Firebase)

    logger.debug('Processamento singolo file completato', {
      fileName: file.originalname,
      success: true,
      invoiceId: savedInvoice._id,
      tenantId
    });

    return {
      success: true,
      invoice: {
        id: savedInvoice._id,
        invoiceNumber: savedInvoice.invoiceNumber,
        totalAmount: savedInvoice.totalAmount
      }
    };
  } catch (error) {
    logger.error('Errore processamento singolo file', {
      error: error.message,
      fileName: file?.originalname,
      tenantId: options?.tenantId
    });
    
    return {
      success: false,
      fileName: file?.originalname,
      error: error.message
    };
  }
};

/**
 * Valida un file prima dell'upload
 * @param {Object} file - File da validare
 * @param {Object} options - Opzioni di validazione
 * @returns {Object} - Risultato della validazione
 */
export const validateFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedExtensions = ['.xml', '.p7m', '.zip'],
    allowedMimeTypes = [
      'application/xml',
      'text/xml',
      'application/pkcs7-mime',
      'application/zip'
    ]
  } = options;

  const errors = [];

  // Controlla dimensione
  if (file.size > maxSize) {
    errors.push(`File troppo grande: ${(file.size / 1024 / 1024).toFixed(2)}MB. Limite: ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
  }

  // Controlla estensione
  const fileExt = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    errors.push(`Estensione non supportata: ${fileExt}. Supportate: ${allowedExtensions.join(', ')}`);
  }

  // Controlla MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    errors.push(`Tipo MIME non supportato: ${file.mimetype}. Supportati: ${allowedMimeTypes.join(', ')}`);
  }

  // Controlla nome file
  if (!file.originalname || file.originalname.trim() === '') {
    errors.push('Nome file mancante');
  }

  const isValid = errors.length === 0;

  logger.debug('Validazione file completata', {
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    isValid,
    errors
  });

  return {
    isValid,
    errors,
    file: {
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      extension: fileExt
    }
  };
};

/**
 * Ottieni informazioni sui file supportati
 * @returns {Object} - Informazioni sui tipi di file supportati
 */
export const getSupportedFileTypes = () => {
  return {
    extensions: ['.xml', '.p7m', '.zip'],
    mimeTypes: [
      'application/xml',
      'text/xml',
      'application/pkcs7-mime',
      'application/zip'
    ],
    maxFileSize: '10MB',
    maxFilesPerUpload: 10,
    descriptions: {
      '.xml': 'Fattura Elettronica XML',
      '.p7m': 'Fattura Elettronica Firmata Digitalmente',
      '.zip': 'Archivio contenente multiple fatture'
    }
  };
};

export default {
  uploadSingleInvoice,
  uploadMultipleInvoices,
  processSingleFile,
  validateFile,
  getSupportedFileTypes
};

// Usa stream invece di buffer per i file di grandi dimensioni
const processLargeFile = async (file, tempDir, fileName) => {
  const localFilePath = path.join(tempDir, fileName);
  
  return new Promise((resolve, reject) => {
    // Crea uno stream di scrittura
    const writeStream = fs.createWriteStream(localFilePath);
    
    // Gestisci gli eventi dello stream
    writeStream.on('finish', () => {
      resolve(localFilePath);
    });
    
    writeStream.on('error', (err) => {
      reject(err);
    });
    
    // Scrivi il buffer nello stream
    writeStream.write(file.buffer);
    writeStream.end();
  });
};