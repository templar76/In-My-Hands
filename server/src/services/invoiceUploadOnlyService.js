import ProcessingJobService from './processingJobService.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid'; // ✅ AGGIUNTO

/**
 * Servizio per l'upload di file senza elaborazione automatica
 */

/**
 * Carica i file e crea un job in stato 'uploaded'
 * @param {Array} files - Array di file da caricare
 * @param {string} tenantId - ID del tenant
 * @param {string} uid - UID dell'utente
 * @returns {Promise<Object>} - Risultato dell'upload
 */
export const uploadFilesOnly = async (files, tenantId, uid) => {
  try {
    logger.info('Avvio upload-only', {
      filesCount: files.length,
      tenantId
    });

    const user = await User.findOne({ uid });
    if (!user) {
      throw new Error('User not found');
    }
    const userId = user._id;

    // Processa i file per estrarre ZIP se necessario
    const processedFiles = await processUploadedFiles(files);

    // ✅ CORREZIONE: Chiama la funzione per salvare i file
    const savedFiles = await saveFilesToTempStorage(processedFiles, tenantId);

    // Crea un nuovo job in stato 'uploaded' con i percorsi dei file
    const job = await ProcessingJobService.createJob(
      tenantId,
      userId,
      savedFiles, // ✅ Ora savedFiles è definito
      {
        status: 'uploaded',
        startedAt: new Date(),
        metadata: {
          uploadMethod: files.length === 1 ? 'single' : 'multiple',
          originalFilesCount: files.length,
          extractedFilesCount: processedFiles.length,
          tempStoragePath: `/tmp/invoices/${tenantId}`
        }
      }
    );

    // Aggiorna tutti i file come 'uploaded'
    for (const file of savedFiles) {
      await ProcessingJobService.updateFileProgress(job.jobId, file.originalname, {
        status: 'uploaded',
        stage: 'upload',
        percentage: 100,
        message: 'File caricato con successo',
        tempFilePath: file.tempFilePath
      });
    }

    logger.info('Upload-only completato', {
      jobId: job.jobId,
      originalFiles: files.length,
      extractedFiles: processedFiles.length,
      tenantId
    });

    return {
      success: true,
      jobId: job.jobId,
      uploadedFiles: files.length,
      extractedFiles: processedFiles.length,
      message: `Upload completato! ${processedFiles.length} file pronti per l'elaborazione.`,
      status: 'uploaded'
    };
  } catch (error) {
    logger.error('Errore upload-only', {
      error: error.message,
      stack: error.stack,
      filesCount: files?.length,
      tenantId
    });
    throw error;
  }
};

/**
 * Processa i file caricati, estraendo i ZIP se necessario
 * @param {Array} files - File da processare
 * @returns {Array} - File processati
 */
const processUploadedFiles = async (files) => {
  const processedFiles = [];
  const allowedExtensions = ['.xml', '.p7m', '.pdf'];

  for (const file of files) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (fileExtension === '.zip') {
      // Estrai file ZIP
      try {
        const zip = new AdmZip(file.buffer);
        const zipEntries = zip.getEntries();
        
        for (const entry of zipEntries) {
          if (!entry.isDirectory) {
            const fileName = path.basename(entry.entryName);
            const entryExtension = path.extname(entry.entryName).toLowerCase();
            
            // ✅ FILTRI AGGIUNTI:
            // 1. Escludi file che iniziano con '.'
            // 2. Includi solo estensioni consentite
            if (!fileName.startsWith('.') && allowedExtensions.includes(entryExtension)) {
              processedFiles.push({
                originalname: fileName,
                buffer: entry.getData(),
                mimetype: getMimeType(entryExtension),
                size: entry.header.size,
                extractedFrom: file.originalname,
                originalPath: entry.entryName
              });
            }
          }
        }
      } catch (error) {
        logger.warn('Errore estrazione ZIP', {
          filename: file.originalname,
          error: error.message
        });
        // Aggiungi il file ZIP come file normale se l'estrazione fallisce
        processedFiles.push(file);
      }
    } else {
      // ✅ FILTRO AGGIUNTO per file normali:
      // Escludi file che iniziano con '.' e includi solo estensioni consentite
      if (!file.originalname.startsWith('.') && allowedExtensions.includes(fileExtension)) {
        processedFiles.push(file);
      }
    }
  }

  return processedFiles;
};

/**
 * Ottiene il MIME type basato sull'estensione
 * @param {string} extension - Estensione del file
 * @returns {string} - MIME type
 */
const getMimeType = (extension) => {
  const mimeTypes = {
    '.xml': 'application/xml',
    '.p7m': 'application/pkcs7-mime',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip'
  };
  return mimeTypes[extension] || 'application/octet-stream';
};

/**
 * Salva i file nel file system temporaneo
 * @param {Array} files - File da salvare
 * @param {string} tenantId - ID del tenant
 * @returns {Array} - File con percorsi temporanei
 */
const saveFilesToTempStorage = async (files, tenantId) => {
  const tempDir = `/tmp/invoices/${tenantId}`;
  
  // ✅ AGGIUNTO: Log di inizio
  logger.info('Inizio salvataggio file in storage temporaneo', {
    filesCount: files.length,
    tempDir,
    tenantId
  });
  
  // Crea la directory se non esiste
  await fs.promises.mkdir(tempDir, { recursive: true });
  
  const savedFiles = [];
  
  for (const file of files) {
    const fileName = `${uuidv4()}_${file.originalname}`;
    const filePath = path.join(tempDir, fileName);
    
    // Salva il file
    await fs.promises.writeFile(filePath, file.buffer);
    
    // Aggiungi il percorso al file
    savedFiles.push({
      ...file,
      tempFilePath: filePath,
      tempFileName: fileName
    });
    
    // ✅ CAMBIATO: da debug a info
    logger.info('File salvato in storage temporaneo', {
      originalName: file.originalname,
      tempPath: filePath,
      tenantId
    });
  }
  
  // ✅ AGGIUNTO: Log di completamento
  logger.info('Completato salvataggio file in storage temporaneo', {
    savedFilesCount: savedFiles.length,
    tempDir,
    tenantId
  });
  
  return savedFiles;
};

export default {
  uploadFilesOnly
};