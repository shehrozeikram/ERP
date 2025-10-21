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
  // Anniversary-based fields
  workYear: {
    type: Number,
    required: [true, 'Work year is required'],
    min: [1, 'Work year must be 1 or later'],
    max: [50, 'Work year must be less than 50']
  },
  expirationDate: {
    type: Date,
    required: false
  },
  isCarriedForward: {
    type: Boolean,
    default: false
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
leaveBalanceSchema.index({ employee: 1, workYear: 1 }, { unique: true });
leaveBalanceSchema.index({ year: 1 });
leaveBalanceSchema.index({ employee: 1 });
leaveBalanceSchema.index({ expirationDate: 1 });

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

    // Calculate work year based on hire date
    const workYear = this.calculateWorkYear(employee.hireDate, new Date(year, 0, 1));
    
    // Calculate anniversary-based allocation
    const allocation = this.calculateAnniversaryAllocation(workYear, employee.leaveConfig);
    
    // Set expiration date for annual leaves (2 years from allocation)
    const expirationDate = new Date(year + 2, 11, 31); // End of year + 2 years

    // Create new balance with anniversary-based allocation
    balance = new this({
      employee: employeeId,
      year,
      workYear,
      expirationDate,
      isCarriedForward: false,
      annual: {
        allocated: allocation.annual,
        used: 0,
        remaining: allocation.annual,
        carriedForward: 0,
        advance: 0
      },
      sick: {
        allocated: allocation.sick,
        used: 0,
        remaining: allocation.sick,
        carriedForward: 0,
        advance: 0
      },
      casual: {
        allocated: allocation.casual,
        used: 0,
        remaining: allocation.casual,
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

// Static method to calculate work year based on hire date
leaveBalanceSchema.statics.calculateWorkYear = function(hireDate, currentDate = new Date()) {
  const years = currentDate.getFullYear() - hireDate.getFullYear();
  const months = currentDate.getMonth() - hireDate.getMonth();
  
  if (months < 0 || (months === 0 && currentDate.getDate() < hireDate.getDate())) {
    return years; // Haven't reached anniversary yet
  }
  return years + 1; // Completed this many work years
};

// Static method to calculate anniversary-based leave allocation
leaveBalanceSchema.statics.calculateAnniversaryAllocation = function(workYear, leaveConfig) {
  const config = leaveConfig || {};
  
  // Annual leaves: Only after completing 1 year (workYear >= 2)
  const annualAllocation = workYear >= 2 ? (config.annualLimit || 20) : 0;
  
  // Sick and Casual leaves: Available from first year (workYear >= 1)
  const sickAllocation = workYear >= 1 ? (config.sickLimit || 10) : 0;
  const casualAllocation = workYear >= 1 ? (config.casualLimit || 10) : 0;
  
  return {
    annual: annualAllocation,
    sick: sickAllocation,
    casual: casualAllocation
  };
};

// Static method to process anniversary renewals
leaveBalanceSchema.statics.processAnniversaryRenewal = async function(employeeId, newWorkYear) {
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findById(employeeId);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  const currentYear = new Date().getFullYear();
  const allocation = this.calculateAnniversaryAllocation(newWorkYear, employee.leaveConfig);
  
  // Create new balance for the new work year
  const newBalance = new this({
    employee: employeeId,
    year: currentYear,
    workYear: newWorkYear,
    expirationDate: new Date(currentYear + 2, 11, 31),
    isCarriedForward: false,
    annual: {
      allocated: allocation.annual,
      used: 0,
      remaining: allocation.annual,
      carriedForward: 0,
      advance: 0
    },
    sick: {
      allocated: allocation.sick,
      used: 0,
      remaining: allocation.sick,
      carriedForward: 0,
      advance: 0
    },
    casual: {
      allocated: allocation.casual,
      used: 0,
      remaining: allocation.casual,
      carriedForward: 0,
      advance: 0
    }
  });
  
  await newBalance.save();
  return newBalance;
};

// Static method to expire old annual leaves
leaveBalanceSchema.statics.expireOldAnnualLeaves = async function() {
  const today = new Date();
  
  // Find balances with expired annual leaves
  const expiredBalances = await this.find({
    expirationDate: { $lt: today },
    'annual.remaining': { $gt: 0 }
  });
  
  for (const balance of expiredBalances) {
    // Mark remaining annual leaves as expired
    balance.annual.carriedForward = 0;
    balance.annual.remaining = 0;
    balance.annual.allocated = balance.annual.used; // Adjust allocated to match used
    
    await balance.save();
  }
  
  return expiredBalances.length;
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);

