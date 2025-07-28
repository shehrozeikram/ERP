const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

const router = express.Router();

// @route   GET /api/cities
// @desc    Get all cities
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { province, country, search } = req.query;
    
    const query = { isActive: true };
    
    if (province) {
      query.province = province;
    }
    
    if (country) {
      query.country = country;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const cities = await City.find(query)
      .populate('province', 'name code')
      .populate('country', 'name code')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: cities
    });
  })
);

// @route   GET /api/cities/:id
// @desc    Get city by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city ID format'
      });
    }

    const city = await City.findById(req.params.id)
      .populate('province', 'name code')
      .populate('country', 'name code');

    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    res.json({
      success: true,
      data: city
    });
  })
);

// @route   POST /api/cities
// @desc    Create new city
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('City name is required'),
  body('code').trim().notEmpty().withMessage('City code is required'),
  body('province').isMongoId().withMessage('Valid province ID is required'),
  body('country').isMongoId().withMessage('Valid country ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Check if province exists
  const province = await Province.findById(req.body.province);
  if (!province) {
    return res.status(400).json({
      success: false,
      message: 'Province not found'
    });
  }

  // Check if country exists
  const country = await Country.findById(req.body.country);
  if (!country) {
    return res.status(400).json({
      success: false,
      message: 'Country not found'
    });
  }

  const city = new City(req.body);
  await city.save();

  const populatedCity = await City.findById(city._id)
    .populate('province', 'name code')
    .populate('country', 'name code');

  res.status(201).json({
    success: true,
    message: 'City created successfully',
    data: populatedCity
  });
}));

// @route   PUT /api/cities/:id
// @desc    Update city
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('City name is required'),
  body('code').optional().trim().notEmpty().withMessage('City code is required'),
  body('province').optional().isMongoId().withMessage('Valid province ID is required'),
  body('country').optional().isMongoId().withMessage('Valid country ID is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid city ID format'
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

  // Check if province exists if being updated
  if (req.body.province) {
    const province = await Province.findById(req.body.province);
    if (!province) {
      return res.status(400).json({
        success: false,
        message: 'Province not found'
      });
    }
  }

  // Check if country exists if being updated
  if (req.body.country) {
    const country = await Country.findById(req.body.country);
    if (!country) {
      return res.status(400).json({
        success: false,
        message: 'Country not found'
      });
    }
  }

  const city = await City.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('province', 'name code')
   .populate('country', 'name code');

  if (!city) {
    return res.status(404).json({
      success: false,
      message: 'City not found'
    });
  }

  res.json({
    success: true,
    message: 'City updated successfully',
    data: city
  });
}));

// @route   DELETE /api/cities/:id
// @desc    Delete city (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city ID format'
      });
    }

    const city = await City.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    res.json({
      success: true,
      message: 'City deleted successfully'
    });
  })
);

module.exports = router; 