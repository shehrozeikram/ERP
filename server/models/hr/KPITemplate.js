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
    trim: true,
    index: true
  },
  /** Optional link to Designation master for blue-collar packs */
  designationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation',
    default: null,
    index: true
  },
  /** blue_collar packs are scored by reporting line only (no employee self-entry) */
  employeeCategory: {
    type: String,
    enum: ['blue_collar', 'white_collar', 'any'],
    default: 'any',
    index: true
  },
  scoredBy: {
    type: String,
    enum: ['employee_and_manager', 'manager_only'],
    default: 'employee_and_manager'
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
    target: {
      type: String,
      trim: true,
      default: ''
    },
    /** higher_better | lower_better | time_lower_better | compliance */
    calculationRule: {
      type: String,
      enum: ['higher_better', 'lower_better', 'time_lower_better', 'compliance', 'custom'],
      default: 'higher_better'
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
  },
  /** Stable key for upsert from All_Designation_KPI catalog */
  sourceKey: {
    type: String,
    trim: true,
    index: true,
    sparse: true
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
