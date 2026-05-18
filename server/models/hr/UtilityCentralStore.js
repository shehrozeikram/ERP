const mongoose = require('mongoose');

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
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

utilityCentralStoreSchema.statics.getOrCreate = async function (userId) {
  let store = await this.findOne();
  if (!store) {
    store = await this.create({ name: 'Centralized Store', updatedBy: userId });
  }
  return store;
};

module.exports = mongoose.model('UtilityCentralStore', utilityCentralStoreSchema);
