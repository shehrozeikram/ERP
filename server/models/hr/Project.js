const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Project code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Project code cannot exceed 10 characters']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementCompany',
    required: [true, 'Company is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Active'
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ name: 1 });
projectSchema.index({ code: 1 });
projectSchema.index({ company: 1 });
projectSchema.index({ isActive: 1 });
projectSchema.index({ status: 1 });

// Virtual for project duration
projectSchema.virtual('duration').get(function() {
  if (!this.startDate) return null;
  const end = this.endDate || new Date();
  const diffTime = Math.abs(end - this.startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Static method to find active projects
projectSchema.statics.findActive = function() {
  return this.find({ isActive: true }).populate('company', 'name code').sort({ name: 1 });
};

// Static method to find projects by company
projectSchema.statics.findByCompany = function(companyId) {
  return this.find({ company: companyId, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('Project', projectSchema); 