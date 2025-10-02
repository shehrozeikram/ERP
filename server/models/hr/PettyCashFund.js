const mongoose = require('mongoose');

const pettyCashFundSchema = new mongoose.Schema({
  fundId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    default: () => `PC${Date.now().toString().slice(-6)}`
  },
  title: {
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
  custodian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Approved', 'Paid', 'Rejected'],
    default: 'Draft'
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
  fundDate: {
    type: Date,
    required: false,
    default: Date.now
  },
  vendor: {
    type: String,
    required: false,
    trim: true
  },
  paymentType: {
    type: String,
    required: false,
    enum: ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Other'],
    default: 'Cash'
  },
  subtitle: {
    type: String,
    required: false,
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
