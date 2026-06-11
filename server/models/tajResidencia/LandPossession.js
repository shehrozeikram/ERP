const mongoose = require('mongoose');

const landAreaSchema = new mongoose.Schema({
  kanal: { type: Number, default: 0, min: 0 },
  marla: { type: Number, default: 0, min: 0 },
  sarsai: { type: Number, default: 0, min: 0 }
}, { _id: false });

const possessionLineSchema = new mongoose.Schema({
  /** Registry / purchase source khasra (optional — may differ from physical allocation). */
  registryKhasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  registryKhewatNo: { type: String, trim: true, default: '' },
  registryKhasraNo: { type: String, trim: true, default: '' },
  registeredArea: { type: landAreaSchema, default: () => ({}) },
  /** Physical possession allocated to this khasra. */
  khasraEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMozaKhasraEntry'
  },
  registry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandRegistry'
  },
  khewatNo: { type: String, required: true, trim: true },
  khasraNo: { type: String, required: true, trim: true },
  khasraArea: { type: landAreaSchema, default: () => ({}) },
  possessedArea: { type: landAreaSchema, default: () => ({}) },
  totalLandPossessed: { type: landAreaSchema, default: () => ({}) },
  transferPercent: { type: Number, default: 0, min: 0, max: 100 },
  remarks: { type: String, trim: true, default: '' }
}, { _id: true });

const landPossessionSchema = new mongoose.Schema({
  possessionDate: { type: Date, required: true },
  moza: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandMoza',
    required: true,
    index: true
  },
  khewatNo: { type: String, required: true, trim: true },
  totalArea: { type: landAreaSchema, default: () => ({}) },
  possessionRef: { type: String, trim: true, default: '' },
  registry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandRegistry'
  },
  lines: { type: [possessionLineSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

landPossessionSchema.index(
  { moza: 1, possessionRef: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, possessionRef: { $type: 'string', $ne: '' } }
  }
);

module.exports = mongoose.model('LandPossession', landPossessionSchema);
