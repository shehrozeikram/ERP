const mongoose = require('mongoose');

const kpiTemplateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false
  },
  designation: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  items: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    weight: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },
    measurementType: {
      type: String,
      enum: ['rating_1_to_5', 'percentage', 'boolean', 'custom'],
      default: 'rating_1_to_5'
    }
  }],
  totalWeight: {
    type: Number,
    default: 100
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save to calculate total weight
kpiTemplateSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalWeight = this.items.reduce((sum, item) => sum + item.weight, 0);
  } else {
    this.totalWeight = 0;
  }
  next();
});

module.exports = mongoose.model('KPITemplate', kpiTemplateSchema);
