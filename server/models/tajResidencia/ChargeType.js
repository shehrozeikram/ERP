const mongoose = require('mongoose');

const chargeTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    description: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isSystem: {
      type: Boolean,
      default: false // System types (OTHER, MAINTENANCE) cannot be deleted
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Allow null for system-created types
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Indexes
chargeTypeSchema.index({ name: 1 });
chargeTypeSchema.index({ isActive: 1 });

module.exports = mongoose.model('ChargeType', chargeTypeSchema);
