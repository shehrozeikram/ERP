const mongoose = require('mongoose');

const binSchema = new mongoose.Schema({
  binCode: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { _id: true });

const shelfSchema = new mongoose.Schema({
  shelfCode: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  bins: [binSchema]
}, { _id: true });

const rackSchema = new mongoose.Schema({
  rackCode: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  shelves: [shelfSchema]
}, { _id: true });

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['main', 'sub'],
    required: true,
    default: 'main'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  racks: [rackSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: populate children sub-stores
storeSchema.virtual('children', {
  ref: 'Store',
  localField: '_id',
  foreignField: 'parent'
});

// Pre-save: auto-generate code (STR-00001, STR-00002, ...)
storeSchema.pre('save', async function (next) {
  if (!this.code) {
    const count = await mongoose.model('Store').countDocuments();
    this.code = `STR-${String(count + 1).padStart(5, '0')}`;
  }
  // Sub-stores must have a parent
  if (this.type === 'sub' && !this.parent) {
    return next(new Error('Sub-store must have a parent store'));
  }
  // Main stores must not have a parent
  if (this.type === 'main' && this.parent) {
    return next(new Error('Main store cannot have a parent'));
  }
  next();
});

// Static: get full hierarchy tree starting from main stores
storeSchema.statics.getHierarchy = async function () {
  const mainStores = await this.find({ type: 'main', isActive: true })
    .populate({
      path: 'children',
      match: { isActive: true },
      options: { sort: { name: 1 } }
    })
    .sort({ name: 1 })
    .lean({ virtuals: true });
  return mainStores;
};

// Static: get flat list of all rack/shelf/bin locations for a store
storeSchema.statics.getFlatLocations = function (store) {
  const locations = [];
  if (!store || !Array.isArray(store.racks)) return locations;
  for (const rack of store.racks) {
    if (!rack.isActive) continue;
    if (!rack.shelves || rack.shelves.length === 0) {
      locations.push({ rack: rack.rackCode, shelf: null, bin: null, label: rack.rackCode });
      continue;
    }
    for (const shelf of rack.shelves) {
      if (!shelf.isActive) continue;
      if (!shelf.bins || shelf.bins.length === 0) {
        locations.push({ rack: rack.rackCode, shelf: shelf.shelfCode, bin: null, label: `${rack.rackCode} / ${shelf.shelfCode}` });
        continue;
      }
      for (const bin of shelf.bins) {
        if (!bin.isActive) continue;
        locations.push({
          rack: rack.rackCode,
          shelf: shelf.shelfCode,
          bin: bin.binCode,
          label: `${rack.rackCode} / ${shelf.shelfCode} / ${bin.binCode}`
        });
      }
    }
  }
  return locations;
};

storeSchema.index({ parent: 1, isActive: 1 });
storeSchema.index({ type: 1, isActive: 1 });
storeSchema.index({ code: 1 });

module.exports = mongoose.model('Store', storeSchema);
