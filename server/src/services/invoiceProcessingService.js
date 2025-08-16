import ProcessingJobService from './processingJobService.js';
import { processSingleFile } from './invoiceUploadService.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import ProcessingJob from '../models/ProcessingJob.js';
import fs from 'fs'; // ✅ AGGIUNTO

/**
 * Avvia il processamento asincrono di multipli file
 * @param {Array} files - Array di file da processare
 * @param {string} tenantId - ID del tenant
 * @param {Object} clientData - Dati del client
 * @returns {Promise<string>} - ID del job di processamento
 */
export const startAsyncProcessing = async (files, tenantId, uid) => {
  try {
    logger.info('Avvio processamento asincrono', {
      filesCount: files.length,
      tenantId
    });

    const user = await User.findOne({ uid });
    if (!user) {
      throw new Error('User not found');
    }
    const userId = user._id;

    // Crea un nuovo job di processamento
    const job = await ProcessingJobService.createJob(
      tenantId,
      userId,
      files,
      {
        startedAt: new Date()
      }
    );
    const jobId = job.jobId;

    // Avvia il processamento in background
    processFilesAsync(jobId, files, tenantId, uid)
      .catch(error => {
        logger.error('Errore nel processamento asincrono', {
          error: error.message,
          jobId,
          tenantId
        });
      });

    logger.info('Job di processamento creato', {
      jobId,
      filesCount: files.length,
      tenantId
    });

    return jobId;
  } catch (error) {
    logger.error('Errore avvio processamento asincrono', {
      error: error.message,
      stack: error.stack,
      filesCount: files?.length,
      tenantId
    });
    throw error;
  }
};

/**
 * Processa i file in modo asincrono
 * @param {string} jobId - ID del job
 * @param {Array} files - File da processare
 * @param {string} tenantId - ID del tenant
 * @param {Object} clientData - Dati del client
 */
const processFilesAsync = async (jobId, files, tenantId, clientData) => {
    try {
        logger.info('Inizio processamento file asincrono', {
            jobId,
            filesCount: files.length,
            tenantId
        });

        // Limita il numero di file elaborati contemporaneamente
        const BATCH_SIZE = 3; // Elabora 3 file alla volta
        
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            
            // Elabora i file in batch in parallelo
            await Promise.all(batch.map(async (file) => {
                try {
                    logger.debug('Processamento file', {
                        jobId,
                        fileName: file.originalname,
                        tenantId
                    });
                    
                    // Aggiorna lo stato a processing
                    await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                        status: 'processing',
                        stage: 'validation',
                        percentage: 10,
                        message: 'Validazione file in corso'
                    });
                    
                    // Resto del codice di elaborazione
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                        status: 'processing',
                        stage: 'extraction',
                        percentage: 30,
                        message: 'Estrazione dati in corso'
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                        status: 'processing',
                        stage: 'parsing',
                        percentage: 60,
                        message: 'Analisi contenuto in corso'
                    });
                    
                    const result = await processSingleFile(file, {
                        tenantId,
                        // ❌ Rimuovere: clientData,
                        saveToStorage: true,
                        importProducts: true
                    });
                    
                    await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                        status: 'processing',
                        stage: 'saving',
                        percentage: 90,
                        message: 'Salvataggio dati in corso'
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    if (result.success) {
                        await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                            status: 'completed',
                            stage: 'completed',
                            percentage: 100,
                            message: 'Elaborazione completata con successo',
                            result: {
                                invoiceId: result.invoice?.id,
                                invoiceNumber: result.invoice?.invoiceNumber,
                                totalAmount: result.invoice?.totalAmount
                            }
                        });
                        
                        logger.debug('File processato con successo', {
                            jobId,
                            fileName: file.originalname,
                            invoiceId: result.invoice?.id,
                            tenantId
                        });
                    } else {
                        await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                            status: 'failed',
                            stage: 'completed',
                            percentage: 100,
                            message: 'Elaborazione fallita',
                            error: result.error || 'Errore sconosciuto'
                        });
                        
                        logger.warn('Errore processamento file', {
                            jobId,
                            fileName: file.originalname,
                            error: result.error,
                            tenantId
                        });
                    }
                } catch (fileError) {
                    await ProcessingJobService.updateFileProgress(jobId, file.originalname, {
                        status: 'failed',
                        stage: 'completed',
                        percentage: 100,
                        message: 'Errore durante l\'elaborazione',
                        error: fileError.message
                    });
                    
                    logger.error('Errore processamento file', {
                        error: fileError.message,
                        jobId,
                        fileName: file.originalname,
                        tenantId
                    });
                }
            }));
            
            // Forza la garbage collection dopo ogni batch
            if (global.gc) {
                global.gc();
            }
        }

        await ProcessingJobService.completeJob(jobId);
        
        logger.info('Processamento asincrono completato', {
            jobId,
            filesCount: files.length,
            tenantId
        });
    } catch (error) {
        await ProcessingJobService.failJob(jobId, error.message);
        
        logger.error('Errore processamento asincrono', {
            error: error.message,
            stack: error.stack,
            jobId,
            tenantId
        });
    }
};

/**
 * Ottieni lo stato di un job di processamento
 * @param {string} jobId - ID del job
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Stato del job
 */
export const getProcessingStatus = async (jobId, tenantId) => {
  try {
    const status = await ProcessingJobService.getJobStatus(jobId, tenantId);
    
    if (!status) {
      throw new Error(`Job con ID ${jobId} non trovato`);
    }

    logger.debug('Stato processamento recuperato', {
      jobId,
      status: status.status,
      progress: status.progress,
      tenantId
    });

    return status;
  } catch (error) {
    logger.error('Errore recupero stato processamento', {
      error: error.message,
      jobId,
      tenantId
    });
    throw error;
  }
};

/**
 * Ottieni tutti i job di processamento di un tenant
 * @param {string} tenantId - ID del tenant
 * @param {Object} options - Opzioni di filtro
 * @returns {Promise<Array>} - Lista dei job
 */
export const getProcessingJobs = async (tenantId, options = {}) => {
  try {
    const {
      limit = 20,
      status = null,
      dateFrom = null,
      dateTo = null
    } = options;

    // ✅ CORREZIONE: Usa getTenantJobs invece di getJobsByTenant
    const result = await ProcessingJobService.getTenantJobs(tenantId, {
      limit,
      status,
      dateFrom,
      dateTo
    });

    logger.debug('Job di processamento recuperati', {
      tenantId,
      jobsCount: result.jobs?.length || 0,
      total: result.total,
      options
    });

    // ✅ CORREZIONE: Restituisci la struttura corretta
    return {
      success: true,
      jobs: result.jobs || [],
      pagination: {
        total: result.total || 0,
        limit,
        hasMore: result.total > limit
      }
    };
  } catch (error) {
    logger.error('Errore recupero job processamento', {
      error: error.message,
      tenantId,
      options
    });
    throw error;
  }
};

/**
 * Cancella un job di processamento
 * @param {string} jobId - ID del job
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<boolean>} - Successo dell'operazione
 */
export const cancelProcessingJob = async (jobId, tenantId) => {
  try {
    const result = await ProcessingJobService.cancelJob(jobId, tenantId);
    
    logger.info('Job di processamento cancellato', {
      jobId,
      tenantId
    });

    return result;
  } catch (error) {
    logger.error('Errore cancellazione job', {
      error: error.message,
      jobId,
      tenantId
    });
    throw error;
  }
};

/**
 * Pulisce i job vecchi
 * @param {number} daysOld - Giorni di anzianità
 * @returns {Promise<number>} - Numero di job eliminati
 */
export const cleanupOldJobs = async (daysOld = 7) => {
  try {
    const deletedCount = await ProcessingJobService.cleanupOldJobs(daysOld);
    
    logger.info('Pulizia job vecchi completata', {
      daysOld,
      deletedCount
    });

    return deletedCount;
  } catch (error) {
    logger.error('Errore pulizia job vecchi', {
      error: error.message,
      daysOld
    });
    throw error;
  }
};

// Aggiungi questi metodi dopo cancelProcessingJob

/**
 * Riavvia un job di processamento
 */
export const restartProcessingJob = async (jobId, tenantId) => {
  try {
    const result = await ProcessingJobService.restartJob(jobId, tenantId);
    
    // Riavvia il processamento asincrono
    const job = await ProcessingJobService.getJobStatus(jobId);
    if (job && job.files) {
      // Simula i file originali per il riprocessamento
      const files = job.files.map(f => ({
        originalname: f.filename,
        size: f.originalSize,
        buffer: null // Il file dovrà essere ricaricato
      }));
      
      // Avvia nuovo processamento
      processFilesAsync(jobId, files, tenantId, {});
    }
    
    logger.info('Job riavviato', { jobId, tenantId });
    return result;
  } catch (error) {
    logger.error('Errore riavvio job', {
      error: error.message,
      jobId,
      tenantId
    });
    throw error;
  }
};

/**
 * Elimina un job di processamento
 */
export const deleteProcessingJob = async (jobId, tenantId) => {
  try {
    const result = await ProcessingJobService.deleteJob(jobId, tenantId);
    
    logger.info('Job eliminato', { jobId, tenantId });
    return result;
  } catch (error) {
    logger.error('Errore eliminazione job', {
      error: error.message,
      jobId,
      tenantId
    });
    throw error;
  }
};

/**
 * Carica i file dal file system temporaneo
 * @param {Array} jobFiles - File dal job
 * @returns {Array} - File con buffer caricati
 */
const loadFilesFromTempStorage = async (jobFiles) => {
  const files = [];
  
  for (const jobFile of jobFiles) {
    if (!jobFile.tempFilePath) {
      throw new Error(`Percorso temporaneo mancante per il file: ${jobFile.filename}`);
    }
    
    try {
      // Verifica che il file esista
      await fs.promises.access(jobFile.tempFilePath);
      
      // Leggi il file
      const buffer = await fs.promises.readFile(jobFile.tempFilePath);
      
      files.push({
        originalname: jobFile.filename,
        buffer: buffer,
        mimetype: jobFile.fileType,
        size: jobFile.originalSize,
        tempFilePath: jobFile.tempFilePath
      });
      
      logger.debug('File caricato da storage temporaneo', {
        filename: jobFile.filename,
        tempPath: jobFile.tempFilePath,
        size: buffer.length
      });
    } catch (error) {
      logger.error('Errore caricamento file da storage temporaneo', {
        filename: jobFile.filename,
        tempPath: jobFile.tempFilePath,
        error: error.message
      });
      throw new Error(`Impossibile caricare il file: ${jobFile.filename}`);
    }
  }
  
  return files;
};

/**
 * Avvia l'elaborazione di un job già caricato
 * @param {string} jobId - ID del job
 * @param {string} tenantId - ID del tenant
 * @param {string} uid - UID dell'utente
 * @returns {Promise<Object>} - Risultato dell'avvio
 */
export const startProcessingFromJob = async (jobId, tenantId, uid) => {
  try {
    logger.info('Avvio elaborazione da job esistente', {
      jobId,
      tenantId
    });

    // Recupera il job
    const job = await ProcessingJobService.getJobStatus(jobId, tenantId);
    if (!job) {
      throw new Error('Job non trovato');
    }

    if (!['uploaded', 'pending', 'failed'].includes(job.status)) {
      throw new Error(`Impossibile avviare l'elaborazione. Stato attuale: ${job.status}`);
    }

    // ✅ NUOVA VALIDAZIONE: Verifica esistenza file temporanei
    const missingFiles = [];
    for (const jobFile of job.files) {
      if (!jobFile.tempFilePath) {
        missingFiles.push(jobFile.filename);
        continue;
      }
      
      try {
        await fs.promises.access(jobFile.tempFilePath);
      } catch (error) {
        logger.warn('File temporaneo non trovato', {
          filename: jobFile.filename,
          tempPath: jobFile.tempFilePath,
          error: error.message
        });
        missingFiles.push(jobFile.filename);
      }
    }

    if (missingFiles.length > 0) {
      // Aggiorna lo stato a 'failed'
      await ProcessingJob.updateOne(
        { jobId },
        { 
          $set: { 
            status: 'failed',
            error: `File temporanei mancanti o scaduti: ${missingFiles.join(', ')}. Ricarica i file.`,
            updatedAt: new Date()
          }
        }
      );
      
      throw new Error(`File temporanei mancanti o scaduti: ${missingFiles.join(', ')}. Ricarica i file per riprovare.`);
    }

    // ✅ CORREZIONE: Carica i file dal file system temporaneo
    const files = await loadFilesFromTempStorage(job.files);

    // Avvia il processamento in background
    processFilesAsync(jobId, files, tenantId, uid)
      .catch(error => {
        logger.error('Errore nel processamento da job', {
          error: error.message,
          jobId,
          tenantId
        });
      });

    logger.info('Elaborazione da job avviata', {
      jobId,
      filesCount: files.length,
      tenantId
    });

    return {
      success: true,
      jobId,
      message: 'Elaborazione avviata con successo',
      status: 'pending'
    };
  } catch (error) {
    // ✅ AGGIUNTO: Aggiorna lo stato a 'failed' in caso di errore
    await ProcessingJob.updateOne(
      { jobId },
      { 
        $set: { 
          status: 'failed',
          error: error.message,
          updatedAt: new Date()
        }
      }
    ).catch(updateError => {
      logger.error('Errore aggiornamento stato job a failed', {
        jobId,
        updateError: updateError.message
      });
    });

    logger.error('Errore avvio elaborazione da job', {
      error: error.message,
      stack: error.stack,
      jobId,
      tenantId
    });
    throw error;
  }
};

// Aggiorna l'export default (SPOSTATO DOPO LA DICHIARAZIONE DELLA FUNZIONE)
export default {
  startAsyncProcessing,
  startProcessingFromJob, // Ora può essere referenziato
  getProcessingStatus,
  getProcessingJobs,
  cancelProcessingJob,
  restartProcessingJob,
  deleteProcessingJob,
  cleanupOldJobs
};