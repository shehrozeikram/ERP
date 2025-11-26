const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const WaterUtilitySlab = require('../models/tajResidencia/WaterUtilitySlab');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all Water Utility Slabs
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const slabs = await WaterUtilitySlab.find()
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: slabs
  });
}));

// Get active Water Utility Slabs
router.get('/active', authMiddleware, asyncHandler(async (req, res) => {
  const activeSlabs = await WaterUtilitySlab.getActiveSlabs();
  
  if (!activeSlabs) {
    return res.status(404).json({
      success: false,
      message: 'No active water utility slabs found'
    });
  }

  res.json({
    success: true,
    data: activeSlabs
  });
}));

// Get Water Utility Slab by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const slab = await WaterUtilitySlab.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  if (!slab) {
    return res.status(404).json({
      success: false,
      message: 'Water utility slab not found'
    });
  }

  res.json({
    success: true,
    data: slab
  });
}));

// Create new Water Utility Slabs
router.post('/', authMiddleware, [
  body('slabs').isArray({ min: 1 }).withMessage('At least one slab is required'),
  body('slabs.*.lowerSlab').isNumeric().withMessage('Lower slab must be numeric').isFloat({ min: 0 }).withMessage('Lower slab cannot be negative'),
  body('slabs.*.higherSlab').isNumeric().withMessage('Higher slab must be numeric').isFloat({ min: 0 }).withMessage('Higher slab cannot be negative'),
  body('slabs.*.unitsSlab').notEmpty().withMessage('Units slab is required'),
  body('slabs.*.fixRate').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    return num >= 0;
  }).withMessage('Fix rate must be a non-negative number or empty'),
  body('slabs.*.unitRate').isNumeric().withMessage('Unit rate must be numeric').isFloat({ min: 0 }).withMessage('Unit rate cannot be negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // If this is set as active, deactivate others
  if (req.body.isActive) {
    await WaterUtilitySlab.updateMany({}, { isActive: false });
  }

  // Process slabs to convert empty fixRate strings to null
  if (req.body.slabs) {
    req.body.slabs = req.body.slabs.map(slab => ({
      ...slab,
      fixRate: slab.fixRate === '' || slab.fixRate === null || slab.fixRate === undefined ? null : parseFloat(slab.fixRate)
    }));
  }

  const waterUtilitySlabs = new WaterUtilitySlab({
    ...req.body,
    createdBy: req.user.id
  });

  await waterUtilitySlabs.save();

  const populatedSlabs = await WaterUtilitySlab.findById(waterUtilitySlabs._id)
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Water utility slabs created successfully',
    data: populatedSlabs
  });
}));

// Update Water Utility Slabs
router.put('/:id', authMiddleware, [
  body('slabs').optional().isArray({ min: 1 }).withMessage('At least one slab is required'),
  body('slabs.*.lowerSlab').optional().isNumeric().withMessage('Lower slab must be numeric').isFloat({ min: 0 }).withMessage('Lower slab cannot be negative'),
  body('slabs.*.higherSlab').optional().isNumeric().withMessage('Higher slab must be numeric').isFloat({ min: 0 }).withMessage('Higher slab cannot be negative'),
  body('slabs.*.unitsSlab').optional().notEmpty().withMessage('Units slab is required'),
  body('slabs.*.fixRate').optional({ nullable: true, checkFalsy: true }).custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    return num >= 0;
  }).withMessage('Fix rate must be a non-negative number or empty'),
  body('slabs.*.unitRate').optional().isNumeric().withMessage('Unit rate must be numeric').isFloat({ min: 0 }).withMessage('Unit rate cannot be negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const waterUtilitySlabs = await WaterUtilitySlab.findById(req.params.id);
  if (!waterUtilitySlabs) {
    return res.status(404).json({
      success: false,
      message: 'Water utility slabs not found'
    });
  }

  // If this is set as active, deactivate others
  if (req.body.isActive) {
    await WaterUtilitySlab.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
  }

  // Process slabs to convert empty fixRate strings to null
  if (req.body.slabs) {
    req.body.slabs = req.body.slabs.map(slab => ({
      ...slab,
      fixRate: slab.fixRate === '' || slab.fixRate === null || slab.fixRate === undefined ? null : parseFloat(slab.fixRate)
    }));
  }

  const updatedSlabs = await WaterUtilitySlab.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      updatedBy: req.user.id
    },
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName')
   .populate('updatedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Water utility slabs updated successfully',
    data: updatedSlabs
  });
}));

// Delete Water Utility Slabs
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const waterUtilitySlabs = await WaterUtilitySlab.findById(req.params.id);
  if (!waterUtilitySlabs) {
    return res.status(404).json({
      success: false,
      message: 'Water utility slabs not found'
    });
  }

  await WaterUtilitySlab.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Water utility slabs deleted successfully'
  });
}));

module.exports = router;

