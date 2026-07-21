const mongoose = require('mongoose');

const salaryAdvanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  amount: {
    type: Number,
    required: [true, 'Advance amount is required'],
    min: [1, 'Advance amount must be greater than 0']
  },
  advanceDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  payrollMonth: {
    type: Number,
    required: [true, 'Target payroll month is required'],
    min: 1,
    max: 12
  },
  payrollYear: {
    type: Number,
    required: [true, 'Target payroll year is required'],
    min: 2020
  },
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Cheque'],
    default: 'Bank Transfer'
  },
  status: {
    type: String,
    enum: ['Unadjusted', 'Adjusted', 'Cancelled'],
    default: 'Unadjusted'
  },
  adjustedPayroll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    default: null
  },
  adjustedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

salaryAdvanceSchema.index({ employee: 1, payrollMonth: 1, payrollYear: 1, status: 1 });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
