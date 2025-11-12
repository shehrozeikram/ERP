const mongoose = require('mongoose');

/**
 * Leave Transaction Model
 * 
 * This model logs all leave-related activities including:
 * - Annual leave allocations on anniversary dates
 * - Leave usage/deductions
 * - Carry forward operations
 * - Cap enforcement operations
 */
const leaveTransactionSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required'],
    index: true
  },
  transactionType: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: [
      'ALLOCATION',      // Annual leave allocation on anniversary
      'USAGE',          // Leave usage/deduction
      'CARRY_FORWARD',  // Carry forward operation
      'CAP_ENFORCEMENT', // 40-leave cap enforcement
      'EXPIRY',         // Leave expiry
      'ADJUSTMENT'      // Manual adjustment
    ],
    index: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year must be 2020 or later'],
    max: [2100, 'Year must be before 2100'],
    index: true
  },
  // Transaction details
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  operation: {
    type: String,
    required: [true, 'Operation is required'],
    enum: ['ADD', 'SUBTRACT', 'SET']
  },
  // Balance details before transaction
  balanceBefore: {
    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    carryForward: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  // Balance details after transaction
  balanceAfter: {
    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    carryForward: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  // Additional context
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Reference to related records
  leaveRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    required: false
  },
  leaveBalanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnualLeaveBalance',
    required: false
  },
  // Metadata
  anniversaryDate: {
    type: Date,
    required: false
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
leaveTransactionSchema.index({ employeeId: 1, year: 1 });
leaveTransactionSchema.index({ employeeId: 1, transactionType: 1 });
leaveTransactionSchema.index({ processedAt: 1 });
leaveTransactionSchema.index({ anniversaryDate: 1 });

// Static method to log allocation transaction
leaveTransactionSchema.statics.logAllocation = async function(employeeId, year, amount, anniversaryDate, balanceBefore, balanceAfter) {
  const transaction = new this({
    employeeId,
    transactionType: 'ALLOCATION',
    year,
    amount,
    operation: 'ADD',
    balanceBefore,
    balanceAfter,
    description: `Annual leave allocation of ${amount} days on ${anniversaryDate.toDateString()}`,
    anniversaryDate,
    processedAt: new Date()
  });
  
  await transaction.save();
  return transaction;
};

// Static method to log usage transaction
leaveTransactionSchema.statics.logUsage = async function(employeeId, year, amount, leaveRequestId, balanceBefore, balanceAfter, description) {
  const transaction = new this({
    employeeId,
    transactionType: 'USAGE',
    year,
    amount,
    operation: 'SUBTRACT',
    balanceBefore,
    balanceAfter,
    description: description || `Leave usage of ${amount} days`,
    leaveRequestId,
    processedAt: new Date()
  });
  
  await transaction.save();
  return transaction;
};

// Static method to log carry forward transaction
leaveTransactionSchema.statics.logCarryForward = async function(employeeId, year, amount, balanceBefore, balanceAfter) {
  const transaction = new this({
    employeeId,
    transactionType: 'CARRY_FORWARD',
    year,
    amount,
    operation: 'ADD',
    balanceBefore,
    balanceAfter,
    description: `Carry forward of ${amount} days from previous year`,
    processedAt: new Date()
  });
  
  await transaction.save();
  return transaction;
};

// Static method to log cap enforcement transaction
leaveTransactionSchema.statics.logCapEnforcement = async function(employeeId, year, amount, balanceBefore, balanceAfter, description) {
  const transaction = new this({
    employeeId,
    transactionType: 'CAP_ENFORCEMENT',
    year,
    amount,
    operation: 'SUBTRACT',
    balanceBefore,
    balanceAfter,
    description: description || `Cap enforcement: removed ${amount} days to maintain 40-day limit`,
    processedAt: new Date()
  });
  
  await transaction.save();
  return transaction;
};

// Static method to get transaction history for an employee
leaveTransactionSchema.statics.getEmployeeHistory = async function(employeeId, year = null, limit = 100) {
  const query = { employeeId, isActive: true };
  if (year) {
    query.year = year;
  }
  
  return await this.find(query)
    .sort({ processedAt: -1 })
    .limit(limit)
    .populate('leaveRequestId', 'startDate endDate totalDays reason status')
    .populate('processedBy', 'firstName lastName');
};

// Static method to get allocation transactions for a specific year
leaveTransactionSchema.statics.getAllocationHistory = async function(year, limit = 1000) {
  return await this.find({
    transactionType: 'ALLOCATION',
    year,
    isActive: true
  })
    .sort({ processedAt: -1 })
    .limit(limit)
    .populate('employeeId', 'firstName lastName employeeId hireDate');
};

// Instance method to get transaction summary
leaveTransactionSchema.methods.getSummary = function() {
  return {
    id: this._id,
    transactionType: this.transactionType,
    year: this.year,
    amount: this.amount,
    operation: this.operation,
    description: this.description,
    balanceBefore: this.balanceBefore,
    balanceAfter: this.balanceAfter,
    processedAt: this.processedAt,
    anniversaryDate: this.anniversaryDate
  };
};

module.exports = mongoose.model('LeaveTransaction', leaveTransactionSchema);
