const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Opportunity title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  // Company and Contact Information
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },

  // Opportunity Details
  stage: {
    type: String,
    required: [true, 'Stage is required'],
    enum: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    default: 'Prospecting'
  },
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: 10
  },
  expectedCloseDate: {
    type: Date,
    required: [true, 'Expected close date is required']
  },
  actualCloseDate: {
    type: Date
  },

  // Financial Information
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD'
  },
  type: {
    type: String,
    enum: ['New Business', 'Existing Business', 'Renewal', 'Up-sell', 'Cross-sell'],
    default: 'New Business'
  },

  // Lead Source
  leadSource: {
    type: String,
    enum: ['Website', 'Referral', 'Cold Call', 'Trade Show', 'Advertisement', 'Email Campaign', 'Social Media', 'Other'],
    default: 'Website'
  },

  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned user is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Activities and Notes
  activities: [{
    type: {
      type: String,
      enum: ['Call', 'Email', 'Meeting', 'Proposal', 'Follow-up', 'Other'],
      required: true
    },
    subject: {
      type: String,
      required: true,
      maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    date: {
      type: Date,
      default: Date.now
    },
    duration: {
      type: Number, // in minutes
      min: 0
    },
    outcome: {
      type: String,
      maxlength: [500, 'Outcome cannot exceed 500 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],

  notes: [{
    content: {
      type: String,
      required: true,
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

  // Products/Services
  products: [{
    name: {
      type: String,
      required: true,
      maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    description: {
      type: String,
      maxlength: [500, 'Product description cannot exceed 500 characters']
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative']
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative']
    }
  }],

  // Competition
  competitors: [{
    name: {
      type: String,
      required: true,
      maxlength: [100, 'Competitor name cannot exceed 100 characters']
    },
    strengths: {
      type: String,
      maxlength: [500, 'Strengths cannot exceed 500 characters']
    },
    weaknesses: {
      type: String,
      maxlength: [500, 'Weaknesses cannot exceed 500 characters']
    }
  }],

  // Tags
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  // Custom Fields
  customFields: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
opportunitySchema.index({ company: 1 });
opportunitySchema.index({ assignedTo: 1 });
opportunitySchema.index({ stage: 1 });
opportunitySchema.index({ expectedCloseDate: 1 });
opportunitySchema.index({ amount: -1 });
opportunitySchema.index({ createdAt: -1 });

// Virtual for total products value
opportunitySchema.virtual('productsTotal').get(function() {
  return this.products.reduce((total, product) => total + product.totalPrice, 0);
});

// Virtual for weighted amount
opportunitySchema.virtual('weightedAmount').get(function() {
  return (this.amount * this.probability) / 100;
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
opportunitySchema.methods.updateStage = function(newStage) {
  this.stage = newStage;
  
  // Update probability based on stage
  const stageProbabilities = {
    'Prospecting': 10,
    'Qualification': 25,
    'Proposal': 50,
    'Negotiation': 75,
    'Closed Won': 100,
    'Closed Lost': 0
  };
  
  this.probability = stageProbabilities[newStage] || this.probability;
  
  // If closed, set actual close date
  if (newStage === 'Closed Won' || newStage === 'Closed Lost') {
    this.actualCloseDate = new Date();
  }
  
  return this.save();
};

// Static method to get opportunities by stage
opportunitySchema.statics.getOpportunitiesByStage = function(stage) {
  return this.find({ stage })
    .populate('company', 'name industry')
    .populate('contact', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');
};

// Static method to get opportunities by assigned user
opportunitySchema.statics.getOpportunitiesByUser = function(userId) {
  return this.find({ assignedTo: userId })
    .populate('company', 'name industry')
    .populate('contact', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');
};

// Static method to get opportunities by company
opportunitySchema.statics.getOpportunitiesByCompany = function(companyId) {
  return this.find({ company: companyId })
    .populate('company', 'name industry')
    .populate('contact', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');
};

// Static method to get pipeline summary
opportunitySchema.statics.getPipelineSummary = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$stage',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        weightedAmount: { $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] } }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Pre-save middleware to calculate product totals
opportunitySchema.pre('save', function(next) {
  // Calculate total amount from products if not set
  if (this.products && this.products.length > 0) {
    this.amount = this.products.reduce((total, product) => {
      product.totalPrice = product.quantity * product.unitPrice;
      return total + product.totalPrice;
    }, 0);
  }
  next();
});

module.exports = mongoose.model('Opportunity', opportunitySchema); 