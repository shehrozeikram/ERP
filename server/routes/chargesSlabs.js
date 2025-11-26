const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const ChargesSlab = require('../models/tajResidencia/ChargesSlab');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all Charges Slabs
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const slabs = await ChargesSlab.find()
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: slabs
  });
}));

// Get active Charges Slabs
router.get('/active', authMiddleware, asyncHandler(async (req, res) => {
  const activeSlabs = await ChargesSlab.getActiveSlabs();
  
  if (!activeSlabs) {
    return res.status(404).json({
      success: false,
      message: 'No active charges slabs found'
    });
  }

  res.json({
    success: true,
    data: activeSlabs
  });
}));

// Get Charges Slab by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const slab = await ChargesSlab.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  if (!slab) {
    return res.status(404).json({
      success: false,
      message: 'Charges slab not found'
    });
  }

  res.json({
    success: true,
    data: slab
  });
}));

// Create new Charges Slabs
router.post('/', authMiddleware, [
  body('slabs').isArray({ min: 1 }).withMessage('At least one slab is required'),
  body('slabs.*.size').notEmpty().withMessage('Size is required'),
  body('slabs.*.camCharges').isNumeric().withMessage('CAM Charges must be numeric').isFloat({ min: 0 }).withMessage('CAM Charges cannot be negative')
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
    await ChargesSlab.updateMany({}, { isActive: false });
  }

  const chargesSlabs = new ChargesSlab({
    ...req.body,
    createdBy: req.user.id
  });

  await chargesSlabs.save();

  const populatedSlabs = await ChargesSlab.findById(chargesSlabs._id)
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Charges slabs created successfully',
    data: populatedSlabs
  });
}));

// Update Charges Slabs
router.put('/:id', authMiddleware, [
  body('slabs').optional().isArray({ min: 1 }).withMessage('At least one slab is required'),
  body('slabs.*.size').optional().notEmpty().withMessage('Size is required'),
  body('slabs.*.camCharges').optional().isNumeric().withMessage('CAM Charges must be numeric').isFloat({ min: 0 }).withMessage('CAM Charges cannot be negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const chargesSlabs = await ChargesSlab.findById(req.params.id);
  if (!chargesSlabs) {
    return res.status(404).json({
      success: false,
      message: 'Charges slabs not found'
    });
  }

  // If this is set as active, deactivate others
  if (req.body.isActive) {
    await ChargesSlab.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
  }

  const updatedSlabs = await ChargesSlab.findByIdAndUpdate(
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
    message: 'Charges slabs updated successfully',
    data: updatedSlabs
  });
}));

// Delete Charges Slabs
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const chargesSlabs = await ChargesSlab.findById(req.params.id);
  if (!chargesSlabs) {
    return res.status(404).json({
      success: false,
      message: 'Charges slabs not found'
    });
  }

  await ChargesSlab.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Charges slabs deleted successfully'
  });
}));

module.exports = router;

