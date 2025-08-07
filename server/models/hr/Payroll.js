const mongoose = require('mongoose');
const { calculateMonthlyTax, calculateTaxableIncome, getTaxSlabInfo } = require('../../utils/taxCalculator');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: [1, 'Month must be between 1 and 12'],
    max: [12, 'Month must be between 1 and 12']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year must be 2020 or later']
  },
  // Basic salary components
  basicSalary: {
    type: Number,
    required: [true, 'Basic salary is required'],
    min: [0, 'Basic salary cannot be negative']
  },
  // Flexible Allowances (House Rent removed as it's part of distributed salary)
  allowances: {
    conveyance: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Conveyance allowance cannot be negative']
      }
    },
    food: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Food allowance cannot be negative']
      }
    },
    vehicleFuel: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Vehicle & fuel allowance cannot be negative']
      }
    },
    medical: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Medical allowance cannot be negative']
      }
    },
    special: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Special allowance cannot be negative']
      }
    },
    other: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Other allowance cannot be negative']
      }
    }
  },
  // Overtime
  overtimeHours: {
    type: Number,
    default: 0,
    min: [0, 'Overtime hours cannot be negative']
  },
  overtimeRate: {
    type: Number,
    default: 0,
    min: [0, 'Overtime rate cannot be negative']
  },
  overtimeAmount: {
    type: Number,
    default: 0,
    min: [0, 'Overtime amount cannot be negative']
  },
  // Bonuses and Arrears
  performanceBonus: {
    type: Number,
    default: 0,
    min: [0, 'Performance bonus cannot be negative']
  },
  otherBonus: {
    type: Number,
    default: 0,
    min: [0, 'Other bonus cannot be negative']
  },
  arrears: {
    type: Number,
    default: 0,
    min: [0, 'Arrears cannot be negative']
  },
  // Deductions
  providentFund: {
    type: Number,
    default: 0,
    min: [0, 'Provident fund cannot be negative']
  },
  incomeTax: {
    type: Number,
    default: 0,
    min: [0, 'Income tax cannot be negative']
  },
  healthInsurance: {
    type: Number,
    default: 0,
    min: [0, 'Health insurance cannot be negative']
  },
  vehicleLoanDeduction: {
    type: Number,
    default: 0,
    min: [0, 'Vehicle loan deduction cannot be negative']
  },
  companyLoanDeduction: {
    type: Number,
    default: 0,
    min: [0, 'Company loan deduction cannot be negative']
  },
  otherDeductions: {
    type: Number,
    default: 0,
    min: [0, 'Other deductions cannot be negative']
  },
  // EOBI (Employees' Old-Age Benefits Institution) - Pakistan
  eobi: {
    type: Number,
    default: 0,
    min: [0, 'EOBI cannot be negative']
  },
  // Attendance
  totalWorkingDays: {
    type: Number,
    required: [true, 'Total working days is required'],
    min: [0, 'Total working days cannot be negative']
  },
  presentDays: {
    type: Number,
    required: [true, 'Present days is required'],
    min: [0, 'Present days cannot be negative']
  },
  absentDays: {
    type: Number,
    default: 0,
    min: [0, 'Absent days cannot be negative']
  },
  leaveDays: {
    type: Number,
    default: 0,
    min: [0, 'Leave days cannot be negative']
  },
  // Calculations
  grossSalary: {
    type: Number,
    required: [true, 'Gross salary is required'],
    min: [0, 'Gross salary cannot be negative']
  },
  totalDeductions: {
    type: Number,
    default: 0,
    min: [0, 'Total deductions cannot be negative']
  },
  netSalary: {
    type: Number,
    required: [true, 'Net salary is required'],
    min: [0, 'Net salary cannot be negative']
  },
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Approved', 'Paid', 'Cancelled'],
    default: 'Draft'
  },
  // Payment details
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Check', 'Direct Deposit'],
    default: 'Bank Transfer'
  },
  transactionId: {
    type: String,
    trim: true
  },
  // Metadata
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  remarks: {
    type: String,
    trim: true
  },
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for attendance percentage
payrollSchema.virtual('attendancePercentage').get(function() {
  if (this.totalWorkingDays === 0) return 0;
  return ((this.presentDays / this.totalWorkingDays) * 100).toFixed(2);
});

// Virtual for total allowances
payrollSchema.virtual('totalAllowances').get(function() {
  let total = 0;
  
  if (this.allowances) {
    if (this.allowances.conveyance?.isActive) {
      total += this.allowances.conveyance.amount || 0;
    }
    if (this.allowances.food?.isActive) {
      total += this.allowances.food.amount || 0;
    }
    if (this.allowances.vehicleFuel?.isActive) {
      total += this.allowances.vehicleFuel.amount || 0;
    }
    if (this.allowances.medical?.isActive) {
      total += this.allowances.medical.amount || 0;
    }
    if (this.allowances.special?.isActive) {
      total += this.allowances.special.amount || 0;
    }
    if (this.allowances.other?.isActive) {
      total += this.allowances.other.amount || 0;
    }
  }
  
  return total;
});

// Virtual for total bonuses
payrollSchema.virtual('totalBonuses').get(function() {
  return this.performanceBonus + this.otherBonus;
});

// Virtual for total earnings
payrollSchema.virtual('totalEarnings').get(function() {
  return this.grossSalary + this.overtimeAmount + this.totalBonuses;
});

// Pre-save middleware to calculate totals
payrollSchema.pre('save', function(next) {
  // Auto-calculate Provident Fund (8.34% of basic salary) if not provided
  if (!this.providentFund && this.basicSalary > 0) {
    this.providentFund = Math.round((this.basicSalary * 8.34) / 100);
  }
  
  // EOBI is always 370 PKR for all employees (Pakistan EOBI fixed amount)
  this.eobi = 370;
  
  // Calculate total deductions
  this.totalDeductions = (this.providentFund || 0) + 
                        (this.incomeTax || 0) + 
                        (this.healthInsurance || 0) + 
                        (this.vehicleLoanDeduction || 0) +
                        (this.companyLoanDeduction || 0) +
                        (this.eobi || 0) + 
                        (this.otherDeductions || 0);
  
  // Calculate net salary
  this.netSalary = this.grossSalary - this.totalDeductions;
  
  // Auto-calculate income tax if not provided
  if (!this.incomeTax && this.basicSalary) {
    const taxableIncome = calculateTaxableIncome({
      basic: this.basicSalary,
      allowances: {
        transport: this.allowances?.conveyance?.isActive ? this.allowances.conveyance.amount : 0,
        meal: this.allowances?.food?.isActive ? this.allowances.food.amount : 0,
        vehicleFuel: this.allowances?.vehicleFuel?.isActive ? this.allowances.vehicleFuel.amount : 0,
        other: this.allowances?.other?.isActive ? this.allowances.other.amount : 0,
        medical: this.allowances?.medical?.isActive ? this.allowances.medical.amount : 0
      }
    });
    
    this.incomeTax = calculateMonthlyTax(taxableIncome);
  }
  
  next();
});

// Static method to generate payroll for an employee
payrollSchema.statics.generatePayroll = async function(employeeId, month, year, attendanceData = {}) {
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findById(employeeId).populate('department position');
  
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Check if payroll already exists for this month/year
  const existingPayroll = await this.findOne({
    employee: employeeId,
    month: month,
    year: year
  });

  if (existingPayroll) {
    throw new Error('Payroll already exists for this month');
  }

  // Calculate attendance
  const totalWorkingDays = attendanceData.totalWorkingDays || 22; // Default working days
  const presentDays = attendanceData.presentDays || totalWorkingDays;
  const absentDays = attendanceData.absentDays || 0;
  const leaveDays = attendanceData.leaveDays || 0;

  // Get employee salary structure
  const basicSalary = employee.salary.basic || 0;
  
  // Get employee allowances (only active ones)
  const employeeAllowances = employee.allowances || {};
  const payrollAllowances = {
    conveyance: {
      isActive: employeeAllowances.conveyance?.isActive || false,
      amount: employeeAllowances.conveyance?.isActive ? employeeAllowances.conveyance.amount : 0
    },
    food: {
      isActive: employeeAllowances.food?.isActive || false,
      amount: employeeAllowances.food?.isActive ? employeeAllowances.food.amount : 0
    },
    vehicleFuel: {
      isActive: employeeAllowances.vehicleFuel?.isActive || false,
      amount: employeeAllowances.vehicleFuel?.isActive ? employeeAllowances.vehicleFuel.amount : 0
    },
    medical: {
      isActive: employeeAllowances.medical?.isActive || false,
      amount: employeeAllowances.medical?.isActive ? employeeAllowances.medical.amount : 0
    },
    special: {
      isActive: employeeAllowances.special?.isActive || false,
      amount: employeeAllowances.special?.isActive ? employeeAllowances.special.amount : 0
    },
    other: {
      isActive: employeeAllowances.other?.isActive || false,
      amount: employeeAllowances.other?.isActive ? employeeAllowances.other.amount : 0
    }
  };

  // Calculate gross salary (basic + all active allowances)
  const totalAllowances = Object.values(payrollAllowances).reduce((sum, allowance) => {
    return sum + (allowance.isActive ? allowance.amount : 0);
  }, 0);
  
  const grossSalary = basicSalary + totalAllowances;

  // Calculate overtime (if any)
  const overtimeHours = attendanceData.overtimeHours || 0;
  const overtimeRate = (basicSalary / 176); // Assuming 176 working hours per month
  const overtimeAmount = overtimeHours * overtimeRate;

  // Get loan deductions
  const vehicleLoanDeduction = employee.loans?.vehicleLoan?.monthlyInstallment || 0;
  const companyLoanDeduction = employee.loans?.companyLoan?.monthlyInstallment || 0;

  // Create payroll object
  const payrollData = {
    employee: employeeId,
    month: month,
    year: year,
    basicSalary: basicSalary,
    allowances: payrollAllowances,
    overtimeHours: overtimeHours,
    overtimeRate: overtimeRate,
    overtimeAmount: overtimeAmount,
    performanceBonus: attendanceData.performanceBonus || 0,
    otherBonus: attendanceData.otherBonus || 0,
    arrears: attendanceData.arrears || 0,
    providentFund: attendanceData.providentFund || Math.round((basicSalary * 8.34) / 100),
    incomeTax: attendanceData.incomeTax || 0,
    healthInsurance: attendanceData.healthInsurance || 0,
    vehicleLoanDeduction: vehicleLoanDeduction,
    companyLoanDeduction: companyLoanDeduction,
    otherDeductions: attendanceData.otherDeductions || 0,
    totalWorkingDays: totalWorkingDays,
    presentDays: presentDays,
    absentDays: absentDays,
    leaveDays: leaveDays,
    grossSalary: grossSalary,
    currency: employee.currency || 'PKR',
    status: 'Draft',
    createdBy: attendanceData.createdBy || 'system'
  };

  return new this(payrollData);
};

// Static method to get payroll statistics
payrollSchema.statics.getStatistics = async function(year, month) {
  const matchStage = {};
  if (year) matchStage.year = year;
  if (month) matchStage.month = month;

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayrolls: { $sum: 1 },
        totalGrossSalary: { $sum: '$grossSalary' },
        totalNetSalary: { $sum: '$netSalary' },
        totalDeductions: { $sum: '$totalDeductions' },
        totalOvertime: { $sum: '$overtimeAmount' },
        totalBonuses: { $sum: { $add: ['$performanceBonus', '$otherBonus'] } },
        averageGrossSalary: { $avg: '$grossSalary' },
        averageNetSalary: { $avg: '$netSalary' }
      }
    }
  ]);

  return stats[0] || {
    totalPayrolls: 0,
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    totalOvertime: 0,
    totalBonuses: 0,
    averageGrossSalary: 0,
    averageNetSalary: 0
  };
};

// Static method to get payroll statistics (alias for getStatistics)
payrollSchema.statics.getPayrollStats = async function(filters = {}) {
  const { startDate, endDate, status } = filters;
  
  const matchStage = {};
  
  if (status) matchStage.status = status;
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayrolls: { $sum: 1 },
        totalGrossSalary: { $sum: '$grossSalary' },
        totalNetSalary: { $sum: '$netSalary' },
        totalDeductions: { $sum: '$totalDeductions' },
        totalOvertime: { $sum: '$overtimeAmount' },
        totalBonuses: { $sum: { $add: ['$performanceBonus', '$otherBonus'] } },
        averageGrossSalary: { $avg: '$grossSalary' },
        averageNetSalary: { $avg: '$netSalary' },
        totalTax: { $sum: '$incomeTax' },
        totalProvidentFund: { $sum: '$providentFund' }
      }
    }
  ]);

  return stats[0] || {
    totalPayrolls: 0,
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    totalOvertime: 0,
    totalBonuses: 0,
    averageGrossSalary: 0,
    averageNetSalary: 0,
    totalTax: 0,
    totalProvidentFund: 0
  };
};

// Instance method to approve payroll
payrollSchema.methods.approve = async function(approvedByUserId) {
  if (this.status !== 'Draft') {
    throw new Error('Only draft payrolls can be approved');
  }
  
  this.status = 'Approved';
  this.approvedBy = approvedByUserId;
  this.approvedAt = new Date();
  
  return await this.save();
};

// Instance method to mark payroll as paid
payrollSchema.methods.markAsPaid = async function(paymentMethod = 'Bank Transfer') {
  if (this.status !== 'Approved') {
    throw new Error('Only approved payrolls can be marked as paid');
  }
  
  this.status = 'Paid';
  this.paymentMethod = paymentMethod;
  this.paymentDate = new Date();
  
  return await this.save();
};

// Instance method to mark payroll as unpaid (revert to draft)
payrollSchema.methods.markAsUnpaid = async function() {
  if (this.status !== 'Paid') {
    throw new Error('Only paid payrolls can be marked as unpaid');
  }
  
  this.status = 'Draft';
  this.paymentMethod = undefined;
  this.paymentDate = undefined;
  this.approvedBy = undefined;
  this.approvedAt = undefined;
  
  return await this.save();
};

// Index for efficient queries
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ status: 1 });
payrollSchema.index({ month: 1, year: 1 });

module.exports = mongoose.model('Payroll', payrollSchema); 