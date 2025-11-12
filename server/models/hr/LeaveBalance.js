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
    min: [0, 'Work year must be 0 or later'],
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
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });
leaveBalanceSchema.index({ year: 1 });
leaveBalanceSchema.index({ employee: 1 });
leaveBalanceSchema.index({ expirationDate: 1 });

// Pre-save middleware to calculate remaining and advance leaves
leaveBalanceSchema.pre('save', function(next) {
  // Calculate remaining and advance for annual leaves
  // Use allocated days first, then carry forward
  let annualUsed = this.annual.used;
  let annualCarriedForward = this.annual.carriedForward;
  let annualAllocated = this.annual.allocated;
  
  // Use allocated days first
  let annualAllocatedUsed = 0;
  if (annualUsed > 0) {
    annualAllocatedUsed = Math.min(annualUsed, annualAllocated);
    annualUsed -= annualAllocatedUsed;
  }
  
  // Use carry forward only if allocated days are exhausted
  let annualCarriedForwardUsed = 0;
  if (annualUsed > 0 && annualCarriedForward > 0) {
    annualCarriedForwardUsed = Math.min(annualUsed, annualCarriedForward);
    annualUsed -= annualCarriedForwardUsed;
  }
  
  // Calculate total available (allocated + carry forward)
  // Note: The 40-day cap is now enforced during carry forward calculation,
  // not here. This middleware only calculates remaining based on what's provided.
  let totalAnnualAvailable = annualAllocated + annualCarriedForward;
  
  // Calculate remaining: total available minus used
  const totalUsed = annualAllocatedUsed + annualCarriedForwardUsed;
  this.annual.remaining = Math.max(0, totalAnnualAvailable - totalUsed);
  this.annual.advance = annualUsed; // Anything left is advance

  // Calculate remaining and advance for sick leaves
  let sickUsed = this.sick.used;
  let sickCarriedForward = this.sick.carriedForward; // Keep original value
  let sickAllocated = this.sick.allocated;
  
  // Use allocated days first
  let sickAllocatedUsed = 0;
  if (sickUsed > 0) {
    sickAllocatedUsed = Math.min(sickUsed, sickAllocated);
    sickUsed -= sickAllocatedUsed;
  }
  
  // Use carry forward only if allocated days are exhausted
  let sickCarriedForwardUsed = 0;
  if (sickUsed > 0 && sickCarriedForward > 0) {
    sickCarriedForwardUsed = Math.min(sickUsed, sickCarriedForward);
    sickUsed -= sickCarriedForwardUsed;
  }
  
  // Calculate remaining and advance WITHOUT modifying carriedForward
  this.sick.remaining = Math.max(0, sickCarriedForward + sickAllocated - sickAllocatedUsed - sickCarriedForwardUsed);
  this.sick.advance = sickUsed; // Anything left is advance

  // Calculate remaining and advance for casual leaves
  let casualUsed = this.casual.used;
  let casualCarriedForward = this.casual.carriedForward; // Keep original value
  let casualAllocated = this.casual.allocated;
  
  // Use allocated days first
  let casualAllocatedUsed = 0;
  if (casualUsed > 0) {
    casualAllocatedUsed = Math.min(casualUsed, casualAllocated);
    casualUsed -= casualAllocatedUsed;
  }
  
  // Use carry forward only if allocated days are exhausted
  let casualCarriedForwardUsed = 0;
  if (casualUsed > 0 && casualCarriedForward > 0) {
    casualCarriedForwardUsed = Math.min(casualUsed, casualCarriedForward);
    casualUsed -= casualCarriedForwardUsed;
  }
  
  // Calculate remaining and advance WITHOUT modifying carriedForward
  this.casual.remaining = Math.max(0, casualCarriedForward + casualAllocated - casualAllocatedUsed - casualCarriedForwardUsed);
  this.casual.advance = casualUsed; // Anything left is advance

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

    try {
      await balance.save();
    } catch (error) {
      // Handle duplicate key error
      if (error.code === 11000) {
        // Try to find the existing record
        balance = await this.findOne({ employee: employeeId, year });
        if (!balance) {
          throw error; // Re-throw if we still can't find it
        }
      } else {
        throw error;
      }
    }
  } else {
    // If balance exists but workYear is missing, calculate and update it
    if (!balance.workYear) {
      const Employee = mongoose.model('Employee');
      const employee = await Employee.findById(employeeId);
      
      if (employee) {
        balance.workYear = this.calculateWorkYear(employee.hireDate, new Date(year, 0, 1));
        await balance.save();
      }
    }
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
  
  // Annual leaves: Only after completing 1 year (workYear >= 1)
  const annualAllocation = workYear >= 1 ? (config.annualLimit || 20) : 0;
  
  // Sick and Casual leaves: Available from first year (workYear >= 0)
  const sickAllocation = workYear >= 0 ? (config.sickLimit || 10) : 0;
  const casualAllocation = workYear >= 0 ? (config.casualLimit || 10) : 0;
  
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

// Static method to get or create leave balance for employee with automatic carry forward
leaveBalanceSchema.statics.getOrCreateBalanceWithCarryForward = async function(employeeId, workYear) {
  const CarryForwardService = require('../../services/carryForwardService');
  return await CarryForwardService.getOrCreateBalanceWithCarryForward(employeeId, workYear);
};

// Static method to recalculate carry forward for employee
leaveBalanceSchema.statics.recalculateCarryForward = async function(employeeId) {
  const CarryForwardService = require('../../services/carryForwardService');
  return await CarryForwardService.recalculateCarryForward(employeeId);
};

// Static method to get carry forward summary for employee
leaveBalanceSchema.statics.getCarryForwardSummary = async function(employeeId) {
  const CarryForwardService = require('../../services/carryForwardService');
  return await CarryForwardService.getCarryForwardSummary(employeeId);
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);

