const mongoose = require('mongoose');

const propertyInvoiceSchema = new mongoose.Schema({
  // Property Reference (optional for open invoices like ground booking, billboard, events)
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TajProperty',
    required: false
  },
  // Customer/Client details for non-property invoices
  customerName: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerAddress: {
    type: String,
    trim: true
  },
  sector: {
    type: String,
    trim: true
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
    // Allow any string for flexibility (especially for open invoices with custom types)
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
  // Store detailed calculation breakdown for reference (especially for PDF)
  calculationData: {
    type: Object,
    default: null
  },
  // Charges Breakdown
  charges: [{
    type: {
      type: String,
      // Allow any string for flexibility (especially for open invoices with custom types)
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
// Compound index for CAM charges overview query optimization
propertyInvoiceSchema.index({ property: 1, chargeTypes: 1, paymentStatus: 1, balance: 1 });

// Calculate payment status before save
propertyInvoiceSchema.pre('save', function(next) {
  // Calculate total paid
  this.totalPaid = (this.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  
  // Check if invoice is overdue (after due date ends) and unpaid/partially paid
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dueDateObj = this.dueDate ? new Date(this.dueDate) : null;
  if (dueDateObj) dueDateObj.setHours(0, 0, 0, 0);
  const isOverdue = dueDateObj && todayStart > dueDateObj;
  const isUnpaid = this.paymentStatus === 'unpaid' || this.paymentStatus === 'partial_paid' || this.totalPaid < this.grandTotal;
  
  // Calculate late payment surcharge if overdue and unpaid
  let latePaymentSurcharge = 0;
  if (isOverdue && isUnpaid) {
    // Calculate surcharge based on charges for the month (not including arrears)
    // 10% of charges for the month
    const chargesForMonth = this.subtotal || 0;
    // If invoice has charges array, sum up the amount (not arrears) for each charge
    if (this.charges && Array.isArray(this.charges) && this.charges.length > 0) {
      const totalChargesAmount = this.charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      if (totalChargesAmount > 0) {
        latePaymentSurcharge = Math.max(Math.round(totalChargesAmount * 0.1), 0);
      } else if (chargesForMonth > 0) {
        latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
      }
    } else if (chargesForMonth > 0) {
      latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
    }
  }
  
  // Store late payment surcharge in calculationData if not already set
  if (!this.calculationData) {
    this.calculationData = {};
  }
  if (latePaymentSurcharge > 0) {
    this.calculationData.latePaymentSurcharge = latePaymentSurcharge;
    // Update grandTotal to include surcharge if not already included
    // Only add surcharge to grandTotal if it hasn't been added before
    const originalGrandTotal = (this.subtotal || 0) + (this.totalArrears || 0);
    if (this.grandTotal <= originalGrandTotal) {
      this.grandTotal = originalGrandTotal + latePaymentSurcharge;
    }
  } else {
    // If not overdue or already paid, ensure grandTotal doesn't include surcharge
    const originalGrandTotal = (this.subtotal || 0) + (this.totalArrears || 0);
    if (this.grandTotal > originalGrandTotal) {
      // Check if the difference is a surcharge (approximately 10% of subtotal)
      const difference = this.grandTotal - originalGrandTotal;
      const expectedSurcharge = Math.round((this.subtotal || 0) * 0.1);
      if (Math.abs(difference - expectedSurcharge) < 1) {
        // It's a surcharge, remove it if invoice is no longer overdue
        this.grandTotal = originalGrandTotal;
      }
    }
  }
  
  // Calculate balance (after adjusting grandTotal for surcharge)
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
    if (this.status === 'Issued' && isOverdue) {
      this.status = 'Overdue';
    }
  }
  
  next();
});

module.exports = mongoose.model('PropertyInvoice', propertyInvoiceSchema);

