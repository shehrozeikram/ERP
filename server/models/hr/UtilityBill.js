const mongoose = require('mongoose');

const utilityBillSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: true,
    unique: true,
    default: () => `UB${Date.now().toString().slice(-6)}`
  },
  accountHead: {
    type: String,
    enum: ['President Personal', 'Head Office', 'Boly.pk', 'Usman Solar', ''],
    default: '',
    trim: true
  },
  site: {
    type: String,
    trim: true,
    maxlength: [200, 'Site cannot exceed 200 characters']
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
  lastMonthAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
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
  approvalStatus: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    default: 'Draft',
    index: true
  },
  approvalChain: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    actedAt: {
      type: Date
    },
    comment: {
      type: String,
      trim: true
    }
  }],
  draftApproverIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  workflowHistory: [{
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    comments: { type: String, trim: true },
    module: { type: String, trim: true },
    stampUsed: { type: Boolean, default: false },
    stampImage: { type: String, trim: true }
  }],
  auditStatus: {
    type: String,
    enum: [
      'Not Sent',
      'Send to Audit',
      'Forwarded to Audit Director',
      'Approved (from Send to Audit)',
      'Approved (from Forwarded to Audit Director)',
      'Returned from Audit',
      'Rejected (from Send to Audit)'
    ],
    default: 'Not Sent',
    index: true
  },
  observations: [{
    observation: { type: String, trim: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
    answer: { type: String, trim: true },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answeredAt: { type: Date },
    resolved: { type: Boolean, default: false }
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
  forWhat: {
    type: String,
    trim: true,
    maxlength: [1000, 'For what cannot exceed 1000 characters']
  },
  attachment: {
    type: String, // File path for bill attachment
    default: null
  },
  billImage: {
    type: String, // Image path for bill image
    default: null
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Office'
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters']
  },
  custodian: {
    type: String,
    trim: true,
    maxlength: [200, 'Custodian cannot exceed 200 characters']
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
utilityBillSchema.index({ approvalStatus: 1 });
utilityBillSchema.index({ billDate: -1 });
utilityBillSchema.index({ dueDate: 1 });
utilityBillSchema.index({ provider: 1 });
utilityBillSchema.index({ accountHead: 1 });
utilityBillSchema.index({ site: 1 });
utilityBillSchema.index({ location: 1 });
utilityBillSchema.index({ department: 1 });
utilityBillSchema.index({ custodian: 1 });
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
    site: this.site,
    utilityType: this.utilityType,
    utilityTypeDescription: this.utilityTypeDescription,
    provider: this.provider,
    department: this.department,
    custodian: this.custodian,
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
