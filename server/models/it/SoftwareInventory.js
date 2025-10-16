const mongoose = require('mongoose');

const softwareInventorySchema = new mongoose.Schema({
  softwareName: {
    type: String,
    required: [true, 'Software name is required'],
    trim: true,
    maxlength: [100, 'Software name cannot exceed 100 characters']
  },
  version: {
    type: String,
    required: [true, 'Version is required'],
    trim: true
  },
  category: {
    type: String,
    enum: [
      'Operating System', 'Office Suite', 'Design Software', 'Development Tools',
      'Database Software', 'Security Software', 'Antivirus', 'Backup Software',
      'Communication Tools', 'Project Management', 'Accounting Software',
      'ERP Software', 'Other'
    ],
    required: [true, 'Category is required']
  },
  subcategory: {
    type: String,
    trim: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SoftwareVendor',
    required: false
  },
  licenseType: {
    type: String,
    enum: ['Perpetual', 'Subscription', 'Volume', 'Site License', 'Concurrent', 'Open Source'],
    required: [true, 'License type is required']
  },
  purchaseDate: {
    type: Date,
    required: [true, 'Purchase date is required']
  },
  purchasePrice: {
    type: Number,
    required: [true, 'Purchase price is required'],
    min: [0, 'Purchase price cannot be negative']
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  licenseKey: {
    type: String,
    trim: true
  },
  licenseCount: {
    total: {
      type: Number,
      required: [true, 'Total license count is required'],
      min: [1, 'Total license count must be at least 1']
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'Used license count cannot be negative']
    },
    available: {
      type: Number,
      default: function() {
        return this.licenseCount.total - this.licenseCount.used;
      }
    }
  },
  expiryDate: Date,
  renewalDate: Date,
  renewalCost: {
    type: Number,
    min: [0, 'Renewal cost cannot be negative']
  },
  supportContact: {
    name: String,
    email: String,
    phone: String,
    website: String
  },
  installationNotes: String,
  systemRequirements: {
    operatingSystem: [String],
    processor: String,
    memory: String,
    storage: String,
    other: String
  },
  compatibility: [String],
  documents: [{
    type: {
      type: String,
      enum: ['License Agreement', 'Purchase Order', 'Invoice', 'Manual', 'Installation Guide', 'Other']
    },
    name: String,
    fileUrl: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
softwareInventorySchema.index({ softwareName: 1 });
softwareInventorySchema.index({ category: 1 });
softwareInventorySchema.index({ vendor: 1 });
softwareInventorySchema.index({ licenseType: 1 });
softwareInventorySchema.index({ expiryDate: 1 });
softwareInventorySchema.index({ renewalDate: 1 });
softwareInventorySchema.index({ isActive: 1 });

// Virtual for license utilization percentage
softwareInventorySchema.virtual('utilizationPercentage').get(function() {
  if (this.licenseCount.total === 0) return 0;
  return ((this.licenseCount.used / this.licenseCount.total) * 100).toFixed(2);
});

// Virtual for expiry status
softwareInventorySchema.virtual('expiryStatus').get(function() {
  if (!this.expiryDate) return 'No Expiry';
  
  const today = new Date();
  const expiryDate = new Date(this.expiryDate);
  const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'Expired';
  if (daysUntilExpiry <= 30) return 'Expiring Soon';
  if (daysUntilExpiry <= 90) return 'Expiring in 3 Months';
  return 'Active';
});

// Virtual for renewal status
softwareInventorySchema.virtual('renewalStatus').get(function() {
  if (!this.renewalDate) return 'No Renewal';
  
  const today = new Date();
  const renewalDate = new Date(this.renewalDate);
  const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntilRenewal < 0) return 'Overdue';
  if (daysUntilRenewal <= 30) return 'Due Soon';
  if (daysUntilRenewal <= 90) return 'Due in 3 Months';
  return 'Active';
});

// Pre-save middleware
softwareInventorySchema.pre('save', function(next) {
  // Handle invalid vendor ObjectId
  if (this.vendor && !mongoose.Types.ObjectId.isValid(this.vendor)) {
    this.vendor = null;
  }
  
  // Calculate available licenses
  this.licenseCount.available = this.licenseCount.total - this.licenseCount.used;
  
  // Validate license count
  if (this.licenseCount.used > this.licenseCount.total) {
    return next(new Error('Used license count cannot exceed total license count'));
  }
  
  next();
});

// Static methods
softwareInventorySchema.statics.findExpiringSoon = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    expiryDate: { $lte: futureDate, $gte: new Date() },
    isActive: true
  }).populate('vendor');
};

softwareInventorySchema.statics.findExpired = function() {
  return this.find({
    expiryDate: { $lt: new Date() },
    isActive: true
  }).populate('vendor');
};

softwareInventorySchema.statics.findRenewalDue = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    renewalDate: { $lte: futureDate, $gte: new Date() },
    isActive: true
  }).populate('vendor');
};

softwareInventorySchema.statics.getSoftwareStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalSoftware: { $sum: 1 },
        totalLicenses: { $sum: '$licenseCount.total' },
        usedLicenses: { $sum: '$licenseCount.used' },
        availableLicenses: { $sum: '$licenseCount.available' },
        totalCost: { $sum: '$purchasePrice' },
        averageCost: { $avg: '$purchasePrice' },
        expiringSoon: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lte: ['$expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                  { $gte: ['$expiryDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        expired: {
          $sum: {
            $cond: [{ $lt: ['$expiryDate', new Date()] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  const categoryStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalLicenses: { $sum: '$licenseCount.total' },
        usedLicenses: { $sum: '$licenseCount.used' },
        totalCost: { $sum: '$purchasePrice' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalSoftware: 0,
      totalLicenses: 0,
      usedLicenses: 0,
      availableLicenses: 0,
      totalCost: 0,
      averageCost: 0,
      expiringSoon: 0,
      expired: 0
    },
    byCategory: categoryStats
  };
};

module.exports = mongoose.model('SoftwareInventory', softwareInventorySchema);
