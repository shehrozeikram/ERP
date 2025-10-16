const mongoose = require('mongoose');

const subRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Sub-role name is required'],
    trim: true,
    maxlength: [100, 'Sub-role name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  module: {
    type: String,
    required: [true, 'Module is required'],
    enum: ['admin', 'hr', 'finance', 'procurement', 'sales', 'crm', 'audit', 'it'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permissions: [{
    submodule: {
      type: String,
      required: true,
      trim: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'approve'],
      required: true
    }]
  }]
}, {
  timestamps: true
});

// Index for better query performance
subRoleSchema.index({ module: 1, isActive: 1 });
subRoleSchema.index({ name: 1, module: 1 });

// Virtual for permission count
subRoleSchema.virtual('permissionCount').get(function() {
  return this.permissions.length;
});

// Method to check if sub-role has permission for a specific submodule and action
subRoleSchema.methods.hasPermission = function(submodule, action) {
  const permission = this.permissions.find(p => p.submodule === submodule);
  return permission ? permission.actions.includes(action) : false;
};

// Method to get all allowed submodules
subRoleSchema.methods.getAllowedSubmodules = function() {
  return this.permissions.map(p => p.submodule);
};

// Static method to find sub-roles by module
subRoleSchema.statics.findByModule = function(module) {
  return this.find({ module, isActive: true });
};

// Static method to find sub-roles created by user
subRoleSchema.statics.findByCreator = function(createdBy) {
  return this.find({ createdBy, isActive: true });
};

module.exports = mongoose.model('SubRole', subRoleSchema);
