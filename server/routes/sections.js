const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Section = require('../models/hr/Section');
const Department = require('../models/hr/Department');

const router = express.Router();

// @route   GET /api/sections
// @desc    Get all sections
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { department, search } = req.query;
    
    const query = { isActive: true };
    
    if (department) {
      query.department = department;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const sections = await Section.find(query)
      .populate('department', 'name code')
      .populate('manager', 'firstName lastName employeeId')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: sections
    });
  })
);

// @route   GET /api/sections/:id
// @desc    Get section by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section ID format'
      });
    }

    const section = await Section.findById(req.params.id)
      .populate('department', 'name code')
      .populate('manager', 'firstName lastName employeeId');

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    res.json({
      success: true,
      data: section
    });
  })
);

// @route   POST /api/sections
// @desc    Create new section
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Section name is required'),
  body('code').trim().notEmpty().withMessage('Section code is required'),
  body('department').isMongoId().withMessage('Valid department ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Check if department exists
  const department = await Department.findById(req.body.department);
  if (!department) {
    return res.status(400).json({
      success: false,
      message: 'Department not found'
    });
  }

  const section = new Section(req.body);
  await section.save();

  const populatedSection = await Section.findById(section._id)
    .populate('department', 'name code')
    .populate('manager', 'firstName lastName employeeId');

  res.status(201).json({
    success: true,
    message: 'Section created successfully',
    data: populatedSection
  });
}));

// @route   PUT /api/sections/:id
// @desc    Update section
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Section name is required'),
  body('code').optional().trim().notEmpty().withMessage('Section code is required'),
  body('department').optional().isMongoId().withMessage('Valid department ID is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid section ID format'
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Check if department exists if being updated
  if (req.body.department) {
    const department = await Department.findById(req.body.department);
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department not found'
      });
    }
  }

  const section = await Section.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('department', 'name code')
   .populate('manager', 'firstName lastName employeeId');

  if (!section) {
    return res.status(404).json({
      success: false,
      message: 'Section not found'
    });
  }

  res.json({
    success: true,
    message: 'Section updated successfully',
    data: section
  });
}));

// @route   DELETE /api/sections/:id
// @desc    Delete section (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section ID format'
      });
    }

    const section = await Section.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  })
);

module.exports = router; 