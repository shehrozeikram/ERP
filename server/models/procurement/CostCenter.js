const mongoose = require('mongoose');

const costCenterSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Cost center code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Code cannot exceed 20 characters']
  },
  name: {
    type: String,
    required: [true, 'Cost center name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  departmentName: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  managerName: {
    type: String,
    trim: true
  },
  budget: {
    type: Number,
    default: 0,
    min: 0
  },
  budgetPeriod: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Annual'],
    default: 'Annual'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  },
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

costCenterSchema.index({ code: 1 });
costCenterSchema.index({ department: 1 });
costCenterSchema.index({ isActive: 1 });

module.exports = mongoose.model('CostCenter', costCenterSchema);
