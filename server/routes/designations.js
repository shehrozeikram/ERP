const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Designation = require('../models/hr/Designation');
const Department = require('../models/hr/Department');
const Section = require('../models/hr/Section');

const router = express.Router();

// @route   GET /api/designations
// @desc    Get all designations
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { department, section, search } = req.query;
    
    const query = { isActive: true };
    
    if (department) {
      query.department = department;
    }
    
    if (section) {
      query.section = section;
    }
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const designations = await Designation.find(query)
      .populate('department', 'name code')
      .populate('section', 'name code')
      .sort({ title: 1 });

    res.json({
      success: true,
      data: designations
    });
  })
);

// @route   GET /api/designations/:id
// @desc    Get designation by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designation ID format'
      });
    }

    const designation = await Designation.findById(req.params.id)
      .populate('department', 'name code')
      .populate('section', 'name code');

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    res.json({
      success: true,
      data: designation
    });
  })
);

// @route   POST /api/designations
// @desc    Create new designation
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('title').trim().notEmpty().withMessage('Designation title is required'),
  body('code').trim().notEmpty().withMessage('Designation code is required'),
  body('department').isMongoId().withMessage('Valid department ID is required'),
  body('section').optional().isMongoId().withMessage('Valid section ID is required'),
  body('level').optional().isIn(['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive']).withMessage('Valid level is required')
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

  // Check if section exists if provided
  if (req.body.section) {
    const section = await Section.findById(req.body.section);
    if (!section) {
      return res.status(400).json({
        success: false,
        message: 'Section not found'
      });
    }
  }

  const designation = new Designation(req.body);
  await designation.save();

  const populatedDesignation = await Designation.findById(designation._id)
    .populate('department', 'name code')
    .populate('section', 'name code');

  res.status(201).json({
    success: true,
    message: 'Designation created successfully',
    data: populatedDesignation
  });
}));

// @route   PUT /api/designations/:id
// @desc    Update designation
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('title').optional().trim().notEmpty().withMessage('Designation title is required'),
  body('code').optional().trim().notEmpty().withMessage('Designation code is required'),
  body('department').optional().isMongoId().withMessage('Valid department ID is required'),
  body('section').optional().isMongoId().withMessage('Valid section ID is required'),
  body('level').optional().isIn(['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive']).withMessage('Valid level is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid designation ID format'
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

  // Check if section exists if being updated
  if (req.body.section) {
    const section = await Section.findById(req.body.section);
    if (!section) {
      return res.status(400).json({
        success: false,
        message: 'Section not found'
      });
    }
  }

  const designation = await Designation.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('department', 'name code')
   .populate('section', 'name code');

  if (!designation) {
    return res.status(404).json({
      success: false,
      message: 'Designation not found'
    });
  }

  res.json({
    success: true,
    message: 'Designation updated successfully',
    data: designation
  });
}));

// @route   DELETE /api/designations/:id
// @desc    Delete designation (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designation ID format'
      });
    }

    const designation = await Designation.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    res.json({
      success: true,
      message: 'Designation deleted successfully'
    });
  })
);

module.exports = router; 