const mongoose = require('mongoose');

const tajRentalManagementSchema = new mongoose.Schema({
  // Property Reference
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TajRentalProperty',
    required: true
  },
  // Agreement Reference (can be existing or new)
  rentalAgreement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TajRentalAgreement',
    required: true
  },
  // Tenant Details (snapshot from agreement or override)
  tenantName: {
    type: String,
    required: true,
    trim: true
  },
  tenantEmail: {
    type: String,
    trim: true
  },
  tenantPhone: {
    type: String,
    trim: true
  },
  tenantCNIC: {
    type: String,
    trim: true
  },
  // Rental Period
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  // Financial Details
  monthlyRent: {
    type: Number,
    required: true
  },
  securityDeposit: {
    type: Number,
    default: 0
  },
  depositReceived: {
    type: Number,
    default: 0
  },
  // Payment Tracking
  payments: [{
    amount: {
      type: Number,
      required: true
    },
    paymentDate: {
      type: Date,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
      default: 'Bank Transfer'
    },
    reference: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Draft', 'Unpaid', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Draft'
    },
    statusUpdatedAt: {
      type: Date,
      default: Date.now
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Status
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Terminated', 'On Hold'],
    default: 'Active'
  },
  // Additional Info
  notes: {
    type: String,
    trim: true
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
  }
}, {
  timestamps: true
});

// Indexes
tajRentalManagementSchema.index({ property: 1 });
tajRentalManagementSchema.index({ rentalAgreement: 1 });
tajRentalManagementSchema.index({ status: 1 });
tajRentalManagementSchema.index({ startDate: 1, endDate: 1 });

// Virtual for total paid
tajRentalManagementSchema.virtual('totalPaid').get(function() {
  return this.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
});

// Virtual for outstanding balance
tajRentalManagementSchema.virtual('outstandingBalance').get(function() {
  const totalExpected = this.monthlyRent * this.getMonthsDifference();
  return totalExpected - this.totalPaid;
});

// Helper method to calculate months difference
tajRentalManagementSchema.methods.getMonthsDifference = function() {
  if (!this.startDate || !this.endDate) return 0;
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
};

tajRentalManagementSchema.set('toJSON', { virtuals: true });
tajRentalManagementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TajRentalManagement', tajRentalManagementSchema);

