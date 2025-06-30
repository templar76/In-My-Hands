import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const PriceHistorySchema = new Schema({
  price: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  quantity: { type: Number, default: 1 },
  unitOfMeasure: String,
  
  // Collegamento al documento di acquisto
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceNumber: { type: String, required: true },
  invoiceDate: { type: Date, required: true },
  invoiceLineNumber: { type: Number },
  
  // Metadati aggiuntivi
  purchaseDate: { type: Date, default: Date.now },
  notes: String,
  
  createdAt: { type: Date, default: Date.now }
});

const PriceBySupplierSchema = new Schema({
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierVat: { type: String, required: true },
  supplierName: String,
  
  // Storico prezzi invece di prezzo singolo
  priceHistory: [PriceHistorySchema],
  
  // Campi calcolati per performance
  currentPrice: { type: Number }, // Ultimo prezzo
  averagePrice: { type: Number }, // Prezzo medio
  bestPrice: { type: Number }, // Miglior prezzo
  lastUpdated: { type: Date, default: Date.now }
});

// Normalize a raw description: lowercase, strip punctuation, collapse spaces
const normalizeDescription = desc =>
  desc
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const ProductSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  codeInternal: { type: String, unique: true, index: true, required: true },
  description: { type: String, required: true },
  descriptionStd: { type: String, required: true, trim: true },
  // Array di tutte le descrizioni alternative per migliorare il matching
  descriptions: [{
    text: { type: String, required: true },
    normalized: { type: String, required: true },
    source: { type: String, enum: ['original', 'invoice', 'manual', 'supplier'], default: 'original' },
    frequency: { type: Number, default: 1 },
    lastSeen: { type: Date, default: Date.now },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    confidence: { type: Number, min: 0, max: 1, default: 1.0 }
  }],
  category: String,
  unitOfMeasure: String, // Sostituito 'unit' con 'unitOfMeasure'
  metadata: {
    ean: String,
    otherCodes: [String],
    attributes: Schema.Types.Mixed
  },
  prices: [PriceBySupplierSchema],
  ignoredDuplicate: { type: Boolean, default: false, index: true },
  
  // Campi di approvazione
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  approvalNotes: {
    type: String
  },
}, {
  timestamps: true
});

// Metodi per calcoli sui prezzi
ProductSchema.methods.getAveragePrice = function() {
  const allPrices = [];
  this.prices.forEach(supplier => {
    supplier.priceHistory.forEach(price => {
      allPrices.push(price.price);
    });
  });
  return allPrices.length > 0 ? allPrices.reduce((a, b) => a + b) / allPrices.length : 0;
};

ProductSchema.methods.getBestPrice = function() {
  let bestPrice = null;
  let bestSupplier = null;
  let bestInvoice = null;
  
  this.prices.forEach(supplier => {
    supplier.priceHistory.forEach(price => {
      if (!bestPrice || price.price < bestPrice.price) {
        bestPrice = price;
        bestSupplier = {
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          supplierVat: supplier.supplierVat
        };
        bestInvoice = {
          invoiceId: price.invoiceId,
          invoiceNumber: price.invoiceNumber,
          invoiceDate: price.invoiceDate,
          invoiceLineNumber: price.invoiceLineNumber
        };
      }
    });
  });
  
  return { price: bestPrice, supplier: bestSupplier, invoice: bestInvoice };
};

ProductSchema.methods.getCurrentPrice = function(supplierId) {
  const supplier = this.prices.find(p => p.supplierId.toString() === supplierId.toString());
  if (!supplier || supplier.priceHistory.length === 0) return null;
  
  // Ritorna il prezzo più recente
  return supplier.priceHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
};

ProductSchema.methods.addPriceEntry = function(supplierData, priceData, invoiceData) {
  let supplier = this.prices.find(p => p.supplierVat === supplierData.supplierVat);
  
  if (!supplier) {
    // Nuovo supplier
    const newSupplier = {
      supplierId: supplierData.supplierId,
      supplierVat: supplierData.supplierVat,
      supplierName: supplierData.supplierName,
      priceHistory: [],
      lastUpdated: new Date()
    };
    this.prices.push(newSupplier);
    // Ottieni il riferimento all'oggetto effettivamente nell'array
    supplier = this.prices[this.prices.length - 1];
  }
  
  // Aggiungi nuovo prezzo allo storico
  const newPriceEntry = {
    price: priceData.price,
    currency: priceData.currency || 'EUR',
    quantity: priceData.quantity || 1,
    unitOfMeasure: priceData.unitOfMeasure,
    invoiceId: invoiceData.invoiceId,
    invoiceNumber: invoiceData.invoiceNumber,
    invoiceDate: invoiceData.invoiceDate,
    invoiceLineNumber: invoiceData.invoiceLineNumber,
    purchaseDate: invoiceData.purchaseDate || new Date(),
    notes: priceData.notes
  };
  
  supplier.priceHistory.push(newPriceEntry);
  supplier.lastUpdated = new Date();
  
  // Marca il documento come modificato per Mongoose
  this.markModified('prices');
  
  // Aggiorna campi calcolati
  this.updateCalculatedFields();
  
  return this;
};

ProductSchema.methods.updateCalculatedFields = function() {
  this.prices.forEach(supplier => {
    if (supplier.priceHistory.length > 0) {
      // Current price (più recente)
      const sortedPrices = supplier.priceHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      supplier.currentPrice = sortedPrices[0].price;
      
      // Average price
      const avgPrice = supplier.priceHistory.reduce((sum, p) => sum + p.price, 0) / supplier.priceHistory.length;
      supplier.averagePrice = Math.round(avgPrice * 100) / 100;
      
      // Best price (minimo)
      supplier.bestPrice = Math.min(...supplier.priceHistory.map(p => p.price));
    }
  });
};

// Automatically populate descriptionStd before saving
ProductSchema.pre('save', function(next) {
  if (this.isModified('description')) {
    this.descriptionStd = normalizeDescription(this.description);
  }
  
  // Aggiorna campi calcolati se i prezzi sono stati modificati
  if (this.isModified('prices')) {
    this.updateCalculatedFields();
  }
  
  next();
});

// Full-text search index on normalized description
ProductSchema.index({ descriptionStd: 'text' });

export default model('Product', ProductSchema);