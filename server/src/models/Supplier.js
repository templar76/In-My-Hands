import mongoose from 'mongoose';
const { Schema } = mongoose;

const SupplierSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: { type: String, required: true },
  vatNumber: { type: String, required: true }, // Campo corretto per la partita IVA
  codiceFiscale: { type: String },
  pec: { type: String },
  sdiCode: { type: String },
  address: { type: String },
  // Dati REA estesi
  iscrizioneREA: {
    ufficio: { type: String },
    numeroREA: { type: String },
    capitaleSociale: { type: Number },
    socioUnico: { type: String },
    statoLiquidazione: { type: String }
  },
  // Contatti dettagliati
  contatti: {
    telefono: { type: String },
    fax: { type: String },
    email: { type: String }
  },
  // Campi aggiuntivi per gestione completa del fornitore
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  notes: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indice composto per performance e unicità
// SupplierSchema.index({ tenantId: 1, pIva: 1 }); // ❌ RIMUOVERE questa riga duplicata
SupplierSchema.index({ tenantId: 1, codiceFiscale: 1 });
SupplierSchema.index({ tenantId: 1, name: 1 });

// ✅ INDICE UNICO per vatNumber PER TENANT
SupplierSchema.index({ tenantId: 1, vatNumber: 1 }, { unique: true });

export default mongoose.model('Supplier', SupplierSchema);