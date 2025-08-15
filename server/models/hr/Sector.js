const mongoose = require('mongoose');

const sectorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  industry: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentSector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sector'
  },
  subSectors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sector'
  }],
  companies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  }],
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
sectorSchema.index({ name: 1 });
sectorSchema.index({ code: 1 });
sectorSchema.index({ industry: 1 });
sectorSchema.index({ isActive: 1 });

module.exports = mongoose.model('Sector', sectorSchema);
