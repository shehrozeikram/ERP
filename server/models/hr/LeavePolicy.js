const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Policy name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Policy name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  // Leave allocation rules
  leaveAllocation: {
    annual: {
      days: {
        type: Number,
        default: 14,
        min: [0, 'Annual leave days cannot be negative']
      },
      accrualMethod: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'on_joining'],
        default: 'yearly'
      },
      carryForward: {
        allowed: {
          type: Boolean,
          default: false
        },
        maxDays: {
          type: Number,
          default: 0,
          min: [0, 'Max carry forward days cannot be negative']
        },
        expiryMonths: {
          type: Number,
          default: 12,
          min: [1, 'Expiry months must be at least 1']
        }
      }
    },
    casual: {
      days: {
        type: Number,
        default: 10,
        min: [0, 'Casual leave days cannot be negative']
      },
      accrualMethod: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'on_joining'],
        default: 'yearly'
      },
      carryForward: {
        allowed: {
          type: Boolean,
          default: false
        },
        maxDays: {
          type: Number,
          default: 0,
          min: [0, 'Max carry forward days cannot be negative']
        }
      }
    },
    medical: {
      days: {
        type: Number,
        default: 8,
        min: [0, 'Medical leave days cannot be negative']
      },
      accrualMethod: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'on_joining'],
        default: 'yearly'
      },
      carryForward: {
        allowed: {
          type: Boolean,
          default: false
        },
        maxDays: {
          type: Number,
          default: 0,
          min: [0, 'Max carry forward days cannot be negative']
        }
      },
      requiresCertificate: {
        type: Boolean,
        default: true
      },
      certificateRequiredAfterDays: {
        type: Number,
        default: 3,
        min: [1, 'Certificate required after days must be at least 1']
      }
    }
  },
  // Probation period rules
  probationRules: {
    duration: {
      type: Number,
      default: 3,
      min: [0, 'Probation duration cannot be negative'],
      max: [24, 'Probation duration cannot exceed 24 months']
    },
    leaveEligibility: {
      type: String,
      enum: ['no_leave', 'reduced_leave', 'full_leave'],
      default: 'reduced_leave'
    },
    reducedLeavePercentage: {
      type: Number,
      default: 50,
      min: [0, 'Reduced leave percentage cannot be negative'],
      max: [100, 'Reduced leave percentage cannot exceed 100']
    }
  },
  // Leave application rules
  applicationRules: {
    advanceNoticeDays: {
      type: Number,
      default: 1,
      min: [0, 'Advance notice days cannot be negative']
    },
    emergencyLeaveAllowed: {
      type: Boolean,
      default: true
    },
    maxConsecutiveDays: {
      type: Number,
      default: 30,
      min: [1, 'Max consecutive days must be at least 1']
    },
    maxLeaveDaysPerMonth: {
      type: Number,
      default: 5,
      min: [1, 'Max leave days per month must be at least 1']
    },
    requireManagerApproval: {
      type: Boolean,
      default: true
    },
    requireHRApproval: {
      type: Boolean,
      default: false
    },
    autoApproveDays: {
      type: Number,
      default: 0,
      min: [0, 'Auto approve days cannot be negative']
    }
  },
  // Working days calculation
  workingDays: {
    daysPerWeek: {
      type: Number,
      default: 6,
      min: [1, 'Days per week must be at least 1'],
      max: [7, 'Days per week cannot exceed 7']
    },
    workingDaysPerMonth: {
      type: Number,
      default: 26,
      min: [1, 'Working days per month must be at least 1'],
      max: [31, 'Working days per month cannot exceed 31']
    },
    excludeWeekends: {
      type: Boolean,
      default: true
    },
    excludeHolidays: {
      type: Boolean,
      default: true
    }
  },
  // Holiday calendar
  holidays: [{
    name: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['national', 'religious', 'company'],
      default: 'national'
    },
    isRecurring: {
      type: Boolean,
      default: false
    }
  }],
  // Effective dates
  effectiveFrom: {
    type: Date,
    required: [true, 'Effective from date is required']
  },
  effectiveTo: {
    type: Date,
    default: null
  },
  // Applicable to
  applicableTo: {
    employmentTypes: [{
      type: String,
      enum: ['permanent', 'contract', 'probation', 'intern']
    }],
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }],
    designations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation'
    }]
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
leavePolicySchema.index({ name: 1 });
leavePolicySchema.index({ effectiveFrom: 1, effectiveTo: 1 });
leavePolicySchema.index({ isActive: 1 });
leavePolicySchema.index({ isDefault: 1 });

// Static method to get active policy for a given date
leavePolicySchema.statics.getActivePolicy = async function(date = new Date()) {
  return this.findOne({
    isActive: true,
    effectiveFrom: { $lte: date },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: date } }
    ]
  }).sort({ effectiveFrom: -1 });
};

// Static method to get default policy
leavePolicySchema.statics.getDefaultPolicy = async function() {
  return this.findOne({
    isActive: true,
    isDefault: true
  });
};

// Instance method to check if policy applies to employee
leavePolicySchema.methods.appliesToEmployee = function(employee) {
  // Check employment type
  if (this.applicableTo.employmentTypes.length > 0) {
    if (!this.applicableTo.employmentTypes.includes(employee.employmentStatus)) {
      return false;
    }
  }
  
  // Check department
  if (this.applicableTo.departments.length > 0) {
    if (!this.applicableTo.departments.includes(employee.department)) {
      return false;
    }
  }
  
  // Check designation
  if (this.applicableTo.designations.length > 0) {
    if (!this.applicableTo.designations.includes(employee.position)) {
      return false;
    }
  }
  
  return true;
};

// Instance method to calculate leave allocation for employee
leavePolicySchema.methods.calculateLeaveAllocation = function(employee, year) {
  const allocation = {
    annual: 0,
    casual: 0,
    medical: 0
  };
  
  // Check if employee is on probation
  const isOnProbation = this.isEmployeeOnProbation(employee, year);
  
  if (isOnProbation && this.probationRules.leaveEligibility === 'no_leave') {
    return allocation;
  }
  
  // Calculate annual leave
  allocation.annual = this.leaveAllocation.annual.days;
  if (isOnProbation && this.probationRules.leaveEligibility === 'reduced_leave') {
    allocation.annual = Math.floor(allocation.annual * this.probationRules.reducedLeavePercentage / 100);
  }
  
  // Calculate casual leave
  allocation.casual = this.leaveAllocation.casual.days;
  if (isOnProbation && this.probationRules.leaveEligibility === 'reduced_leave') {
    allocation.casual = Math.floor(allocation.casual * this.probationRules.reducedLeavePercentage / 100);
  }
  
  // Calculate medical leave
  allocation.medical = this.leaveAllocation.medical.days;
  if (isOnProbation && this.probationRules.leaveEligibility === 'reduced_leave') {
    allocation.medical = Math.floor(allocation.medical * this.probationRules.reducedLeavePercentage / 100);
  }
  
  return allocation;
};

// Helper method to check if employee is on probation
leavePolicySchema.methods.isEmployeeOnProbation = function(employee, year) {
  if (!employee.appointmentDate) return false;
  
  const appointmentDate = new Date(employee.appointmentDate);
  const probationEndDate = new Date(appointmentDate);
  probationEndDate.setMonth(probationEndDate.getMonth() + this.probationRules.duration);
  
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  return probationEndDate >= yearStart && appointmentDate <= yearEnd;
};

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);

