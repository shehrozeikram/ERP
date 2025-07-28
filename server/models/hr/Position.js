const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Position title is required'],
    trim: true,
    maxlength: [100, 'Position title cannot exceed 100 characters']
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

// Index for efficient queries
positionSchema.index({ department: 1, isActive: 1 });
positionSchema.index({ title: 1 });

// Virtual for full position info
positionSchema.virtual('fullInfo').get(function() {
  return `${this.title} - ${this.level}`;
});

// Static method to find positions by department
positionSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, isActive: true }).sort({ title: 1 });
};

// Static method to find active positions
positionSchema.statics.findActive = function() {
  return this.find({ isActive: true }).populate('department', 'name').sort({ title: 1 });
};

module.exports = mongoose.model('Position', positionSchema); 