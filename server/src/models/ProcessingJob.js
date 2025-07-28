import mongoose from 'mongoose';
const { Schema } = mongoose;

const ProcessingJobSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: String, required: true, unique: true },
  
  // Informazioni generali del job
  totalFiles: { type: Number, required: true },
  processedFiles: { type: Number, default: 0 },
  successfulFiles: { type: Number, default: 0 },
  failedFiles: { type: Number, default: 0 },
  
  // Stato generale
  status: {
    type: String,
    enum: ['uploaded', 'pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'uploaded' // Nuovo stato iniziale
  },
  
  // Dettagli per singolo file
  // Nel fileSchema, aggiungi:
  files: [{
    filename: { type: String, required: true },
    originalSize: { type: Number, required: true },
    fileType: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'skipped', 'uploaded'],
      default: 'uploaded'
    },
    tempFilePath: { type: String }, // ✅ AGGIUNTO: Percorso file temporaneo
    tempFileName: { type: String }, // ✅ AGGIUNTO: Nome file temporaneo
    
    // Progresso specifico
    progress: {
      stage: {
        type: String,
        enum: ['upload', 'validation', 'extraction', 'parsing', 'saving', 'completed'],
        default: 'upload'
      },
      percentage: { type: Number, default: 0, min: 0, max: 100 },
      message: { type: String }
    },
    
    // Risultati
    result: {
      invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
      extractedFiles: [{ // Per file ZIP
        filename: String,
        status: String,
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' }
      }]
    },
    
    // Errori
    error: {
      code: String,
      message: String,
      details: Schema.Types.Mixed,
      timestamp: { type: Date, default: Date.now }
    },
    
    // NUOVO: Errori di validazione
    validationErrors: [{
      type: { type: String, required: true }, // es: 'vatNumber_mismatch'
      message: { type: String, required: true },
      severity: { type: String, enum: ['warning', 'error'], default: 'error' },
      timestamp: { type: Date, default: Date.now }
    }],
    
    // Timing
    startedAt: Date,
    completedAt: Date,
    processingTime: Number // millisecondi
  }],
  
  // Timing generale
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  totalProcessingTime: Number,
  
  // Metadati
  metadata: {
    uploadMethod: String, // single, multiple, zip
    clientInfo: String,
    ipAddress: String
  }
});

// Indici per performance
ProcessingJobSchema.index({ tenantId: 1, createdAt: -1 });
// ProcessingJobSchema.index({ jobId: 1 }); // Rimuovi questa riga
ProcessingJobSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ProcessingJob', ProcessingJobSchema);