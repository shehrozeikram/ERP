const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const CAMCharge = require('../models/tajResidencia/CAMCharge');
const TajProperty = require('../models/tajResidencia/TajProperty');
const { authMiddleware } = require('../middleware/auth');
const { getCAMChargeForProperty, numberToWords } = require('../utils/camChargesHelper');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;

// Get all CAM Charges with search and filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status, sector, category } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { invoiceNumber: new RegExp(search, 'i') },
        { plotNo: new RegExp(search, 'i') },
        { owner: new RegExp(search, 'i') },
        { address: new RegExp(search, 'i') },
        { project: new RegExp(search, 'i') }
      ];
    }

    if (status) query.status = status;
    if (sector) query.sector = sector;
    if (category) query.category = category;

    const charges = await CAMCharge.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ serialNumber: -1 });

    res.json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/cam-charges/current-overview
// @desc    Get current CAM charges overview for all properties
// @access  Private
// NOTE: This route MUST be defined before /:id route to avoid route matching conflicts
router.get('/current-overview', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Fetching current CAM charges overview...');
    
    // Get all properties - use find without select first to test
    let properties;
    try {
      properties = await TajProperty.find({})
        .sort({ srNo: 1 })
        .lean();
      console.log(`✅ Found ${properties.length} properties`);
      
      if (properties.length > 0) {
        console.log('Sample property fields:', Object.keys(properties[0]));
      }
    } catch (propertyError) {
      console.error('❌ Error fetching properties:', propertyError);
      console.error('Error details:', {
        name: propertyError.name,
        message: propertyError.message,
        stack: propertyError.stack
      });
      throw new Error(`Failed to fetch properties: ${propertyError.message}`);
    }

    if (properties.length === 0) {
      return res.json({
        success: true,
        data: {
          totalProperties: 0,
          totalActiveProperties: 0,
          totalPendingProperties: 0,
          totalCompletedProperties: 0,
          properties: []
        }
      });
    }

    // Calculate statistics
    const totalProperties = properties.length;
    const totalActiveProperties = properties.filter(p => p.status === 'Active' || p.status === 'active').length;
    const totalPendingProperties = properties.filter(p => p.status === 'Pending' || p.status === 'pending').length;
    const totalCompletedProperties = properties.filter(p => p.status === 'Completed' || p.status === 'completed').length;

    // Get CAM charges for each property to calculate totals
    // Filter out empty/null values and ensure we have valid strings
    const propertyAddresses = properties
      .map(p => {
        const addr = p.address || `${p.plotNumber || ''} ${p.street || ''} ${p.sector || ''}`.trim();
        return addr && addr.length > 0 ? addr : null;
      })
      .filter(addr => addr && addr.length > 0);
    
    const plotNumbers = properties
      .map(p => p.plotNumber)
      .filter(plot => plot && typeof plot === 'string' && plot.trim().length > 0);
    
    const ownerNames = properties
      .map(p => p.ownerName)
      .filter(owner => owner && typeof owner === 'string' && owner.trim().length > 0);
    
    // Build query conditions - only add conditions if arrays are not empty
    const queryConditions = [];
    if (propertyAddresses.length > 0) {
      queryConditions.push({ address: { $in: propertyAddresses } });
    }
    if (plotNumbers.length > 0) {
      queryConditions.push({ plotNo: { $in: plotNumbers } });
    }
    if (ownerNames.length > 0) {
      queryConditions.push({ owner: { $in: ownerNames } });
    }
    
    // Match CAM charges by address, plot number, or owner name
    let camCharges = [];
    if (queryConditions.length > 0) {
      try {
        console.log(`🔍 Querying CAM charges with ${queryConditions.length} conditions...`);
        camCharges = await CAMCharge.find({
          $or: queryConditions
        })
          .select('address plotNo owner amount arrears status')
          .lean();
        console.log(`✅ Found ${camCharges.length} CAM charges`);
      } catch (queryError) {
        console.error('❌ Error querying CAM charges:', queryError);
        console.error('Query conditions:', JSON.stringify(queryConditions, null, 2));
        // Continue with empty array if query fails
        camCharges = [];
      }
    } else {
      console.log('⚠️ No query conditions, skipping CAM charges query');
    }

    // Create a map of charges by property identifier
    const chargesMap = new Map();
    camCharges.forEach(charge => {
      const key = charge.address || charge.plotNo || charge.owner;
      if (key) {
        if (!chargesMap.has(key)) {
          chargesMap.set(key, []);
        }
        chargesMap.get(key).push(charge);
      }
    });

    // Calculate totals and prepare property details
    let totalAmount = 0;
    let totalArrears = 0;
    let propertyDetails = [];
    
    try {
      propertyDetails = properties.map(property => {
        try {
          const propertyKey = property.address || property.plotNumber || property.ownerName;
          const relatedCharges = chargesMap.get(propertyKey) || [];
          
          const propertyAmount = relatedCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
          const propertyArrears = relatedCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
          
          totalAmount += propertyAmount;
          totalArrears += propertyArrears;

          // Safely extract all fields with defaults
          return {
            _id: property._id || null,
            srNo: property.srNo || null,
            propertyType: property.propertyType || null,
            propertyName: property.propertyName || null,
            plotNumber: property.plotNumber || null,
            rdaNumber: property.rdaNumber || null,
            street: property.street || null,
            sector: property.sector || null,
            categoryType: property.categoryType || null,
            address: property.address || property.fullAddress || `${property.plotNumber || ''} ${property.street || ''} ${property.sector || ''}`.trim() || null,
            project: property.project || null,
            ownerName: property.ownerName || null,
            contactNumber: property.contactNumber || null,
            status: property.status || 'Pending',
            fileSubmissionDate: property.fileSubmissionDate ? new Date(property.fileSubmissionDate).toISOString() : null,
            demarcationDate: property.demarcationDate ? new Date(property.demarcationDate).toISOString() : null,
            constructionDate: property.constructionDate ? new Date(property.constructionDate).toISOString() : null,
            familyStatus: property.familyStatus || null,
            areaValue: property.areaValue || 0,
            areaUnit: property.areaUnit || null,
            // CAM Charge related fields
            camAmount: propertyAmount || 0,
            camArrears: propertyArrears || 0,
            hasCAMCharge: relatedCharges.length > 0
          };
        } catch (propError) {
          console.error('❌ Error processing property:', property._id, propError);
          // Return a minimal property object if processing fails
          return {
            _id: property._id,
            srNo: property.srNo || 0,
            propertyName: property.propertyName || 'Unknown',
            address: property.address || 'N/A',
            ownerName: property.ownerName || 'N/A',
            status: property.status || 'Pending',
            camAmount: 0,
            camArrears: 0,
            hasCAMCharge: false
          };
        }
      });
      console.log(`✅ Processed ${propertyDetails.length} property details`);
    } catch (mappingError) {
      console.error('❌ Error mapping properties:', mappingError);
      throw new Error(`Failed to process property details: ${mappingError.message}`);
    }

    console.log('✅ Sending response with', propertyDetails.length, 'properties');
    
    const responseData = {
      totalProperties,
      totalActiveProperties,
      totalPendingProperties,
      totalCompletedProperties,
      totalAmount: Math.round(totalAmount),
      totalArrears: Math.round(totalArrears),
      properties: propertyDetails
    };
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in current-overview:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Return a more detailed error in development
    const errorResponse = {
      success: false,
      message: 'Failed to fetch current CAM charges overview',
      error: error.message
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.stack;
      errorResponse.errorName = error.name;
    }
    
    res.status(500).json(errorResponse);
  }
});

// Get CAM Charge by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const charge = await CAMCharge.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!charge) {
      return res.status(404).json({ success: false, message: 'CAM Charge not found' });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new CAM Charge
router.post('/', authMiddleware, async (req, res) => {
  try {
    const chargeData = {
      ...req.body,
      createdBy: req.user.id
    };

    const charge = new CAMCharge(chargeData);
    await charge.save();
    await charge.populate('createdBy', 'firstName lastName');

    res.status(201).json({ success: true, data: charge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update CAM Charge
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const charge = await CAMCharge.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!charge) {
      return res.status(404).json({ success: false, message: 'CAM Charge not found' });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete CAM Charge
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const charge = await CAMCharge.findByIdAndDelete(req.params.id);

    if (!charge) {
      return res.status(404).json({ success: false, message: 'CAM Charge not found' });
    }

    res.json({ success: true, message: 'CAM Charge deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/cam-charges/bulk-create
// @desc    Bulk create CAM charges for all properties for a specific month
// @access  Private
router.post('/bulk-create', authMiddleware, [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2020 }).withMessage('Year must be 2020 or later'),
  body('forceRegenerate').optional().isBoolean().withMessage('Force regenerate must be a boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { month, year, forceRegenerate = false } = req.body;

  try {
    // Check if charges already exist for this month/year
    if (!forceRegenerate) {
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      const existingCharges = await CAMCharge.countDocuments({
        invoiceNumber: new RegExp(`^CAM-${monthYear}`, 'i')
      });
      
      if (existingCharges > 0) {
        return res.status(400).json({
          success: false,
          message: `CAM charges already exist for ${month}/${year}. Use forceRegenerate: true to regenerate.`,
          existingCount: existingCharges
        });
      }
    }

    // Get all properties
    const properties = await TajProperty.find({})
      .sort({ srNo: 1 })
      .lean();

    if (properties.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No properties found'
      });
    }

    const createdCharges = [];
    const errors = [];
    const skippedProperties = [];
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;

    // Process properties in batches for better performance
    const BATCH_SIZE = 50;
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      const batch = properties.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (property) => {
        try {
          // Check if charge already exists for this property and month
          if (!forceRegenerate) {
            const propertyKey = property.address || property.plotNumber || property.ownerName;
            const existingCharge = await CAMCharge.findOne({
              $or: [
                { address: propertyKey },
                { plotNo: property.plotNumber },
                { owner: property.ownerName }
              ],
              invoiceNumber: new RegExp(`^CAM-${monthYear}`, 'i')
            });

            if (existingCharge) {
              skippedProperties.push({
                propertyId: property._id,
                propertyName: property.propertyName || property.address,
                reason: 'Charge already exists'
              });
              return;
            }
          }

          // Get CAM charge amount based on property size
          const propertySize = property.areaValue || 0;
          const areaUnit = property.areaUnit || 'Marla';
          const { amount } = await getCAMChargeForProperty(propertySize, areaUnit);

          if (amount === 0) {
            errors.push({
              propertyId: property._id,
              propertyName: property.propertyName || property.address,
              reason: 'No matching slab found for property size'
            });
            return;
          }

          // Generate invoice number
          const invoiceNumber = `CAM-${monthYear}-${String(property.srNo || createdCharges.length + 1).padStart(4, '0')}`;

          // Create CAM charge data
          const chargeData = {
            invoiceNumber,
            plotNo: property.plotNumber || '',
            rdaNo: property.rdaNumber || '',
            street: property.street || '',
            sector: property.sector || '',
            category: property.categoryType || '',
            address: property.address || property.fullAddress || `${property.plotNumber || ''} ${property.street || ''} ${property.sector || ''}`.trim(),
            project: property.project || '',
            owner: property.ownerName || '',
            contactNo: property.contactNumber || '',
            status: 'Active',
            fileSubmission: property.fileSubmissionDate || undefined,
            demarcationDate: property.demarcationDate || undefined,
            constructionDate: property.constructionDate || undefined,
            familyStatus: property.familyStatus || '',
            arrears: 0,
            amount: amount,
            amountInWords: numberToWords(amount),
            createdBy: req.user.id
          };

          const charge = new CAMCharge(chargeData);
          await charge.save();
          createdCharges.push(charge);
        } catch (error) {
          errors.push({
            propertyId: property._id,
            propertyName: property.propertyName || property.address,
            reason: error.message
          });
        }
      }));
    }

    res.json({
      success: true,
      message: `Bulk CAM charges creation completed`,
      data: {
        totalProperties: properties.length,
        created: createdCharges.length,
        skipped: skippedProperties.length,
        errors: errors.length,
        createdCharges: createdCharges.map(c => ({
          _id: c._id,
          invoiceNumber: c.invoiceNumber,
          owner: c.owner,
          amount: c.amount
        })),
        skippedProperties,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error in bulk create CAM charges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bulk CAM charges',
      error: error.message
    });
  }
}));

module.exports = router;

