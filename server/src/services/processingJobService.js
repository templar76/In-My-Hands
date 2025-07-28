import ProcessingJob from '../models/ProcessingJob.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class ProcessingJobService {
  
  // Crea un nuovo job di elaborazione
  static async createJob(tenantId, userId, files, metadata = {}) {
    const jobId = uuidv4();
    
    const job = new ProcessingJob({
      tenantId,
      userId,
      jobId,
      totalFiles: files.length,
      files: files.map(file => ({
        filename: file.originalname || file.filename,
        originalSize: file.size || file.buffer?.length,
        fileType: this.detectFileType(file.originalname || file.filename),
        status: 'pending',
        // ✅ AGGIUNTO: Salva i percorsi temporanei
        tempFilePath: file.tempFilePath || null,
        tempFileName: file.tempFileName || null,
        progress: {
          stage: 'upload',
          percentage: 0,
          message: 'File caricato, in attesa di elaborazione'
        }
      })),
      metadata
    });
    
    await job.save();
    logger.info('Job di elaborazione creato', { jobId, tenantId, totalFiles: files.length });
    
    return job;
  }
  
  // Aggiorna lo stato di un file specifico
  static async updateFileProgress(jobId, filename, updates) {
    const updateData = {};
    
    if (updates.status) updateData['files.$.status'] = updates.status;
    if (updates.stage) updateData['files.$.progress.stage'] = updates.stage;
    if (updates.percentage !== undefined) updateData['files.$.progress.percentage'] = updates.percentage;
    if (updates.message) updateData['files.$.progress.message'] = updates.message;
    if (updates.error) updateData['files.$.error'] = updates.error;
    if (updates.result) updateData['files.$.result'] = updates.result;
    if (updates.startedAt) updateData['files.$.startedAt'] = updates.startedAt;
    if (updates.completedAt) {
      updateData['files.$.completedAt'] = updates.completedAt;
      if (updates.startedAt) {
        updateData['files.$.processingTime'] = updates.completedAt - updates.startedAt;
      }
    }
    
    const result = await ProcessingJob.updateOne(
      { jobId, 'files.filename': filename },
      { $set: updateData }
    );
    
    // Aggiorna contatori generali
    await this.updateJobCounters(jobId);
    
    return result;
  }
  
  // Aggiorna i contatori generali del job
  static async updateJobCounters(jobId) {
    const job = await ProcessingJob.findOne({ jobId });
    if (!job) return;
    
    const processedFiles = job.files.filter(f => 
      ['completed', 'failed', 'skipped'].includes(f.status)
    ).length;
    
    const successfulFiles = job.files.filter(f => f.status === 'completed').length;
    const failedFiles = job.files.filter(f => f.status === 'failed').length;
    
    let status = job.status;
    if (processedFiles === job.totalFiles) {
      status = failedFiles === job.totalFiles ? 'failed' : 'completed';
    } else if (processedFiles > 0) {
      status = 'processing';
    }
    
    await ProcessingJob.updateOne(
      { jobId },
      {
        $set: {
          processedFiles,
          successfulFiles,
          failedFiles,
          status,
          ...(status === 'completed' && { completedAt: new Date() })
        }
      }
    );
  }
  
  // Ottieni lo stato di un job
  static async getJobStatus(jobId) {
    return await ProcessingJob.findOne({ jobId });
  }
  
  // Ottieni tutti i job di un tenant
  static async getTenantJobs(tenantId, options = {}) {
    const {
      page = 0,
      limit = 20,
      status,
      sortBy = 'createdAt',
      sortOrder = -1
    } = options;
    
    const query = { tenantId };
    if (status) query.status = status;
    
    const jobs = await ProcessingJob.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(page * limit)
      .limit(limit)
      .lean();
    
    const total = await ProcessingJob.countDocuments(query);
    
    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  // Rileva il tipo di file
  static detectFileType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const typeMap = {
      'xml': 'xml',
      'p7m': 'p7m',
      'pdf': 'pdf',
      'zip': 'zip'
    };
    return typeMap[ext] || 'unknown';
  }
  
  // Pulisci job vecchi (da eseguire periodicamente)
  static async cleanupOldJobs(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await ProcessingJob.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['completed', 'failed', 'cancelled'] }
    });
    
    logger.info('Cleanup job completato', { deletedJobs: result.deletedCount });
    return result;
  }
  
  static async completeJob(jobId) {
      await this.updateJobCounters(jobId);
      await ProcessingJob.updateOne(
          { jobId },
          { $set: { completedAt: new Date() } }
      );
      logger.info('Job completato', { jobId });
  }
  
  static async failJob(jobId, errorMessage) {
      await ProcessingJob.updateOne(
          { jobId },
          {
              $set: {
                  status: 'failed',
                  error: errorMessage,
                  completedAt: new Date()
              }
          }
      );
      logger.error('Job fallito', { jobId, error: errorMessage });
  }
  
  // Aggiungi questi metodi alla classe ProcessingJobService
  
  // Cancella un job
  static async cancelJob(jobId, tenantId) {
    const result = await ProcessingJob.updateOne(
      { jobId, tenantId, status: { $in: ['pending', 'processing'] } },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('Job non trovato o non cancellabile');
    }
    
    logger.info('Job cancellato', { jobId, tenantId });
    return result;
  }
  
  // Riavvia un job fallito
  static async restartJob(jobId, tenantId) {
    const job = await ProcessingJob.findOne({ jobId, tenantId });
    
    if (!job) {
      throw new Error('Job non trovato');
    }
    
    if (!['failed', 'cancelled'].includes(job.status)) {
      throw new Error('Solo i job falliti o cancellati possono essere riavviati');
    }
    
    // Reset dello stato del job
    const result = await ProcessingJob.updateOne(
      { jobId, tenantId },
      {
        $set: {
          status: 'pending',
          processedFiles: 0,
          successfulFiles: 0,
          failedFiles: 0,
          completedAt: null,
          error: null,
          'files.$[].status': 'pending',
          'files.$[].progress.percentage': 0,
          'files.$[].progress.message': 'In attesa di rielaborazione',
          'files.$[].error': null,
          'files.$[].result': null
        }
      }
    );
    
    logger.info('Job riavviato', { jobId, tenantId });
    return result;
  }
  
  // Elimina definitivamente un job
  static async deleteJob(jobId, tenantId) {
    const result = await ProcessingJob.deleteOne({ jobId, tenantId });
    
    if (result.deletedCount === 0) {
      throw new Error('Job non trovato');
    }
    
    logger.info('Job eliminato', { jobId, tenantId });
    return result;
  }
  
  // Aggiungi questo metodo alla classe ProcessingJobService
  static async cleanupTempFiles(jobId) {
    try {
      const job = await ProcessingJob.findOne({ jobId });
      if (!job) return;
      
      for (const file of job.files) {
        if (file.tempFilePath) {
          try {
            await fs.promises.unlink(file.tempFilePath);
            logger.debug('File temporaneo eliminato', {
              filename: file.filename,
              tempPath: file.tempFilePath
            });
          } catch (error) {
            logger.warn('Errore eliminazione file temporaneo', {
              filename: file.filename,
              tempPath: file.tempFilePath,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      logger.error('Errore cleanup file temporanei', {
        jobId,
        error: error.message
      });
    }
  }
}

export default ProcessingJobService;