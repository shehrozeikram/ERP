const mongoose = require('mongoose');

const landAreaSchema = new mongoose.Schema({
  kanal: { type: Number, default: 0, min: 0 },
  marla: { type: Number, default: 0, min: 0 },
  sarsai: { type: Number, default: 0, min: 0 }
}, { _id: false });

const landMozaKhasraEntrySchema = new mongoose.Schema({
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true,
    index: true
  },
  srNo: { type: Number, required: true, min: 1 },
  khasraNo: { type: String, required: true, trim: true },
  khewatNo: { type: String, required: true, trim: true },
  landInKhasra: { type: landAreaSchema, default: () => ({}) },
  landOfSociety: { type: landAreaSchema, default: () => ({}) },
  othersToPurchase: { type: landAreaSchema, default: () => ({}) },
  landInPossession: { type: landAreaSchema, default: () => ({}) },
  ownershipNotInPossession: { type: landAreaSchema, default: () => ({}) },
  notOwnershipButInPossession: { type: landAreaSchema, default: () => ({}) },
  mozaRef: { type: String, trim: true, default: '' },
  remarks: { type: String, trim: true, default: '' }
}, { timestamps: true });

landMozaKhasraEntrySchema.index({ moza: 1, srNo: 1 }, { unique: true });
landMozaKhasraEntrySchema.index({ moza: 1, khewatNo: 1, khasraNo: 1 });
landMozaKhasraEntrySchema.index({ moza: 1, khewatNo: 1 });

module.exports = mongoose.model('LandMozaKhasraEntry', landMozaKhasraEntrySchema);
