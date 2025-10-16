const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { authMiddleware, authorize } = require('../middleware/auth');
const { checkSubRoleAccess, SUBMODULES, MODULES } = require('../config/permissions');
const SubRole = require('../models/SubRole');
const UserSubRole = require('../models/UserSubRole');
const User = require('../models/User');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// @route   GET /api/sub-roles
// @desc    Get all sub-roles with pagination and filters
// @access  Private (Admin/Super Admin)
router.get('/', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, module, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = { isActive: true };
    if (module) filter.module = module;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const subRoles = await SubRole.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await SubRole.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        subRoles,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sub-roles',
      error: error.message
    });
  }
}));

// @route   GET /api/sub-roles/:id
// @desc    Get single sub-role by ID
// @access  Private (Admin/Super Admin)
router.get('/:id', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const subRole = await SubRole.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');
    
    if (!subRole) {
      return res.status(404).json({
        success: false,
        message: 'Sub-role not found'
      });
    }
    
    res.json({
      success: true,
      data: { subRole }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sub-role',
      error: error.message
    });
  }
}));

// @route   POST /api/sub-roles
// @desc    Create new sub-role
// @access  Private (Admin/Super Admin)
router.post('/', [
  authorize('super_admin', 'admin'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('module')
    .isIn(Object.values(MODULES))
    .withMessage('Invalid module'),
  body('permissions')
    .isArray({ min: 1 })
    .withMessage('At least one permission is required'),
  body('permissions.*.submodule')
    .notEmpty()
    .withMessage('Submodule is required'),
  body('permissions.*.actions')
    .isArray({ min: 1 })
    .withMessage('At least one action is required')
], asyncHandler(async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { name, description, module, permissions } = req.body;
    
    // Validate submodules belong to the specified module
    const validSubmodules = SUBMODULES[module] || [];
    for (const permission of permissions) {
      if (!validSubmodules.includes(permission.submodule)) {
        return res.status(400).json({
          success: false,
          message: `Invalid submodule: ${permission.submodule} for module: ${module}`
        });
      }
    }
    
    // Check if sub-role name already exists for this module
    const existingSubRole = await SubRole.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }, 
      module,
      isActive: true 
    });
    
    if (existingSubRole) {
      return res.status(400).json({
        success: false,
        message: 'Sub-role with this name already exists for this module'
      });
    }
    
    const subRole = new SubRole({
      name,
      description,
      module,
      permissions,
      createdBy: req.user.id
    });
    
    await subRole.save();
    await subRole.populate('createdBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Sub-role created successfully',
      data: { subRole }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating sub-role',
      error: error.message
    });
  }
}));

// @route   PUT /api/sub-roles/:id
// @desc    Update sub-role
// @access  Private (Admin/Super Admin)
router.put('/:id', [
  authorize('super_admin', 'admin'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('permissions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one permission is required')
], asyncHandler(async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { name, description, permissions } = req.body;
    
    const subRole = await SubRole.findById(req.params.id);
    if (!subRole) {
      return res.status(404).json({
        success: false,
        message: 'Sub-role not found'
      });
    }
    
    // Validate submodules if permissions are being updated
    if (permissions) {
      const validSubmodules = SUBMODULES[subRole.module] || [];
      for (const permission of permissions) {
        if (!validSubmodules.includes(permission.submodule)) {
          return res.status(400).json({
            success: false,
            message: `Invalid submodule: ${permission.submodule} for module: ${subRole.module}`
          });
        }
      }
    }
    
    // Check if sub-role name already exists for this module (excluding current sub-role)
    if (name && name !== subRole.name) {
      const existingSubRole = await SubRole.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') }, 
        module: subRole.module,
        isActive: true,
        _id: { $ne: subRole._id }
      });
      
      if (existingSubRole) {
        return res.status(400).json({
          success: false,
          message: 'Sub-role with this name already exists for this module'
        });
      }
    }
    
    // Update sub-role
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions) updateData.permissions = permissions;
    
    const updatedSubRole = await SubRole.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');
    
    res.json({
      success: true,
      message: 'Sub-role updated successfully',
      data: { subRole: updatedSubRole }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating sub-role',
      error: error.message
    });
  }
}));

// @route   DELETE /api/sub-roles/:id
// @desc    Delete sub-role (soft delete)
// @access  Private (Admin/Super Admin)
router.delete('/:id', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const subRole = await SubRole.findById(req.params.id);
    if (!subRole) {
      return res.status(404).json({
        success: false,
        message: 'Sub-role not found'
      });
    }
    
    // Check if sub-role is assigned to any users
    const assignedUsers = await UserSubRole.find({ subRole: subRole._id, isActive: true });
    if (assignedUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete sub-role. It is assigned to ${assignedUsers.length} user(s). Please unassign users first.`
      });
    }
    
    // Soft delete
    subRole.isActive = false;
    await subRole.save();
    
    res.json({
      success: true,
      message: 'Sub-role deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting sub-role',
      error: error.message
    });
  }
}));

// @route   GET /api/sub-roles/modules/:module/submodules
// @desc    Get available submodules for a module
// @access  Private (Admin/Super Admin)
router.get('/modules/:module/submodules', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const { module } = req.params;
    
    if (!Object.values(MODULES).includes(module)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid module'
      });
    }
    
    const submodules = SUBMODULES[module] || [];
    
    res.json({
      success: true,
      data: { submodules }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching submodules',
      error: error.message
    });
  }
}));

module.exports = router;
