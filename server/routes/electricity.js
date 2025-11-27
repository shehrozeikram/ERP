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
    console.log('📋 Fetching current Electricity overview...');
    
    // Get all properties
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

    // Get Electricity charges for each property to calculate totals
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
        console.error('Query conditions:', JSON.stringify(queryConditions, null, 2));
        // Continue with empty array if query fails
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

    // Calculate totals and prepare property details
    let totalAmount = 0;
    let totalArrears = 0;
    let propertyDetails = [];
    
    try {
      propertyDetails = properties.map(property => {
        try {
          const propertyKey = property.address || property.plotNumber || property.ownerName;
          const relatedCharges = chargesMap.get(propertyKey) || [];
          
          // Use totalBill if available, otherwise use amount
          const propertyAmount = relatedCharges.reduce((sum, charge) => sum + (charge.totalBill || charge.amount || 0), 0);
          const propertyArrears = relatedCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
          
          // Get all payments from related charges
          const allPayments = relatedCharges.flatMap(charge => (charge.payments || []).map(payment => ({
            ...payment,
            chargeId: charge._id,
            chargeInvoiceNumber: charge.invoiceNumber
          })));
          
          // Calculate payment status based on total payments vs total electricity amount
          const totalElectricityAmount = propertyAmount + propertyArrears;
          const totalPaid = allPayments.reduce((sum, payment) => sum + (payment.totalAmount || payment.amount || 0), 0);
          
          let paymentStatus = 'unpaid';
          if (totalPaid >= totalElectricityAmount && totalElectricityAmount > 0) {
            paymentStatus = 'paid';
          } else if (totalPaid > 0) {
            paymentStatus = 'partial_paid';
          }
          
          // Update all payments with the calculated status
          allPayments.forEach(payment => {
            payment.status = paymentStatus;
          });
          
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
            electricityWaterMeterNo: property.electricityWaterMeterNo || null,
            // Electricity related fields
            electricityAmount: propertyAmount || 0,
            electricityArrears: propertyArrears || 0,
            hasElectricity: relatedCharges.length > 0,
            electricityLastReading: lastReading,
            payments: allPayments || [],
            paymentStatus: paymentStatus
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

// Add payment to Electricity Bill by property ID (finds most recent bill)
router.post('/property/:propertyId/payments', authMiddleware, async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, reference, notes } = req.body;

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
      return res.status(404).json({ success: false, message: 'No Electricity bill found for this property' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const paymentTotal = paymentAmount + arrearsAmount;

    bill.payments.push({
      amount: paymentAmount,
      arrears: arrearsAmount,
      totalAmount: paymentTotal,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      invoiceNumber: invoiceNumber || '',
      paymentMethod: paymentMethod || 'Bank Transfer',
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
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add payment to Electricity Bill by bill ID
router.post('/:id/payments', authMiddleware, async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, reference, notes } = req.body;

    const bill = await Electricity.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Electricity Bill not found' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const paymentTotal = paymentAmount + arrearsAmount;

    bill.payments.push({
      amount: paymentAmount,
      arrears: arrearsAmount,
      totalAmount: paymentTotal,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      invoiceNumber: invoiceNumber || '',
      paymentMethod: paymentMethod || 'Bank Transfer',
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
    res.json({ success: true, data: bill });
  } catch (error) {
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
          const meterRent = property.hasElectricityWater ? 75 : 0;
          const tvFee = property.hasElectricityWater ? 35 : 0;
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

