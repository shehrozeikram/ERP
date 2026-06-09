const mongoose = require('mongoose');

const DEFAULT_SITE_OPTIONS = [
  'SGC',
  'President Personal',
  'Head Office',
  'Jagha',
  'Boly.pk',
  'Hamza',
  'Edu.Head Office',
  'SGC Health',
  'Tenacious'
];

/** Singleton-style config for the admin centralized store. */
const utilityCentralStoreSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Centralized Store',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  /** Monotonic source for auto-generated UtilityStoreItem.code (CSI-000001, …). */
  nextItemCodeSeq: {
    type: Number,
    default: 0,
    min: 0
  },
  /** Selectable site names for store items (admin can add more). */
  siteOptions: {
    type: [String],
    default: () => [...DEFAULT_SITE_OPTIONS]
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

utilityCentralStoreSchema.statics.getOrCreate = async function (userId) {
  let store = await this.findOne();
  if (!store) {
    store = await this.create({
      name: 'Centralized Store',
      siteOptions: [...DEFAULT_SITE_OPTIONS],
      updatedBy: userId
    });
  } else if (!store.siteOptions?.length) {
    store.siteOptions = [...DEFAULT_SITE_OPTIONS];
    store.updatedBy = userId;
    await store.save();
  }
  return store;
};

utilityCentralStoreSchema.statics.DEFAULT_SITE_OPTIONS = DEFAULT_SITE_OPTIONS;

/**
 * Returns the next unique catalog item code (CSI-######).
 * Uses an atomic counter on this singleton; syncs from existing CSI-* codes when counter is still zero.
 */
utilityCentralStoreSchema.statics.assignNextItemCode = async function assignNextItemCode() {
  const UtilityStoreItem = require('./UtilityStoreItem');
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({ name: 'Centralized Store', nextItemCodeSeq: 0 });
  }
  if ((doc.nextItemCodeSeq || 0) === 0) {
    const withCodes = await UtilityStoreItem.find({ code: { $regex: /^CSI-\d{6}$/ } })
      .select('code')
      .lean();
    let maxN = 0;
    for (const r of withCodes) {
      const m = /^CSI-(\d{6})$/.exec(r.code);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    if (maxN > 0) {
      await this.updateOne({ _id: doc._id }, { $set: { nextItemCodeSeq: maxN } });
    }
  }
  const updated = await this.findOneAndUpdate(
    {},
    { $inc: { nextItemCodeSeq: 1 } },
    { new: true }
  );
  const n = updated?.nextItemCodeSeq ?? 1;
  return `CSI-${String(n).padStart(6, '0')}`;
};

module.exports = mongoose.model('UtilityCentralStore', utilityCentralStoreSchema);
