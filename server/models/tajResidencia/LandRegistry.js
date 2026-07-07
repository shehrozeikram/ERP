const mongoose = require('mongoose');

const landAreaSchema = new mongoose.Schema({
  kanal: { type: Number, default: 0, min: 0 },
  marla: { type: Number, default: 0, min: 0 },
  sarsai: { type: Number, default: 0, min: 0 }
}, { _id: false });

const registryAttachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true, trim: true },
  originalName: { type: String, required: true, trim: true },
  path: { type: String, required: true, trim: true },
  mimetype: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const registryLineSchema = new mongoose.Schema({
  khasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  khewatNo: { type: String, required: true, trim: true },
  khasraNo: { type: String, required: true, trim: true },
  khasraArea: { type: landAreaSchema, default: () => ({}) },
  landOfKhasra: { type: landAreaSchema, default: () => ({}) },
  acquiredArea: { type: landAreaSchema, default: () => ({}) },
  landWithMalkiyat: { type: landAreaSchema, default: () => ({}) },
  transferPercent: { type: Number, default: 0, min: 0 },
  remarks: { type: String, trim: true, default: '' }
}, { _id: true });

const landRegistrySchema = new mongoose.Schema({
  registryDate: { type: Date, required: true },
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true,
    index: true
  },
  khewatNo: { type: String, required: true, trim: true },
  khewatNos: { type: [String], default: [] },
  totalArea: { type: landAreaSchema, default: () => ({}) },
  registryNo: { type: String, trim: true, default: '' },
  inteqalNo: { type: String, trim: true, default: '' },
  lines: { type: [registryLineSchema], default: [] },
  attachments: { type: [registryAttachmentSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Application logic enforces uniqueness for non-empty registry numbers.

module.exports = mongoose.model('LandRegistry', landRegistrySchema);
