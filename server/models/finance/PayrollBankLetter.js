const mongoose = require('mongoose');

const payrollBankLetterSchema = new mongoose.Schema({
  paymentApplicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollPeriodPaymentApplication',
    required: true,
    index: true
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    default: null,
    index: true
  },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  periodLabel: { type: String, trim: true },
  companyName: { type: String, required: true, trim: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlacementCompany', default: null },
  voucherNumber: { type: String, trim: true },
  chequeNumber: { type: String, trim: true },
  companyAccountNumber: { type: String, trim: true },
  companyBankName: { type: String, trim: true },
  companyBankBranch: { type: String, trim: true },
  employeeCount: { type: Number, default: 0 },
  totalNetSalary: { type: Number, default: 0 },
  letterRef: { type: String, trim: true },
  format: {
    type: String,
    enum: ['print', 'excel'],
    default: 'print'
  },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  generatedAt: { type: Date, default: Date.now },
  attachment: {
    filename: String,
    originalName: String,
    path: String,
    mimetype: String,
    size: Number
  }
}, { timestamps: true });

payrollBankLetterSchema.index({ month: 1, year: 1, companyName: 1, generatedAt: -1 });

module.exports = mongoose.model('PayrollBankLetter', payrollBankLetterSchema);
