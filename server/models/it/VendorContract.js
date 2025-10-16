const mongoose = require('mongoose');

const vendorContractSchema = new mongoose.Schema({
  contractNumber: {
    type: String,
    required: [true, 'Contract number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ITVendor',
    required: [true, 'Vendor is required']
  },
  contractTitle: {
    type: String,
    required: [true, 'Contract title is required'],
    trim: true
  },
  contractType: {
    type: String,
    enum: [
      'Purchase Agreement', 'Service Level Agreement', 'Support Contract',
      'Maintenance Agreement', 'Software License', 'Consulting Agreement',
      'Cloud Services', 'Hardware Lease', 'Training Contract', 'Other'
    ],
    required: [true, 'Contract type is required']
  },
  status: {
    type: String,
    enum: ['Draft', 'Active', 'Expired', 'Terminated', 'Suspended', 'Cancelled'],
    default: 'Draft'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  autoRenewal: {
    enabled: {
      type: Boolean,
      default: false
    },
    period: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Annually', 'Bi-annually']
    },
    noticePeriod: {
      type: Number, // days
      default: 30
    }
  },
  value: {
    total: {
      type: Number,
      required: [true, 'Total contract value is required'],
      min: [0, 'Contract value cannot be negative']
    },
    currency: {
      type: String,
      default: 'PKR',
      enum: ['PKR', 'USD', 'EUR']
    },
    billingFrequency: {
      type: String,
      enum: ['One-time', 'Monthly', 'Quarterly', 'Annually', 'Custom']
    },
    paymentTerms: {
      type: String,
      enum: ['Net 30', 'Net 45', 'Net 60', 'Prepaid', 'COD', 'Custom']
    }
  },
  scope: {
    description: {
      type: String,
      required: [true, 'Scope description is required']
    },
    deliverables: [String],
    exclusions: [String],
    milestones: [{
      name: String,
      dueDate: Date,
      status: {
        type: String,
        enum: ['Pending', 'Completed', 'Overdue', 'Cancelled']
      },
      completionDate: Date,
      notes: String
    }]
  },
  terms: {
    warranty: String,
    liability: String,
    termination: String,
    forceMajeure: String,
    confidentiality: String,
    intellectualProperty: String,
    disputeResolution: String,
    governingLaw: String
  },
  sla: {
    availability: {
      target: Number, // percentage
      measurement: String
    },
    responseTime: {
      critical: Number, // hours
      high: Number,
      medium: Number,
      low: Number
    },
    resolutionTime: {
      critical: Number, // hours
      high: Number,
      medium: Number,
      low: Number
    },
    penalties: {
      type: String,
      enum: ['None', 'Service Credits', 'Financial Penalties', 'Contract Termination']
    }
  },
  contacts: {
    primary: {
      name: String,
      title: String,
      email: String,
      phone: String
    },
    technical: {
      name: String,
      title: String,
      email: String,
      phone: String
    },
    billing: {
      name: String,
      title: String,
      email: String,
      phone: String
    },
    escalation: {
      name: String,
      title: String,
      email: String,
      phone: String
    }
  },
  renewal: {
    lastRenewalDate: Date,
    nextRenewalDate: Date,
    renewalValue: Number,
    renewalTerms: String,
    renewalStatus: {
      type: String,
      enum: ['Not Due', 'Due Soon', 'Overdue', 'Renewed', 'Cancelled']
    }
  },
  performance: {
    overallRating: {
      type: Number,
      min: 1,
      max: 5
    },
    slaCompliance: {
      type: Number,
      min: 0,
      max: 100
    },
    customerSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    issues: [{
      date: Date,
      description: String,
      severity: String,
      resolved: Boolean,
      resolutionDate: Date
    }]
  },
  documents: [{
    type: {
      type: String,
      enum: ['Contract', 'Amendment', 'SOW', 'Invoice', 'Certificate', 'Other']
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

// Indexes
vendorContractSchema.index({ contractNumber: 1 });
vendorContractSchema.index({ vendor: 1 });
vendorContractSchema.index({ status: 1 });
vendorContractSchema.index({ contractType: 1 });
vendorContractSchema.index({ startDate: 1 });
vendorContractSchema.index({ endDate: 1 });
vendorContractSchema.index({ 'renewal.nextRenewalDate': 1 });
vendorContractSchema.index({ isActive: 1 });

// Virtual for contract duration
vendorContractSchema.virtual('duration').get(function() {
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365)); // years
});

// Virtual for days until expiry
vendorContractSchema.virtual('daysUntilExpiry').get(function() {
  const today = new Date();
  const endDate = new Date(this.endDate);
  const diffTime = endDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for renewal status
vendorContractSchema.virtual('renewalStatus').get(function() {
  if (this.status !== 'Active') return 'Inactive';
  if (!this.autoRenewal?.enabled) return 'Manual Renewal';
  
  const today = new Date();
  const endDate = new Date(this.endDate);
  const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'Expired';
  if (daysUntilExpiry <= this.autoRenewal.noticePeriod) return 'Due Soon';
  return 'Active';
});

// Virtual for contract age
vendorContractSchema.virtual('contractAge').get(function() {
  const today = new Date();
  const startDate = new Date(this.startDate);
  const diffTime = today - startDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
});

// Pre-save middleware
vendorContractSchema.pre('save', function(next) {
  // Auto-generate contract number if not provided
  if (!this.contractNumber) {
    const prefix = this.contractType.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    this.contractNumber = `${prefix}-${timestamp}`;
  }
  
  // Calculate renewal dates
  if (this.autoRenewal?.enabled && this.autoRenewal?.period) {
    const endDate = new Date(this.endDate);
    let renewalDate = new Date(endDate);
    
    switch (this.autoRenewal.period) {
      case 'Monthly':
        renewalDate.setMonth(renewalDate.getMonth() + 1);
        break;
      case 'Quarterly':
        renewalDate.setMonth(renewalDate.getMonth() + 3);
        break;
      case 'Annually':
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        break;
      case 'Bi-annually':
        renewalDate.setFullYear(renewalDate.getFullYear() + 2);
        break;
    }
    
    this.renewal.nextRenewalDate = renewalDate;
  }
  
  // Update renewal status
  if (this.status === 'Active') {
    const today = new Date();
    const endDate = new Date(this.endDate);
    const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      this.renewal.renewalStatus = 'Overdue';
    } else if (daysUntilExpiry <= 30) {
      this.renewal.renewalStatus = 'Due Soon';
    } else {
      this.renewal.renewalStatus = 'Not Due';
    }
  }
  
  next();
});

// Static methods
vendorContractSchema.statics.findActiveContracts = function() {
  return this.find({
    status: 'Active',
    isActive: true
  }).populate('vendor').sort({ endDate: 1 });
};

vendorContractSchema.statics.findExpiringSoon = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'Active',
    endDate: { $lte: futureDate, $gte: new Date() },
    isActive: true
  }).populate('vendor').sort({ endDate: 1 });
};

vendorContractSchema.statics.findExpired = function() {
  return this.find({
    status: 'Active',
    endDate: { $lt: new Date() },
    isActive: true
  }).populate('vendor').sort({ endDate: -1 });
};

vendorContractSchema.statics.findByVendor = function(vendorId) {
  return this.find({
    vendor: vendorId,
    isActive: true
  }).sort({ startDate: -1 });
};

vendorContractSchema.statics.getContractStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalContracts: { $sum: 1 },
        activeContracts: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Active'] }, 1, 0]
          }
        },
        expiredContracts: {
          $sum: {
            $cond: [{ $lt: ['$endDate', new Date()] }, 1, 0]
          }
        },
        totalValue: { $sum: '$value.total' },
        averageValue: { $avg: '$value.total' },
        expiringSoon: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Active'] },
                  { $lte: ['$endDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                  { $gte: ['$endDate', new Date()] }
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
  
  const typeStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$contractType',
        count: { $sum: 1 },
        totalValue: { $sum: '$value.total' },
        averageValue: { $avg: '$value.total' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalContracts: 0,
      activeContracts: 0,
      expiredContracts: 0,
      totalValue: 0,
      averageValue: 0,
      expiringSoon: 0
    },
    byType: typeStats
  };
};

module.exports = mongoose.model('VendorContract', vendorContractSchema);
