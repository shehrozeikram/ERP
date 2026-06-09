const mongoose = require('mongoose');

const payrollMonthlyApprovalSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  financeApprovalAuthorities: {
    accountsOfficerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    accountsManagerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    financeControllerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  financeAuthorityApprovals: [{
    authorityKey: String,
    authorityLabel: String,
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decision: { type: String, enum: ['approved', 'rejected'], default: 'approved' },
    approvedAt: Date,
    comments: String
  }],
  financeAuthoritiesAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  financeAuthoritiesAssignedAt: Date,
  authorityStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

payrollMonthlyApprovalSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayrollMonthlyApproval', payrollMonthlyApprovalSchema);
