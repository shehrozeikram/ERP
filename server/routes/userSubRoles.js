const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const { authMiddleware, authorize } = require('../middleware/auth');
const UserSubRole = require('../models/UserSubRole');
const SubRole = require('../models/SubRole');
const User = require('../models/User');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// @route   POST /api/user-sub-roles/assign
// @desc    Assign sub-role to user
// @access  Private (Admin/Super Admin)
router.post('/assign', [
  authorize('super_admin', 'admin'),
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('subRoleId')
    .isMongoId()
    .withMessage('Valid sub-role ID is required'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
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
    
    const { userId, subRoleId, expiresAt } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if sub-role exists
    const subRole = await SubRole.findById(subRoleId);
    if (!subRole || !subRole.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Sub-role not found or inactive'
      });
    }
    
    // Check if user already has this sub-role
    const existingAssignment = await UserSubRole.findOne({
      user: userId,
      subRole: subRoleId,
      isActive: true
    });
    
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'User already has this sub-role assigned'
      });
    }
    
    // Create new assignment
    const userSubRole = new UserSubRole({
      user: userId,
      subRole: subRoleId,
      assignedBy: req.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    
    await userSubRole.save();
    await userSubRole.populate([
      { path: 'user', select: 'firstName lastName email role' },
      { path: 'subRole', select: 'name description module permissions' },
      { path: 'assignedBy', select: 'firstName lastName email' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Sub-role assigned successfully',
      data: { userSubRole }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning sub-role',
      error: error.message
    });
  }
}));

// @route   GET /api/user-sub-roles/user/me
// @desc    Get current user's sub-roles
// @access  Private (All authenticated users)
router.get('/user/me', asyncHandler(async (req, res) => {
  try {
    const userSubRoles = await UserSubRole.findActiveByUser(req.user.id);
    
    res.json({
      success: true,
      data: { userSubRoles }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user sub-roles',
      error: error.message
    });
  }
}));

// @route   GET /api/user-sub-roles/user/:userId
// @desc    Get all sub-roles assigned to a user
// @access  Private (Admin/Super Admin)
router.get('/user/:userId', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userSubRoles = await UserSubRole.findActiveByUser(userId);
    
    res.json({
      success: true,
      data: { userSubRoles }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user sub-roles',
      error: error.message
    });
  }
}));

// @route   GET /api/user-sub-roles/sub-role/:subRoleId
// @desc    Get all users assigned to a sub-role
// @access  Private (Admin/Super Admin)
router.get('/sub-role/:subRoleId', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const { subRoleId } = req.params;
    
    const userSubRoles = await UserSubRole.findUsersBySubRole(subRoleId);
    
    res.json({
      success: true,
      data: { userSubRoles }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sub-role users',
      error: error.message
    });
  }
}));

// @route   DELETE /api/user-sub-roles/:id
// @desc    Unassign sub-role from user
// @access  Private (Admin/Super Admin)
router.delete('/:id', authorize('super_admin', 'admin'), asyncHandler(async (req, res) => {
  try {
    const userSubRole = await UserSubRole.findById(req.params.id);
    if (!userSubRole) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    // Soft delete
    userSubRole.isActive = false;
    await userSubRole.save();
    
    res.json({
      success: true,
      message: 'Sub-role unassigned successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unassigning sub-role',
      error: error.message
    });
  }
}));

// @route   PUT /api/user-sub-roles/:id/expire
// @desc    Update expiration date for sub-role assignment
// @access  Private (Admin/Super Admin)
router.put('/:id/expire', [
  authorize('super_admin', 'admin'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
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
    
    const { expiresAt } = req.body;
    
    const userSubRole = await UserSubRole.findById(req.params.id);
    if (!userSubRole) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    userSubRole.expiresAt = expiresAt ? new Date(expiresAt) : null;
    await userSubRole.save();
    
    res.json({
      success: true,
      message: 'Expiration date updated successfully',
      data: { userSubRole }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating expiration date',
      error: error.message
    });
  }
}));

module.exports = router;
