const mongoose = require('mongoose');

const auditFindingSchema = new mongoose.Schema({
  // Basic Information
  findingNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Finding title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Reference to Audit
  audit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Audit',
    required: true,
    index: true
  },
  
  // Finding Details
  category: {
    type: String,
    required: true,
    enum: ['compliance', 'process', 'financial', 'operational', 'security', 'documentation', 'other'],
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  impact: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Process Information
  process: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  
  // Evidence and Documentation
  evidence: {
    type: String,
    required: true,
    trim: true
  },
  criteria: {
    type: String,
    required: true,
    trim: true
  },
  rootCause: {
    type: String,
    trim: true
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: ['open', 'under_investigation', 'pending_review', 'approved', 'closed', 'rejected'],
    default: 'open',
    index: true
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: Date,
  
  // Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewComments: String,
  
  // Corrective Action
  correctiveActionRequired: {
    type: Boolean,
    default: true
  },
  correctiveAction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorrectiveAction'
  },
  
  // Timeline
  targetResolutionDate: Date,
  actualResolutionDate: Date,
  
  // Financial Impact (if applicable)
  financialImpact: {
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'PKR'
    },
    impactType: {
      type: String,
      enum: ['loss', 'savings', 'cost_avoidance', 'revenue_impact'],
      default: 'loss'
    }
  },
  
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
  
  // Follow-up
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  followUpCompleted: {
    type: Boolean,
    default: false
  },
  followUpComments: String,
  
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
auditFindingSchema.index({ audit: 1, status: 1 });
auditFindingSchema.index({ severity: 1, status: 1 });
auditFindingSchema.index({ assignedTo: 1, status: 1 });
auditFindingSchema.index({ category: 1, severity: 1 });
auditFindingSchema.index({ createdAt: -1 });
auditFindingSchema.index({ targetResolutionDate: 1 });

// Virtual for overdue status
auditFindingSchema.virtual('isOverdue').get(function() {
  if (this.status === 'closed') return false;
  if (!this.targetResolutionDate) return false;
  return new Date() > this.targetResolutionDate;
});

// Virtual for days overdue
auditFindingSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;
  const today = new Date();
  const diffTime = today - this.targetResolutionDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to generate finding number
auditFindingSchema.pre('save', async function(next) {
  if (this.isNew && !this.findingNumber) {
    const count = await this.constructor.countDocuments();
    this.findingNumber = `FND-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Method to update audit findings count
auditFindingSchema.post('save', async function() {
  if (this.audit) {
    const Audit = mongoose.model('Audit');
    await Audit.findByIdAndUpdate(this.audit, {}, { new: true }).then(audit => {
      if (audit) {
        audit.updateFindingsCount();
      }
    });
  }
});

auditFindingSchema.post('remove', async function() {
  if (this.audit) {
    const Audit = mongoose.model('Audit');
    await Audit.findByIdAndUpdate(this.audit, {}, { new: true }).then(audit => {
      if (audit) {
        audit.updateFindingsCount();
      }
    });
  }
});

// Static method to get findings statistics
auditFindingSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        totalFindings: { $sum: 1 },
        openFindings: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        underInvestigation: {
          $sum: { $cond: [{ $eq: ['$status', 'under_investigation'] }, 1, 0] }
        },
        pendingReview: {
          $sum: { $cond: [{ $eq: ['$status', 'pending_review'] }, 1, 0] }
        },
        closedFindings: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
        },
        criticalFindings: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        highFindings: {
          $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
        },
        mediumFindings: {
          $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] }
        },
        lowFindings: {
          $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] }
        },
        overdueFindings: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', 'closed'] },
                  { $ne: ['$targetResolutionDate', null] },
                  { $gt: [new Date(), '$targetResolutionDate'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalFindings: 0,
    openFindings: 0,
    underInvestigation: 0,
    pendingReview: 0,
    closedFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
    overdueFindings: 0
  };
};

module.exports = mongoose.model('AuditFinding', auditFindingSchema);
