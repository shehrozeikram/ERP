const mongoose = require('mongoose');

const accountsPayableSchema = new mongoose.Schema({
  // Vendor information
  vendor: {
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    taxId: {
      type: String,
      trim: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor' // If you have a separate Vendor model
    }
  },
  // Bill details
  billNumber: {
    type: String,
    required: [true, 'Bill number is required'],
    trim: true
  },
  vendorInvoiceNumber: {
    type: String,
    trim: true
  },
  billDate: {
    type: Date,
    required: [true, 'Bill date is required'],
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  // Financial details
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: [0, 'Amount paid cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  balanceDue: {
    type: Number,
    get: function() {
      return Math.round((this.totalAmount - this.amountPaid) * 100) / 100;
    }
  },
  // Payment terms
  paymentTerms: {
    type: String,
    enum: ['net_15', 'net_30', 'net_45', 'net_60', 'due_on_receipt', 'custom'],
    default: 'net_30'
  },
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'received', 'approved', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  // Department integration
  department: {
    type: String,
    enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'],
    default: 'procurement'
  },
  module: {
    type: String,
    enum: ['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general'],
    default: 'procurement'
  },
  // Reference to source document
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceType: {
    type: String,
    enum: ['purchase_order', 'receipt', 'service', 'product', 'manual'],
    default: 'manual'
  },
  // Line items
  lineItems: [{
    description: {
      type: String,
      required: [true, 'Line item description is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    amount: {
      type: Number,
      get: function() {
        return Math.round((this.quantity * this.unitPrice) * 100) / 100;
      }
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%']
    },
    taxAmount: {
      type: Number,
      default: 0,
      get: function() {
        return Math.round((this.amount * this.taxRate / 100) * 100) / 100;
      }
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account'
    }
  }],
  // Payment history
  payments: [{
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required']
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Payment amount cannot be negative'],
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'other'],
      required: [true, 'Payment method is required']
    },
    reference: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    journalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required']
    }
  }],
  // Aging information
  aging: {
    current: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    days_30: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    days_60: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    days_90: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    days_90_plus: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    }
  },
  // Approval workflow
  approval: {
    required: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedDate: Date,
    approvalNotes: String
  },
  // Additional fields
  notes: String,
  internalNotes: String,
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
accountsPayableSchema.index({ billNumber: 1 });
accountsPayableSchema.index({ 'vendor.vendorId': 1 });
accountsPayableSchema.index({ billDate: 1 });
accountsPayableSchema.index({ dueDate: 1 });
accountsPayableSchema.index({ status: 1 });
accountsPayableSchema.index({ department: 1 });
accountsPayableSchema.index({ module: 1 });
accountsPayableSchema.index({ balanceDue: 1 });

// Virtuals
accountsPayableSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.balanceDue > 0;
});

accountsPayableSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;
  return Math.floor((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
});

accountsPayableSchema.virtual('formattedTotalAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.totalAmount);
});

accountsPayableSchema.virtual('formattedBalanceDue').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.balanceDue);
});

// Pre-save middleware
accountsPayableSchema.pre('save', function(next) {
  // Calculate total amount from line items
  if (this.lineItems && this.lineItems.length > 0) {
    this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
    this.taxAmount = this.lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;
  }

  // Update status based on balance and approval
  if (this.balanceDue <= 0 && this.amountPaid > 0) {
    this.status = this.amountPaid < this.totalAmount ? 'partial' : 'paid';
  } else if (this.isOverdue) {
    this.status = 'overdue';
  } else if (this.approval.required && this.approval.approvedBy) {
    this.status = 'approved';
  }

  // Calculate aging
  this.calculateAging();

  next();
});

// Method to calculate aging
accountsPayableSchema.methods.calculateAging = function() {
  const now = new Date();
  const daysDiff = Math.floor((now - this.dueDate) / (1000 * 60 * 60 * 24));
  
  this.aging = {
    current: 0,
    days_30: 0,
    days_60: 0,
    days_90: 0,
    days_90_plus: 0
  };

  if (this.balanceDue > 0) {
    if (daysDiff <= 0) {
      this.aging.current = this.balanceDue;
    } else if (daysDiff <= 30) {
      this.aging.days_30 = this.balanceDue;
    } else if (daysDiff <= 60) {
      this.aging.days_60 = this.balanceDue;
    } else if (daysDiff <= 90) {
      this.aging.days_90 = this.balanceDue;
    } else {
      this.aging.days_90_plus = this.balanceDue;
    }
  }
};

// Method to approve bill
accountsPayableSchema.methods.approve = async function(approvedBy, approvalNotes) {
  if (this.approval.required && !this.approval.approvedBy) {
    this.approval.approvedBy = approvedBy;
    this.approval.approvedDate = new Date();
    this.approval.approvalNotes = approvalNotes;
    this.status = 'approved';
    return this.save();
  }
  throw new Error('Bill does not require approval or is already approved');
};

// Method to record payment
accountsPayableSchema.methods.recordPayment = async function(paymentData) {
  if (this.balanceDue <= 0) {
    throw new Error('Bill is already fully paid');
  }

  if (paymentData.amount > this.balanceDue) {
    throw new Error('Payment amount cannot exceed balance due');
  }

  // Add payment to history
  this.payments.push({
    ...paymentData,
    paymentDate: paymentData.paymentDate || new Date()
  });

  // Update amount paid
  this.amountPaid += paymentData.amount;

  // Create journal entry for payment
  const JournalEntry = mongoose.model('JournalEntry');
  const Account = mongoose.model('Account');

  // Find accounts payable and cash/bank account
  const apAccount = await Account.findOne({ accountNumber: '2100' }); // Accounts Payable
  const cashAccount = await Account.findOne({ accountNumber: '1000' }); // Cash

  if (!apAccount || !cashAccount) {
    throw new Error('Required accounts not found');
  }

  const journalEntry = new JournalEntry({
    date: paymentData.paymentDate || new Date(),
    reference: `PAY-${this.billNumber}`,
    description: `Payment made for bill ${this.billNumber}`,
    department: this.department,
    module: this.module,
    referenceId: this._id,
    referenceType: 'payment',
    lines: [
      {
        account: apAccount._id,
        description: `Payment to ${this.vendor.name}`,
        debit: paymentData.amount,
        department: this.department
      },
      {
        account: cashAccount._id,
        description: `Payment for bill ${this.billNumber}`,
        credit: paymentData.amount,
        department: this.department
      }
    ],
    createdBy: paymentData.createdBy
  });

  await journalEntry.post(paymentData.createdBy);

  // Update payment reference
  this.payments[this.payments.length - 1].journalEntry = journalEntry._id;

  return this.save();
};

// Static methods
accountsPayableSchema.statics.getAgingReport = async function() {
  const pipeline = [
    {
      $group: {
        _id: null,
        current: { $sum: '$aging.current' },
        days_30: { $sum: '$aging.days_30' },
        days_60: { $sum: '$aging.days_60' },
        days_90: { $sum: '$aging.days_90' },
        days_90_plus: { $sum: '$aging.days_90_plus' },
        total: { $sum: '$balanceDue' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    current: 0,
    days_30: 0,
    days_60: 0,
    days_90: 0,
    days_90_plus: 0,
    total: 0
  };
};

accountsPayableSchema.statics.getOverdueBills = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    balanceDue: { $gt: 0 }
  }).sort({ dueDate: 1 });
};

accountsPayableSchema.statics.getVendorStatement = async function(vendorId, startDate, endDate) {
  const query = {
    'vendor.vendorId': vendorId
  };

  if (startDate || endDate) {
    query.billDate = {};
    if (startDate) query.billDate.$gte = startDate;
    if (endDate) query.billDate.$lte = endDate;
  }

  return this.find(query)
    .sort({ billDate: 1 });
};

module.exports = mongoose.model('AccountsPayable', accountsPayableSchema);
