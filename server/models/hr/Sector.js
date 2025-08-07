const mongoose = require('mongoose');

const sectorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Sector name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Sector name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Sector code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Sector code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
sectorSchema.index({ name: 1 });
sectorSchema.index({ code: 1 });
sectorSchema.index({ company: 1 });

// Virtual for full name
sectorSchema.virtual('fullName').get(function() {
  return `${this.name} (${this.code})`;
});

// Ensure virtual fields are serialized
sectorSchema.set('toJSON', { virtuals: true });
sectorSchema.set('toObject', { virtuals: true });

// Static method to find active sectors
sectorSchema.statics.findActive = function() {
  return this.find({ isActive: true })
    .populate('company', 'name code')
    .populate('manager', 'firstName lastName employeeId')
    .sort({ name: 1 });
};

// Static method to find sectors by company
sectorSchema.statics.findByCompany = function(companyId) {
  return this.find({ company: companyId, isActive: true })
    .populate('manager', 'firstName lastName employeeId')
    .sort({ name: 1 });
};

module.exports = mongoose.model('Sector', sectorSchema); 