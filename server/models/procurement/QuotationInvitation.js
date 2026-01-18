const mongoose = require('mongoose');
const crypto = require('crypto');

const quotationInvitationSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  indent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Indent',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Submitted', 'Expired'],
    default: 'Pending'
  },
  submittedAt: {
    type: Date
  },
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
quotationInvitationSchema.index({ token: 1 });
quotationInvitationSchema.index({ indent: 1, vendor: 1 });
quotationInvitationSchema.index({ status: 1 });
quotationInvitationSchema.index({ expiresAt: 1 });

// Check if invitation is expired
quotationInvitationSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Check if invitation can be used
quotationInvitationSchema.methods.canBeUsed = function() {
  return this.status === 'Pending' && !this.isExpired();
};

module.exports = mongoose.model('QuotationInvitation', quotationInvitationSchema);
