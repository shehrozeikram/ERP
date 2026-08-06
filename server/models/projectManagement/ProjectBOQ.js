const mongoose = require('mongoose');

const projectBOQSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConstructionProject',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  boqNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  description: {
    type: String,
    trim: true
  },
  version: {
    type: String,
    default: '1.0',
    trim: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Approved', 'Active', 'Archived'],
    default: 'Active'
  },
  totalEstimatedCost: {
    type: Number,
    default: 0
  },
  netEstimatedCost: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Auto-generate boqNumber before saving if missing
projectBOQSchema.pre('save', async function (next) {
  if (!this.boqNumber) {
    const count = await mongoose.model('ProjectBOQ').countDocuments({ project: this.project });
    this.boqNumber = `BOQ-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('ProjectBOQ', projectBOQSchema);
