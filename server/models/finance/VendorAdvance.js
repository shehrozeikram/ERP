const mongoose = require('mongoose');

const vendorAdvanceSchema = new mongoose.Schema({
  vendor: {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }
  },
  amount: { type: Number, required: true, min: 0 },
  appliedAmount: { type: Number, default: 0, min: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'cheque', 'credit_card', 'bank_transfer', 'bank', 'ach', 'other'],
    default: 'bank_transfer'
  },
  reference: { type: String, trim: true },
  paymentDate: { type: Date, default: Date.now },
  department: {
    type: String,
    enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'],
    default: 'procurement'
  },
  module: {
    type: String,
    enum: ['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general', 'finance', 'taj_utilities'],
    default: 'procurement'
  },
  referenceType: { type: String, default: 'advance' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: {
    type: String,
    enum: ['open', 'partially_applied', 'applied'],
    default: 'open'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

vendorAdvanceSchema.virtual('remainingAmount').get(function() {
  return Math.round(((this.amount || 0) - (this.appliedAmount || 0)) * 100) / 100;
});

vendorAdvanceSchema.index({ 'vendor.vendorId': 1, status: 1, paymentDate: 1 });
vendorAdvanceSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('VendorAdvance', vendorAdvanceSchema);
