const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const payslipSchema = new mongoose.Schema({
  // Employee Information
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    required: true
  },

  // Payslip Period
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  payslipNumber: {
    type: String,
    required: true,
    unique: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },

  // Salary Structure
  basicSalary: {
    type: Number,
    required: true,
    default: 0
  },
  houseRent: {
    type: Number,
    default: 0
  },
  medicalAllowance: {
    type: Number,
    default: 0
  },
  conveyanceAllowance: {
    type: Number,
    default: 0
  },
  specialAllowance: {
    type: Number,
    default: 0
  },
  otherAllowances: {
    type: Number,
    default: 0
  },

  // Earnings
  earnings: {
    basicSalary: { type: Number, default: 0 },
    houseRent: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    conveyanceAllowance: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 },
    otherEarnings: { type: Number, default: 0 }
  },

  // Deductions
  deductions: {
    providentFund: { type: Number, default: 0 },
    eobi: { type: Number, default: 0 },
    incomeTax: { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    lateDeduction: { type: Number, default: 0 },
    absentDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 }
  },

  // Attendance
  totalDays: {
    type: Number,
    default: 0
  },
  presentDays: {
    type: Number,
    default: 0
  },
  absentDays: {
    type: Number,
    default: 0
  },
  lateDays: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },

  // Calculations
  grossSalary: {
    type: Number,
    required: true,
    default: 0
  },
  totalEarnings: {
    type: Number,
    required: true,
    default: 0
  },
  totalDeductions: {
    type: Number,
    required: true,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true,
    default: 0
  },

  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'generated', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check', 'online'],
    default: 'bank_transfer'
  },

  // Comments and Notes
  notes: {
    type: String
  },
  remarks: {
    type: String
  },

  // Audit Trail
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

// Virtual for full name
payslipSchema.virtual('period').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[this.month - 1]} ${this.year}`;
});

// Virtual for attendance percentage
payslipSchema.virtual('attendancePercentage').get(function() {
  if (this.totalDays === 0) return 0;
  return Math.round((this.presentDays / this.totalDays) * 100);
});

// Pre-save middleware to calculate totals
payslipSchema.pre('save', function(next) {
  // Calculate total earnings
  this.totalEarnings = Object.values(this.earnings).reduce((sum, value) => sum + (value || 0), 0);
  
  // Calculate total deductions
  this.totalDeductions = Object.values(this.deductions).reduce((sum, value) => sum + (value || 0), 0);
  
  // Calculate net salary
  this.netSalary = this.totalEarnings - this.totalDeductions;
  
  // Generate payslip number if not exists
  if (!this.payslipNumber) {
    this.payslipNumber = `PS${this.year}${this.month.toString().padStart(2, '0')}${this.employeeId}`;
  }
  
  next();
});

// Static method to get payslip statistics
payslipSchema.statics.getPayslipStats = async function(month, year) {
  const stats = await this.aggregate([
    {
      $match: {
        month: parseInt(month),
        year: parseInt(year)
      }
    },
    {
      $group: {
        _id: null,
        totalPayslips: { $sum: 1 },
        totalGrossSalary: { $sum: '$grossSalary' },
        totalNetSalary: { $sum: '$netSalary' },
        totalDeductions: { $sum: '$totalDeductions' },
        averageSalary: { $avg: '$netSalary' }
      }
    }
  ]);
  
  return stats[0] || {
    totalPayslips: 0,
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    averageSalary: 0
  };
};

payslipSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Payslip', payslipSchema); 