const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Company = require('../models/hr/Company');

const router = express.Router();

// @route   GET /api/companies
// @desc    Get all companies
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { type, search } = req.query;
    
    const query = { isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const companies = await Company.find(query).sort({ name: 1 });

    res.json({
      success: true,
      data: companies
    });
  })
);

// @route   GET /api/companies/:id
// @desc    Get company by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format'
      });
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  })
);

// @route   POST /api/companies
// @desc    Create new company
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Company name is required'),
  body('code').trim().notEmpty().withMessage('Company code is required'),
  body('type').optional().isIn(['Client', 'Partner', 'Subsidiary', 'Parent', 'Other']).withMessage('Valid company type is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const company = new Company(req.body);
  await company.save();

  res.status(201).json({
    success: true,
    message: 'Company created successfully',
    data: company
  });
}));

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Company name is required'),
  body('code').optional().trim().notEmpty().withMessage('Company code is required'),
  body('type').optional().isIn(['Client', 'Partner', 'Subsidiary', 'Parent', 'Other']).withMessage('Valid company type is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid company ID format'
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

  const company = await Company.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Company not found'
    });
  }

  res.json({
    success: true,
    message: 'Company updated successfully',
    data: company
  });
}));

// @route   DELETE /api/companies/:id
// @desc    Delete company (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format'
      });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  })
);

module.exports = router; 