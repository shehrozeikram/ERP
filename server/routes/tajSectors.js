const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const TajSector = require('../models/tajResidencia/TajSector');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;

// Get all sectors
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  const query = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const sectors = await TajSector.find(query)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ name: 1 });

  res.json({ success: true, data: sectors });
}));

// Get single sector by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const sector = await TajSector.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  if (!sector) {
    return res.status(404).json({ success: false, message: 'Sector not found' });
  }

  res.json({ success: true, data: sector });
}));

// Create new sector
router.post(
  '/',
  authMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Sector name is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name } = req.body;
    
    // Check if sector with same name already exists
    const existingSector = await TajSector.findOne({ name: name.trim() });
    if (existingSector) {
      return res.status(400).json({ 
        success: false, 
        message: 'Sector with this name already exists' 
      });
    }

    const sector = new TajSector({
      name: name.trim(),
      createdBy: req.user.id
    });

    await sector.save();
    await sector.populate('createdBy', 'firstName lastName');

    res.status(201).json({ success: true, data: sector });
  })
);

// Update sector
router.put(
  '/:id',
  authMiddleware,
  [
    body('name').optional().trim().notEmpty().withMessage('Sector name cannot be empty'),
    body('isActive').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const sector = await TajSector.findById(req.params.id);
    if (!sector) {
      return res.status(404).json({ success: false, message: 'Sector not found' });
    }

    // If name is being updated, check for duplicates
    if (req.body.name && req.body.name.trim() !== sector.name) {
      const existingSector = await TajSector.findOne({ 
        name: req.body.name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingSector) {
        return res.status(400).json({ 
          success: false, 
          message: 'Sector with this name already exists' 
        });
      }
    }

    if (req.body.name) {
      sector.name = req.body.name.trim();
    }
    if (req.body.isActive !== undefined) {
      sector.isActive = req.body.isActive;
    }
    sector.updatedBy = req.user.id;

    await sector.save();
    await sector.populate('createdBy', 'firstName lastName');
    await sector.populate('updatedBy', 'firstName lastName');

    res.json({ success: true, data: sector });
  })
);

// Delete sector (soft delete)
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const sector = await TajSector.findById(req.params.id);
  if (!sector) {
    return res.status(404).json({ success: false, message: 'Sector not found' });
  }

  sector.isActive = false;
  sector.updatedBy = req.user.id;
  await sector.save();

  res.json({ success: true, message: 'Sector deleted successfully' });
}));

module.exports = router;

