const mongoose = require('mongoose');

const landAreaSchema = new mongoose.Schema({
  kanal: { type: Number, default: 0, min: 0 },
  marla: { type: Number, default: 0, min: 0 },
  sarsai: { type: Number, default: 0, min: 0 }
}, { _id: false });

const exchangeAttachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true, trim: true },
  originalName: { type: String, required: true, trim: true },
  path: { type: String, required: true, trim: true },
  mimetype: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const outLandLineSchema = new mongoose.Schema({
  registry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandRegistry'
  },
  registryNo: { type: String, trim: true, default: '' },
  inteqalNo: { type: String, trim: true, default: '' },
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true
  },
  khasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  khewatNo: { type: String, required: true, trim: true },
  khasraNo: { type: String, required: true, trim: true },
  khasraArea: { type: landAreaSchema, default: () => ({}) },
  surrenderedArea: { type: landAreaSchema, default: () => ({}) },
  remarks: { type: String, trim: true, default: '' }
}, { _id: true });

const inLandLineSchema = new mongoose.Schema({
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true
  },
  khasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  khewatNo: { type: String, required: true, trim: true },
  khasraNo: { type: String, required: true, trim: true },
  khasraArea: { type: landAreaSchema, default: () => ({}) },
  acquiredArea: { type: landAreaSchema, default: () => ({}) },
  registryNo: { type: String, trim: true, default: '' },
  inteqalNo: { type: String, trim: true, default: '' },
  remarks: { type: String, trim: true, default: '' }
}, { _id: true });

const financialAdjustmentSchema = new mongoose.Schema({
  hasAdjustment: { type: Boolean, default: false },
  amount: { type: Number, default: 0, min: 0 },
  paidBy: { type: String, enum: ['COMPANY', 'PARTY', 'NONE'], default: 'NONE' },
  paymentMode: { type: String, trim: true, default: 'Cheque' },
  status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  remarks: { type: String, trim: true, default: '' }
}, { _id: false });

const landExchangeSchema = new mongoose.Schema({
  exchangeRef: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  exchangeDate: { type: Date, required: true, default: Date.now },
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParty',
    required: true
  },
  dealNo: { type: Number },
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza'
  },
  outLandLines: { type: [outLandLineSchema], default: [] },
  inLandLines: { type: [inLandLineSchema], default: [] },
  totalOutArea: { type: landAreaSchema, default: () => ({}) },
  totalInArea: { type: landAreaSchema, default: () => ({}) },
  netAreaDiff: {
    kanal: { type: Number, default: 0 },
    marla: { type: Number, default: 0 },
    sarsai: { type: Number, default: 0 },
    type: { type: String, enum: ['IN_SURPLUS', 'OUT_SURPLUS', 'EQUAL'], default: 'EQUAL' }
  },
  financialAdjustment: { type: financialAdjustmentSchema, default: () => ({}) },
  attachments: { type: [exchangeAttachmentSchema], default: [] },
  remarks: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

landExchangeSchema.index({ exchangeDate: -1, createdAt: -1 });
landExchangeSchema.index({ party: 1 });
landExchangeSchema.index({ 'outLandLines.moza': 1 });
landExchangeSchema.index({ 'inLandLines.moza': 1 });

module.exports = mongoose.model('LandExchange', landExchangeSchema);
