const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const WaterCharge = require('../models/tajResidencia/WaterCharge');
const TajProperty = require('../models/tajResidencia/TajProperty');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const { authMiddleware } = require('../middleware/auth');
const { getWaterChargeForProperty, numberToWords } = require('../utils/camChargesHelper');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getCached,
  setCached,
  clearCached,
  fetchProperties,
  preCalculateAddresses,
  collectPropertyIdentifiers,
  buildPropertyQueryConditions,
  calculatePropertyStats,
  calculatePayments,
  CACHE_KEYS
} = require('../utils/tajUtilitiesOptimizer');

const attachmentsDir = path.join(__dirname, '../uploads/payment-attachments');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

const paymentAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const paymentAttachmentUpload = multer({
  storage: paymentAttachmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const cleanupAttachment = (file) => {
  if (file) {
    const filePath = path.join(attachmentsDir, file.filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Failed to cleanup attachment:', err);
      }
    });
  }
};

// Using centralized cache from tajUtilitiesOptimizer

// Get all Water charges with search and filters
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

    const charges = await WaterCharge.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ serialNumber: -1 });

    res.json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/cam-charges/current-overview
// @desc    Get current water charges overview for all properties
// @access  Private
// NOTE: This route MUST be defined before /:id route to avoid route matching conflicts
router.get('/current-overview', authMiddleware, async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Extract filter parameters
    const filters = {
      search: req.query.search || '',
      status: req.query.status || '',
      sector: req.query.sector || '',
      categoryType: req.query.categoryType || ''
    };
    
    // Only use cache if no pagination/filters are requested (page 1, default limit, no filters)
    const hasFilters = filters.search || filters.status || filters.sector || filters.categoryType;
    const isDefaultPagination = page === 1 && limit === 50 && !hasFilters;
    if (isDefaultPagination) {
    const cached = getCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW);
    if (cached) {
      console.log('📋 Returning cached water charges overview');
      return res.json(cached);
      }
    }
    
    console.log(`📋 Fetching current water charges overview (page: ${page}, limit: ${limit}, filters: ${JSON.stringify(filters)})...`);
    
    // OPTIMIZATION: Select only needed fields from properties
    const propertyFields = '_id srNo propertyType propertyName plotNumber rdaNumber street sector categoryType address fullAddress project ownerName contactNumber status fileSubmissionDate demarcationDate constructionDate familyStatus areaValue areaUnit zoneType resident hasWaterCharges';
    
    // OPTIMIZATION: Run all initial queries in parallel
    const [propertiesResult, activeSlabsResult] = await Promise.all([
      fetchProperties(propertyFields, filters).then(async (properties) => {
        // Populate resident with residentId
        const TajResident = require('../models/tajResidencia/TajResident');
        const residentIds = properties.map(p => p.resident).filter(Boolean);
        if (residentIds.length > 0) {
          const residents = await TajResident.find({ _id: { $in: residentIds } })
            .select('_id residentId')
            .lean();
          const residentMap = new Map(residents.map(r => [r._id.toString(), r]));
          properties.forEach(property => {
            if (property.resident) {
              const resident = residentMap.get(property.resident.toString());
              if (resident) {
                property.resident = { _id: resident._id, residentId: resident.residentId };
              }
            }
          });
        }
        return properties;
      }),
      (async () => {
        try {
          const ChargesSlab = require('../models/tajResidencia/ChargesSlab');
          return await ChargesSlab.getActiveSlabs();
        } catch (err) {
          console.error('❌ Error fetching active slabs:', err);
          return null;
        }
      })()
    ]);
    
    const allProperties = (propertiesResult || []).filter((p) => p.hasWaterCharges === true);
    const activeSlabs = activeSlabsResult;
    
    console.log(`✅ Found ${allProperties.length} properties with water charges enabled`);

    if (allProperties.length === 0) {
      const emptyResponse = {
        success: true,
        data: {
          totalProperties: 0,
          totalActiveProperties: 0,
          totalPendingProperties: 0,
          totalCompletedProperties: 0,
          properties: [],
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 0
          }
        }
      };
      if (isDefaultPagination) {
      setCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW, emptyResponse);
      }
      return res.json(emptyResponse);
    }

    // OPTIMIZATION: Calculate statistics using centralized utility (on all properties)
    const stats = calculatePropertyStats(allProperties);
    const { totalProperties, totalActiveProperties, totalPendingProperties, totalCompletedProperties } = stats;
    
    // Apply pagination - only process the slice we need
    const totalPages = Math.ceil(allProperties.length / limit);
    const properties = allProperties.slice(skip, skip + limit);
    
    console.log(`📄 Processing page ${page} of ${totalPages} (${properties.length} properties)`);

    // OPTIMIZATION: Pre-calculate addresses and collect identifiers using centralized utilities
    const propertyAddressMap = preCalculateAddresses(properties);
    const identifiers = collectPropertyIdentifiers(properties, propertyAddressMap);
    const queryConditions = buildPropertyQueryConditions(identifiers);
    
    // OPTIMIZATION: Fetch all PropertyInvoice records in parallel with Water charges query
    const propertyIds = properties.map(p => p._id);
    
    // OPTIMIZATION: Run invoices and Water charges queries in parallel
    const [allInvoices, waterChargeRecords] = await Promise.all([
      PropertyInvoice.find({
        property: { $in: propertyIds },
        chargeTypes: { $in: ['WATER'] },
        paymentStatus: { $in: ['unpaid', 'partial_paid'] },
        balance: { $gt: 0 }
      })
      .select('property charges grandTotal totalPaid balance chargeTypes')
      .lean()
      .catch(err => {
        console.error('❌ Error fetching invoices:', err);
        return [];
      }),
      queryConditions.length > 0
        ? WaterCharge.find({ $or: queryConditions })
          .select('address plotNo owner amount arrears status payments paymentStatus')
          .lean()
          .catch(err => {
            console.error('❌ Error querying Water charges:', err);
            return [];
          })
        : Promise.resolve([])
    ]);
    
    // Group invoices by property ID (optimized)
    const invoicesByProperty = new Map();
    allInvoices.forEach(inv => {
      const propId = inv.property.toString();
      if (!invoicesByProperty.has(propId)) {
        invoicesByProperty.set(propId, []);
      }
      invoicesByProperty.get(propId).push(inv);
    });

    // Create a map of charges by property identifier (optimized)
    const chargesMap = new Map();
    waterChargeRecords.forEach(charge => {
      const key = charge.address || charge.plotNo || charge.owner;
      if (key) {
        if (!chargesMap.has(key)) {
          chargesMap.set(key, []);
        }
        chargesMap.get(key).push(charge);
      }
    });
    
    console.log(`✅ Found ${waterChargeRecords.length} Water charges and ${allInvoices.length} invoices`);

    // activeSlabs already loaded in parallel above

    // Helper function to get Water charge amount (using cached slabs)
    const getWaterAmount = (propertySize, areaUnit, zoneType) => {
      if (!activeSlabs) return 0;
      
      if (zoneType && zoneType.toLowerCase() === 'commercial') {
        return activeSlabs?.commercialWaterCharges ?? 0;
      }
      
      if (!activeSlabs.slabs || activeSlabs.slabs.length === 0) {
        return 0;
      }

      const au = (areaUnit || '').toLowerCase();
      const sizeToMatch = au.includes('kanal')
        ? `${propertySize}K`
        : `${propertySize}M`;

      const matchingSlab = activeSlabs.slabs.find(slab => {
        const slabSize = slab.size?.toUpperCase().trim();
        const matchSize = sizeToMatch.toUpperCase().trim();
        return slabSize === matchSize;
      });

      if (matchingSlab) {
        return matchingSlab.waterCharges || 0;
      }

      // Try numeric comparison
      const numericSize = parseFloat(propertySize);
      if (!isNaN(numericSize)) {
        const numericMatch = activeSlabs.slabs.find(slab => {
          const slabSizeStr = slab.size?.replace(/[^0-9.]/g, '');
          const slabSizeNum = parseFloat(slabSizeStr);
          return !isNaN(slabSizeNum) && slabSizeNum === numericSize;
        });

        if (numericMatch) {
          return numericMatch.waterCharges || 0;
        }
      }

      return 0;
    };

    // Calculate totals and prepare property details
    let totalAmount = 0;
    let totalArrears = 0;
    let propertyDetails = [];
    
    try {
      propertyDetails = properties.map((property) => {
        try {
          // OPTIMIZATION: Use pre-calculated address
          const propertyKey = propertyAddressMap.get(property._id.toString()) || property.plotNumber || property.ownerName;
          const relatedCharges = chargesMap.get(propertyKey) || [];
          
          // Calculate CAM amount from property size if no charges found, otherwise use charges
          let propertyAmount = 0;
          if (relatedCharges.length > 0) {
            // Use the latest charge amount or sum all charges
            propertyAmount = relatedCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
          } else {
            const propertySize = property.areaValue || 0;
            const areaUnit = property.areaUnit || 'Marla';
            const zoneType = property.zoneType || 'Residential';
            if (zoneType === 'Commercial') {
              propertyAmount = getWaterAmount(0, areaUnit, zoneType);
            } else if (propertySize > 0) {
              propertyAmount = getWaterAmount(propertySize, areaUnit, zoneType);
            }
          }
          
          const waterChargeArrearsFromRecords = relatedCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
          
          // Calculate carry forward arrears from unpaid PropertyInvoice records (using pre-fetched data)
          let carryForwardArrears = 0;
          try {
            const previousWaterInvoices = invoicesByProperty.get(property._id.toString()) || [];
            
            // Outstanding water charges from previous invoices
            previousWaterInvoices.forEach(inv => {
              const waterChargeInPrevInvoice = inv.charges?.find(c => c.type === 'WATER');
              if (waterChargeInPrevInvoice) {
                // Fix: Check if chargeTypes exists and has length
                const chargeTypes = inv.chargeTypes || [];
                if (chargeTypes.length === 1 && chargeTypes[0] === 'WATER') {
                  carryForwardArrears += inv.balance || 0;
                } else {
                  // If mixed charges, water portion of grandTotal
                  // and apply that proportion to the remaining balance
                  const grandTotal = inv.grandTotal || 0;
                  if (grandTotal > 0) {
                    const waterProportion = (waterChargeInPrevInvoice.amount + waterChargeInPrevInvoice.arrears) / grandTotal;
                  carryForwardArrears += (inv.balance || 0) * waterProportion;
                  }
                }
              }
            });
            
            // Round to nearest whole number
            carryForwardArrears = Math.round(carryForwardArrears);
          } catch (err) {
            console.error('Error calculating carry forward arrears for property:', property._id, err);
          }
          
          const propertyArrears = waterChargeArrearsFromRecords + carryForwardArrears;
          
          // OPTIMIZATION: Calculate payments using centralized utility
          const paymentData = calculatePayments(relatedCharges);
          const { allPayments, paymentStatus } = paymentData;
          
          const totalWaterAmount = propertyAmount + propertyArrears;
          let finalPaymentStatus = 'unpaid';
          if (paymentData.totalPaid >= totalWaterAmount && totalWaterAmount > 0) {
            finalPaymentStatus = 'paid';
          } else if (paymentData.totalPaid > 0) {
            finalPaymentStatus = 'partial_paid';
          }
          
          // Update payment status on all payments
          if (allPayments.length > 0) {
          allPayments.forEach(payment => {
              payment.status = finalPaymentStatus;
          });
          }

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
            address: propertyAddressMap.get(property._id.toString()) || null,
            project: property.project || null,
            ownerName: property.ownerName || null,
            contactNumber: property.contactNumber || null,
            status: property.status || 'Pending',
            fileSubmissionDate: property.fileSubmissionDate || null,
            demarcationDate: property.demarcationDate || null,
            constructionDate: property.constructionDate || null,
            familyStatus: property.familyStatus || null,
            areaValue: property.areaValue || 0,
            areaUnit: property.areaUnit || null,
            tenantName: property.tenantName || null,
            // Include resident data if available
            resident: property.resident || null,
            waterAmount: propertyAmount || 0,
            waterArrears: propertyArrears || 0,
            hasWaterChargeRecord: relatedCharges.length > 0,
            payments: allPayments || [],
            paymentStatus: finalPaymentStatus
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
            waterAmount: 0,
            waterArrears: 0,
            hasWaterChargeRecord: false
          };
        }
      });
      
      // Calculate totals after all properties are processed (for current page only)
      totalAmount = propertyDetails.reduce((sum, prop) => sum + (prop.waterAmount || 0), 0);
      totalArrears = propertyDetails.reduce((sum, prop) => sum + (prop.waterArrears || 0), 0);
      
      console.log(`✅ Processed ${propertyDetails.length} property details`);
    } catch (mappingError) {
      console.error('❌ Error mapping properties:', mappingError);
      throw new Error(`Failed to process property details: ${mappingError.message}`);
    }

    // Calculate totals across ALL invoices (all pages) for counts
    // Sum all PropertyInvoices with Water charge type
    let totalAmountAllPages = 0;
    let totalArrearsAllPages = 0;
    try {
      // Get all PropertyInvoices with Water charge type (across all properties, all pages)
      const allWaterInvoices = await PropertyInvoice.find({
        chargeTypes: { $in: ['WATER'] }
      })
      .select('grandTotal balance charges chargeTypes')
      .lean()
      .catch(() => []);
      
      totalAmountAllPages = allWaterInvoices.reduce((sum, invoice) => {
        return sum + (invoice.grandTotal || 0);
      }, 0);
      
      totalArrearsAllPages = allWaterInvoices.reduce((sum, invoice) => {
        const waterChargesFromInv = invoice.charges?.filter(c => c.type === 'WATER') || [];
        if (waterChargesFromInv.length > 0) {
          const hasOnlyWater = invoice.chargeTypes?.length === 1 && invoice.chargeTypes[0] === 'WATER';
          if (hasOnlyWater) {
            return sum + (invoice.balance || 0);
          }
          const waterPartTotal = waterChargesFromInv.reduce((s, c) => s + (c.amount || 0) + (c.arrears || 0), 0);
          const invoiceTotal = invoice.grandTotal || 0;
          if (invoiceTotal > 0) {
            const waterProportion = waterPartTotal / invoiceTotal;
            return sum + ((invoice.balance || 0) * waterProportion);
          }
        }
        return sum;
      }, 0);
      
      // Round to 2 decimal places
      totalAmountAllPages = Math.round(totalAmountAllPages * 100) / 100;
      totalArrearsAllPages = Math.round(totalArrearsAllPages * 100) / 100;
    } catch (totalsError) {
      console.error('❌ Error calculating totals from invoices:', totalsError);
      // Use current page totals as fallback
      totalAmountAllPages = totalAmount;
      totalArrearsAllPages = totalArrears;
    }

    console.log('✅ Sending response with', propertyDetails.length, 'properties');
    
    const responseData = {
      totalProperties,
      totalActiveProperties,
      totalPendingProperties,
      totalCompletedProperties,
      totalAmount: Math.round(totalAmount),
      totalArrears: Math.round(totalArrears),
      totalAmountAllPages: Math.round(totalAmountAllPages),
      totalArrearsAllPages: Math.round(totalArrearsAllPages),
      properties: propertyDetails,
      pagination: {
        page,
        limit,
        total: allProperties.length,
        totalPages
      }
    };
    
    const response = {
      success: true,
      data: responseData
    };
    
    // OPTIMIZATION: Cache the response only for default pagination
    if (isDefaultPagination) {
    setCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW, response);
    }
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error in current-overview:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Return a more detailed error in development
    const errorResponse = {
      success: false,
      message: 'Failed to fetch current water charges overview',
      error: error.message
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.stack;
      errorResponse.errorName = error.name;
    }
    
    res.status(500).json(errorResponse);
  }
});

// Get latest Water charge for a specific property
router.get('/property/:propertyId/latest-charge', authMiddleware, async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId).lean();
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const conditions = [];
    if (property.address) conditions.push({ address: property.address });
    if (property.plotNumber) conditions.push({ plotNo: property.plotNumber });
    if (property.ownerName) conditions.push({ owner: property.ownerName });

    if (!conditions.length) {
      return res.status(400).json({
        success: false,
        message: 'Property does not have enough identifiers to locate a Water charge'
      });
    }

    const latestCharge = await WaterCharge.findOne({ $or: conditions })
      .sort({ createdAt: -1, updatedAt: -1 })
      .lean();

    if (!latestCharge) {
      return res.status(404).json({ success: false, message: 'No Water charge found for this property' });
    }

    res.json({ success: true, data: latestCharge });
  } catch (error) {
    console.error('❌ Error fetching latest Water charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest Water charge',
      error: error.message
    });
  }
});

// Add payment to Water charge by property ID (finds most recent charge)
router.post('/property/:propertyId/payments', authMiddleware, paymentAttachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, bankName, reference, notes } = req.body;

    // Find property
    const property = await TajProperty.findById(req.params.propertyId);
    if (!property) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Find most recent Water charge for this property
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    const charge = await WaterCharge.findOne({
      $or: [
        { address: propertyKey },
        { plotNo: property.plotNumber },
        { owner: property.ownerName }
      ]
    }).sort({ createdAt: -1 });

    if (!charge) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'No Water charge found for this property' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const paymentTotal = paymentAmount + arrearsAmount;

    const attachmentUrl = req.file ? `/uploads/payment-attachments/${req.file.filename}` : '';

    charge.payments.push({
      amount: paymentAmount,
      arrears: arrearsAmount,
      totalAmount: paymentTotal,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      invoiceNumber: invoiceNumber || '',
      paymentMethod: paymentMethod || 'Bank Transfer',
      bankName: bankName || '',
      attachmentUrl,
      reference: reference || '',
      notes: notes || '',
      recordedBy: req.user.id
    });

    // Recalculate payment status after adding payment
    const chargeTotal = charge.amount + (charge.arrears || 0);
    const totalPaid = charge.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    if (totalPaid >= chargeTotal && chargeTotal > 0) {
      charge.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      charge.paymentStatus = 'partial_paid';
    } else {
      charge.paymentStatus = 'unpaid';
    }

    await charge.save();
    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on payment update
    res.json({ success: true, data: charge });
  } catch (error) {
    cleanupAttachment(req.file);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add payment to Water charge by charge ID
router.post('/:id/payments', authMiddleware, paymentAttachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, bankName, reference, notes } = req.body;

    const charge = await WaterCharge.findById(req.params.id);
    if (!charge) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'Water charge not found' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const paymentTotal = paymentAmount + arrearsAmount;

    const attachmentUrl = req.file ? `/uploads/payment-attachments/${req.file.filename}` : '';

    charge.payments.push({
      amount: paymentAmount,
      arrears: arrearsAmount,
      totalAmount: paymentTotal,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      invoiceNumber: invoiceNumber || '',
      paymentMethod: paymentMethod || 'Bank Transfer',
      bankName: bankName || '',
      attachmentUrl,
      reference: reference || '',
      notes: notes || '',
      recordedBy: req.user.id
    });

    // Recalculate payment status after adding payment
    const chargeTotal = charge.amount + (charge.arrears || 0);
    const totalPaid = charge.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    if (totalPaid >= chargeTotal && chargeTotal > 0) {
      charge.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      charge.paymentStatus = 'partial_paid';
    } else {
      charge.paymentStatus = 'unpaid';
    }

    await charge.save();
    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on payment update
    res.json({ success: true, data: charge });
  } catch (error) {
    cleanupAttachment(req.file);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete all payments from Water charge by property ID
router.delete('/property/:propertyId/payments', authMiddleware, async (req, res) => {
  try {
    // Find property
    const property = await TajProperty.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Find all Water charges for this property
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    const charges = await WaterCharge.find({
      $or: [
        { address: propertyKey },
        { plotNo: property.plotNumber },
        { owner: property.ownerName }
      ]
    });

    if (charges.length === 0) {
      return res.status(404).json({ success: false, message: 'No Water charges found for this property' });
    }

    // Remove all payments from all charges
    for (const charge of charges) {
      charge.payments = [];
      charge.paymentStatus = 'unpaid';
      await charge.save();
    }

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on payment deletion
    res.json({ 
      success: true, 
      message: `Removed all payments from ${charges.length} Water charge(s)`,
      data: { chargesUpdated: charges.length }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete all payments from Water charge by charge ID
router.delete('/:id/payments', authMiddleware, async (req, res) => {
  try {
    const charge = await WaterCharge.findById(req.params.id);
    if (!charge) {
      return res.status(404).json({ success: false, message: 'Water charge not found' });
    }

    charge.payments = [];
    charge.paymentStatus = 'unpaid';
    await charge.save();

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on payment deletion
    res.json({ 
      success: true, 
      message: 'All payments removed from Water charge',
      data: charge
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete a specific payment from Water charge
router.delete('/:chargeId/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const charge = await WaterCharge.findById(req.params.chargeId);
    if (!charge) {
      return res.status(404).json({ success: false, message: 'Water charge not found' });
    }

    const paymentIndex = charge.payments.findIndex(
      p => p._id.toString() === req.params.paymentId
    );

    if (paymentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    charge.payments.splice(paymentIndex, 1);

    // Recalculate payment status after removing payment
    const chargeTotal = charge.amount + (charge.arrears || 0);
    const totalPaid = charge.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    if (totalPaid >= chargeTotal && chargeTotal > 0) {
      charge.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      charge.paymentStatus = 'partial_paid';
    } else {
      charge.paymentStatus = 'unpaid';
    }

    await charge.save();

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on payment deletion
    res.json({ 
      success: true, 
      message: 'Payment removed successfully',
      data: charge
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get Water charge by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const charge = await WaterCharge.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!charge) {
      return res.status(404).json({ success: false, message: 'Water charge not found' });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new Water charge
router.post('/', authMiddleware, async (req, res) => {
  try {
    const chargeData = {
      ...req.body,
      createdBy: req.user.id
    };

    const charge = new WaterCharge(chargeData);
    await charge.save();
    await charge.populate('createdBy', 'firstName lastName');

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on charge creation
    res.status(201).json({ success: true, data: charge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update Water charge
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const charge = await WaterCharge.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!charge) {
      return res.status(404).json({ success: false, message: 'Water charge not found' });
    }

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on charge update
    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete Water charge
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const charge = await WaterCharge.findByIdAndDelete(req.params.id);

    if (!charge) {
      return res.status(404).json({ success: false, message: 'Water charge not found' });
    }

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on charge deletion
    res.json({ success: true, message: 'Water charge deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/water-charges/bulk-create
// @desc    Bulk create water charges for properties with water enabled for a specific month
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
      const existingCharges = await WaterCharge.countDocuments({
        invoiceNumber: new RegExp(`^WATER-${monthYear}`, 'i')
      });
      
      if (existingCharges > 0) {
        return res.status(400).json({
          success: false,
          message: `Water charges already exist for ${month}/${year}. Use forceRegenerate: true to regenerate.`,
          existingCount: existingCharges
        });
      }
    }

    const properties = await TajProperty.find({ hasWaterCharges: true })
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
            const existingCharge = await WaterCharge.findOne({
              $or: [
                { address: propertyKey },
                { plotNo: property.plotNumber },
                { owner: property.ownerName }
              ],
              invoiceNumber: new RegExp(`^WATER-${monthYear}`, 'i')
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

          // Get Water charge amount based on zone type and property size
          const propertySize = property.areaValue || 0;
          const areaUnit = property.areaUnit || 'Marla';
          const zoneType = property.zoneType || 'Residential';
          
          // For Commercial zone, use commercial Water charges (size not needed)
          // For Residential zone, calculate based on property size
          let amount = 0;
          if (zoneType === 'Commercial') {
            const camChargeInfo = await getWaterChargeForProperty(0, areaUnit, zoneType);
            amount = camChargeInfo.amount || 0;
          } else if (propertySize > 0) {
            const camChargeInfo = await getWaterChargeForProperty(propertySize, areaUnit, zoneType);
            amount = camChargeInfo.amount || 0;
          }

          if (amount === 0) {
            const reason = zoneType === 'Commercial'
              ? 'Commercial water charges not configured in charges slab'
              : 'No matching slab found for property size';
            errors.push({
              propertyId: property._id,
              propertyName: property.propertyName || property.address,
              reason
            });
            return;
          }

          // Generate invoice number
          const invoiceNumber = `WATER-${monthYear}-${String(property.srNo || createdCharges.length + 1).padStart(4, '0')}`;

          // Create water charge data
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

          const charge = new WaterCharge(chargeData);
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

    clearCached(CACHE_KEYS.WATER_CHARGES_OVERVIEW); // Invalidate cache on bulk creation
    res.json({
      success: true,
      message: `Bulk water charges creation completed`,
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
    console.error('Error in bulk create water charges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bulk water charges',
      error: error.message
    });
  }
}));

module.exports = router;

