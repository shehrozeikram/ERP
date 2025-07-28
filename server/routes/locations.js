const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Location = require('../models/hr/Location');

const router = express.Router();

// @route   GET /api/locations
// @desc    Get all locations
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { type, city, search } = req.query;
    
    const query = { isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    if (city) {
      query['address.city'] = city;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const locations = await Location.find(query).sort({ name: 1 });

    res.json({
      success: true,
      data: locations
    });
  })
);

// @route   GET /api/locations/:id
// @desc    Get location by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location ID format'
      });
    }

    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.json({
      success: true,
      data: location
    });
  })
);

// @route   POST /api/locations
// @desc    Create new location
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Location name is required'),
  body('code').trim().notEmpty().withMessage('Location code is required'),
  body('type').optional().isIn(['Office', 'Branch', 'Site', 'Remote', 'Client Site', 'Other']).withMessage('Valid location type is required'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.zipCode').notEmpty().withMessage('ZIP code is required'),
  body('address.country').notEmpty().withMessage('Country is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const location = new Location(req.body);
  await location.save();

  res.status(201).json({
    success: true,
    message: 'Location created successfully',
    data: location
  });
}));

// @route   PUT /api/locations/:id
// @desc    Update location
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Location name is required'),
  body('code').optional().trim().notEmpty().withMessage('Location code is required'),
  body('type').optional().isIn(['Office', 'Branch', 'Site', 'Remote', 'Client Site', 'Other']).withMessage('Valid location type is required'),
  body('address.street').optional().notEmpty().withMessage('Street address is required'),
  body('address.city').optional().notEmpty().withMessage('City is required'),
  body('address.state').optional().notEmpty().withMessage('State is required'),
  body('address.zipCode').optional().notEmpty().withMessage('ZIP code is required'),
  body('address.country').optional().notEmpty().withMessage('Country is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location ID format'
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

  const location = await Location.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!location) {
    return res.status(404).json({
      success: false,
      message: 'Location not found'
    });
  }

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: location
  });
}));

// @route   DELETE /api/locations/:id
// @desc    Delete location (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location ID format'
      });
    }

    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  })
);

module.exports = router; 