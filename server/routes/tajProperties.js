const express = require('express');
const router = express.Router();
const TajProperty = require('../models/tajResidencia/TajProperty');

// List properties
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (search) {
      const pattern = new RegExp(search, 'i');
      filters.$or = [
        { plotNumber: pattern },
        { rdaNumber: pattern },
        { street: pattern },
        { sector: pattern },
        { ownerName: pattern },
        { project: pattern }
      ];
    }

    const properties = await TajProperty.find(filters)
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .sort({ srNo: 1 });
    res.json({ success: true, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get property by id
router.get('/:id', async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.id)
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: property });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property
router.post('/', async (req, res) => {
  try {
    const property = await TajProperty.create(req.body);
    res.status(201).json({ success: true, data: property });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update property
router.put('/:id', async (req, res) => {
  try {
    const property = await TajProperty.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, data: property });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update property status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const property = await TajProperty.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, data: property });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete property
router.delete('/:id', async (req, res) => {
  try {
    const property = await TajProperty.findByIdAndDelete(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

