import mongoose from 'mongoose';

const tenantRegistrationTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  plan: {
    type: String,
    required: true,
    default: 'free',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indice TTL per la scadenza automatica dei token
tenantRegistrationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('TenantRegistrationToken', tenantRegistrationTokenSchema);