const mongoose = require('mongoose');

const payrollMonthlyComparisonReportSchema = new mongoose.Schema({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  report: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: [
      'Draft',
      'Approved by Deputy Manager Payroll HR',
      'Approved by GM HR',
      'Approved by AVP'
    ],
    default: 'Draft'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

payrollMonthlyComparisonReportSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayrollMonthlyComparisonReport', payrollMonthlyComparisonReportSchema);
