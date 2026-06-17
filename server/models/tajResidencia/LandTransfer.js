const mongoose = require('mongoose');

const landAreaSchema = new mongoose.Schema({
  kanal: { type: Number, default: 0, min: 0 },
  marla: { type: Number, default: 0, min: 0 },
  sarsai: { type: Number, default: 0, min: 0 }
}, { _id: false });

const transferLineSchema = new mongoose.Schema({
  khasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  khewatNo: { type: String, trim: true, default: '' },
  khasraNo: { type: String, trim: true, default: '' },
  khasraArea: { type: landAreaSchema, default: () => ({}) }
}, { _id: true });

const transferPaymentSchema = new mongoose.Schema({
  paymentType: { type: String, trim: true, required: true },
  amount: { type: Number, default: 0, min: 0 },
  amountInWords: { type: String, trim: true, default: '' }
}, { _id: true });

const landTransferSchema = new mongoose.Schema({
  referenceNo: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  transferNo: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  landPurchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandPurchase',
    required: true,
    index: true
  },
  dealNo: { type: Number, required: true },
  purchaseNo: { type: String, trim: true, required: true },
  transferDate: { type: Date, required: true },
  intiqalNo: { type: String, trim: true, default: '' },
  registryNo: { type: String, trim: true, default: '' },
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true,
    index: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParty',
    required: true
  },
  sellerCnic: { type: String, trim: true, default: '' },
  sellerName: { type: String, trim: true, default: '' },
  purchaser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParty'
  },
  purchaserCnic: { type: String, trim: true, default: '' },
  purchaserName: { type: String, trim: true, default: '' },
  lines: { type: [transferLineSchema], default: [] },
  purchaseArea: { type: landAreaSchema, default: () => ({}) },
  transferArea: { type: landAreaSchema, default: () => ({}) },
  purchaseSizeInKanal: { type: Number, default: 0, min: 0 },
  transferSizeInKanal: { type: Number, default: 0, min: 0 },
  ratePerKanal: { type: Number, default: 0, min: 0 },
  transferredCost: { type: Number, default: 0, min: 0 },
  transferPayments: { type: [transferPaymentSchema], default: [] },
  totalTransferPayments: { type: Number, default: 0, min: 0 },
  totalTransferPaymentsInWords: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['Open', 'Closed'],
    default: 'Open',
    index: true
  },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

landTransferSchema.index({ moza: 1, transferDate: -1 });
landTransferSchema.index({ landPurchase: 1, transferDate: -1 });

module.exports = mongoose.model('LandTransfer', landTransferSchema);
