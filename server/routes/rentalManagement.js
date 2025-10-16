const express = require('express');
const router = express.Router();
const RentalManagement = require('../models/hr/RentalManagement');
const RentalAgreement = require('../models/hr/RentalAgreement');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Get all rental agreements for dropdown
router.get('/rental-agreements/list', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const agreements = await RentalAgreement.find()
      .select('_id agreementNumber tenantName propertyAddress startDate endDate')
      .sort({ createdAt: -1 });
    
    res.json(agreements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all rental management records
router.get('/', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const records = await RentalManagement.find()
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('rentalAgreement', 'agreementNumber tenantName propertyAddress startDate endDate')
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get rental management record by ID
router.get('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const record = await RentalManagement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('rentalAgreement', 'agreementNumber tenantName propertyAddress startDate endDate');
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new rental management record
router.post('/', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'create'), async (req, res) => {
  try {
    const record = new RentalManagement({
      ...req.body,
      createdBy: req.user.id
    });
    
    await record.save();
    
    // Populate the saved record
    const populatedRecord = await RentalManagement.findById(record._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    res.status(201).json(populatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update rental management record
router.put('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const record = await RentalManagement.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    );
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    // Populate the updated record
    const populatedRecord = await RentalManagement.findById(record._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    res.json(populatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete rental management record
router.delete('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'delete'), async (req, res) => {
  try {
    const record = await RentalManagement.findByIdAndDelete(req.params.id);
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json({ message: 'Rental management record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Update status of rental management record
router.put('/:id/status', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const record = await RentalManagement.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
