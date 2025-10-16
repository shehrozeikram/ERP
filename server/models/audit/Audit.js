const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  // Basic Information
  auditNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Audit title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Audit Type and Category
  auditType: {
    type: String,
    required: true,
    enum: ['internal', 'departmental', 'compliance', 'financial', 'asset'],
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  
  // Audit Scope
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true
  },
  module: {
    type: String,
    required: true,
    enum: ['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'general'],
    index: true
  },
  
  // Scheduling
  plannedStartDate: {
    type: Date,
    required: true,
    index: true
  },
  plannedEndDate: {
    type: Date,
    required: true,
    index: true
  },
  actualStartDate: {
    type: Date,
    index: true
  },
  actualEndDate: {
    type: Date,
    index: true
  },
  
  // Assignment
  leadAuditor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  auditTeam: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['auditor', 'reviewer', 'observer'],
      default: 'auditor'
    }
  }],
  
  // Status and Progress
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'under_review', 'completed', 'cancelled'],
    default: 'planned',
    index: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Audit Objectives and Scope
  objectives: [{
    objective: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'not_applicable'],
      default: 'pending'
    }
  }],
  
  // Risk Assessment
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Findings Summary
  totalFindings: {
    type: Number,
    default: 0,
    min: 0
  },
  criticalFindings: {
    type: Number,
    default: 0,
    min: 0
  },
  highFindings: {
    type: Number,
    default: 0,
    min: 0
  },
  mediumFindings: {
    type: Number,
    default: 0,
    min: 0
  },
  lowFindings: {
    type: Number,
    default: 0,
    min: 0
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
  
  // Review and Approval
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewComments: String,
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalComments: String,
  
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
auditSchema.index({ auditType: 1, status: 1 });
auditSchema.index({ department: 1, status: 1 });
auditSchema.index({ leadAuditor: 1, status: 1 });
auditSchema.index({ plannedStartDate: 1, plannedEndDate: 1 });
auditSchema.index({ createdAt: -1 });
auditSchema.index({ updatedAt: -1 });

// Virtual for audit duration
auditSchema.virtual('plannedDuration').get(function() {
  if (this.plannedStartDate && this.plannedEndDate) {
    return Math.ceil((this.plannedEndDate - this.plannedStartDate) / (1000 * 60 * 60 * 24));
  }
  return null;
});

auditSchema.virtual('actualDuration').get(function() {
  if (this.actualStartDate && this.actualEndDate) {
    return Math.ceil((this.actualEndDate - this.actualStartDate) / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for overdue status
auditSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed') return false;
  if (this.status === 'cancelled') return false;
  return new Date() > this.plannedEndDate;
});

// Pre-save middleware to generate audit number
auditSchema.pre('save', async function(next) {
  if (this.isNew && !this.auditNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.auditNumber = `AUD-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to update findings count
auditSchema.methods.updateFindingsCount = async function() {
  const AuditFinding = mongoose.model('AuditFinding');
  const findings = await AuditFinding.find({ audit: this._id });
  
  this.totalFindings = findings.length;
  this.criticalFindings = findings.filter(f => f.severity === 'critical').length;
  this.highFindings = findings.filter(f => f.severity === 'high').length;
  this.mediumFindings = findings.filter(f => f.severity === 'medium').length;
  this.lowFindings = findings.filter(f => f.severity === 'low').length;
  
  await this.save();
};

// Static method to get audit statistics
auditSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        totalAudits: { $sum: 1 },
        completedAudits: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        inProgressAudits: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        plannedAudits: {
          $sum: { $cond: [{ $eq: ['$status', 'planned'] }, 1, 0] }
        },
        overdueAudits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', 'completed'] },
                  { $ne: ['$status', 'cancelled'] },
                  { $gt: [new Date(), '$plannedEndDate'] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalFindings: { $sum: '$totalFindings' },
        criticalFindings: { $sum: '$criticalFindings' },
        highFindings: { $sum: '$highFindings' },
        mediumFindings: { $sum: '$mediumFindings' },
        lowFindings: { $sum: '$lowFindings' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalAudits: 0,
    completedAudits: 0,
    inProgressAudits: 0,
    plannedAudits: 0,
    overdueAudits: 0,
    totalFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0
  };
};

module.exports = mongoose.model('Audit', auditSchema);
