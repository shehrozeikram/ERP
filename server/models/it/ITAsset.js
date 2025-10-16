const mongoose = require('mongoose');

const itAssetSchema = new mongoose.Schema({
  assetTag: {
    type: String,
    required: [true, 'Asset tag is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  assetName: {
    type: String,
    required: [true, 'Asset name is required'],
    trim: true,
    maxlength: [100, 'Asset name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Asset category is required'],
    enum: [
      'Laptop', 'Desktop', 'Server', 'Printer', 'Scanner', 'Router', 'Switch',
      'Access Point', 'Firewall', 'UPS', 'Monitor', 'Keyboard', 'Mouse',
      'Webcam', 'Headset', 'Projector', 'Tablet', 'Smartphone', 'Other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true
  },
  serialNumber: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true
  },
  specifications: {
    cpu: String,
    ram: String,
    storage: String,
    gpu: String,
    operatingSystem: String,
    screenSize: String,
    resolution: String,
    other: String
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
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ITVendor',
    required: false
  },
  warranty: {
    startDate: Date,
    endDate: Date,
    type: {
      type: String,
      enum: ['Manufacturer', 'Extended', 'Third Party']
    },
    provider: String,
    contactInfo: String
  },
  depreciation: {
    method: {
      type: String,
      enum: ['Straight Line', 'Declining Balance', 'Sum of Years'],
      default: 'Straight Line'
    },
    usefulLife: {
      type: Number,
      default: 5, // years
      min: [1, 'Useful life must be at least 1 year']
    },
    residualValue: {
      type: Number,
      default: 0,
      min: [0, 'Residual value cannot be negative']
    },
    currentValue: {
      type: Number,
      default: function() {
        return this.purchasePrice;
      }
    }
  },
  location: {
    building: String,
    floor: String,
    room: String,
    desk: String
  },
  status: {
    type: String,
    enum: ['Active', 'In Repair', 'Retired', 'Lost', 'Stolen', 'Disposed'],
    default: 'Active'
  },
  condition: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'],
    default: 'Good'
  },
  assignedTo: {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    assignedDate: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    returnDate: Date,
    notes: String
  },
  qrCode: {
    type: String,
    unique: true,
    sparse: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  maintenance: {
    lastServiceDate: Date,
    nextServiceDate: Date,
    serviceProvider: String,
    serviceCost: {
      type: Number,
      min: [0, 'Service cost cannot be negative']
    },
    maintenanceNotes: String
  },
  documents: [{
    type: {
      type: String,
      enum: ['Invoice', 'Warranty', 'Manual', 'License', 'Other']
    },
    name: String,
    fileUrl: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  },
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

// Pre-save middleware to handle supplier field
itAssetSchema.pre('save', function(next) {
  // If supplier is provided but not a valid ObjectId, set it to null
  if (this.supplier && !mongoose.Types.ObjectId.isValid(this.supplier)) {
    this.supplier = null;
  }
  next();
});

// Indexes for better query performance
itAssetSchema.index({ assetTag: 1 });
itAssetSchema.index({ category: 1 });
itAssetSchema.index({ status: 1 });
itAssetSchema.index({ 'assignedTo.employee': 1 });
itAssetSchema.index({ brand: 1, model: 1 });
itAssetSchema.index({ purchaseDate: 1 });
itAssetSchema.index({ isActive: 1 });

// Virtual for asset age
itAssetSchema.virtual('age').get(function() {
  const today = new Date();
  const purchaseDate = new Date(this.purchaseDate);
  let age = today.getFullYear() - purchaseDate.getFullYear();
  const monthDiff = today.getMonth() - purchaseDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < purchaseDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for warranty status
itAssetSchema.virtual('warrantyStatus').get(function() {
  if (!this.warranty?.endDate) return 'No Warranty';
  
  const today = new Date();
  const endDate = new Date(this.warranty.endDate);
  
  if (today > endDate) return 'Expired';
  if (today > new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)) return 'Expiring Soon';
  return 'Active';
});

// Virtual for depreciation
itAssetSchema.virtual('depreciatedValue').get(function() {
  if (!this.depreciation || !this.purchaseDate) return this.purchasePrice;
  
  const today = new Date();
  const purchaseDate = new Date(this.purchaseDate);
  const yearsElapsed = (today - purchaseDate) / (365.25 * 24 * 60 * 60 * 1000);
  
  if (yearsElapsed >= this.depreciation.usefulLife) {
    return this.depreciation.residualValue;
  }
  
  const depreciableAmount = this.purchasePrice - this.depreciation.residualValue;
  const annualDepreciation = depreciableAmount / this.depreciation.usefulLife;
  
  return Math.max(
    this.purchasePrice - (annualDepreciation * yearsElapsed),
    this.depreciation.residualValue
  );
});

// Pre-save middleware to auto-generate QR code and calculate depreciation
itAssetSchema.pre('save', function(next) {
  // Generate QR code if not provided
  if (!this.qrCode) {
    this.qrCode = `IT-${this.assetTag}-${Date.now()}`;
  }
  
  // Calculate current depreciated value
  this.depreciation.currentValue = this.depreciatedValue;
  
  next();
});

// Static methods
itAssetSchema.statics.findActive = function() {
  return this.find({ isActive: true, status: 'Active' });
};

itAssetSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

itAssetSchema.statics.findAssignedAssets = function() {
  return this.find({ 
    'assignedTo.employee': { $exists: true, $ne: null },
    isActive: true 
  }).populate('assignedTo.employee', 'firstName lastName employeeId');
};

itAssetSchema.statics.findUnassignedAssets = function() {
  return this.find({ 
    $or: [
      { 'assignedTo.employee': { $exists: false } },
      { 'assignedTo.employee': null }
    ],
    isActive: true,
    status: 'Active'
  });
};

itAssetSchema.statics.getAssetStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalAssets: { $sum: 1 },
        totalValue: { $sum: '$purchasePrice' },
        averageValue: { $avg: '$purchasePrice' },
        activeAssets: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $ne: ['$isActive', false] }, // Consider active if not explicitly false
                  { $ne: ['$status', 'Inactive'] } // Consider active if not explicitly inactive
                ] 
              }, 
              1, 
              0
            ]
          }
        },
        assignedAssets: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $ne: ['$assignedTo.employee', null] },
                  { $ne: ['$assignedTo.employee', undefined] }
                ]
              }, 
              1, 
              0
            ]
          }
        }
      }
    }
  ]);
  
  const categoryStats = await this.aggregate([
    { 
      $match: { 
        $and: [
          { isActive: { $ne: false } }, // Consider active if not explicitly false
          { status: { $ne: 'Inactive' } } // Consider active if not explicitly inactive
        ]
      } 
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalValue: { $sum: '$purchasePrice' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalAssets: 0,
      totalValue: 0,
      averageValue: 0,
      activeAssets: 0,
      assignedAssets: 0
    },
    byCategory: categoryStats
  };
};

module.exports = mongoose.model('ITAsset', itAssetSchema);
