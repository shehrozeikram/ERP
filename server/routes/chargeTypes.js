const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;
const ChargeType = require('../models/tajResidencia/ChargeType');

// Initialize default charge types if they don't exist
const initializeDefaultChargeTypes = async () => {
  try {
    const defaultTypes = ['OTHER', 'MAINTENANCE'];
    for (const typeName of defaultTypes) {
      const exists = await ChargeType.findOne({ name: typeName });
      if (!exists) {
        await ChargeType.create({
          name: typeName,
          description: `Default charge type: ${typeName}`,
          isSystem: true,
          isActive: true,
          createdBy: null // System-created
        });
      }
    }
  } catch (error) {
    console.error('Error initializing default charge types:', error);
  }
};

// Initialize on module load
initializeDefaultChargeTypes();

// Get all charge types
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  const query = {};
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }
  
  const chargeTypes = await ChargeType.find(query)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ isSystem: -1, name: 1 })
    .lean();
  
  res.json({
    success: true,
    data: chargeTypes
  });
}));

// Get charge type by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const chargeType = await ChargeType.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .lean();
  
  if (!chargeType) {
    return res.status(404).json({ success: false, message: 'Charge type not found' });
  }
  
  res.json({
    success: true,
    data: chargeType
  });
}));

// Create charge type
router.post(
  '/',
  authMiddleware,
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('name').trim().notEmpty().withMessage('Charge type name is required'),
    body('description').optional().trim()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { name, description } = req.body;
    const nameUpper = name.trim().toUpperCase();
    
    // Check if charge type already exists
    const existing = await ChargeType.findOne({ name: nameUpper });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Charge type with this name already exists'
      });
    }
    
    const chargeType = new ChargeType({
      name: nameUpper,
      description: description || '',
      createdBy: req.user.id
    });
    
    await chargeType.save();
    await chargeType.populate('createdBy', 'firstName lastName');
    
    res.status(201).json({
      success: true,
      message: 'Charge type created successfully',
      data: chargeType
    });
  })
);

// Update charge type
router.put(
  '/:id',
  authMiddleware,
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('name').optional().trim().notEmpty().withMessage('Charge type name cannot be empty'),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const chargeType = await ChargeType.findById(req.params.id);
    if (!chargeType) {
      return res.status(404).json({ success: false, message: 'Charge type not found' });
    }
    
    const { name, description, isActive } = req.body;
    
    if (name !== undefined) {
      const nameUpper = name.trim().toUpperCase();
      // Check if another charge type with this name exists
      const existing = await ChargeType.findOne({ name: nameUpper, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Charge type with this name already exists'
        });
      }
      chargeType.name = nameUpper;
    }
    
    if (description !== undefined) chargeType.description = description;
    if (isActive !== undefined) chargeType.isActive = isActive;
    chargeType.updatedBy = req.user.id;
    
    await chargeType.save();
    await chargeType.populate('createdBy', 'firstName lastName');
    await chargeType.populate('updatedBy', 'firstName lastName');
    
    res.json({
      success: true,
      message: 'Charge type updated successfully',
      data: chargeType
    });
  })
);

// Delete charge type
router.delete(
  '/:id',
  authMiddleware,
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const chargeType = await ChargeType.findById(req.params.id);
    if (!chargeType) {
      return res.status(404).json({ success: false, message: 'Charge type not found' });
    }
    
    // Prevent deletion of system charge types
    if (chargeType.isSystem) {
      return res.status(400).json({
        success: false,
        message: 'System charge types cannot be deleted'
      });
    }
    
    await ChargeType.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Charge type deleted successfully'
    });
  })
);

module.exports = router;
