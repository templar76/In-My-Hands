import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  plan:        { type: String, enum: ['free','monthly','annual'], default: 'free' },
  status:      { type: String, enum: ['active','past_due','canceled'], default: 'active' },
  startDate:   { type: Date, default: Date.now },
  trialEndsAt: { type: Date },
  renewalAt:   { type: Date }
}, { timestamps: true });

export default mongoose.model('Subscription', subscriptionSchema);