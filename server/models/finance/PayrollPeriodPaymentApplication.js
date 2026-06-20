const mongoose = require('mongoose');

const payrollPeriodPaymentApplicationSchema = new mongoose.Schema({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  periodLabel: { type: String, trim: true },
  companyName: { type: String, required: true, trim: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlacementCompany', default: null },
  amount: { type: Number, required: true, min: 0.01 },
  employeeCount: { type: Number, default: 0 },
  payrollIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }],
  paymentMeta: {
    paymentMethod: { type: String },
    reference: { type: String, trim: true },
    narration: { type: String, trim: true, maxlength: 500 },
    paymentDate: { type: Date },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    grossSalary: { type: Number, default: 0 },
    breakdown: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', required: true, index: true },
  workflowStatus: {
    type: String,
    enum: ['draft', 'pending_authority', 'fully_approved', 'rejected'],
    default: 'draft',
    index: true
  },
  financeApprovalAuthorities: {
    accountsOfficerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    accountsManagerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    financeControllerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  financeAuthorityApprovals: [{
    authorityKey: { type: String, trim: true },
    authorityLabel: { type: String, trim: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decision: { type: String, enum: ['approved', 'rejected'], default: 'approved' },
    approvedAt: { type: Date, default: Date.now },
    comments: { type: String, trim: true }
  }],
  rejectionObservation: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  finalizedAt: { type: Date, default: null }
}, { timestamps: true });

payrollPeriodPaymentApplicationSchema.index({ month: 1, year: 1, companyName: 1, workflowStatus: 1 });

module.exports = mongoose.model('PayrollPeriodPaymentApplication', payrollPeriodPaymentApplicationSchema);
