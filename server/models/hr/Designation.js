const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Designation title is required'],
    trim: true,
    maxlength: [100, 'Designation title cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Designation code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Designation code cannot exceed 10 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  level: {
    type: String,
    enum: ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive'],
    default: 'Entry'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  minSalary: {
    type: Number,
    min: [0, 'Minimum salary cannot be negative']
  },
  maxSalary: {
    type: Number,
    min: [0, 'Maximum salary cannot be negative']
  },
  requirements: [{
    type: String,
    trim: true
  }],
  responsibilities: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes
designationSchema.index({ title: 1 });
designationSchema.index({ code: 1 });
designationSchema.index({ department: 1 });
designationSchema.index({ section: 1 });
designationSchema.index({ isActive: 1 });

// Virtual for full designation info
designationSchema.virtual('fullInfo').get(function() {
  return `${this.title} - ${this.level}`;
});

// Static method to find active designations
designationSchema.statics.findActive = function() {
  return this.find({ isActive: true })
    .populate('department', 'name code')
    .populate('section', 'name code')
    .sort({ title: 1 });
};

// Static method to find designations by department
designationSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, isActive: true }).sort({ title: 1 });
};

// Static method to find designations by section
designationSchema.statics.findBySection = function(sectionId) {
  return this.find({ section: sectionId, isActive: true }).sort({ title: 1 });
};

module.exports = mongoose.model('Designation', designationSchema); 