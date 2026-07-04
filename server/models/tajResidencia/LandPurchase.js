const mongoose = require('mongoose');

const landAreaSchema = new mongoose.Schema({
  kanal: { type: Number, default: 0, min: 0 },
  marla: { type: Number, default: 0, min: 0 },
  sarsai: { type: Number, default: 0, min: 0 }
}, { _id: false });

const purchaseLineSchema = new mongoose.Schema({
  khasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  khewatNo: { type: String, trim: true, default: '' },
  khasraNo: { type: String, trim: true, default: '' },
  khasraArea: { type: landAreaSchema, default: () => ({}) }
}, { _id: true });

const installmentSchema = new mongoose.Schema({
  description: { type: String, trim: true, required: true },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid', 'Overdue'],
    default: 'Pending'
  },
  paymentDate: { type: Date },
  paymentMode: { type: String, trim: true, default: '' },
  paymentRemarks: { type: String, trim: true, default: '' },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  whtRate: { type: Number, default: 0, min: 0 },
  drawnOn: { type: String, trim: true, default: '' },
  refNo: { type: String, trim: true, default: '' },
  narration: { type: String, trim: true, default: '' },
  voucherEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const landPurchaseSchema = new mongoose.Schema({
  purchaseNo: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  dealNo: {
    type: Number,
    required: true
  },
  purchaseDate: { type: Date, required: true },
  project: { type: String, trim: true, default: 'Taj Residencia' },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParty',
    required: true
  },
  purchaser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParty'
  },
  dealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParty'
  },
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true,
    index: true
  },
  lines: { type: [purchaseLineSchema], default: [] },
  totalArea: { type: landAreaSchema, default: () => ({}) },
  totalSizeInKanal: { type: Number, default: 0, min: 0 },
  ratePerKanal: { type: Number, default: 0, min: 0 },
  ratePerKanalInWords: { type: String, trim: true, default: '' },
  agreedAmount: { type: Number, default: 0, min: 0 },
  agreedAmountInWords: { type: String, trim: true, default: '' },
  govtLandValue: { type: Number, default: 0, min: 0 },
  govtLandValueInWords: { type: String, trim: true, default: '' },
  tokenAmount: { type: Number, default: 0, min: 0 },
  tokenAmountInWords: { type: String, trim: true, default: '' },
  balanceAmount: { type: Number, default: 0, min: 0 },
  paymentMode: { type: String, trim: true, default: '' },
  paymentRemarks: { type: String, trim: true, default: '' },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  whtRate: { type: Number, default: 0, min: 0 },
  drawnOn: { type: String, trim: true, default: '' },
  refNo: { type: String, trim: true, default: '' },
  narration: { type: String, trim: true, default: '' },
  tokenPaymentDate: { type: Date },
  tokenVoucherEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  installments: { type: [installmentSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

landPurchaseSchema.index({ moza: 1, purchaseDate: -1 });
landPurchaseSchema.index({ seller: 1 });

module.exports = mongoose.model('LandPurchase', landPurchaseSchema);
