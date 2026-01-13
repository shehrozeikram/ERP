const express = require('express');
const router = express.Router();
const TajProperty = require('../models/tajResidencia/TajProperty');
const CAMCharge = require('../models/tajResidencia/CAMCharge');
const Electricity = require('../models/tajResidencia/Electricity');
const {
  getCached,
  setCached,
  clearCached,
  CACHE_KEYS
} = require('../utils/tajUtilitiesOptimizer');

// List properties
router.get('/', async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // OPTIMIZATION: Check cache first (only if no filters/search and default pagination)
    const hasFilters = req.query.search || req.query.status || req.query.sector || req.query.propertyType || 
                      req.query.zoneType || req.query.categoryType || req.query.project || 
                      req.query.resident || req.query.hasElectricityWater !== undefined;
    const isDefaultPagination = page === 1 && limit === 50;
    const cacheKey = (hasFilters || !isDefaultPagination) ? null : CACHE_KEYS.PROPERTIES_LIST;
    
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log('📋 Returning cached properties list');
        return res.json(cached);
      }
    }
    
    const { 
      search, 
      status, 
      sector,
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

    if (sector) {
      filters.sector = sector;
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

    // Get total count for pagination
    const total = await TajProperty.countDocuments(filters);
    
    // Get property type counts across all records (not just current page)
    const propertyTypeCounts = await TajProperty.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$propertyType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Convert to object format
    const countsByType = {};
    propertyTypeCounts.forEach(item => {
      countsByType[item._id || 'Other'] = item.count;
    });
    
    // OPTIMIZATION: Use lean for better performance with pagination
    const properties = await TajProperty.find(filters)
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .populate('resident', 'name accountType contactNumber email residentId')
      .sort({ srNo: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalPages = Math.ceil(total / limit);
    const response = { 
      success: true, 
      data: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      counts: {
        total,
        byPropertyType: countsByType
      }
    };
    
    // OPTIMIZATION: Cache response if no filters and default pagination
    if (cacheKey) {
      setCached(cacheKey, response);
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get property by id
router.get('/:id', async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.id)
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .populate('resident', 'name accountType contactNumber email residentId')
      .populate('createdBy', 'firstName lastName email _id')
      .populate('updatedBy', 'firstName lastName email _id');
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
    // Always remove srNo from body - let the pre-save hook generate it atomically
    delete req.body.srNo;
    
    let attempts = 0;
    const maxAttempts = 3;
    let property;
    
    while (attempts < maxAttempts) {
      try {
        property = await TajProperty.create(req.body);
        break; // Success
      } catch (error) {
        // If duplicate key error for srNo, retry
        if (error.code === 11000 && error.keyPattern?.srNo) {
          attempts++;
          if (attempts >= maxAttempts) {
            return res.status(400).json({ 
              success: false, 
              message: 'Failed to generate unique Property ID after multiple attempts. Please try again.' 
            });
          }
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
          // Ensure srNo is removed for retry
          delete req.body.srNo;
        } else {
          // Other errors, throw immediately
          throw error;
        }
      }
    }
    
    clearCached(CACHE_KEYS.PROPERTIES_LIST); // Invalidate cache on creation
    clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache
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

    clearCached(CACHE_KEYS.PROPERTIES_LIST); // Invalidate cache on update
    clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache
    res.json({ success: true, data: property });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update property status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, updatedBy } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const updateData = { status };
    // If status is being set to Active and updatedBy is provided, track who activated it
    if (status === 'Active' && updatedBy) {
      updateData.updatedBy = updatedBy;
    }

    const property = await TajProperty.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('rentalAgreement', 'agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdAt updatedAt')
      .populate('resident', 'name accountType contactNumber email residentId')
      .populate('updatedBy', 'firstName lastName email _id');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    clearCached(CACHE_KEYS.PROPERTIES_LIST); // Invalidate cache on status update
    clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache
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

    clearCached(CACHE_KEYS.PROPERTIES_LIST); // Invalidate cache on deletion
    clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

