const mongoose = require('mongoose');

const approvalLevelConfigurationSchema = new mongoose.Schema({
  module: {
    type: String,
    required: true,
    enum: ['evaluation_appraisal', 'leave_management', 'loan_management', 'settlement_management'],
    index: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  title: {
    type: String,
    required: true
  },
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false // Optional, can be linked if user has employee record
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index to ensure unique level per module
approvalLevelConfigurationSchema.index({ module: 1, level: 1 }, { unique: true });

// Index for faster lookups
approvalLevelConfigurationSchema.index({ module: 1, isActive: 1 });
approvalLevelConfigurationSchema.index({ assignedUser: 1 });

// Static method to get active configuration for a module
approvalLevelConfigurationSchema.statics.getActiveForModule = function(module) {
  return this.find({ module, isActive: true })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .sort({ level: 1 });
};

// Static method to get configuration for a specific level
approvalLevelConfigurationSchema.statics.getByModuleAndLevel = function(module, level) {
  return this.findOne({ module, level, isActive: true })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId');
};

// Static method to check if user is assigned to a level
approvalLevelConfigurationSchema.statics.isUserAssigned = async function(module, level, userId) {
  const config = await this.findOne({ module, level, isActive: true });
  if (!config) return false;
  return config.assignedUser.toString() === userId.toString();
};

module.exports = mongoose.model('ApprovalLevelConfiguration', approvalLevelConfigurationSchema);

