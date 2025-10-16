const mongoose = require('mongoose');

const correctiveActionSchema = new mongoose.Schema({
  // Basic Information
  carNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'CAR title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Reference to Finding
  finding: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditFinding',
    required: true,
    index: true
  },
  audit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Audit',
    required: true,
    index: true
  },
  
  // Action Details
  actionType: {
    type: String,
    required: true,
    enum: ['corrective', 'preventive', 'improvement'],
    default: 'corrective',
    index: true
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Action Plan
  actionPlan: {
    type: String,
    required: true,
    trim: true
  },
  rootCause: {
    type: String,
    trim: true
  },
  proposedSolution: {
    type: String,
    required: true,
    trim: true
  },
  
  // Assignment and Responsibility
  responsiblePerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  
  // Timeline
  targetCompletionDate: {
    type: Date,
    required: true,
    index: true
  },
  actualCompletionDate: Date,
  
  // Status Tracking
  status: {
    type: String,
    enum: ['open', 'in_progress', 'under_review', 'completed', 'verified', 'closed', 'overdue'],
    default: 'open',
    index: true
  },
  
  // Progress Tracking
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  milestones: [{
    milestone: {
      type: String,
      required: true
    },
    targetDate: Date,
    completedDate: Date,
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending'
    }
  }],
  
  // Verification Process
  verificationRequired: {
    type: Boolean,
    default: true
  },
  verificationMethod: {
    type: String,
    enum: ['document_review', 'site_inspection', 'testing', 'interview', 'other'],
    default: 'document_review'
  },
  verificationCriteria: {
    type: String,
    trim: true
  },
  
  // Verification Results
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  verificationComments: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'not_verified', 'requires_rework'],
    default: 'pending'
  },
  
  // Effectiveness Review
  effectivenessReviewRequired: {
    type: Boolean,
    default: false
  },
  effectivenessReviewDate: Date,
  effectivenessReviewBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  effectivenessComments: String,
  effectivenessRating: {
    type: String,
    enum: ['excellent', 'good', 'satisfactory', 'needs_improvement', 'poor']
  },
  
  // Cost and Resources
  estimatedCost: {
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'PKR'
    }
  },
  actualCost: {
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'PKR'
    }
  },
  resourcesRequired: [{
    resource: String,
    quantity: Number,
    unit: String
  }],
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Follow-up Actions
  followUpActions: [{
    action: String,
    responsiblePerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending'
    }
  }],
  
  // Comments and Notes
  comments: [{
    comment: String,
    commentedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    commentedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
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
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
correctiveActionSchema.index({ audit: 1, status: 1 });
correctiveActionSchema.index({ responsiblePerson: 1, status: 1 });
correctiveActionSchema.index({ priority: 1, status: 1 });
correctiveActionSchema.index({ targetCompletionDate: 1 });
correctiveActionSchema.index({ createdAt: -1 });

// Virtual for overdue status
correctiveActionSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'verified' || this.status === 'closed') {
    return false;
  }
  return new Date() > this.targetCompletionDate;
});

// Virtual for days overdue
correctiveActionSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;
  const today = new Date();
  const diffTime = today - this.targetCompletionDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for completion rate
correctiveActionSchema.virtual('completionRate').get(function() {
  if (this.milestones.length === 0) return this.progress;
  const completedMilestones = this.milestones.filter(m => m.status === 'completed').length;
  return Math.round((completedMilestones / this.milestones.length) * 100);
});

// Pre-save middleware to generate CAR number
correctiveActionSchema.pre('save', async function(next) {
  if (this.isNew && !this.carNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.carNumber = `CAR-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to update status based on progress and dates
correctiveActionSchema.pre('save', function(next) {
  if (this.status !== 'closed' && this.status !== 'verified') {
    if (this.isOverdue) {
      this.status = 'overdue';
    } else if (this.progress === 100 && this.verificationStatus === 'verified') {
      this.status = 'completed';
    } else if (this.progress > 0) {
      this.status = 'in_progress';
    }
  }
  next();
});

// Method to add comment
correctiveActionSchema.methods.addComment = function(comment, userId) {
  this.comments.push({
    comment,
    commentedBy: userId,
    commentedAt: new Date()
  });
  return this.save();
};

// Method to update progress
correctiveActionSchema.methods.updateProgress = function(progress, userId) {
  this.progress = Math.min(Math.max(progress, 0), 100);
  this.updatedBy = userId;
  return this.save();
};

// Static method to get CAR statistics
correctiveActionSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        totalCARs: { $sum: 1 },
        openCARs: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        inProgressCARs: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        completedCARs: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        verifiedCARs: {
          $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
        },
        overdueCARs: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
        },
        criticalCARs: {
          $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
        },
        highCARs: {
          $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalCARs: 0,
    openCARs: 0,
    inProgressCARs: 0,
    completedCARs: 0,
    verifiedCARs: 0,
    overdueCARs: 0,
    criticalCARs: 0,
    highCARs: 0
  };
};

module.exports = mongoose.model('CorrectiveAction', correctiveActionSchema);
