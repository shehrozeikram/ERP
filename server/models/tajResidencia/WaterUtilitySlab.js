const mongoose = require('mongoose');

const waterUtilitySlabSchema = new mongoose.Schema({
  status: {
    type: String,
    default: 'Un-Protect',
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  slabs: [{
    lowerSlab: {
      type: Number,
      required: [true, 'Lower slab is required'],
      min: [0, 'Lower slab cannot be negative']
    },
    higherSlab: {
      type: Number,
      required: [true, 'Higher slab is required'],
      min: [0, 'Higher slab cannot be negative']
    },
    unitsSlab: {
      type: String,
      required: [true, 'Units slab is required'],
      trim: true
    },
    fixRate: {
      type: Number,
      default: null,
      min: [0, 'Fix rate cannot be negative']
    },
    unitRate: {
      type: Number,
      required: [true, 'Unit rate is required'],
      min: [0, 'Unit rate cannot be negative']
    }
  }],
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
waterUtilitySlabSchema.statics.getActiveSlabs = async function() {
  return await this.findOne({ isActive: true })
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');
};

// Index for efficient queries
waterUtilitySlabSchema.index({ isActive: 1 });

module.exports = mongoose.model('WaterUtilitySlab', waterUtilitySlabSchema);

