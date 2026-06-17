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

const landPurchaseSchema = new mongoose.Schema({
  purchaseNo: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  dealNo: {
    type: Number,
    required: true,
    unique: true
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
    ref: 'LandParty',
    required: true
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
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

landPurchaseSchema.index({ moza: 1, purchaseDate: -1 });
landPurchaseSchema.index({ seller: 1 });

module.exports = mongoose.model('LandPurchase', landPurchaseSchema);
