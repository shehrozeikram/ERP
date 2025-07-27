const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  payPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      required: true
    }
  },
  basicSalary: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  allowances: {
    housing: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    meal: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  overtime: {
    hours: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 }
  },
  bonuses: {
    performance: { type: Number, default: 0 },
    attendance: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  deductions: {
    tax: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    pension: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  attendance: {
    totalDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 }
  },
  leaveDeductions: {
    unpaidLeave: { type: Number, default: 0 },
    sickLeave: { type: Number, default: 0 },
    casualLeave: { type: Number, default: 0 },
    annualLeave: { type: Number, default: 0 },
    otherLeave: { type: Number, default: 0 },
    totalLeaveDays: { type: Number, default: 0 },
    leaveDeductionAmount: { type: Number, default: 0 }
  },
  calculations: {
    grossPay: { type: Number, required: true, default: 0 },
    totalAllowances: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, required: true, default: 0 }
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'check', 'cash'],
    default: 'bank_transfer'
  },
  paymentDate: Date,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true
});

// Pre-save middleware to calculate totals
payrollSchema.pre('save', function(next) {
  try {
    // Ensure all numeric values are properly converted
    const basicSalary = Number(this.basicSalary) || 0;
    const housing = Number(this.allowances?.housing) || 0;
    const transport = Number(this.allowances?.transport) || 0;
    const meal = Number(this.allowances?.meal) || 0;
    const medical = Number(this.allowances?.medical) || 0;
    const otherAllowance = Number(this.allowances?.other) || 0;
    
    const tax = Number(this.deductions?.tax) || 0;
    const insurance = Number(this.deductions?.insurance) || 0;
    const pension = Number(this.deductions?.pension) || 0;
    const loan = Number(this.deductions?.loan) || 0;
    const otherDeduction = Number(this.deductions?.other) || 0;
    
    const overtimeHours = Number(this.overtime?.hours) || 0;
    const overtimeRate = Number(this.overtime?.rate) || 0;
    
    const performanceBonus = Number(this.bonuses?.performance) || 0;
    const attendanceBonus = Number(this.bonuses?.attendance) || 0;
    const otherBonus = Number(this.bonuses?.other) || 0;

    // Calculate leave deductions
    const unpaidLeave = Number(this.leaveDeductions?.unpaidLeave) || 0;
    const sickLeave = Number(this.leaveDeductions?.sickLeave) || 0;
    const casualLeave = Number(this.leaveDeductions?.casualLeave) || 0;
    const annualLeave = Number(this.leaveDeductions?.annualLeave) || 0;
    const otherLeave = Number(this.leaveDeductions?.otherLeave) || 0;
    
    const totalLeaveDays = unpaidLeave + sickLeave + casualLeave + annualLeave + otherLeave;
    
    // Calculate daily rate (basic salary / working days per month)
    const workingDaysPerMonth = 22; // Standard working days per month
    const dailyRate = basicSalary / workingDaysPerMonth;
    
    // Calculate leave deduction amount (only for unpaid and other leaves)
    // Sick leave, casual leave, and annual leave are usually paid
    const leaveDeductionAmount = (unpaidLeave + otherLeave) * dailyRate;

    // Calculate total allowances
    const totalAllowances = housing + transport + meal + medical + otherAllowance;

    // Calculate total deductions
    const totalDeductions = tax + insurance + pension + loan + otherDeduction + leaveDeductionAmount;

    // Calculate overtime amount
    const overtimeAmount = overtimeHours * overtimeRate;

    // Calculate gross pay
    const grossPay = basicSalary + totalAllowances + overtimeAmount + performanceBonus + attendanceBonus + otherBonus;

    // Calculate net pay
    const netPay = grossPay - totalDeductions;

    // Set the calculated values
    this.calculations = {
      grossPay: Math.max(0, grossPay),
      totalAllowances: totalAllowances,
      totalDeductions: totalDeductions,
      netPay: Math.max(0, netPay)
    };

    // Update overtime amount
    this.overtime.amount = overtimeAmount;

    // Update leave deductions
    this.leaveDeductions = {
      unpaidLeave: unpaidLeave,
      sickLeave: sickLeave,
      casualLeave: casualLeave,
      annualLeave: annualLeave,
      otherLeave: otherLeave,
      totalLeaveDays: totalLeaveDays,
      leaveDeductionAmount: leaveDeductionAmount
    };

    console.log('Payroll calculations completed:', {
      basicSalary,
      totalAllowances,
      overtimeAmount,
      grossPay,
      totalDeductions,
      netPay,
      leaveDeductionAmount,
      totalLeaveDays,
      dailyRate
    });

    next();
  } catch (error) {
    console.error('Error in payroll pre-save middleware:', error);
    next(error);
  }
});

// Static method to get payroll statistics
payrollSchema.statics.getPayrollStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.startDate && filters.endDate) {
    matchStage['payPeriod.startDate'] = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
  }
  
  if (filters.status) {
    matchStage.status = filters.status;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayrolls: { $sum: 1 },
        totalGrossPay: { $sum: '$calculations.grossPay' },
        totalNetPay: { $sum: '$calculations.netPay' },
        totalDeductions: { $sum: '$calculations.totalDeductions' },
        averageNetPay: { $avg: '$calculations.netPay' }
      }
    }
  ]);

  return stats[0] || {
    totalPayrolls: 0,
    totalGrossPay: 0,
    totalNetPay: 0,
    totalDeductions: 0,
    averageNetPay: 0
  };
};

// Instance method to approve payroll
payrollSchema.methods.approve = function(userId) {
  this.status = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to mark as paid
payrollSchema.methods.markAsPaid = function(paymentMethod = 'bank_transfer') {
  this.status = 'paid';
  this.paymentMethod = paymentMethod;
  this.paymentDate = new Date();
  return this.save();
};

module.exports = mongoose.model('Payroll', payrollSchema); 