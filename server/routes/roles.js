const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all roles
router.get('/', 
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'read'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '', isActive } = req.query;
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const roles = await Role.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('userCount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Role.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        roles,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  })
);

// Get role by ID
router.get('/:id',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'read'),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('userCount');
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.json({
      success: true,
      data: { role }
    });
  })
);

// Create new role
router.post('/',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'create'),
  asyncHandler(async (req, res) => {
    const { name, displayName, description, permissions: rolePermissions, isActive = true } = req.body;
    
    // Validate required fields
    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Name and display name are required'
      });
    }
    
    // Check if role already exists
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }
    
    // Validate permissions structure
    if (rolePermissions && Array.isArray(rolePermissions)) {
      for (const permission of rolePermissions) {
        if (!permission.module || !Array.isArray(permission.submodules) || !Array.isArray(permission.actions)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid permission structure'
          });
        }
      }
    }
    
    const role = new Role({
      name: name.toLowerCase(),
      displayName,
      description: description || '',
      permissions: rolePermissions || [],
      isActive,
      createdBy: req.user.id
    });
    
    await role.save();
    
    // Populate the created role
    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'firstName lastName');
    
    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: { role: populatedRole }
    });
  })
);

// Update role
router.put('/:id',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'update'),
  asyncHandler(async (req, res) => {
    const { displayName, description, permissions: rolePermissions, isActive } = req.body;
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    // Prevent updating system roles
    if (role.isSystemRole) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update system role'
      });
    }
    
    // Validate permissions structure if provided
    if (rolePermissions && Array.isArray(rolePermissions)) {
      for (const permission of rolePermissions) {
        if (!permission.module || !Array.isArray(permission.submodules) || !Array.isArray(permission.actions)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid permission structure'
          });
        }
      }
    }
    
    // Update fields
    if (displayName !== undefined) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (rolePermissions !== undefined) role.permissions = rolePermissions;
    if (isActive !== undefined) role.isActive = isActive;
    role.updatedBy = req.user.id;
    
    await role.save();
    
    // Populate the updated role
    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    res.json({
      success: true,
      message: 'Role updated successfully',
      data: { role: populatedRole }
    });
  })
);

// Delete role
router.delete('/:id',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'delete'),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    // Prevent deleting system roles
    if (role.isSystemRole) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system role'
      });
    }
    
    // Check if role is assigned to any users
    const userCount = await User.countDocuments({ role: role.name });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. It is assigned to ${userCount} user(s)`
      });
    }
    
    await Role.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  })
);

// Get available modules and submodules for role creation
router.get('/modules/available',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'read'),
  asyncHandler(async (req, res) => {
    const { SUBMODULES, MODULES } = require('../config/permissions');
    
    const availableModules = Object.keys(SUBMODULES).map(moduleKey => ({
      key: moduleKey,
      name: MODULES[moduleKey] || moduleKey,
      submodules: SUBMODULES[moduleKey] || []
    }));
    
    res.json({
      success: true,
      data: { modules: availableModules }
    });
  })
);

// Get users assigned to a specific role
router.get('/:id/users',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'sub_roles', 'read'),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    const users = await User.find({ role: role.name })
      .select('firstName lastName email isActive createdAt')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: { users }
    });
  })
);

module.exports = router;
