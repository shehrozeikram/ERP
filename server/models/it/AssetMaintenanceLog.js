const mongoose = require('mongoose');

const assetMaintenanceLogSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ITAsset',
    required: [true, 'Asset is required']
  },
  maintenanceType: {
    type: String,
    enum: ['Preventive', 'Corrective', 'Emergency', 'Upgrade', 'Inspection'],
    required: [true, 'Maintenance type is required']
  },
  title: {
    type: String,
    required: [true, 'Maintenance title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  scheduledDate: Date,
  actualStartDate: Date,
  actualEndDate: Date,
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'On Hold'],
    default: 'Scheduled'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedBy: {
    name: String,
    company: String,
    contactInfo: String,
    isInternal: {
      type: Boolean,
      default: false
    }
  },
  cost: {
    labor: {
      type: Number,
      min: [0, 'Labor cost cannot be negative']
    },
    parts: {
      type: Number,
      min: [0, 'Parts cost cannot be negative']
    },
    total: {
      type: Number,
      min: [0, 'Total cost cannot be negative']
    },
    currency: {
      type: String,
      default: 'PKR',
      enum: ['PKR', 'USD', 'EUR']
    }
  },
  partsUsed: [{
    name: String,
    partNumber: String,
    quantity: {
      type: Number,
      min: [0, 'Quantity cannot be negative']
    },
    unitCost: {
      type: Number,
      min: [0, 'Unit cost cannot be negative']
    },
    totalCost: {
      type: Number,
      min: [0, 'Total cost cannot be negative']
    }
  }],
  conditionBefore: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
  },
  conditionAfter: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
  },
  resolution: String,
  recommendations: String,
  nextMaintenanceDate: Date,
  warrantyInfo: {
    isWarrantyRepair: {
      type: Boolean,
      default: false
    },
    warrantyProvider: String,
    warrantyReference: String
  },
  documents: [{
    type: {
      type: String,
      enum: ['Invoice', 'Receipt', 'Warranty', 'Report', 'Other']
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
assetMaintenanceLogSchema.index({ asset: 1 });
assetMaintenanceLogSchema.index({ status: 1 });
assetMaintenanceLogSchema.index({ maintenanceType: 1 });
assetMaintenanceLogSchema.index({ scheduledDate: 1 });
assetMaintenanceLogSchema.index({ priority: 1 });
assetMaintenanceLogSchema.index({ isActive: 1 });

// Virtual for maintenance duration
assetMaintenanceLogSchema.virtual('duration').get(function() {
  if (!this.actualStartDate || !this.actualEndDate) return null;
  
  const diffTime = Math.abs(this.actualEndDate - this.actualStartDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for overdue status
assetMaintenanceLogSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'Scheduled' || !this.scheduledDate) return false;
  return new Date() > new Date(this.scheduledDate);
});

// Pre-save middleware to calculate total cost
assetMaintenanceLogSchema.pre('save', function(next) {
  // Calculate total cost
  this.cost.total = (this.cost.labor || 0) + (this.cost.parts || 0);
  
  // Calculate parts total
  if (this.partsUsed && this.partsUsed.length > 0) {
    this.partsUsed.forEach(part => {
      part.totalCost = (part.quantity || 0) * (part.unitCost || 0);
    });
    
    // Update parts cost
    this.cost.parts = this.partsUsed.reduce((sum, part) => sum + (part.totalCost || 0), 0);
  }
  
  next();
});

// Static methods
assetMaintenanceLogSchema.statics.findByAsset = function(assetId) {
  return this.find({ 
    asset: assetId,
    isActive: true 
  }).sort({ createdAt: -1 });
};

assetMaintenanceLogSchema.statics.findScheduledMaintenance = function() {
  return this.find({ 
    status: 'Scheduled',
    isActive: true 
  }).populate('asset').sort({ scheduledDate: 1 });
};

assetMaintenanceLogSchema.statics.findOverdueMaintenance = function() {
  return this.find({
    status: 'Scheduled',
    scheduledDate: { $lt: new Date() },
    isActive: true
  }).populate('asset');
};

assetMaintenanceLogSchema.statics.getMaintenanceStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalMaintenance: { $sum: 1 },
        completedMaintenance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0]
          }
        },
        scheduledMaintenance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Scheduled'] }, 1, 0]
          }
        },
        overdueMaintenance: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Scheduled'] },
                  { $lt: ['$scheduledDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalCost: { $sum: '$cost.total' },
        averageCost: { $avg: '$cost.total' }
      }
    }
  ]);
  
  const typeStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$maintenanceType',
        count: { $sum: 1 },
        totalCost: { $sum: '$cost.total' },
        averageCost: { $avg: '$cost.total' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalMaintenance: 0,
      completedMaintenance: 0,
      scheduledMaintenance: 0,
      overdueMaintenance: 0,
      totalCost: 0,
      averageCost: 0
    },
    byType: typeStats
  };
};

module.exports = mongoose.model('AssetMaintenanceLog', assetMaintenanceLogSchema);
