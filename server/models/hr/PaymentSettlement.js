const mongoose = require('mongoose');

const paymentSettlementSchema = new mongoose.Schema({
  // Company Details
  parentCompanyName: {
    type: String,
    required: [true, 'Parent company name is required'],
    trim: true,
    maxlength: [200, 'Parent company name cannot exceed 200 characters']
  },
  subsidiaryName: {
    type: String,
    required: [true, 'Subsidiary name is required'],
    trim: true,
    maxlength: [200, 'Subsidiary name cannot exceed 200 characters']
  },

  // Payment Details
  site: {
    type: String,
    trim: true,
    maxlength: [200, 'Site cannot exceed 200 characters']
  },
  paymentType: {
    type: String,
    enum: ['Payable', 'Reimbursement', 'Advance'],
    trim: true
  },
  fromDepartment: {
    type: String,
    trim: true,
    maxlength: [100, 'From department cannot exceed 100 characters']
  },
  custodian: {
    type: String,
    trim: true,
    maxlength: [200, 'Custodian cannot exceed 200 characters']
  },
  date: {
    type: String,
    required: [true, 'Date is required'],
    trim: true
  },
  referenceNumber: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference number cannot exceed 100 characters']
  },
  toWhomPaid: {
    type: String,
    trim: true,
    maxlength: [200, 'To whom paid cannot exceed 200 characters']
  },
  forWhat: {
    type: String,
    trim: true,
    maxlength: [500, 'For what cannot exceed 500 characters']
  },
  amount: {
    type: String,
    required: [true, 'Amount is required'],
    trim: true,
    maxlength: [50, 'Amount cannot exceed 50 characters']
  },
  grandTotal: {
    type: String,
    required: [true, 'Grand total is required'],
    trim: true,
    maxlength: [50, 'Grand total cannot exceed 50 characters']
  },

  // Authorization Details
  preparedBy: {
    type: String,
    trim: true,
    maxlength: [200, 'Prepared by cannot exceed 200 characters']
  },
  preparedByDesignation: {
    type: String,
    trim: true,
    maxlength: [100, 'Prepared by designation cannot exceed 100 characters']
  },
  verifiedBy: {
    type: String,
    trim: true,
    maxlength: [200, 'Verified by cannot exceed 200 characters']
  },
  verifiedByDesignation: {
    type: String,
    trim: true,
    maxlength: [100, 'Verified by designation cannot exceed 100 characters']
  },
  approvedBy: {
    type: String,
    trim: true,
    maxlength: [200, 'Approved by cannot exceed 200 characters']
  },
  approvedByDesignation: {
    type: String,
    trim: true,
    maxlength: [100, 'Approved by designation cannot exceed 100 characters']
  },

  // Document Attachments
  attachments: [{
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

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
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'],
    default: 'Draft'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSettlementSchema.index({ parentCompanyName: 1 });
paymentSettlementSchema.index({ subsidiaryName: 1 });
paymentSettlementSchema.index({ referenceNumber: 1 });
paymentSettlementSchema.index({ status: 1 });
paymentSettlementSchema.index({ createdAt: -1 });

// Virtual for formatted amount
paymentSettlementSchema.virtual('formattedAmount').get(function() {
  return this.amount ? `PKR ${this.amount}` : '';
});

// Virtual for formatted grand total
paymentSettlementSchema.virtual('formattedGrandTotal').get(function() {
  return this.grandTotal ? `PKR ${this.grandTotal}` : '';
});

// Method to get settlement summary
paymentSettlementSchema.methods.getSettlementSummary = function() {
  return {
    id: this._id,
    parentCompanyName: this.parentCompanyName,
    subsidiaryName: this.subsidiaryName,
    referenceNumber: this.referenceNumber,
    toWhomPaid: this.toWhomPaid,
    amount: this.formattedAmount,
    grandTotal: this.formattedGrandTotal,
    status: this.status,
    date: this.date,
    createdAt: this.createdAt
  };
};

// Ensure virtual fields are serialized
paymentSettlementSchema.set('toJSON', { virtuals: true });
paymentSettlementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PaymentSettlement', paymentSettlementSchema);
