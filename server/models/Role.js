const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  permissions: [{
    module: {
      type: String,
      required: true,
      enum: ['admin', 'hr', 'finance', 'procurement', 'sales', 'crm', 'it', 'dashboard', 'audit', 'taj_residencia']
    },
    submodules: [{
      type: String,
      required: true
    }],
    actions: [{
      type: String,
      required: true,
      enum: ['create', 'read', 'update', 'delete', 'approve', 'export', 'import']
    }]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemRole: {
    type: Boolean,
    default: false // System roles cannot be deleted
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Not required for system roles
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better performance
roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });

// Virtual for user count
roleSchema.virtual('userCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'role',
  count: true
});

// Method to check if role has permission for a specific module
roleSchema.methods.hasModulePermission = function(module) {
  return this.permissions.some(permission => permission.module === module);
};

// Method to check if role has permission for a specific submodule
roleSchema.methods.hasSubmodulePermission = function(module, submodule) {
  const modulePermission = this.permissions.find(p => p.module === module);
  return modulePermission ? modulePermission.submodules.includes(submodule) : false;
};

// Method to check if role has permission for a specific action
roleSchema.methods.hasActionPermission = function(module, submodule, action) {
  const modulePermission = this.permissions.find(p => p.module === module);
  if (!modulePermission) return false;
  
  const hasSubmodule = modulePermission.submodules.includes(submodule);
  const hasAction = modulePermission.actions.includes(action);
  
  return hasSubmodule && hasAction;
};

// Method to get all allowed modules for this role
roleSchema.methods.getAllowedModules = function() {
  return this.permissions.map(p => p.module);
};

// Method to get all allowed submodules for a specific module
roleSchema.methods.getAllowedSubmodules = function(module) {
  const modulePermission = this.permissions.find(p => p.module === module);
  return modulePermission ? modulePermission.submodules : [];
};

// Method to get all allowed actions for a specific module and submodule
roleSchema.methods.getAllowedActions = function(module, submodule) {
  const modulePermission = this.permissions.find(p => p.module === module);
  if (!modulePermission || !modulePermission.submodules.includes(submodule)) {
    return [];
  }
  return modulePermission.actions;
};

// Pre-save middleware to ensure lowercase name
roleSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.toLowerCase();
  }
  next();
});

// Pre-remove middleware to prevent deletion of system roles
roleSchema.pre('remove', function(next) {
  if (this.isSystemRole) {
    const error = new Error('Cannot delete system role');
    error.statusCode = 400;
    return next(error);
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);
