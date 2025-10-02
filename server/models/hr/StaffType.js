const mongoose = require('mongoose');

const staffTypeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [2, 'Code must be at least 2 characters'],
    maxlength: [20, 'Code cannot exceed 20 characters']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  icon: {
    type: String,
    default: 'person',
    trim: true
  },
  color: {
    type: String,
    default: '#1976d2',
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color']
  },
  // Assignment configuration
  assignmentTargets: [{
    type: {
      type: String,
      required: true,
      enum: ['location', 'department', 'vehicle', 'project', 'route', 'custom'],
      lowercase: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    model: {
      type: String,
      required: function() {
        return ['location', 'department', 'vehicle', 'project'].includes(this.type);
      },
      enum: ['Location', 'Department', 'Vehicle', 'Project']
    },
    required: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    }
  }],
  // Default shift configuration
  defaultShift: {
    startTime: { type: String, default: '09:00' }, // HH:MM format
    endTime: { type: String, default: '17:00' },
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    hoursPerDay: { type: Number, default: 8, min: 1, max: 24 }
  },
  // Skill sets required for this staff type
  requiredSkills: [{
    type: String,
    trim: true
  }],
  // Status management
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  // Metadata
  isSystemGenerated: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
staffTypeSchema.index({ code: 1, status: 1 });
staffTypeSchema.index({ name: 1, status: 1 });
staffTypeSchema.index({ 'assignmentTargets.type': 1 });

// Virtual for displayName
staffTypeSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// Virtual for assignment summary
staffTypeSchema.virtual('assignmentSummary').get(function() {
  const targets = this.assignmentTargets || [];
  if (targets.length === 0) return 'No assignments';
  
  const types = targets.map(target => target.label).join(', ');
  return `Can be assigned to: ${types}`;
});

// Method to get assignment configurations
staffTypeSchema.methods.getAssignmentConfig = function() {
  return this.assignmentTargets.reduce((config, target) => {
    config[target.type] = {
      label: target.label,
      model: target.model,
      required: target.required,
      priority: target.priority
    };
    return config;
  }, {});
};

// Method to validate assignment data
staffTypeSchema.methods.validateAssignment = function(assignmentData) {
  const errors = [];
  const config = this.getAssignmentConfig();
  
  Object.entries(config).forEach(([type, configItem]) => {
    const field = `${type}Id`;
    if (configItem.required && !assignmentData[field]) {
      errors.push(`${configItem.label} is required for ${this.name} assignments`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Static method to get types by assignment target
staffTypeSchema.statics.getTypesByTarget = function(targetType) {
  return this.find({
    status: 'Active',
    'assignmentTargets.type': targetType
  }).select('code name icon color assignmentTargets');
};

// Static method to populate assignment targets
staffTypeSchema.statics.withTargetDetails = function(query = {}) {
  return this.find(query).populate({
    path: 'assignmentTargets.model',
    select: '_id name code',
    match: { status: 'Active' }
  });
};

// Pre-save middleware to update lastModifiedBy
staffTypeSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy = this.lastModifiedBy || this.createdBy;
  }
  next();
});

module.exports = mongoose.model('StaffType', staffTypeSchema);
