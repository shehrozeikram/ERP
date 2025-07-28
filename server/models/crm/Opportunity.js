const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Opportunity title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  stage: {
    type: String,
    required: [true, 'Stage is required'],
    enum: {
      values: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
      message: 'Please select a valid stage'
    },
    default: 'Prospecting'
  },
  probability: {
    type: Number,
    min: [0, 'Probability cannot be negative'],
    max: [100, 'Probability cannot exceed 100%'],
    default: 10
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'PKR']
  },
  expectedCloseDate: {
    type: Date,
    required: [true, 'Expected close date is required']
  },
  actualCloseDate: {
    type: Date
  },
  closeReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Close reason cannot exceed 500 characters']
  },
  lossReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Loss reason cannot exceed 500 characters']
  },
  source: {
    type: String,
    enum: {
      values: ['Website', 'Referral', 'Cold Call', 'Email Campaign', 'Social Media', 'Trade Show', 'Advertisement', 'Partner', 'Other'],
      message: 'Please select a valid source'
    },
    default: 'Other'
  },
  priority: {
    type: String,
    enum: {
      values: ['Low', 'Medium', 'High', 'Urgent'],
      message: 'Please select a valid priority'
    },
    default: 'Medium'
  },
  type: {
    type: String,
    enum: {
      values: ['New Business', 'Existing Business', 'Renewal', 'Upsell', 'Cross-sell'],
      message: 'Please select a valid opportunity type'
    },
    default: 'New Business'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Opportunity must be assigned to someone']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  competitors: [{
    name: {
      type: String,
      trim: true,
      required: true
    },
    strength: {
      type: String,
      enum: ['Weak', 'Medium', 'Strong'],
      default: 'Medium'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Competitor notes cannot exceed 500 characters']
    }
  }],
  products: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative']
    },
    discount: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      default: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative']
    }
  }],
  activities: [{
    type: {
      type: String,
      enum: ['Call', 'Email', 'Meeting', 'Proposal', 'Follow-up', 'Demo', 'Quote', 'Other'],
      required: true
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Activity subject cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Activity description cannot exceed 1000 characters']
    },
    date: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
      default: 0
    },
    outcome: {
      type: String,
      trim: true,
      maxlength: [500, 'Activity outcome cannot exceed 500 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: [{
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Note content cannot exceed 1000 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for weighted amount
opportunitySchema.virtual('weightedAmount').get(function() {
  return (this.amount * this.probability) / 100;
});

// Virtual for days until close
opportunitySchema.virtual('daysUntilClose').get(function() {
  if (this.expectedCloseDate) {
    const now = new Date();
    const diffTime = this.expectedCloseDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
});

// Virtual for total products value
opportunitySchema.virtual('totalProductsValue').get(function() {
  return this.products.reduce((total, product) => {
    const discountedPrice = product.unitPrice * (1 - product.discount / 100);
    return total + (discountedPrice * product.quantity);
  }, 0);
});

// Virtual for isOverdue
opportunitySchema.virtual('isOverdue').get(function() {
  if (this.expectedCloseDate && this.stage !== 'Closed Won' && this.stage !== 'Closed Lost') {
    return new Date() > this.expectedCloseDate;
  }
  return false;
});

// Indexes for better query performance
opportunitySchema.index({ stage: 1, expectedCloseDate: 1 });
opportunitySchema.index({ assignedTo: 1 });
opportunitySchema.index({ company: 1 });
opportunitySchema.index({ amount: -1 });
opportunitySchema.index({ createdAt: -1 });
opportunitySchema.index({ tags: 1 });

// Pre-save middleware to calculate total price for products
opportunitySchema.pre('save', function(next) {
  if (this.products && this.products.length > 0) {
    this.products.forEach(product => {
      const discountedPrice = product.unitPrice * (1 - product.discount / 100);
      product.totalPrice = discountedPrice * product.quantity;
    });
  }
  next();
});

// Method to add activity
opportunitySchema.methods.addActivity = function(activityData) {
  this.activities.push(activityData);
  return this.save();
};

// Method to add note
opportunitySchema.methods.addNote = function(content, userId) {
  this.notes.push({
    content,
    createdBy: userId
  });
  return this.save();
};

// Method to update stage
opportunitySchema.methods.updateStage = function(newStage, reason = '') {
  this.stage = newStage;
  
  if (newStage === 'Closed Won' || newStage === 'Closed Lost') {
    this.actualCloseDate = new Date();
    if (newStage === 'Closed Lost') {
      this.lossReason = reason;
    } else {
      this.closeReason = reason;
    }
  }
  
  return this.save();
};

// Static method to get opportunity statistics
opportunitySchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalOpportunities: { $sum: 1 },
        totalValue: { $sum: '$amount' },
        weightedValue: { $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] } },
        avgProbability: { $avg: '$probability' },
        closedWon: {
          $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] }
        },
        closedLost: {
          $sum: { $cond: [{ $eq: ['$stage', 'Closed Lost'] }, 1, 0] }
        },
        openOpportunities: {
          $sum: { $cond: [{ $nin: ['$stage', ['Closed Won', 'Closed Lost']] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalOpportunities: 0,
    totalValue: 0,
    weightedValue: 0,
    avgProbability: 0,
    closedWon: 0,
    closedLost: 0,
    openOpportunities: 0
  };
};

// Static method to get pipeline by stage
opportunitySchema.statics.getPipeline = async function() {
  const pipeline = await this.aggregate([
    {
      $group: {
        _id: '$stage',
        count: { $sum: 1 },
        totalValue: { $sum: '$amount' },
        avgProbability: { $avg: '$probability' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  return pipeline;
};

module.exports = mongoose.model('Opportunity', opportunitySchema); 