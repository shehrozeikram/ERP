const mongoose = require('mongoose');

const pettyCashExpenseSchema = new mongoose.Schema({
  expenseId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  fundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PettyCashFund',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Office Supplies', 'Travel', 'Meals', 'Utilities', 'Maintenance', 'Communication', 'Other'],
    default: 'Other'
  },
  receiptNumber: {
    type: String,
    trim: true
  },
  expenseDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
    default: 'Pending'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  approvalDate: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
pettyCashExpenseSchema.index({ expenseId: 1 });
pettyCashExpenseSchema.index({ fundId: 1 });
pettyCashExpenseSchema.index({ status: 1 });
pettyCashExpenseSchema.index({ requestedBy: 1 });
pettyCashExpenseSchema.index({ expenseDate: 1 });
pettyCashExpenseSchema.index({ category: 1 });

// Pre-save middleware to set approval date
pettyCashExpenseSchema.pre('save', function(next) {
  if (this.isModified('status') && (this.status === 'Approved' || this.status === 'Rejected')) {
    this.approvalDate = new Date();
  }
  next();
});

module.exports = mongoose.model('PettyCashExpense', pettyCashExpenseSchema);
