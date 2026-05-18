const mongoose = require('mongoose');

/**
 * Flat category under Admin Centralized Store (e.g. Electricity, Gas, Water, Rent).
 * Items (Meter 1, Meter 2, …) belong to a category.
 */
const utilityStoreCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    unique: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

utilityStoreCategorySchema.index({ name: 1 }, { unique: true });
utilityStoreCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model('UtilityStoreCategory', utilityStoreCategorySchema);
