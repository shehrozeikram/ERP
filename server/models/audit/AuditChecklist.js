const mongoose = require('mongoose');

const auditChecklistSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Checklist name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Checklist Type and Category
  auditType: {
    type: String,
    required: true,
    enum: ['internal', 'departmental', 'compliance', 'financial', 'asset'],
    index: true
  },
  module: {
    type: String,
    required: true,
    enum: ['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'general'],
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Checklist Items
  items: [{
    itemNumber: {
      type: String,
      required: true
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      trim: true
    },
    criteria: {
      type: String,
      required: true,
      trim: true
    },
    expectedEvidence: {
      type: String,
      trim: true
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    isMandatory: {
      type: Boolean,
      default: true
    },
    applicableFor: [{
      type: String,
      enum: ['all', 'specific_department', 'specific_role', 'specific_process']
    }],
    applicableValues: [String], // Specific departments, roles, or processes
    weight: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    }
  }],
  
  // Checklist Configuration
  version: {
    type: String,
    default: '1.0'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Usage Statistics
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUsed: Date,
  
  // Approval and Review
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  reviewDate: Date,
  nextReviewDate: Date,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
auditChecklistSchema.index({ auditType: 1, module: 1, isActive: 1 });
auditChecklistSchema.index({ category: 1, isActive: 1 });
auditChecklistSchema.index({ isDefault: 1, auditType: 1 });
auditChecklistSchema.index({ createdAt: -1 });

// Virtual for total items count
auditChecklistSchema.virtual('totalItems').get(function() {
  return this.items.length;
});

// Virtual for mandatory items count
auditChecklistSchema.virtual('mandatoryItems').get(function() {
  return this.items.filter(item => item.isMandatory).length;
});

// Virtual for high risk items count
auditChecklistSchema.virtual('highRiskItems').get(function() {
  return this.items.filter(item => item.riskLevel === 'high' || item.riskLevel === 'critical').length;
});

// Method to increment usage count
auditChecklistSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Method to create a copy for a specific audit
auditChecklistSchema.methods.createAuditCopy = function(auditId) {
  const copy = this.toObject();
  delete copy._id;
  delete copy.__v;
  copy.originalChecklistId = this._id;
  copy.auditId = auditId;
  copy.isActive = false; // This copy is specific to the audit
  
  // Reset usage stats for the copy
  copy.usageCount = 0;
  copy.lastUsed = null;
  
  return copy;
};

// Static method to get checklist statistics
auditChecklistSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        totalChecklists: { $sum: 1 },
        internalChecklists: {
          $sum: { $cond: [{ $eq: ['$auditType', 'internal'] }, 1, 0] }
        },
        departmentalChecklists: {
          $sum: { $cond: [{ $eq: ['$auditType', 'departmental'] }, 1, 0] }
        },
        complianceChecklists: {
          $sum: { $cond: [{ $eq: ['$auditType', 'compliance'] }, 1, 0] }
        },
        financialChecklists: {
          $sum: { $cond: [{ $eq: ['$auditType', 'financial'] }, 1, 0] }
        },
        assetChecklists: {
          $sum: { $cond: [{ $eq: ['$auditType', 'asset'] }, 1, 0] }
        },
        totalUsage: { $sum: '$usageCount' },
        mostUsedChecklist: {
          $max: {
            usage: '$usageCount',
            name: '$name'
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalChecklists: 0,
    internalChecklists: 0,
    departmentalChecklists: 0,
    complianceChecklists: 0,
    financialChecklists: 0,
    assetChecklists: 0,
    totalUsage: 0,
    mostUsedChecklist: { usage: 0, name: 'N/A' }
  };
};

// Static method to find checklists by criteria
auditChecklistSchema.statics.findByCriteria = function(auditType, module, category) {
  const query = { isActive: true };
  
  if (auditType) query.auditType = auditType;
  if (module) query.module = module;
  if (category) query.category = category;
  
  return this.find(query).sort({ usageCount: -1, createdAt: -1 });
};

// Static method to get most used checklists
auditChecklistSchema.statics.getMostUsed = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ usageCount: -1, lastUsed: -1 })
    .limit(limit);
};

// Pre-save middleware to validate items
auditChecklistSchema.pre('save', function(next) {
  // Ensure items have unique item numbers
  const itemNumbers = this.items.map(item => item.itemNumber);
  const uniqueItemNumbers = [...new Set(itemNumbers)];
  
  if (itemNumbers.length !== uniqueItemNumbers.length) {
    return next(new Error('Item numbers must be unique within a checklist'));
  }
  
  // Ensure at least one item exists
  if (this.items.length === 0) {
    return next(new Error('Checklist must have at least one item'));
  }
  
  next();
});

module.exports = mongoose.model('AuditChecklist', auditChecklistSchema);
