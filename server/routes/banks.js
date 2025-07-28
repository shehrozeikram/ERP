const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Bank = require('../models/hr/Bank');

const router = express.Router();

// @route   GET /api/banks
// @desc    Get all banks
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { country, type, search } = req.query;
    
    const query = { isActive: true };
    
    if (country) {
      query.country = country;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const banks = await Bank.find(query).sort({ name: 1 });

    res.json({
      success: true,
      data: banks
    });
  })
);

// @route   GET /api/banks/:id
// @desc    Get bank by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank ID format'
      });
    }

    const bank = await Bank.findById(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank not found'
      });
    }

    res.json({
      success: true,
      data: bank
    });
  })
);

// @route   POST /api/banks
// @desc    Create new bank
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Bank name is required'),
  body('code').trim().notEmpty().withMessage('Bank code is required'),
  body('type').optional().isIn(['Commercial', 'Islamic', 'Investment', 'Central', 'Development', 'Other']).withMessage('Valid bank type is required'),
  body('country').optional().trim().notEmpty().withMessage('Country is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const bank = new Bank(req.body);
  await bank.save();

  res.status(201).json({
    success: true,
    message: 'Bank created successfully',
    data: bank
  });
}));

// @route   PUT /api/banks/:id
// @desc    Update bank
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Bank name is required'),
  body('code').optional().trim().notEmpty().withMessage('Bank code is required'),
  body('type').optional().isIn(['Commercial', 'Islamic', 'Investment', 'Central', 'Development', 'Other']).withMessage('Valid bank type is required'),
  body('country').optional().trim().notEmpty().withMessage('Country is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid bank ID format'
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

  const bank = await Bank.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!bank) {
    return res.status(404).json({
      success: false,
      message: 'Bank not found'
    });
  }

  res.json({
    success: true,
    message: 'Bank updated successfully',
    data: bank
  });
}));

// @route   DELETE /api/banks/:id
// @desc    Delete bank (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank ID format'
      });
    }

    const bank = await Bank.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank not found'
      });
    }

    res.json({
      success: true,
      message: 'Bank deleted successfully'
    });
  })
);

module.exports = router; 