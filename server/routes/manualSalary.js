const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');

const ManualSalary = require('../models/hr/ManualSalary');

// @route   GET /api/hr/manual-salary
// @desc    Get all manual salary records
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  const records = await ManualSalary.find().sort({ year: -1, month: -1, createdAt: -1 });
  res.status(200).json({
    success: true,
    data: records
  });
}));

// @route   GET /api/hr/manual-salary/:id
// @desc    Get single manual salary record
// @access  Private
router.get('/:id', asyncHandler(async (req, res) => {
  const record = await ManualSalary.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  res.status(200).json({
    success: true,
    data: record
  });
}));

// @route   POST /api/hr/manual-salary
// @desc    Create manual salary record
// @access  Private
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Valid year is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const record = await ManualSalary.create(req.body);

  res.status(201).json({
    success: true,
    data: record
  });
}));

// @route   PUT /api/hr/manual-salary/:id
// @desc    Update manual salary record
// @access  Private
router.put('/:id', [
  body('name').notEmpty().withMessage('Name is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Valid year is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const record = await ManualSalary.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  res.status(200).json({
    success: true,
    data: record
  });
}));

// @route   DELETE /api/hr/manual-salary/:id
// @desc    Delete manual salary record
// @access  Private
router.delete('/:id', asyncHandler(async (req, res) => {
  const record = await ManualSalary.findById(req.params.id);

  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  await record.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
}));

module.exports = router;
