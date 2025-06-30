import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema({
  // Identificazione
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true,
    index: true 
  },
  
  // Configurazione Alert
  type: {
    type: String,
    enum: ['price_threshold', 'price_variation', 'stock'],
    required: true
  },
  
  // Per alert di soglia prezzo (verifica accordi fornitori)
  thresholdPrice: {
    type: Number,
    required: function() {
      return this.type === 'price_threshold';
    }
  },
  
  // Per alert di variazione prezzo (% dal prezzo medio)
  variationThreshold: {
    type: Number, // Percentuale (es. 10 = 10%)
    default: 15, // Default 15% di variazione
    required: function() {
      return this.type === 'price_variation';
    }
  },
  
  // Configurazione generale
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Frequenza controllo
  checkFrequency: {
    type: String,
    enum: ['immediate', 'daily', 'weekly'],
    default: 'daily'
  },
  
  // Metodo notifica
  notificationMethod: {
    type: String,
    enum: ['email', 'pec', 'both'],
    default: 'email'
  },
  
  // Storico attivazioni
  lastTriggered: Date,
  triggerCount: { type: Number, default: 0 },
  
  // Metadati
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indici composti per performance
AlertSchema.index({ tenantId: 1, userId: 1 });
AlertSchema.index({ tenantId: 1, productId: 1 });
AlertSchema.index({ tenantId: 1, isActive: 1, type: 1 });

// Virtual per popolare i dati del prodotto
AlertSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true
});

// Virtual per popolare i dati dell'utente
AlertSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Metodo per calcolare il prezzo medio del prodotto
AlertSchema.methods.calculateAveragePrice = async function() {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.productId);
  
  if (!product || !product.pricesBySupplier.length) {
    return null;
  }
  
  let totalPrices = 0;
  let priceCount = 0;
  
  product.pricesBySupplier.forEach(supplier => {
    if (supplier.priceHistory && supplier.priceHistory.length > 0) {
      // Prende l'ultimo prezzo di ogni fornitore
      const lastPrice = supplier.priceHistory[supplier.priceHistory.length - 1];
      totalPrices += lastPrice.price;
      priceCount++;
    }
  });
  
  return priceCount > 0 ? totalPrices / priceCount : null;
};

// Metodo per verificare se l'alert deve scattare
AlertSchema.methods.shouldTrigger = async function(currentPrice, supplierId) {
  if (!this.isActive) return false;
  
  switch (this.type) {
    case 'price_threshold':
      // Alert scatta se il prezzo è SUPERIORE alla soglia (non rispetta accordo)
      return currentPrice > this.thresholdPrice;
      
    case 'price_variation':
      const avgPrice = await this.calculateAveragePrice();
      if (!avgPrice) return false;
      
      // Calcola la variazione percentuale
      const variation = Math.abs((currentPrice - avgPrice) / avgPrice) * 100;
      return variation > this.variationThreshold;
      
    default:
      return false;
  }
};

// Metodo per registrare l'attivazione dell'alert
AlertSchema.methods.recordTrigger = async function() {
  this.lastTriggered = new Date();
  this.triggerCount += 1;
  return this.save();
};

export default mongoose.model('Alert', AlertSchema);