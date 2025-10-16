const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year must be 2020 or later'],
    max: [2100, 'Year must be before 2100']
  },
  // Leave type balances
  annual: {
    allocated: {
      type: Number,
      default: 20,
      min: [0, 'Allocated leaves cannot be negative']
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'Used leaves cannot be negative']
    },
    remaining: {
      type: Number,
      default: 20,
      min: [0, 'Remaining leaves cannot be negative']
    },
    carriedForward: {
      type: Number,
      default: 0,
      min: [0, 'Carried forward leaves cannot be negative']
    },
    advance: {
      type: Number,
      default: 0,
      min: [0, 'Advance leaves cannot be negative']
    }
  },
  sick: {
    allocated: {
      type: Number,
      default: 10,
      min: [0, 'Allocated leaves cannot be negative']
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'Used leaves cannot be negative']
    },
    remaining: {
      type: Number,
      default: 10,
      min: [0, 'Remaining leaves cannot be negative']
    },
    carriedForward: {
      type: Number,
      default: 0,
      min: [0, 'Carried forward leaves cannot be negative']
    },
    advance: {
      type: Number,
      default: 0,
      min: [0, 'Advance leaves cannot be negative']
    }
  },
  casual: {
    allocated: {
      type: Number,
      default: 10,
      min: [0, 'Allocated leaves cannot be negative']
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'Used leaves cannot be negative']
    },
    remaining: {
      type: Number,
      default: 10,
      min: [0, 'Remaining leaves cannot be negative']
    },
    carriedForward: {
      type: Number,
      default: 0,
      min: [0, 'Carried forward leaves cannot be negative']
    },
    advance: {
      type: Number,
      default: 0,
      min: [0, 'Advance leaves cannot be negative']
    }
  },
  // Total advance leaves across all types
  totalAdvanceLeaves: {
    type: Number,
    default: 0,
    min: [0, 'Total advance leaves cannot be negative']
  },
  // Last update timestamp
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });
leaveBalanceSchema.index({ year: 1 });
leaveBalanceSchema.index({ employee: 1 });

// Pre-save middleware to calculate remaining and advance leaves
leaveBalanceSchema.pre('save', function(next) {
  // Calculate remaining and advance for annual leaves
  const annualRemaining = this.annual.allocated + this.annual.carriedForward - this.annual.used;
  if (annualRemaining >= 0) {
    this.annual.remaining = annualRemaining;
    this.annual.advance = 0;
  } else {
    this.annual.remaining = 0;
    this.annual.advance = Math.abs(annualRemaining);
  }

  // Calculate remaining and advance for sick leaves
  const sickRemaining = this.sick.allocated + this.sick.carriedForward - this.sick.used;
  if (sickRemaining >= 0) {
    this.sick.remaining = sickRemaining;
    this.sick.advance = 0;
  } else {
    this.sick.remaining = 0;
    this.sick.advance = Math.abs(sickRemaining);
  }

  // Calculate remaining and advance for casual leaves
  const casualRemaining = this.casual.allocated + this.casual.carriedForward - this.casual.used;
  if (casualRemaining >= 0) {
    this.casual.remaining = casualRemaining;
    this.casual.advance = 0;
  } else {
    this.casual.remaining = 0;
    this.casual.advance = Math.abs(casualRemaining);
  }

  // Calculate total advance leaves
  this.totalAdvanceLeaves = this.annual.advance + this.sick.advance + this.casual.advance;

  next();
});

// Static method to get or create leave balance for employee
leaveBalanceSchema.statics.getOrCreateBalance = async function(employeeId, year) {
  let balance = await this.findOne({ employee: employeeId, year });
  
  if (!balance) {
    // Get employee to fetch their leave configuration
    const Employee = mongoose.model('Employee');
    const employee = await Employee.findById(employeeId);
    
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Create new balance with employee's configured limits
    balance = new this({
      employee: employeeId,
      year,
      annual: {
        allocated: employee.leaveConfig?.annualLimit || 20,
        used: 0,
        remaining: employee.leaveConfig?.annualLimit || 20,
        carriedForward: 0,
        advance: 0
      },
      sick: {
        allocated: employee.leaveConfig?.sickLimit || 10,
        used: 0,
        remaining: employee.leaveConfig?.sickLimit || 10,
        carriedForward: 0,
        advance: 0
      },
      casual: {
        allocated: employee.leaveConfig?.casualLimit || 10,
        used: 0,
        remaining: employee.leaveConfig?.casualLimit || 10,
        carriedForward: 0,
        advance: 0
      }
    });

    await balance.save();
  }

  return balance;
};

// Static method to update leave balance when leave is approved
leaveBalanceSchema.statics.updateBalanceForLeave = async function(employeeId, leaveType, days, year) {
  const balance = await this.getOrCreateBalance(employeeId, year);
  
  // Map leave type to balance field (handle various code formats)
  const typeMap = {
    'ANNUAL': 'annual',
    'AL': 'annual',
    'annual': 'annual',
    'SICK': 'sick',
    'SL': 'sick',
    'sick': 'sick',
    'CASUAL': 'casual',
    'CL': 'casual',
    'casual': 'casual',
    'MEDICAL': 'sick',  // Medical maps to sick
    'ML': 'sick',
    'medical': 'sick'
  };

  const balanceType = typeMap[leaveType] || typeMap[leaveType.toUpperCase()] || 'casual';
  
  // Update used days
  balance[balanceType].used += days;
  
  await balance.save();
  
  return balance;
};

// Instance method to calculate advance leave deduction
leaveBalanceSchema.methods.calculateAdvanceDeduction = function(dailyRate) {
  if (!this.totalAdvanceLeaves || this.totalAdvanceLeaves === 0) {
    return 0;
  }

  return this.totalAdvanceLeaves * dailyRate;
};

// Instance method to get summary
leaveBalanceSchema.methods.getSummary = function() {
  return {
    annual: {
      allocated: this.annual.allocated,
      used: this.annual.used,
      remaining: this.annual.remaining,
      carriedForward: this.annual.carriedForward,
      advance: this.annual.advance
    },
    sick: {
      allocated: this.sick.allocated,
      used: this.sick.used,
      remaining: this.sick.remaining,
      carriedForward: this.sick.carriedForward,
      advance: this.sick.advance
    },
    casual: {
      allocated: this.casual.allocated,
      used: this.casual.used,
      remaining: this.casual.remaining,
      carriedForward: this.casual.carriedForward,
      advance: this.casual.advance
    },
    totalAdvanceLeaves: this.totalAdvanceLeaves
  };
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);

