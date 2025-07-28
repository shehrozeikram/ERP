const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Country = require('../models/hr/Country');

const router = express.Router();

// @route   GET /api/countries
// @desc    Get all countries
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    
    const query = { isActive: true };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const countries = await Country.find(query).sort({ name: 1 });

    res.json({
      success: true,
      data: countries
    });
  })
);

// @route   GET /api/countries/:id
// @desc    Get country by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country ID format'
      });
    }

    const country = await Country.findById(req.params.id);

    if (!country) {
      return res.status(404).json({
        success: false,
        message: 'Country not found'
      });
    }

    res.json({
      success: true,
      data: country
    });
  })
);

// @route   POST /api/countries
// @desc    Create new country
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Country name is required'),
  body('code').trim().notEmpty().withMessage('Country code is required'),
  body('iso3').trim().notEmpty().withMessage('ISO3 code is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const country = new Country(req.body);
  await country.save();

  res.status(201).json({
    success: true,
    message: 'Country created successfully',
    data: country
  });
}));

// @route   PUT /api/countries/:id
// @desc    Update country
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Country name is required'),
  body('code').optional().trim().notEmpty().withMessage('Country code is required'),
  body('iso3').optional().trim().notEmpty().withMessage('ISO3 code is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid country ID format'
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

  const country = await Country.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!country) {
    return res.status(404).json({
      success: false,
      message: 'Country not found'
    });
  }

  res.json({
    success: true,
    message: 'Country updated successfully',
    data: country
  });
}));

// @route   DELETE /api/countries/:id
// @desc    Delete country (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country ID format'
      });
    }

    const country = await Country.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!country) {
      return res.status(404).json({
        success: false,
        message: 'Country not found'
      });
    }

    res.json({
      success: true,
      message: 'Country deleted successfully'
    });
  })
);

module.exports = router; 