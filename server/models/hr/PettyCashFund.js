const mongoose = require('mongoose');

const pettyCashFundSchema = new mongoose.Schema({
  fundId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  initialAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currentBalance: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  maxAmount: {
    type: Number,
    required: true,
    min: 0
  },
  custodian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  location: {
    type: String,
    required: true,
    trim: true,
    default: 'Main Office'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
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
pettyCashFundSchema.index({ fundId: 1 });
pettyCashFundSchema.index({ status: 1 });
pettyCashFundSchema.index({ custodian: 1 });

// Virtual for utilization percentage
pettyCashFundSchema.virtual('utilizationPercentage').get(function() {
  if (this.maxAmount === 0) return 0;
  return ((this.maxAmount - this.currentBalance) / this.maxAmount) * 100;
});

// Pre-save middleware to validate balance
pettyCashFundSchema.pre('save', function(next) {
  if (this.currentBalance > this.maxAmount) {
    return next(new Error('Current balance cannot exceed maximum amount'));
  }
  next();
});

module.exports = mongoose.model('PettyCashFund', pettyCashFundSchema);
