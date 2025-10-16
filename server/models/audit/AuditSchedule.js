const mongoose = require('mongoose');

const auditScheduleSchema = new mongoose.Schema({
  // Basic Information
  scheduleName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Schedule name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Schedule Configuration
  scheduleType: {
    type: String,
    required: true,
    enum: ['annual', 'quarterly', 'monthly', 'weekly', 'ad_hoc'],
    default: 'annual',
    index: true
  },
  frequency: {
    type: Number,
    required: true,
    min: 1,
    default: 1 // Number of times per period
  },
  period: {
    type: String,
    required: true,
    enum: ['year', 'quarter', 'month', 'week', 'day'],
    default: 'year'
  },
  
  // Audit Configuration
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
  
  // Scope and Coverage
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  }],
  includeAllDepartments: {
    type: Boolean,
    default: false
  },
  
  // Timing Configuration
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: Date, // For recurring schedules, this might be null
  duration: {
    type: Number,
    required: true,
    min: 1,
    default: 30 // Duration in days
  },
  
  // Recurrence Pattern
  recurrencePattern: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly', 'quarterly', 'annually'],
    default: 'none'
  },
  recurrenceInterval: {
    type: Number,
    min: 1,
    default: 1 // Every X periods
  },
  recurrenceDays: [Number], // Days of week (0-6) for weekly recurrence
  recurrenceDayOfMonth: Number, // Day of month for monthly recurrence
  recurrenceMonth: Number, // Month (0-11) for annual recurrence
  
  // Assignment Configuration
  defaultLeadAuditor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  defaultAuditTeam: [{
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
  
  // Checklist Configuration
  defaultChecklist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditChecklist'
  },
  
  // Notification Settings
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    reminderDays: [Number], // Days before audit to send reminders (e.g., [30, 7, 1])
    notifyLeadAuditor: {
      type: Boolean,
      default: true
    },
    notifyAuditTeam: {
      type: Boolean,
      default: true
    },
    notifyDepartmentHeads: {
      type: Boolean,
      default: true
    },
    notifyManagement: {
      type: Boolean,
      default: false
    }
  },
  
  // Status and Control
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Generated Audits
  generatedAudits: [{
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit',
      required: true
    },
    scheduledDate: Date,
    actualDate: Date,
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled']
    }
  }],
  
  // Statistics
  totalScheduled: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCompleted: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCancelled: {
    type: Number,
    default: 0,
    min: 0
  },
  completionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Next Scheduled Audit
  nextScheduledDate: Date,
  nextAuditId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Audit'
  },
  
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
auditScheduleSchema.index({ scheduleType: 1, status: 1 });
auditScheduleSchema.index({ auditType: 1, module: 1, isActive: 1 });
auditScheduleSchema.index({ startDate: 1, endDate: 1 });
auditScheduleSchema.index({ nextScheduledDate: 1 });
auditScheduleSchema.index({ createdAt: -1 });

// Virtual for next audit due
auditScheduleSchema.virtual('nextAuditDue').get(function() {
  if (!this.nextScheduledDate) return null;
  const now = new Date();
  return this.nextScheduledDate <= now;
});

// Virtual for days until next audit
auditScheduleSchema.virtual('daysUntilNextAudit').get(function() {
  if (!this.nextScheduledDate) return null;
  const now = new Date();
  const diffTime = this.nextScheduledDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to calculate next scheduled date
auditScheduleSchema.methods.calculateNextScheduledDate = function(fromDate = null) {
  if (this.recurrencePattern === 'none') {
    return null;
  }
  
  const baseDate = fromDate || this.startDate;
  let nextDate = new Date(baseDate);
  
  switch (this.recurrencePattern) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + this.recurrenceInterval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (7 * this.recurrenceInterval));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + this.recurrenceInterval);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + (3 * this.recurrenceInterval));
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + this.recurrenceInterval);
      break;
  }
  
  return nextDate;
};

// Method to generate next audit
auditScheduleSchema.methods.generateNextAudit = async function() {
  if (this.recurrencePattern === 'none' && this.generatedAudits.length > 0) {
    return null; // No more audits to generate
  }
  
  const nextDate = this.calculateNextScheduledDate();
  if (!nextDate) return null;
  
  // Create audit based on schedule configuration
  const Audit = mongoose.model('Audit');
  
  const auditData = {
    title: `${this.scheduleName} - ${nextDate.toLocaleDateString()}`,
    description: this.description,
    auditType: this.auditType,
    category: `${this.module} - ${this.auditType}`,
    module: this.module,
    department: this.departments[0], // Use first department as primary
    plannedStartDate: nextDate,
    plannedEndDate: new Date(nextDate.getTime() + (this.duration * 24 * 60 * 60 * 1000)),
    leadAuditor: this.defaultLeadAuditor,
    auditTeam: this.defaultAuditTeam,
    riskLevel: 'medium',
    createdBy: this.createdBy,
    status: 'planned'
  };
  
  const audit = new Audit(auditData);
  await audit.save();
  
  // Update schedule with generated audit
  this.generatedAudits.push({
    audit: audit._id,
    scheduledDate: nextDate,
    status: 'scheduled'
  });
  
  this.nextScheduledDate = this.calculateNextScheduledDate(nextDate);
  this.totalScheduled += 1;
  
  await this.save();
  
  return audit;
};

// Method to update completion statistics
auditScheduleSchema.methods.updateStatistics = async function() {
  const Audit = mongoose.model('Audit');
  
  let completedCount = 0;
  let cancelledCount = 0;
  
  for (const generatedAudit of this.generatedAudits) {
    const audit = await Audit.findById(generatedAudit.audit);
    if (audit) {
      if (audit.status === 'completed') {
        completedCount++;
      } else if (audit.status === 'cancelled') {
        cancelledCount++;
      }
      
      // Update generated audit status
      generatedAudit.status = audit.status;
      if (audit.actualStartDate) {
        generatedAudit.actualDate = audit.actualStartDate;
      }
    }
  }
  
  this.totalCompleted = completedCount;
  this.totalCancelled = cancelledCount;
  this.completionRate = this.totalScheduled > 0 ? 
    Math.round((completedCount / this.totalScheduled) * 100) : 0;
  
  await this.save();
};

// Static method to get schedules needing audit generation
auditScheduleSchema.statics.getSchedulesForGeneration = async function() {
  const now = new Date();
  
  return await this.find({
    isActive: true,
    status: 'active',
    $or: [
      { nextScheduledDate: { $lte: now } },
      { nextScheduledDate: { $exists: false } }
    ]
  }).populate('defaultLeadAuditor defaultAuditTeam.user departments');
};

// Static method to get schedule statistics
auditScheduleSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        totalSchedules: { $sum: 1 },
        activeSchedules: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        pausedSchedules: {
          $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] }
        },
        totalScheduledAudits: { $sum: '$totalScheduled' },
        totalCompletedAudits: { $sum: '$totalCompleted' },
        totalCancelledAudits: { $sum: '$totalCancelled' },
        averageCompletionRate: { $avg: '$completionRate' },
        overdueSchedules: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'active'] },
                  { $lte: ['$nextScheduledDate', new Date()] }
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
    totalSchedules: 0,
    activeSchedules: 0,
    pausedSchedules: 0,
    totalScheduledAudits: 0,
    totalCompletedAudits: 0,
    totalCancelledAudits: 0,
    averageCompletionRate: 0,
    overdueSchedules: 0
  };
};

// Pre-save middleware to validate schedule configuration
auditScheduleSchema.pre('save', function(next) {
  // Validate date ranges
  if (this.endDate && this.startDate >= this.endDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Validate recurrence configuration
  if (this.recurrencePattern !== 'none') {
    if (!this.recurrenceInterval || this.recurrenceInterval < 1) {
      return next(new Error('Recurrence interval must be at least 1'));
    }
  }
  
  // Validate departments
  if (!this.includeAllDepartments && (!this.departments || this.departments.length === 0)) {
    return next(new Error('At least one department must be specified'));
  }
  
  next();
});

module.exports = mongoose.model('AuditSchedule', auditScheduleSchema);
