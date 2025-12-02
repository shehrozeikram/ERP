const mongoose = require('mongoose');

const propertyReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TajProperty',
    required: true
  },
  receiptDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  bankName: {
    type: String,
    trim: true
  },
  bankReference: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
    default: 'Bank Transfer'
  },
  allocations: [{
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyInvoice',
      required: true
    },
    invoiceNumber: String,
    invoiceType: String,
    balance: Number,
    allocatedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    remaining: Number
  }],
  totalAllocated: {
    type: Number,
    default: 0
  },
  unallocatedAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Cancelled'],
    default: 'Draft'
  },
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

// Indexes
propertyReceiptSchema.index({ property: 1, receiptDate: -1 });
propertyReceiptSchema.index({ receiptNumber: 1 });
propertyReceiptSchema.index({ status: 1 });

// Calculate totals before save
propertyReceiptSchema.pre('save', function(next) {
  this.totalAllocated = (this.allocations || []).reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0);
  this.unallocatedAmount = this.amount - this.totalAllocated;
  next();
});

module.exports = mongoose.model('PropertyReceipt', propertyReceiptSchema);

