import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  companyType: { type: String, required: true },
  companyName: { type: String, required: true, unique: true },
  country: { type: String, required: true, default: 'IT' }, // Aggiungiamo il campo country
  vatNumber: { type: String, required: true, unique: true },
  codiceFiscale: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  plan: { type: String, enum: ['free', 'monthly', 'annual'], default: 'free' },
  contacts: {
    email: { type: String, required: true },
    phone: { type: String, required: true },
    sdiCode: { type: String, required: true },
    pec: { type: String, required: true }
  },
  // Configurazione Product Matching - Tre Fasi
  productMatchingConfig: {
    phase1: {
      enabled: { type: Boolean, default: false },
      confidenceThreshold: { type: Number, default: 0.7, min: 0.5, max: 1.0 },
      autoApproveAbove: { type: Number, default: 0.9, min: 0.7, max: 1.0 },
      requireManualReview: { type: Boolean, default: true }
    },
    phase2: {
      enabled: { type: Boolean, default: false },
      handleUnmatched: { type: Boolean, default: true },
      createNewProducts: { type: Boolean, default: true },
      requireApprovalForNew: { type: Boolean, default: true }
    },
    phase3: {
      enabled: { type: Boolean, default: false },
      analyticsLevel: { type: String, enum: ['basic', 'advanced'], default: 'basic' },
      mlOptimization: { type: Boolean, default: false },
      continuousLearning: { type: Boolean, default: false },
      performanceTracking: { type: Boolean, default: true }
    },
    globalSettings: {
      maxPendingReviews: { type: Number, default: 100, min: 10, max: 1000 },
      notificationThresholds: {
        pendingReviews: { type: Number, default: 50, min: 5, max: 500 },
        lowConfidenceMatches: { type: Number, default: 20, min: 5, max: 100 },
        unmatchedProducts: { type: Number, default: 30, min: 5, max: 200 }
      },
      autoCleanupDays: { type: Number, default: 30, min: 7, max: 365 }
    }
  },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model('Tenant', tenantSchema);