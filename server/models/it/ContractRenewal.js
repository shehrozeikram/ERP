const mongoose = require('mongoose');

const contractRenewalSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorContract',
    required: [true, 'Contract is required']
  },
  renewalNumber: {
    type: String,
    required: [true, 'Renewal number is required'],
    trim: true
  },
  renewalType: {
    type: String,
    enum: ['Automatic', 'Manual', 'Extension', 'Amendment'],
    required: [true, 'Renewal type is required']
  },
  previousEndDate: {
    type: Date,
    required: [true, 'Previous end date is required']
  },
  newStartDate: {
    type: Date,
    required: [true, 'New start date is required']
  },
  newEndDate: {
    type: Date,
    required: [true, 'New end date is required']
  },
  renewalPeriod: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Annually', 'Bi-annually', 'Custom'],
    required: [true, 'Renewal period is required']
  },
  previousValue: {
    type: Number,
    required: [true, 'Previous value is required'],
    min: [0, 'Previous value cannot be negative']
  },
  newValue: {
    type: Number,
    required: [true, 'New value is required'],
    min: [0, 'New value cannot be negative']
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  valueChange: {
    amount: {
      type: Number,
      default: function() {
        return this.newValue - this.previousValue;
      }
    },
    percentage: {
      type: Number,
      default: function() {
        if (this.previousValue === 0) return 0;
        return ((this.newValue - this.previousValue) / this.previousValue * 100).toFixed(2);
      }
    },
    reason: String
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  renewalReason: {
    type: String,
    enum: ['Contract Expiry', 'Performance Based', 'Volume Increase', 'Service Expansion', 'Cost Optimization', 'Other'],
    required: [true, 'Renewal reason is required']
  },
  approvalWorkflow: {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    requestedDate: {
      type: Date,
      default: Date.now
    },
    approvers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      level: {
        type: String,
        enum: ['Department Head', 'Finance', 'IT Director', 'CEO', 'Board']
      },
      status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
      },
      approvedDate: Date,
      comments: String
    }],
    finalApprovalDate: Date,
    finalApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  terms: {
    previousTerms: String,
    newTerms: String,
    changes: [String],
    specialConditions: String
  },
  performance: {
    previousRating: {
      type: Number,
      min: 1,
      max: 5
    },
    slaCompliance: {
      type: Number,
      min: 0,
      max: 100
    },
    issuesCount: Number,
    customerSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  documents: [{
    type: {
      type: String,
      enum: ['Renewal Agreement', 'Amendment', 'Performance Report', 'Financial Analysis', 'Other']
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
  }
}, {
  timestamps: true
});

// Indexes
contractRenewalSchema.index({ contract: 1 });
contractRenewalSchema.index({ renewalNumber: 1 });
contractRenewalSchema.index({ status: 1 });
contractRenewalSchema.index({ renewalType: 1 });
contractRenewalSchema.index({ newEndDate: 1 });
contractRenewalSchema.index({ 'approvalWorkflow.requestedDate': -1 });
contractRenewalSchema.index({ isActive: 1 });

// Virtual for renewal duration
contractRenewalSchema.virtual('renewalDuration').get(function() {
  const startDate = new Date(this.newStartDate);
  const endDate = new Date(this.newEndDate);
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
});

// Virtual for approval status
contractRenewalSchema.virtual('approvalStatus').get(function() {
  if (!this.approvalWorkflow?.approvers || this.approvalWorkflow.approvers.length === 0) {
    return 'No Approvers';
  }
  
  const pendingApprovals = this.approvalWorkflow.approvers.filter(approver => 
    approver.status === 'Pending'
  ).length;
  
  if (pendingApprovals === 0) {
    const rejectedApprovals = this.approvalWorkflow.approvers.filter(approver => 
      approver.status === 'Rejected'
    ).length;
    
    return rejectedApprovals > 0 ? 'Rejected' : 'Approved';
  }
  
  return 'Pending';
});

// Virtual for days until renewal
contractRenewalSchema.virtual('daysUntilRenewal').get(function() {
  const today = new Date();
  const newEndDate = new Date(this.newEndDate);
  const diffTime = newEndDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
contractRenewalSchema.pre('save', function(next) {
  // Auto-generate renewal number if not provided
  if (!this.renewalNumber) {
    const timestamp = Date.now().toString().slice(-6);
    this.renewalNumber = `REN-${timestamp}`;
  }
  
  // Calculate value change
  this.valueChange.amount = this.newValue - this.previousValue;
  if (this.previousValue > 0) {
    this.valueChange.percentage = ((this.newValue - this.previousValue) / this.previousValue * 100).toFixed(2);
  }
  
  next();
});

// Static methods
contractRenewalSchema.statics.findPendingRenewals = function() {
  return this.find({
    status: 'Pending',
    isActive: true
  }).populate('contract').sort({ 'approvalWorkflow.requestedDate': -1 });
};

contractRenewalSchema.statics.findApprovedRenewals = function() {
  return this.find({
    status: 'Approved',
    isActive: true
  }).populate('contract').sort({ newEndDate: 1 });
};

contractRenewalSchema.statics.findUpcomingRenewals = function(days = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: { $in: ['Approved', 'Completed'] },
    newEndDate: { $lte: futureDate, $gte: new Date() },
    isActive: true
  }).populate('contract').sort({ newEndDate: 1 });
};

contractRenewalSchema.statics.getRenewalStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalRenewals: { $sum: 1 },
        pendingRenewals: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0]
          }
        },
        approvedRenewals: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0]
          }
        },
        completedRenewals: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0]
          }
        },
        rejectedRenewals: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0]
          }
        },
        totalValueIncrease: {
          $sum: '$valueChange.amount'
        },
        averageValueChange: { $avg: '$valueChange.percentage' }
      }
    }
  ]);
  
  const typeStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$renewalType',
        count: { $sum: 1 },
        averageValueChange: { $avg: '$valueChange.percentage' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  const reasonStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$renewalReason',
        count: { $sum: 1 },
        averageValueChange: { $avg: '$valueChange.percentage' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalRenewals: 0,
      pendingRenewals: 0,
      approvedRenewals: 0,
      completedRenewals: 0,
      rejectedRenewals: 0,
      totalValueIncrease: 0,
      averageValueChange: 0
    },
    byType: typeStats,
    byReason: reasonStats
  };
};

module.exports = mongoose.model('ContractRenewal', contractRenewalSchema);
