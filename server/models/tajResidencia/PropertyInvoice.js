const mongoose = require('mongoose');

const propertyInvoiceSchema = new mongoose.Schema({
  // Property Reference
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TajProperty',
    required: true
  },
  // Invoice Details
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  periodFrom: {
    type: Date
  },
  periodTo: {
    type: Date
  },
  // Charge Types Included
  chargeTypes: [{
    type: String,
    enum: ['CAM', 'ELECTRICITY', 'RENT'],
    required: true
  }],
  // Source References
  camCharge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CAMCharge'
  },
  electricityBill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Electricity'
  },
  rentPayment: {
    type: mongoose.Schema.Types.ObjectId
  },
  // Charges Breakdown
  charges: [{
    type: {
      type: String,
      enum: ['CAM', 'ELECTRICITY', 'RENT'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      default: 0
    },
    arrears: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  }],
  // Financial Summary
  subtotal: {
    type: Number,
    default: 0
  },
  totalArrears: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    default: 0
  },
  amountInWords: {
    type: String,
    trim: true
  },
  // Payment Tracking
  payments: [{
    amount: {
      type: Number,
      required: true
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
      default: 'Bank Transfer'
    },
    bankName: {
      type: String,
      trim: true
    },
    reference: {
      type: String,
      trim: true
    },
    attachmentUrl: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    },
    receiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyReceipt'
    }
  }],
  totalPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Issued'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial_paid', 'paid'],
    default: 'unpaid'
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
propertyInvoiceSchema.index({ property: 1, invoiceDate: -1 });
propertyInvoiceSchema.index({ invoiceNumber: 1 });
propertyInvoiceSchema.index({ status: 1 });

// Calculate payment status before save
propertyInvoiceSchema.pre('save', function(next) {
  // Calculate total paid
  this.totalPaid = (this.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  
  // Calculate balance
  this.balance = this.grandTotal - this.totalPaid;
  
  // Update payment status
  if (this.totalPaid >= this.grandTotal && this.grandTotal > 0) {
    this.paymentStatus = 'paid';
    this.status = 'Paid';
  } else if (this.totalPaid > 0) {
    this.paymentStatus = 'partial_paid';
    this.status = 'Partially Paid';
  } else {
    this.paymentStatus = 'unpaid';
    if (this.status === 'Issued' && new Date() > this.dueDate) {
      this.status = 'Overdue';
    }
  }
  
  next();
});

module.exports = mongoose.model('PropertyInvoice', propertyInvoiceSchema);

