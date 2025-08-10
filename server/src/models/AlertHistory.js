import mongoose from 'mongoose';

const AlertHistorySchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    required: true,
    index: true
  },
  userId: {
    type: String, // Firebase UID
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  supplierName: {
    type: String,
    required: true
  },
  alertType: {
    type: String,
    enum: ['price_threshold', 'price_variation', 'stock'],
    required: true
  },
  triggerReason: {
    type: String,
    required: true
  },
  priceData: {
    currentPrice: {
      type: Number,
      required: true
    },
    previousPrice: {
      type: Number,
      required: false
    },
    thresholdPrice: {
      type: Number,
      required: false
    },
    variationPercentage: {
      type: Number,
      required: false
    },
    averagePrice: {
      type: Number,
      required: false
    }
  },
  notificationData: {
    method: {
      type: String,
      enum: ['email', 'pec', 'both'],
      required: true
    },
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date,
      required: false
    },
    error: {
      type: String,
      required: false
    },
    retryCount: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    checkFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      required: true
    },
    responseTime: {
      type: Number, // millisecondi
      required: false
    },
    dataSource: {
      type: String,
      default: 'automatic'
    },
    userAgent: {
      type: String,
      required: false
    }
  },
  status: {
    type: String,
    enum: ['triggered', 'sent', 'failed', 'acknowledged'],
    default: 'triggered'
  },
  acknowledgedAt: {
    type: Date,
    required: false
  },
  acknowledgedBy: {
    type: String, // Firebase UID
    required: false
  }
}, {
  timestamps: true,
  collection: 'alert_history'
});

// Indici composti per performance
AlertHistorySchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
AlertHistorySchema.index({ alertId: 1, createdAt: -1 });
AlertHistorySchema.index({ productId: 1, alertType: 1, createdAt: -1 });
AlertHistorySchema.index({ tenantId: 1, status: 1, createdAt: -1 });
AlertHistorySchema.index({ 'notificationData.method': 1, 'notificationData.sent': 1 });

// Metodi del modello
AlertHistorySchema.statics.getAlertAnalytics = async function(tenantId, userId, options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 giorni fa
    endDate = new Date(),
    alertType,
    productId,
    supplierId
  } = options;

  const matchStage = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    userId,
    createdAt: { $gte: startDate, $lte: endDate }
  };

  if (alertType) matchStage.alertType = alertType;
  if (productId) matchStage.productId = new mongoose.Types.ObjectId(productId);
  if (supplierId) matchStage.supplierId = new mongoose.Types.ObjectId(supplierId);

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          alertType: "$alertType"
        },
        count: { $sum: 1 },
        avgPrice: { $avg: "$priceData.currentPrice" },
        minPrice: { $min: "$priceData.currentPrice" },
        maxPrice: { $max: "$priceData.currentPrice" },
        successfulNotifications: {
          $sum: { $cond: ["$notificationData.sent", 1, 0] }
        },
        avgResponseTime: { $avg: "$metadata.responseTime" }
      }
    },
    { $sort: { "_id.date": 1 } }
  ];

  return await this.aggregate(pipeline);
};

AlertHistorySchema.statics.getTopTriggeredProducts = async function(tenantId, userId, limit = 10) {
  const pipeline = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: "$productId",
        triggerCount: { $sum: 1 },
        lastTriggered: { $max: "$createdAt" },
        avgPrice: { $avg: "$priceData.currentPrice" },
        alertTypes: { $addToSet: "$alertType" }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    { $sort: { triggerCount: -1 } },
    { $limit: limit }
  ];

  return await this.aggregate(pipeline);
};

AlertHistorySchema.statics.getNotificationStats = async function(tenantId, userId, period = 30) {
  const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
  
  const pipeline = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: "$notificationData.method",
        total: { $sum: 1 },
        successful: { $sum: { $cond: ["$notificationData.sent", 1, 0] } },
        failed: { $sum: { $cond: ["$notificationData.sent", 0, 1] } },
        avgRetries: { $avg: "$notificationData.retryCount" }
      }
    },
    {
      $addFields: {
        successRate: {
          $multiply: [
            { $divide: ["$successful", "$total"] },
            100
          ]
        }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Metodi di istanza
AlertHistorySchema.methods.markAsSent = function(sentAt = new Date()) {
  this.notificationData.sent = true;
  this.notificationData.sentAt = sentAt;
  this.status = 'sent';
  return this.save();
};

AlertHistorySchema.methods.markAsFailed = function(error) {
  this.notificationData.sent = false;
  this.notificationData.error = error;
  this.notificationData.retryCount += 1;
  this.status = 'failed';
  return this.save();
};

AlertHistorySchema.methods.acknowledge = function(userId) {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = userId;
  return this.save();
};

// Middleware pre-save per validazioni
AlertHistorySchema.pre('save', function(next) {
  // Calcola la variazione percentuale se non presente
  if (this.priceData.currentPrice && this.priceData.previousPrice && !this.priceData.variationPercentage) {
    this.priceData.variationPercentage = 
      ((this.priceData.currentPrice - this.priceData.previousPrice) / this.priceData.previousPrice) * 100;
  }
  
  next();
});

// TTL per pulizia automatica dopo 1 anno
AlertHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const AlertHistory = mongoose.model('AlertHistory', AlertHistorySchema);

export default AlertHistory;