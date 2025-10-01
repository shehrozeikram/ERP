const express = require('express');
const router = express.Router();
const RentalManagement = require('../models/hr/RentalManagement');
const RentalAgreement = require('../models/hr/RentalAgreement');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Get all rental management records
router.get('/', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const records = await RentalManagement.find()
      .populate('rentalAgreement')
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get rental management record by ID
router.get('/:id', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const record = await RentalManagement.findById(req.params.id)
      .populate('rentalAgreement')
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new rental management record
router.post('/', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const record = new RentalManagement({
      ...req.body,
      createdBy: req.user.id
    });
    
    await record.save();
    
    // Populate the saved record
    const populatedRecord = await RentalManagement.findById(record._id)
      .populate('rentalAgreement')
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');
    
    res.status(201).json(populatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update rental management record
router.put('/:id', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const record = await RentalManagement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    // Populate the updated record
    const populatedRecord = await RentalManagement.findById(record._id)
      .populate('rentalAgreement')
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');
    
    res.json(populatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete rental management record
router.delete('/:id', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
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

// Get rental agreements for dropdown
router.get('/agreements/list', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const agreements = await RentalAgreement.find({ status: 'Active' })
      .select('agreementNumber propertyName monthlyRent')
      .sort({ propertyName: 1 });
    
    res.json(agreements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update status of rental management record
router.put('/:id/status', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['Draft', 'HOD Admin', 'Audit', 'Finance', 'CEO/President', 'Approved', 'Paid', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const record = await RentalManagement.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('rentalAgreement')
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
