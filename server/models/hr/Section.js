const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true,
    maxlength: [100, 'Section name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Section code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Section code cannot exceed 10 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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
sectionSchema.index({ name: 1 });
sectionSchema.index({ code: 1 });
sectionSchema.index({ department: 1 });
sectionSchema.index({ isActive: 1 });

// Virtual for full section info
sectionSchema.virtual('fullInfo').get(function() {
  return `${this.name} (${this.code})`;
});

// Static method to find active sections
sectionSchema.statics.findActive = function() {
  return this.find({ isActive: true }).populate('department', 'name code').sort({ name: 1 });
};

// Static method to find sections by department
sectionSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('Section', sectionSchema); 