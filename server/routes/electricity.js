const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Electricity = require('../models/tajResidencia/Electricity');
const TajProperty = require('../models/tajResidencia/TajProperty');
const { authMiddleware } = require('../middleware/auth');
const {
  getElectricitySlabForUnits, 
  calculateElectricityCharges, 
  getPreviousReading,
  calculateUnitsForDays,
  formatDateString,
  formatMonthString
} = require('../utils/electricityBillHelper');
const { numberToWords } = require('../utils/camChargesHelper');
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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

// Get all Electricity with search and filters
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

    const charges = await Electricity.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ serialNumber: -1 });

    res.json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/electricity/current-overview
// @desc    Get current Electricity overview for all properties
// @access  Private
// NOTE: This route MUST be defined before /:id route to avoid route matching conflicts
router.get('/current-overview', authMiddleware, async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Only use cache if no pagination is requested (page 1, default limit)
    const isDefaultPagination = page === 1 && limit === 50;
    if (isDefaultPagination) {
    const cached = getCached(CACHE_KEYS.ELECTRICITY_OVERVIEW);
    if (cached) {
      console.log('📋 Returning cached Electricity overview');
      return res.json(cached);
      }
    }
    
    console.log(`📋 Fetching current Electricity overview (page: ${page}, limit: ${limit})...`);
    
    // OPTIMIZATION: Select only needed fields from properties
    const propertyFields = '_id srNo propertyType propertyName plotNumber rdaNumber street sector categoryType address fullAddress project ownerName contactNumber status fileSubmissionDate demarcationDate constructionDate familyStatus areaValue areaUnit zoneType electricityWaterMeterNo meters';
    
    // OPTIMIZATION: Fetch properties with optimized field selection
    const allProperties = await fetchProperties(propertyFields);
      console.log(`✅ Found ${allProperties.length} total properties`);

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
      setCached(CACHE_KEYS.ELECTRICITY_OVERVIEW, emptyResponse);
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
    
    // Match Electricity charges by address, plot number, or owner name
    let electricityCharges = [];
    if (queryConditions.length > 0) {
      try {
        console.log(`🔍 Querying Electricity charges with ${queryConditions.length} conditions...`);
        electricityCharges = await Electricity.find({
          $or: queryConditions
        })
          .select('address plotNo owner meterNo amount arrears status curReading toDate totalBill payments paymentStatus')
          .sort({ toDate: -1 })
          .lean();
        console.log(`✅ Found ${electricityCharges.length} Electricity charges`);
      } catch (queryError) {
        console.error('❌ Error querying Electricity charges:', queryError);
        electricityCharges = [];
      }
    } else {
      console.log('⚠️ No query conditions, skipping Electricity charges query');
    }

    // Create a map of charges by property identifier and meter number
    const chargesMap = new Map();
    const lastReadingMap = new Map(); // Map to store last reading by property key
    
    electricityCharges.forEach(charge => {
      const key = charge.address || charge.plotNo || charge.owner;
      if (key) {
        if (!chargesMap.has(key)) {
          chargesMap.set(key, []);
        }
        chargesMap.get(key).push(charge);
        
        // Store last reading (most recent bill's current reading)
        if (charge.curReading !== undefined && charge.curReading !== null) {
          if (!lastReadingMap.has(key) || (charge.toDate && (!lastReadingMap.get(key).date || new Date(charge.toDate) > new Date(lastReadingMap.get(key).date)))) {
            lastReadingMap.set(key, {
              reading: charge.curReading,
              date: charge.toDate
            });
          }
        }
      }
      
      // Also map by meter number if available
      if (charge.meterNo) {
        if (!lastReadingMap.has(charge.meterNo) || (charge.toDate && (!lastReadingMap.get(charge.meterNo).date || new Date(charge.toDate) > new Date(lastReadingMap.get(charge.meterNo).date)))) {
          lastReadingMap.set(charge.meterNo, {
            reading: charge.curReading,
            date: charge.toDate
          });
        }
      }
    });

    // Fetch PropertyInvoices with ELECTRICITY charge type to determine which electricity bills should be shown
    const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
    const propertyIds = properties.map(p => p._id);
    const electricityInvoices = await PropertyInvoice.find({
      property: { $in: propertyIds },
      chargeTypes: { $in: ['ELECTRICITY'] }
    })
      .select('property electricityBill')
      .lean();
    
    // Create a set of electricityBill IDs that have PropertyInvoices
    const electricityBillIdsWithInvoices = new Set();
    electricityInvoices.forEach(invoice => {
      const elecBillId = invoice.electricityBill?.toString() || invoice.electricityBill;
      if (elecBillId) {
        electricityBillIdsWithInvoices.add(elecBillId);
      }
    });
    
    // Create a map of propertyId -> hasInvoice (boolean) for quick lookup
    const propertyHasInvoiceMap = new Map();
    electricityInvoices.forEach(invoice => {
      const propId = invoice.property?.toString() || invoice.property;
      if (propId) {
        propertyHasInvoiceMap.set(propId, true);
      }
    });

    // Calculate totals and prepare property details
    let totalAmount = 0;
    let totalArrears = 0;
    let propertyDetails = [];
    
    try {
      propertyDetails = properties.map(property => {
        try {
          // OPTIMIZATION: Use pre-calculated address
          const propertyKey = propertyAddressMap.get(property._id.toString()) || property.plotNumber || property.ownerName;
          const relatedCharges = chargesMap.get(propertyKey) || [];
          
          // Only show electricity amounts if property has at least one PropertyInvoice with ELECTRICITY charge type
          const propertyIdStr = property._id.toString();
          const hasInvoice = propertyHasInvoiceMap.get(propertyIdStr) || false;
          
          // Filter charges to only include those that are referenced by PropertyInvoices
          const filteredCharges = hasInvoice 
            ? relatedCharges.filter(charge => {
                const billId = charge._id?.toString();
                return billId && electricityBillIdsWithInvoices.has(billId);
              })
            : [];
          
          // Use totalBill if available, otherwise use amount
          const propertyAmount = filteredCharges.reduce((sum, charge) => sum + (charge.totalBill || charge.amount || 0), 0);
          const propertyArrears = filteredCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
          
          // OPTIMIZATION: Calculate payments using centralized utility (only for filtered charges)
          const paymentData = calculatePayments(
            filteredCharges,
            (c) => c.totalBill || c.amount || 0,
            (c) => c.arrears || 0
          );
          const { allPayments } = paymentData;
          
          // Recalculate payment status based on total electricity amount
          const totalElectricityAmount = propertyAmount + propertyArrears;
          let finalPaymentStatus = 'unpaid';
          if (paymentData.totalPaid >= totalElectricityAmount && totalElectricityAmount > 0) {
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
          
          totalAmount += propertyAmount;
          totalArrears += propertyArrears;

          // Get last reading for this property
          const meterNo = property.electricityWaterMeterNo || '';
          const lastReadingInfo = lastReadingMap.get(propertyKey) || lastReadingMap.get(meterNo) || null;
          const lastReading = lastReadingInfo ? lastReadingInfo.reading : 0;

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
            electricityWaterMeterNo: property.electricityWaterMeterNo || null,
            meters: property.meters || [], // Include meters array
            // Electricity related fields (only show if there's a PropertyInvoice)
            electricityAmount: propertyAmount || 0,
            electricityArrears: propertyArrears || 0,
            hasElectricity: filteredCharges.length > 0,
            electricityLastReading: lastReading,
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
            meters: property.meters || [], // Include meters even in error case
            electricityAmount: 0,
            electricityArrears: 0,
            hasElectricity: false
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
    setCached(CACHE_KEYS.ELECTRICITY_OVERVIEW, response);
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
      message: 'Failed to fetch current Electricity overview',
      error: error.message
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.stack;
      errorResponse.errorName = error.name;
    }
    
    res.status(500).json(errorResponse);
  }
});

// @route   GET /api/electricity/property/:propertyId/latest-bill
// @desc    Fetch the most recent electricity bill for a specific property
// @access  Private
router.get('/property/:propertyId/latest-bill', authMiddleware, async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId).lean();
    if (!property) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const conditions = [];
    if (property.address) conditions.push({ address: property.address });
    if (property.plotNumber) conditions.push({ plotNo: property.plotNumber });
    if (property.ownerName) conditions.push({ owner: property.ownerName });
    if (property.electricityWaterMeterNo) conditions.push({ meterNo: property.electricityWaterMeterNo });

    if (!conditions.length) {
      return res.status(400).json({
        success: false,
        message: 'Property does not have enough identifiers to locate an electricity bill'
      });
    }

    const latestBill = await Electricity.findOne({ $or: conditions })
      .sort({ toDate: -1, createdAt: -1 })
      .lean();

    if (!latestBill) {
      return res.status(404).json({ success: false, message: 'No electricity bill found for this property' });
    }

    res.json({ success: true, data: latestBill });
  } catch (error) {
    console.error('❌ Error fetching latest bill for property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest electricity bill',
      error: error.message
    });
  }
});

// Add payment to Electricity Bill by property ID (finds most recent bill)
router.post('/property/:propertyId/payments', authMiddleware, paymentAttachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, bankName, reference, notes } = req.body;

    // Find property
    const property = await TajProperty.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Find most recent Electricity bill for this property
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    const bill = await Electricity.findOne({
      $or: [
        { address: propertyKey },
        { plotNo: property.plotNumber },
        { owner: property.ownerName }
      ]
    }).sort({ toDate: -1, createdAt: -1 });

    if (!bill) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'No Electricity bill found for this property' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const paymentTotal = paymentAmount + arrearsAmount;

    const attachmentUrl = req.file ? `/uploads/payment-attachments/${req.file.filename}` : '';

    bill.payments.push({
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
    const billTotal = (bill.totalBill || bill.amount || 0) + (bill.arrears || 0);
    const totalPaid = bill.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    if (totalPaid >= billTotal && billTotal > 0) {
      bill.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      bill.paymentStatus = 'partial_paid';
    } else {
      bill.paymentStatus = 'unpaid';
    }

    await bill.save();
    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on payment update
    res.json({ success: true, data: bill });
  } catch (error) {
    cleanupAttachment(req.file);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add payment to Electricity Bill by bill ID
router.post('/:id/payments', authMiddleware, paymentAttachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, bankName, reference, notes } = req.body;

    const bill = await Electricity.findById(req.params.id);
    if (!bill) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'Electricity Bill not found' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const paymentTotal = paymentAmount + arrearsAmount;

    const attachmentUrl = req.file ? `/uploads/payment-attachments/${req.file.filename}` : '';

    bill.payments.push({
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
    const billTotal = (bill.totalBill || bill.amount || 0) + (bill.arrears || 0);
    const totalPaid = bill.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    if (totalPaid >= billTotal && billTotal > 0) {
      bill.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      bill.paymentStatus = 'partial_paid';
    } else {
      bill.paymentStatus = 'unpaid';
    }

    await bill.save();
    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on payment update
    res.json({ success: true, data: bill });
  } catch (error) {
    cleanupAttachment(req.file);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete all payments from Electricity Bill by property ID
router.delete('/property/:propertyId/payments', authMiddleware, async (req, res) => {
  try {
    // Find property
    const property = await TajProperty.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Find all Electricity bills for this property
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    const bills = await Electricity.find({
      $or: [
        { address: propertyKey },
        { plotNo: property.plotNumber },
        { owner: property.ownerName }
      ]
    });

    if (bills.length === 0) {
      return res.status(404).json({ success: false, message: 'No Electricity bills found for this property' });
    }

    // Remove all payments from all bills
    for (const bill of bills) {
      bill.payments = [];
      bill.paymentStatus = 'unpaid';
      await bill.save();
    }

    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on payment deletion
    res.json({ 
      success: true, 
      message: `Removed all payments from ${bills.length} Electricity bill(s)`,
      data: { billsUpdated: bills.length }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete all payments from Electricity Bill by bill ID
router.delete('/:id/payments', authMiddleware, async (req, res) => {
  try {
    const bill = await Electricity.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Electricity Bill not found' });
    }

    bill.payments = [];
    bill.paymentStatus = 'unpaid';
    await bill.save();

    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on payment deletion
    res.json({ 
      success: true, 
      message: 'All payments removed from Electricity bill',
      data: bill
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete a specific payment from Electricity Bill
router.delete('/:billId/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const bill = await Electricity.findById(req.params.billId);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Electricity Bill not found' });
    }

    const paymentIndex = bill.payments.findIndex(
      p => p._id.toString() === req.params.paymentId
    );

    if (paymentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    bill.payments.splice(paymentIndex, 1);

    // Recalculate payment status after removing payment
    const billTotal = (bill.totalBill || bill.amount || 0) + (bill.arrears || 0);
    const totalPaid = bill.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    if (totalPaid >= billTotal && billTotal > 0) {
      bill.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      bill.paymentStatus = 'partial_paid';
    } else {
      bill.paymentStatus = 'unpaid';
    }

    await bill.save();

    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on payment deletion
    res.json({ 
      success: true, 
      message: 'Payment removed successfully',
      data: bill
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get Electricity by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const charge = await Electricity.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!charge) {
      return res.status(404).json({ success: false, message: 'Electricity not found' });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new Electricity
router.post('/', authMiddleware, async (req, res) => {
  try {
    const chargeData = {
      ...req.body,
      createdBy: req.user.id
    };

    const charge = new Electricity(chargeData);
    await charge.save();
    await charge.populate('createdBy', 'firstName lastName');

    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on bill creation
    res.status(201).json({ success: true, data: charge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update Electricity
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const charge = await Electricity.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!charge) {
      return res.status(404).json({ success: false, message: 'Electricity not found' });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete Electricity
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const charge = await Electricity.findByIdAndDelete(req.params.id);

    if (!charge) {
      return res.status(404).json({ success: false, message: 'Electricity not found' });
    }

    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on bill deletion
    res.json({ success: true, message: 'Electricity deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/electricity/bulk-create
// @desc    Bulk create electricity bills for all properties for a specific month
// @access  Private
router.post('/bulk-create', authMiddleware, [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2020 }).withMessage('Year must be 2020 or later'),
  body('properties').isArray().withMessage('Properties array is required'),
  body('properties.*.propertyId').notEmpty().withMessage('Property ID is required'),
  body('properties.*.currentReading').isNumeric().withMessage('Current reading must be numeric').isFloat({ min: 0 }).withMessage('Current reading cannot be negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { month, year, properties, fromDate, toDate, dueDate, forceRegenerate = false } = req.body;

  try {
    // Calculate default dates if not provided
    const billingFromDate = fromDate ? new Date(fromDate) : new Date(year, month - 1, 1);
    const billingToDate = toDate ? new Date(toDate) : new Date(year, month, 0);
    const paymentDueDate = dueDate ? new Date(dueDate) : new Date(year, month + 1, 25);
    
    const totalDays = Math.ceil((billingToDate - billingFromDate) / (1000 * 60 * 60 * 24)) + 1;
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    const monthString = formatMonthString(billingFromDate);

    const createdBills = [];
    const errors = [];
    const skippedProperties = [];

    // Process properties in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      const batch = properties.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (propData) => {
        try {
          const { propertyId, currentReading, overrideFromDate, overrideToDate, overrideDueDate } = propData;
          
          // Get property details
          const property = await TajProperty.findById(propertyId).lean();
          if (!property) {
            errors.push({
              propertyId,
              reason: 'Property not found'
            });
            return;
          }

          // Check if bill already exists
          if (!forceRegenerate) {
            const propertyKey = property.address || property.plotNumber || property.ownerName;
            const existingBill = await Electricity.findOne({
              $or: [
                { address: propertyKey },
                { plotNo: property.plotNumber },
                { owner: property.ownerName },
                { meterNo: property.electricityWaterMeterNo }
              ],
              month: monthString
            });

            if (existingBill) {
              skippedProperties.push({
                propertyId,
                propertyName: property.propertyName || property.address,
                reason: 'Bill already exists for this month'
              });
              return;
            }
          }

          // Get meter number
          const meterNo = property.electricityWaterMeterNo || '';
          if (!meterNo) {
            errors.push({
              propertyId,
              propertyName: property.propertyName || property.address,
              reason: 'Meter number not found'
            });
            return;
          }

          // Get previous reading and arrears
          const propertyKey = property.address || property.plotNumber || property.ownerName;
          const { prvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey);

          // Calculate units consumed
          const curReading = parseFloat(currentReading) || 0;
          const unitsConsumed = Math.max(0, curReading - prvReading);
          
          if (unitsConsumed === 0 && prvReading > 0) {
            // If no consumption but previous reading exists, still create bill with 0 units
          }

          // Get slab information
          const { slab, unitRate, fixRate, unitsSlab } = await getElectricitySlabForUnits(unitsConsumed);
          
          if (!slab && unitsConsumed > 0) {
            errors.push({
              propertyId,
              propertyName: property.propertyName || property.address,
              reason: 'No matching slab found for units consumed'
            });
            return;
          }

          // Use override dates if provided
          const billFromDate = overrideFromDate ? new Date(overrideFromDate) : billingFromDate;
          const billToDate = overrideToDate ? new Date(overrideToDate) : billingToDate;
          const billDueDate = overrideDueDate ? new Date(overrideDueDate) : paymentDueDate;
          
          const billTotalDays = Math.ceil((billToDate - billFromDate) / (1000 * 60 * 60 * 24)) + 1;
          const unitsForDays = calculateUnitsForDays(unitsConsumed, billTotalDays, billTotalDays);

          // Calculate all charges
          // Meter Rent, TV Fee, and NJ Surcharge removed from calculation
          const meterRent = 0;
          const tvFee = 0;
          const charges = calculateElectricityCharges(unitsConsumed, unitRate, fixRate, meterRent, tvFee);

          // Calculate balance and arrears
          const receivedAmount = 0; // Default to 0, can be updated later
          const balance = charges.withSurcharge - receivedAmount;
          const newArrears = previousArrears + balance;

          // Generate invoice number
          const invoiceNumber = `ELEC-${monthYear}-${String(property.srNo || createdBills.length + 1).padStart(4, '0')}`;

          // Create bill data
          const billData = {
            invoiceNumber,
            meterNo,
            propertyType: 'Residential',
            prvReading,
            curReading,
            unitsConsumed,
            unitsConsumedForDays: unitsForDays,
            iescoSlabs: unitsSlab || '',
            fromDate: billFromDate,
            toDate: billToDate,
            month: monthString,
            dueDate: billDueDate,
            iescoUnitPrice: parseFloat(unitRate) || 0,
            electricityCost: charges.electricityCost,
            fcSurcharge: charges.fcSurcharge,
            meterRent: charges.meterRent,
            njSurcharge: charges.njSurcharge,
            gst: charges.gst,
            electricityDuty: charges.electricityDuty,
            tvFee: charges.tvFee,
            fixedCharges: charges.fixedCharges,
            totalBill: charges.totalBill,
            withSurcharge: charges.withSurcharge,
            receivedAmount,
            balance,
            arrears: newArrears,
            amount: charges.withSurcharge,
            amountInWords: numberToWords(charges.withSurcharge),
            // Property details
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
            createdBy: req.user.id
          };

          const bill = new Electricity(billData);
          await bill.save();
          createdBills.push(bill);
        } catch (error) {
          errors.push({
            propertyId: propData.propertyId,
            reason: error.message
          });
        }
      }));
    }

    clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW); // Invalidate cache on bulk creation
    res.json({
      success: true,
      message: `Bulk electricity bills creation completed`,
      data: {
        totalProperties: properties.length,
        created: createdBills.length,
        skipped: skippedProperties.length,
        errors: errors.length,
        createdBills: createdBills.map(b => ({
          _id: b._id,
          invoiceNumber: b.invoiceNumber,
          meterNo: b.meterNo,
          owner: b.owner,
          unitsConsumed: b.unitsConsumed,
          totalBill: b.totalBill
        })),
        skippedProperties,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error in bulk create electricity bills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bulk electricity bills',
      error: error.message
    });
  }
}));

module.exports = router;

