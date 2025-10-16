const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Position = require('../models/hr/Position');
const Department = require('../models/hr/Department');

const router = express.Router();

// @route   GET /api/positions
// @desc    Get all positions
// @access  Private (HR and Admin)
router.get('/', 
  authorize('super_admin', 'admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { department, search } = req.query;
    
    const query = { isActive: true };
    
    if (department) {
      query.department = department;
    }
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const positions = await Position.find(query)
      .populate('department', 'name code')
      .sort({ title: 1 });

    res.json({
      success: true,
      data: positions
    });
  })
);

// @route   GET /api/positions/:id
// @desc    Get position by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('super_admin', 'admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID format'
      });
    }

    const position = await Position.findById(req.params.id)
      .populate('department', 'name code');

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    res.json({
      success: true,
      data: position
    });
  })
);

// @route   POST /api/positions
// @desc    Create new position
// @access  Private (HR and Admin)
router.post('/', [
  authorize('super_admin', 'admin', 'hr_manager'),
  body('title').trim().notEmpty().withMessage('Position title is required'),
  body('department').isMongoId().withMessage('Valid department ID is required'),
  body('level').optional().isIn(['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive']).withMessage('Valid level is required'),
  body('minSalary').optional().isNumeric().withMessage('Minimum salary must be a number'),
  body('maxSalary').optional().isNumeric().withMessage('Maximum salary must be a number')
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

  const position = new Position(req.body);
  await position.save();

  const populatedPosition = await Position.findById(position._id)
    .populate('department', 'name code');

  res.status(201).json({
    success: true,
    message: 'Position created successfully',
    data: populatedPosition
  });
}));

// @route   PUT /api/positions/:id
// @desc    Update position
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('super_admin', 'admin', 'hr_manager'),
  body('title').optional().trim().notEmpty().withMessage('Position title is required'),
  body('department').optional().isMongoId().withMessage('Valid department ID is required'),
  body('level').optional().isIn(['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive']).withMessage('Valid level is required'),
  body('minSalary').optional().isNumeric().withMessage('Minimum salary must be a number'),
  body('maxSalary').optional().isNumeric().withMessage('Maximum salary must be a number')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid position ID format'
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

  const position = await Position.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('department', 'name code');

  if (!position) {
    return res.status(404).json({
      success: false,
      message: 'Position not found'
    });
  }

  res.json({
    success: true,
    message: 'Position updated successfully',
    data: position
  });
}));

// @route   DELETE /api/positions/:id
// @desc    Delete position (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('super_admin', 'admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID format'
      });
    }

    const position = await Position.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    res.json({
      success: true,
      message: 'Position deleted successfully'
    });
  })
);

module.exports = router; 