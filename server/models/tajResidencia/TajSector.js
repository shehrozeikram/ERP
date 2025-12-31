const mongoose = require('mongoose');

const tajSectorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Indexes
tajSectorSchema.index({ name: 1 });
tajSectorSchema.index({ isActive: 1 });

module.exports = mongoose.model('TajSector', tajSectorSchema);

