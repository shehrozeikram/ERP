const mongoose = require('mongoose');

const utilityBillSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: true,
    unique: true,
    default: () => `UB${Date.now().toString().slice(-6)}`
  },
  utilityType: {
    type: String,
    required: true,
    enum: [
      'Electricity',    // K-Electric, WAPDA, etc.
      'Water',          // Water supply bills
      'Gas',            // Gas supply bills
      'Internet',       // Internet service bills
      'Phone',          // Phone/telecom bills
      'Maintenance',    // Building maintenance
      'Security',       // Security services
      'Cleaning',       // Cleaning services
      'Other'           // Other utility bills
    ],
    default: 'Electricity'
  },
  provider: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    trim: true
  },
  billDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Partial'],
    default: 'Pending'
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Credit Card', 'Other', null],
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  attachment: {
    type: String, // File path for bill attachment
    default: null
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Office'
  },
  // Additional fields for better management
  billingPeriod: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  previousReading: {
    type: Number,
    min: 0
  },
  currentReading: {
    type: Number,
    min: 0
  },
  units: {
    type: Number,
    min: 0
  },
  ratePerUnit: {
    type: Number,
    min: 0
  },
  taxes: {
    gst: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  notes: {
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

// Indexes for performance
utilityBillSchema.index({ billId: 1 });
utilityBillSchema.index({ utilityType: 1 });
utilityBillSchema.index({ status: 1 });
utilityBillSchema.index({ billDate: -1 });
utilityBillSchema.index({ dueDate: 1 });
utilityBillSchema.index({ provider: 1 });
utilityBillSchema.index({ location: 1 });
utilityBillSchema.index({ createdBy: 1 });

// Virtual for remaining amount
utilityBillSchema.virtual('remainingAmount').get(function() {
  return this.amount - this.paidAmount;
});

// Virtual for days overdue
utilityBillSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'Overdue' && this.dueDate < new Date()) {
    return Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for payment percentage
utilityBillSchema.virtual('paymentPercentage').get(function() {
  return this.amount > 0 ? Math.round((this.paidAmount / this.amount) * 100) : 0;
});

// Pre-save middleware to update status
utilityBillSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.paidAmount >= this.amount) {
    this.status = 'Paid';
    if (!this.paymentDate) {
      this.paymentDate = now;
    }
  } else if (this.paidAmount > 0) {
    this.status = 'Partial';
  } else if (this.dueDate < now) {
    this.status = 'Overdue';
  } else {
    this.status = 'Pending';
  }
  
  next();
});

// Virtual for utility type description
utilityBillSchema.virtual('utilityTypeDescription').get(function() {
  const descriptions = {
    'Electricity': 'Electricity supply bill',
    'Water': 'Water supply bill',
    'Gas': 'Gas supply bill',
    'Internet': 'Internet service bill',
    'Phone': 'Phone/telecom bill',
    'Maintenance': 'Building maintenance bill',
    'Security': 'Security service bill',
    'Cleaning': 'Cleaning service bill',
    'Other': 'Other utility bill'
  };
  return descriptions[this.utilityType] || 'Utility bill';
});

// Method to get bill details
utilityBillSchema.methods.getBillDetails = function() {
  return {
    billId: this.billId,
    utilityType: this.utilityType,
    utilityTypeDescription: this.utilityTypeDescription,
    provider: this.provider,
    amount: this.amount,
    paidAmount: this.paidAmount,
    remainingAmount: this.remainingAmount,
    status: this.status,
    dueDate: this.dueDate,
    daysOverdue: this.daysOverdue,
    paymentPercentage: this.paymentPercentage
  };
};

module.exports = mongoose.model('UtilityBill', utilityBillSchema);
