const mongoose = require('mongoose');

// Generic assignment target schema
const assignmentTargetSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['location', 'department', 'vehicle', 'project', 'route', 'custom'],
    lowercase: true
  },
  model: {
    type: String,
    enum: ['Location', 'Department', 'Vehicle', 'Project']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return this.type !== 'custom';
    }
  },
  customData: {
    type: mongoose.Schema.Types.Mixed,
    required: function() {
      return this.type === 'custom';
    }
  },
  label: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const genericStaffAssignmentSchema = new mongoose.Schema({
  assignmentId: {
    type: String,
    required: true,
    unique: true,
    default: () => `STAFF${Date.now().toString().slice(-6)}`
  },
  
  // Staff information
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // Staff type information
  staffType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StaffType',
    required: true
  },
  
  // Assignment targets - flexible array of targets
  targets: [assignmentTargetSchema],
  
  // Assignment details
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Dates
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(endDate) {
        return !endDate || endDate >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  
  // Status and priority
  status: {
    type: String,
    enum: ['Pending', 'Active', 'Completed', 'Transferred', 'Suspended', 'Cancelled'],
    default: 'Pending'
  },
  
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  
  // Work schedule
  schedule: {
    shiftTimings: {
      startTime: { type: String }, // HH:MM format
      endTime: { type: String },   // HH:MM format
      workingDays: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      }],
      hoursPerDay: { type: Number, min: 1, max: 24 },
      isFlexibleHours: { type: Boolean, default: false }
    },
    workArrangement: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'On-call'],
      default: 'Full-time'
    },
    locationRequirement: {
      type: String,
      enum: ['On-site', 'Remote', 'Hybrid'],
      default: 'On-site'
    }
  },
  
  // Responsibilities and requirements
  responsibilities: [{
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    isCompleted: { type: Boolean, default: false }
  }],
  
  requiredSkills: [{
    type: String,
    trim: true
  }],
  
  // Management structure
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Performance tracking
  performance: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    notes: {
      type: String,
      trim: true
    },
    evaluator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    evaluatedAt: {
      type: Date
    }
  },
  
  // Additional information
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Metadata
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Change tracking
  changeHistory: [{
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changeType: { type: String, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, trim: true }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
genericStaffAssignmentSchema.index({ employee: 1, status: 1 });
genericStaffAssignmentSchema.index({ staffType: 1, status: 1 });
genericStaffAssignmentSchema.index({ assignmentId: 1 });
genericStaffAssignmentSchema.index({ status: 1, priority: 1 });
genericStaffAssignmentSchema.index({ startDate: 1, endDate: 1 });
genericStaffAssignmentSchema.index({ 'targets.type': 1, 'targets.targetId': 1 });
genericStaffAssignmentSchema.index({ tags: 1 });
genericStaffAssignmentSchema.index({ reportingManager: 1 });

// Text index for searching
genericStaffAssignmentSchema.index({
  title: 'text',
  description: 'text',
  notes: 'text',
  tags: 'text'
});

// Virtual fields
genericStaffAssignmentSchema.virtual('duration').get(function() {
  if (!this.endDate) return null;
  const ms = this.endDate.getTime() - this.startDate.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24)); // Days
});

genericStaffAssignmentSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'Active' && 
         this.startDate <= now && 
         (!this.endDate || this.endDate >= now);
});

genericStaffAssignmentSchema.virtual('primaryTarget').get(function() {
  const targets = this.targets || [];
  return targets.find(t => t.type !== 'custom') || targets[0];
});

// Instance methods
genericStaffAssignmentSchema.methods.getTargetSummary = function() {
  if (!this.targets || this.targets.length === 0) {
    return 'No targets assigned';
  }
  
  return this.targets.map(target => target.label).join(', ');
};

genericStaffAssignmentSchema.methods.addChangeEntry = function(changeType, changes, userId, notes) {
  this.changeHistory.push({
    changedBy: userId,
    changeType,
    changes,
    notes: notes || ''
  });
};

genericStaffAssignmentSchema.methods.getResponsibilityProgress = function() {
  const responsibilities = this.responsibilities || [];
  if (responsibilities.length === 0) return 0;
  
  const completed = responsibilities.filter(r => r.isCompleted).length;
  return Math.round((completed / responsibilities.length) * 100);
};

genericStaffAssignmentSchema.methods.validateTargets = async function() {
  const StaffType = mongoose.model('StaffType');
  
  const staffType = await StaffType.findById(this.staffType);
  if (!staffType) {
    throw new Error('Invalid staff type');
  }
  
  const config = staffType.getAssignmentConfig();
  const errors = [];
  
  Object.entries(config).forEach(([type, typeConfig]) => {
    const target = this.targets.find(t => t.type === type);
    if (typeConfig.required && !target) {
      errors.push(`${typeConfig.label} is required for this assignment`);
    }
    if (target && target.model !== typeConfig.model) {
      errors.push(`Invalid model for ${typeConfig.label}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Static methods
genericStaffAssignmentSchema.statics.getActiveByEmployee = function(employeeId) {
  return this.find({
    employee: employeeId,
    status: 'Active'
  }).populate('staffType targets.targetId employee assignedBy');
};

genericStaffAssignmentSchema.statics.getByStaffType = function(staffTypeId, status = 'Active') {
  return this.find({
    staffType: staffTypeId,
    status
  }).populate('employee staffType targets.targetId');
};

genericStaffAssignmentSchema.statics.getByTarget = function(targetType, targetId, status = 'Active') {
  return this.find({
    'targets.type': targetType,
    'targets.targetId': targetId,
    status
  }).populate('employee staffType');
};

// Pre-save middleware
genericStaffAssignmentSchema.pre('save', async function(next) {
  try {
    // Validate targets against staff type
    const validation = await this.validateTargets();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    
    // Update lastModifiedBy
    if (this.isModified() && !this.isNew) {
      // This should be set by the controller/service
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-update middleware for conflict detection
genericStaffAssignmentSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.addChangeEntry = function() {
    // Implementation for update operations
  };
  next();
});

module.exports = mongoose.model('GenericStaffAssignment', genericStaffAssignmentSchema);
