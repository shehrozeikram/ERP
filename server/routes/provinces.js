const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

const router = express.Router();

// @route   GET /api/provinces
// @desc    Get all provinces
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { country, search } = req.query;
    
    const query = { isActive: true };
    
    if (country) {
      query.country = country;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const provinces = await Province.find(query)
      .populate('country', 'name code')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: provinces
    });
  })
);

// @route   GET /api/provinces/:id
// @desc    Get province by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province ID format'
      });
    }

    const province = await Province.findById(req.params.id)
      .populate('country', 'name code');

    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }

    res.json({
      success: true,
      data: province
    });
  })
);

// @route   POST /api/provinces
// @desc    Create new province
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Province name is required'),
  body('code').trim().notEmpty().withMessage('Province code is required'),
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

  // Check if country exists
  const country = await Country.findById(req.body.country);
  if (!country) {
    return res.status(400).json({
      success: false,
      message: 'Country not found'
    });
  }

  const province = new Province(req.body);
  await province.save();

  const populatedProvince = await Province.findById(province._id)
    .populate('country', 'name code');

  res.status(201).json({
    success: true,
    message: 'Province created successfully',
    data: populatedProvince
  });
}));

// @route   PUT /api/provinces/:id
// @desc    Update province
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Province name is required'),
  body('code').optional().trim().notEmpty().withMessage('Province code is required'),
  body('country').optional().isMongoId().withMessage('Valid country ID is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
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

  const province = await Province.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('country', 'name code');

  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }

  res.json({
    success: true,
    message: 'Province updated successfully',
    data: province
  });
}));

// @route   DELETE /api/provinces/:id
// @desc    Delete province (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province ID format'
      });
    }

    const province = await Province.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }

    res.json({
      success: true,
      message: 'Province deleted successfully'
    });
  })
);

module.exports = router; 