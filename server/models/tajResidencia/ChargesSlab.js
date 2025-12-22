const mongoose = require('mongoose');

const chargesSlabSchema = new mongoose.Schema({
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  slabs: [{
    size: {
      type: String,
      required: [true, 'Size is required'],
      trim: true
    },
    camCharges: {
      type: Number,
      required: [true, 'CAM Charges is required'],
      min: [0, 'CAM Charges cannot be negative']
    }
  }],
  commercialCamCharges: {
    type: Number,
    default: 2000,
    min: [0, 'Commercial CAM Charges cannot be negative']
  },
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
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

// Static method to get active slabs
chargesSlabSchema.statics.getActiveSlabs = async function() {
  return await this.findOne({ isActive: true })
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');
};

// Index for efficient queries
chargesSlabSchema.index({ isActive: 1 });

module.exports = mongoose.model('ChargesSlab', chargesSlabSchema);

