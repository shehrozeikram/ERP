const express = require('express');
const router = express.Router();
const TajProperty = require('../models/tajResidencia/TajProperty');
const CAMCharge = require('../models/tajResidencia/CAMCharge');
const Electricity = require('../models/tajResidencia/Electricity');

// List properties
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      status, 
      propertyType, 
      zoneType, 
      categoryType, 
      project, 
      resident,
      hasElectricityWater 
    } = req.query;
    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (propertyType) {
      filters.propertyType = propertyType;
    }

    if (zoneType) {
      filters.zoneType = zoneType;
    }

    if (categoryType) {
      filters.categoryType = categoryType;
    }

    if (project) {
      filters.project = project;
    }

    if (resident) {
      filters.resident = resident;
    }

    if (hasElectricityWater !== undefined) {
      filters.hasElectricityWater = hasElectricityWater === 'true';
    }

    if (search) {
      const pattern = new RegExp(search, 'i');
      filters.$or = [
        { plotNumber: pattern },
        { rdaNumber: pattern },
        { street: pattern },
        { sector: pattern },
        { ownerName: pattern },
        { project: pattern },
        { propertyName: pattern }
      ];
    }

    const properties = await TajProperty.find(filters)
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .populate('resident', 'name accountType contactNumber email')
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
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .populate('resident', 'name accountType contactNumber email');
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
    )
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .populate('resident', 'name accountType contactNumber email');

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
    const property = await TajProperty.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Build matching conditions based on property identifiers
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    const conditions = [];
    if (property.address) conditions.push({ address: property.address });
    if (property.plotNumber) conditions.push({ plotNo: property.plotNumber });
    if (property.ownerName) conditions.push({ owner: property.ownerName });

    // Delete all associated records to prevent them from being attached to new properties
    const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
    await PropertyInvoice.deleteMany({ property: req.params.id });

    // Delete CAM charges that match this property by address/plotNumber/ownerName
    if (conditions.length > 0) {
      await CAMCharge.deleteMany({ $or: conditions });
    }

    // Delete Electricity bills that match this property by address/plotNumber/ownerName
    // Also match by meter number if property has one
    const electricityConditions = [...conditions];
    if (property.electricityWaterMeterNo) {
      electricityConditions.push({ meterNo: property.electricityWaterMeterNo });
    }
    // Also check meters array
    if (property.meters && Array.isArray(property.meters)) {
      property.meters.forEach(meter => {
        if (meter.meterNo) {
          electricityConditions.push({ meterNo: meter.meterNo });
        }
      });
    }
    if (electricityConditions.length > 0) {
      await Electricity.deleteMany({ $or: electricityConditions });
    }

    // Delete the property
    await TajProperty.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

