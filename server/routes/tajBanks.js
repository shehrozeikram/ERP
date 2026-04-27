const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const TajBank = require('../models/tajResidencia/TajBank');

// GET /api/taj-utilities/banks
router.get('/', asyncHandler(async (req, res) => {
  const banks = await TajBank.find().sort({ name: 1 }).lean();
  res.json({ success: true, data: banks });
}));

// POST /api/taj-utilities/banks
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Bank name is required');
  }
  const trimmed = String(name).trim();
  const existing = await TajBank.findOne({ name: { $regex: `^${trimmed}$`, $options: 'i' } });
  if (existing) {
    res.status(409);
    throw new Error(`Bank "${existing.name}" already exists`);
  }
  const bank = await TajBank.create({ name: trimmed, createdBy: req.user?._id });
  res.status(201).json({ success: true, data: bank });
}));

// DELETE /api/taj-utilities/banks/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const bank = await TajBank.findByIdAndDelete(req.params.id);
  if (!bank) {
    res.status(404);
    throw new Error('Bank not found');
  }
  res.json({ success: true, message: `Bank "${bank.name}" deleted` });
}));

module.exports = router;
