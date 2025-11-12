const mongoose = require('mongoose');

/**
 * Annual Leave Balance Model
 * 
 * This model implements the annual leave policy:
 * - Each employee earns 20 annual leaves per completed year
 * - First allocation occurs exactly one year after hire date
 * - Total annual leaves cannot exceed 40 (including carry forward)
 * - Uses oldest-first rule for leave deduction
 * - Maintains separate buckets for each year's allocation
 */
const annualLeaveBalanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required'],
    index: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year must be 2020 or later'],
    max: [2100, 'Year must be before 2100'],
    index: true
  },
  allocated: {
    type: Number,
    required: [true, 'Allocated leaves is required'],
    default: 0,
    min: [0, 'Allocated leaves cannot be negative'],
    max: [20, 'Allocated leaves cannot exceed 20 per year']
  },
  used: {
    type: Number,
    required: [true, 'Used leaves is required'],
    default: 0,
    min: [0, 'Used leaves cannot be negative']
  },
  remaining: {
    type: Number,
    required: [true, 'Remaining leaves is required'],
    default: 0,
    min: [0, 'Remaining leaves cannot be negative']
  },
  carryForward: {
    type: Number,
    required: [true, 'Carry forward leaves is required'],
    default: 0,
    min: [0, 'Carry forward leaves cannot be negative']
  },
  total: {
    type: Number,
    required: [true, 'Total leaves is required'],
    default: 0,
    min: [0, 'Total leaves cannot be negative'],
    max: [40, 'Total leaves cannot exceed 40']
  },
  // Metadata
  anniversaryDate: {
    type: Date,
    required: [true, 'Anniversary date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
annualLeaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });
annualLeaveBalanceSchema.index({ employeeId: 1, anniversaryDate: 1 });

// Pre-save middleware to calculate remaining and total
annualLeaveBalanceSchema.pre('save', function(next) {
  // Calculate remaining leaves
  this.remaining = Math.max(0, this.allocated + this.carryForward - this.used);
  
  // Calculate total leaves (allocated + carry forward)
  this.total = this.allocated + this.carryForward;
  
  // Update timestamp
  this.updatedAt = new Date();
  
  next();
});

// Static method to get or create balance for an employee and year
annualLeaveBalanceSchema.statics.getOrCreateBalance = async function(employeeId, year) {
  try {
    let balance = await this.findOne({ employeeId, year });
    
    if (!balance) {
      // Get employee to calculate anniversary date
      const Employee = mongoose.model('Employee');
      const employee = await Employee.findById(employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      // Calculate anniversary date for this year
      const anniversaryDate = new Date(employee.hireDate);
      anniversaryDate.setFullYear(year);
      
      // Check if employee is eligible for leaves this year
      const hireYear = employee.hireDate.getFullYear();
      const yearsCompleted = year - hireYear;
      
      if (yearsCompleted < 1) {
        // Employee hasn't completed one year yet
        balance = new this({
          employeeId,
          year,
          allocated: 0,
          used: 0,
          remaining: 0,
          carryForward: 0,
          total: 0,
          anniversaryDate
        });
      } else {
        // Employee is eligible for 20 annual leaves
        balance = new this({
          employeeId,
          year,
          allocated: 20,
          used: 0,
          remaining: 20,
          carryForward: 0,
          total: 20,
          anniversaryDate
        });
      }
      
      await balance.save();
    }
    
    return balance;
  } catch (error) {
    throw error;
  }
};

// Static method to get all balances for an employee (for carry forward calculation)
annualLeaveBalanceSchema.statics.getEmployeeBalances = async function(employeeId) {
  return await this.find({ employeeId, isActive: true })
    .sort({ year: 1 });
};

// Static method to calculate total leaves across all years
annualLeaveBalanceSchema.statics.getTotalLeaves = async function(employeeId) {
  const balances = await this.getEmployeeBalances(employeeId);
  return balances.reduce((total, balance) => total + balance.total, 0);
};

// Static method to apply 40-leave cap by removing oldest buckets
annualLeaveBalanceSchema.statics.applyFortyLeaveCap = async function(employeeId) {
  const balances = await this.getEmployeeBalances(employeeId);
  const totalLeaves = balances.reduce((total, balance) => total + balance.total, 0);
  
  if (totalLeaves <= 40) {
    return balances; // No cap needed
  }
  
  // Sort balances by year (oldest first)
  balances.sort((a, b) => a.year - b.year);
  
  let leavesToRemove = totalLeaves - 40;
  const updatedBalances = [];
  
  // Remove leaves starting from oldest buckets
  for (const balance of balances) {
    if (leavesToRemove <= 0) {
      updatedBalances.push(balance);
      continue;
    }
    
    if (balance.total > 0) {
      const removeFromThisBucket = Math.min(leavesToRemove, balance.total);
      
      // Reduce carry forward first, then allocated
      if (balance.carryForward > 0) {
        const removeFromCarryForward = Math.min(removeFromThisBucket, balance.carryForward);
        balance.carryForward -= removeFromCarryForward;
        leavesToRemove -= removeFromCarryForward;
      }
      
      if (leavesToRemove > 0 && balance.allocated > 0) {
        const removeFromAllocated = Math.min(leavesToRemove, balance.allocated);
        balance.allocated -= removeFromAllocated;
        leavesToRemove -= removeFromAllocated;
      }
      
      await balance.save();
    }
    
    updatedBalances.push(balance);
  }
  
  return updatedBalances;
};

// Instance method to deduct leaves using oldest-first rule
annualLeaveBalanceSchema.methods.deductLeaves = async function(daysToDeduct) {
  if (daysToDeduct <= 0) {
    return { success: true, deducted: 0, remaining: this.remaining };
  }
  
  if (this.remaining < daysToDeduct) {
    return { 
      success: false, 
      deducted: this.remaining, 
      remaining: 0,
      error: `Insufficient leaves. Available: ${this.remaining}, Requested: ${daysToDeduct}`
    };
  }
  
  // Deduct from carry forward first, then allocated
  // Note: allocated field should never be reduced, only used should increment
  let remainingToDeduct = daysToDeduct;
  
  if (this.carryForward > 0) {
    const deductFromCarryForward = Math.min(remainingToDeduct, this.carryForward);
    this.carryForward -= deductFromCarryForward;
    remainingToDeduct -= deductFromCarryForward;
  }
  
  // Deduct remaining from allocated (don't reduce allocated, just track usage)
  if (remainingToDeduct > 0 && this.allocated > 0) {
    const deductFromAllocated = Math.min(remainingToDeduct, this.allocated);
    // Don't reduce allocated - only increase used
    remainingToDeduct -= deductFromAllocated;
  }
  
  this.used += daysToDeduct;
  await this.save();
  
  return { 
    success: true, 
    deducted: daysToDeduct, 
    remaining: this.remaining 
  };
};

// Instance method to get balance summary
annualLeaveBalanceSchema.methods.getSummary = function() {
  return {
    year: this.year,
    allocated: this.allocated,
    used: this.used,
    remaining: this.remaining,
    carryForward: this.carryForward,
    total: this.total,
    anniversaryDate: this.anniversaryDate
  };
};

module.exports = mongoose.model('AnnualLeaveBalance', annualLeaveBalanceSchema);
