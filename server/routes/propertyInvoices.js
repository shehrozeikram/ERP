const express = require('express');
const router = express.Router();
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const TajProperty = require('../models/tajResidencia/TajProperty');
const CAMCharge = require('../models/tajResidencia/CAMCharge');
const Electricity = require('../models/tajResidencia/Electricity');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const TajTransaction = require('../models/tajResidencia/TajTransaction');
const { authMiddleware } = require('../middleware/auth');
const { numberToWords, getCAMChargeForProperty } = require('../utils/camChargesHelper');
const FinanceHelper = require('../utils/financeHelper');
const { getPreviousReading, getElectricitySlabForUnits, calculateElectricityCharges } = require('../utils/electricityBillHelper');
const dayjs = require('dayjs');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;
const {
  getCached,
  setCached,
  clearCached,
  CACHE_KEYS
} = require('../utils/tajUtilitiesOptimizer');

// Generate invoice number with type prefix
const generateInvoiceNumber = (propertySrNo, year, month, type = 'GEN', meterSuffix = '') => {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedIndex = String(propertySrNo || 1).padStart(4, '0');
  
  // Determine prefix based on type
  const prefixMap = {
    'CAM': 'INV-CMC',
    'CMC': 'INV-CMC',
    'ELECTRICITY': 'INV-ELC',
    'ELC': 'INV-ELC',
    'RENT': 'INV-REN',
    'REN': 'INV-REN',
    'MIXED': 'INV-MIX',
    'MIX': 'INV-MIX'
  };
  
  const prefix = prefixMap[type] || 'INV';
  const suffix = meterSuffix ? `-${meterSuffix}` : '';
  return `${prefix}-${year}-${paddedMonth}-${paddedIndex}${suffix}`;
};

/**
 * Calculate arrears from overdue invoices (unpaid or partially paid invoices past due date)
 * For each overdue invoice, calculates: Charges for the Month + Arrears + Late Payment Surcharge (10% of Charges for the Month)
 * @param {ObjectId} propertyId - Property ID
 * @param {Date} currentDate - Current date (defaults to now)
 * @returns {Number} Total arrears amount to be added to new invoice
 */
const calculateOverdueArrears = async (propertyId, currentDate = new Date()) => {
  if (!propertyId) return 0;
  
  try {
    // Find all previous invoices for this property that are overdue and have outstanding balance
    const overdueInvoices = await PropertyInvoice.find({
      property: propertyId,
      dueDate: { $lt: currentDate }, // Past due date
      balance: { $gt: 0 }, // Has outstanding balance
      paymentStatus: { $in: ['unpaid', 'partial_paid'] }, // Unpaid or partially paid
      status: { $ne: 'Cancelled' } // Not cancelled
    })
    .select('charges subtotal totalArrears grandTotal balance')
    .sort({ dueDate: 1 }) // Oldest first
    .lean();
    
    if (!overdueInvoices || overdueInvoices.length === 0) {
      return 0;
    }
    
    let totalOverdueArrears = 0;
    
    overdueInvoices.forEach(invoice => {
      // Calculate "Charges for the Month" - sum of all charge amounts (excluding arrears)
      const chargesForMonth = invoice.charges?.reduce((sum, charge) => sum + (charge.amount || 0), 0) || invoice.subtotal || 0;
      
      // Get existing arrears from the invoice
      const existingArrears = invoice.totalArrears || 0;
      
      // Calculate late payment surcharge: 10% of "Charges for the Month"
      const lateSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
      
      // Calculate "Payable After Due Date" = Charges for the Month + Arrears + Late Surcharge
      const payableAfterDue = chargesForMonth + existingArrears + lateSurcharge;
      
      // Add the outstanding balance (what's actually unpaid) to total arrears
      // But we need to account for the late surcharge that should be added
      // The balance already includes the original charges + arrears - payments
      // So we add the late surcharge to the balance
      const overdueAmount = invoice.balance + lateSurcharge;
      
      totalOverdueArrears += overdueAmount;
    });
    
    // Round to 2 decimal places
    return Math.round(totalOverdueArrears * 100) / 100;
  } catch (error) {
    console.error('Error calculating overdue arrears:', error);
    return 0; // Return 0 on error to prevent invoice creation from failing
  }
};

// Helper: Normalize readings map from various input formats
const normalizeReadingsMap = (meterReadings, currentReading, metersToProcess) => {
  const readingsMap = {};
  
  if (meterReadings && typeof meterReadings === 'object' && Object.keys(meterReadings).length > 0) {
    Object.entries(meterReadings).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        readingsMap[String(key)] = {
          currentReading: parseFloat(value.currentReading),
          previousReading: value.previousReading !== undefined ? parseFloat(value.previousReading) : undefined
        };
      } else {
      readingsMap[String(key)] = parseFloat(value) || 0;
      }
    });
  } else if (typeof currentReading === 'object' && currentReading !== null) {
    Object.entries(currentReading).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        readingsMap[String(key)] = {
          currentReading: parseFloat(value.currentReading),
          previousReading: value.previousReading !== undefined ? parseFloat(value.previousReading) : undefined
        };
      } else {
      readingsMap[String(key)] = parseFloat(value) || 0;
      }
    });
  } else if (currentReading !== undefined && currentReading !== null && currentReading !== '' && metersToProcess.length > 0) {
    readingsMap[String(metersToProcess[0].meterNo || '')] = parseFloat(currentReading) || 0;
  }
  
  return readingsMap;
};

// Helper: Update invoice fields
const updateInvoiceFields = (invoice, { charges, subtotal, totalArrears, grandTotal, periodFrom, periodTo, chargeTypes }) => {
  invoice.charges = charges;
  invoice.subtotal = subtotal;
  invoice.totalArrears = totalArrears;
  invoice.grandTotal = grandTotal;
  invoice.amountInWords = numberToWords(grandTotal);
  if (chargeTypes) invoice.chargeTypes = chargeTypes;
  if (periodFrom) invoice.periodFrom = new Date(periodFrom);
  if (periodTo) {
    invoice.periodTo = new Date(periodTo);
    invoice.dueDate = new Date(periodTo);
  }
};

// Helper: Populate invoice references
const populateInvoiceReferences = async (invoice, { camCharge, electricityBill }) => {
  await invoice.populate({
    path: 'property',
    populate: {
      path: 'resident',
      select: 'name accountType contactNumber email residentId'
    }
  });
  if (camCharge) await invoice.populate('camCharge');
  if (electricityBill) await invoice.populate('electricityBill');
};

// Helper: Create new invoice (always creates new, never updates existing)
// If invoice number exists, generates new unique number with timestamp
const createOrUpdateInvoice = async (invoiceData, invoiceNumber, propertyId, userId, periodFrom, periodTo, propertySrNo, invoiceType) => {
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month() + 1;
  
  // Determine the month/year from periodTo (or periodFrom if periodTo is not available)
  const periodDate = periodTo ? dayjs(periodTo) : (periodFrom ? dayjs(periodFrom) : now);
  const periodYear = periodDate.year();
  const periodMonth = periodDate.month() + 1;
  
  // Check if invoice with this number already exists
  let existingInvoice = await PropertyInvoice.findOne({ invoiceNumber });
  
  // If invoice exists, always generate a new unique invoice number
  if (existingInvoice) {
    const timestamp = Date.now().toString().slice(-4);
    const baseSuffix = invoiceData.chargeTypes?.[0] === 'ELECTRICITY' && invoiceNumber.includes('-M') 
      ? invoiceNumber.split('-M')[1].split('-')[0] 
      : '';
    invoiceData.invoiceNumber = generateInvoiceNumber(
      propertySrNo,
      periodYear,
      periodMonth,
      invoiceType,
      baseSuffix ? `M${baseSuffix}-${timestamp}` : `-${timestamp}`
    );
  }
  
  // Always create new invoice (never update existing)
  let invoice;
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    try {
      invoice = new PropertyInvoice(invoiceData);
      await invoice.save();

      // Create Accounts Receivable entry and post to GL
      try {
        const property = await TajProperty.findById(invoice.property).populate('resident');
        if (property && property.resident) {
          await FinanceHelper.createARFromInvoice({
            customerName: property.resident.name,
            customerEmail: property.resident.email,
            customerId: property.resident._id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            amount: invoice.grandTotal,
            department: 'general',
            module: 'general',
            referenceId: invoice._id,
            charges: invoice.charges,
            createdBy: userId
          });
        }
      } catch (arError) {
        console.error('❌ Error creating AR for property invoice:', arError);
        // We don't fail the invoice creation if AR fails, but we log it
      }

      return { invoice, isNew: true };
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.invoiceNumber) {
        // Duplicate key error - generate new invoice number with timestamp
        attempts++;
        const timestamp = Date.now().toString().slice(-4) + attempts;
        const baseSuffix = invoiceData.chargeTypes?.[0] === 'ELECTRICITY' && invoiceData.invoiceNumber.includes('-M') 
          ? invoiceData.invoiceNumber.split('-M')[1].split('-')[0] 
          : '';
        invoiceData.invoiceNumber = generateInvoiceNumber(
          propertySrNo,
          periodYear,
          periodMonth,
          invoiceType,
          baseSuffix ? `M${baseSuffix}-${timestamp}` : `-${timestamp}`
        );
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to create invoice after multiple attempts');
};

// Helper: Create electricity bill data
const createElectricityBillData = (meter, property, calculatedCharges, { prvReading, curReading, unitsConsumed, unitRate, unitsSlab, previousArrears }, periodFrom, periodTo, billInvoiceNumber, userId) => {
  const now = dayjs();
  return {
    invoiceNumber: billInvoiceNumber,
    meterNo: meter.meterNo || '',
    propertyType: 'Residential',
    prvReading,
    curReading,
    unitsConsumed,
    unitsConsumedForDays: unitsConsumed,
    iescoSlabs: unitsSlab || '',
    fromDate: periodFrom ? new Date(periodFrom) : now.startOf('month').toDate(),
    toDate: periodTo ? new Date(periodTo) : now.endOf('month').toDate(),
    month: now.format('MMM-YY'),
    dueDate: periodTo ? dayjs(periodTo).add(15, 'day').toDate() : now.add(30, 'day').toDate(),
    iescoUnitPrice: parseFloat(unitRate) || 0,
    electricityCost: calculatedCharges.electricityCost,
    fcSurcharge: calculatedCharges.fcSurcharge,
    meterRent: calculatedCharges.meterRent,
    njSurcharge: calculatedCharges.njSurcharge,
    gst: calculatedCharges.gst,
    electricityDuty: calculatedCharges.electricityDuty,
    tvFee: calculatedCharges.tvFee,
    fixedCharges: calculatedCharges.fixedCharges,
    totalBill: calculatedCharges.totalBill,
    withSurcharge: calculatedCharges.withSurcharge,
    receivedAmount: 0,
    balance: calculatedCharges.withSurcharge,
    arrears: previousArrears,
    amount: calculatedCharges.withSurcharge,
    amountInWords: numberToWords(calculatedCharges.withSurcharge),
    plotNo: property.plotNumber || '',
    rdaNo: property.rdaNumber || '',
    street: property.street || '',
    sector: property.sector || '',
    category: property.categoryType || '',
    address: property.address || property.fullAddress || '',
    project: property.project || '',
    owner: property.ownerName || '',
    contactNo: property.contactNumber || '',
    status: 'Active',
    createdBy: userId
  };
};

// Get rent calculation for property (including carry forward arrears)
router.get('/property/:propertyId/rent-calculation', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId)
      .populate('rentalAgreement');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Calculate carry forward of Rent arrears from previous unpaid invoices
    let rentCarryForwardArrears = 0;
    const previousRentInvoices = await PropertyInvoice.find({
      property: property._id,
      chargeTypes: { $in: ['RENT'] },
      paymentStatus: { $in: ['unpaid', 'partial_paid'] },
      balance: { $gt: 0 }
    })
    .select('charges grandTotal totalPaid balance')
    .sort({ invoiceDate: 1 })
    .lean();
    
    // Calculate outstanding Rent charges from previous invoices
    previousRentInvoices.forEach(inv => {
      const rentCharge = inv.charges?.find(c => c.type === 'RENT');
      if (rentCharge) {
        // Calculate the Rent portion of the outstanding balance
        const hasOnlyRent = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'RENT';
        if (hasOnlyRent) {
          // If only Rent in invoice, use the full outstanding balance
          rentCarryForwardArrears += (inv.balance || 0);
        } else {
          // If mixed charges, calculate Rent portion proportionally
          const rentTotal = (rentCharge.amount || 0) + (rentCharge.arrears || 0);
          const invoiceTotal = inv.grandTotal || 0;
          if (invoiceTotal > 0) {
            const rentProportion = rentTotal / invoiceTotal;
            rentCarryForwardArrears += (inv.balance || 0) * rentProportion;
          }
        }
      }
    });
    
    // Round to 2 decimal places
    rentCarryForwardArrears = Math.round(rentCarryForwardArrears * 100) / 100;

    // Get monthly rent from rental agreement or property
    let monthlyRent = 0;
    let arrearsFromPayment = 0;
    
    // Try to get rent from rental agreement
    if (property.rentalAgreement?.monthlyRent) {
      monthlyRent = property.rentalAgreement.monthlyRent || 0;
    } else if (property.categoryType === 'Personal Rent' && property.rentalPayments?.length > 0) {
      // Fallback to latest rental payment
      const latestPayment = [...property.rentalPayments]
        .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))[0];
      if (latestPayment) {
        monthlyRent = latestPayment.amount || 0;
        arrearsFromPayment = latestPayment.arrears || 0;
      }
    } else if (property.expectedRent) {
      monthlyRent = property.expectedRent || 0;
    }

    // Total arrears = arrears from payment + carry forward from invoices
    const totalArrears = arrearsFromPayment + rentCarryForwardArrears;

    res.json({
      success: true,
      data: {
        monthlyRent,
        arrearsFromPayment,
        carryForwardArrears: rentCarryForwardArrears,
        totalArrears,
        rentalAgreement: property.rentalAgreement
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get previous reading and calculate charges for property
router.get('/property/:propertyId/electricity-calculation', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId)
      .populate('rentalAgreement');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const { unitsConsumed, currentReading, meterNo: requestedMeterNo, previousReading: requestedPreviousReading } = req.query;
    
    // Get active meters from property
    const activeMeters = (property.meters || []).filter(m => m.isActive !== false);
    
    // If specific meter requested, use that; otherwise use first meter or legacy meter
    let targetMeter = null;
    if (requestedMeterNo && activeMeters.length > 0) {
      targetMeter = activeMeters.find(m => m.meterNo === requestedMeterNo);
    }
    
    if (!targetMeter) {
      targetMeter = activeMeters.length > 0 
        ? activeMeters[0]
        : { meterNo: property.meterNumber || property.electricityWaterMeterNo || '', floor: property.floor || 'Ground Floor' };
    }
    
    const meterNo = targetMeter.meterNo || '';
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    
    // Get previous reading (pass propertyId for carry forward calculation)
    const { prvReading: autoPrvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey, req.params.propertyId);
    
    // PRIORITY: Use requested previous reading if provided (manual override), otherwise use auto-fetched one
    const prvReading = requestedPreviousReading !== undefined 
      ? parseFloat(requestedPreviousReading) 
      : autoPrvReading;
    
    // Calculate units consumed - prioritize direct unitsConsumed parameter
    let finalUnitsConsumed = 0;
    let curReading = 0;
    
    if (unitsConsumed !== undefined && unitsConsumed !== null && unitsConsumed !== '') {
      // Use units consumed directly (simplest approach)
      finalUnitsConsumed = Math.max(0, parseFloat(unitsConsumed) || 0);
      curReading = prvReading + finalUnitsConsumed; // Calculate current reading for display
    } else if (currentReading !== undefined && currentReading !== null && currentReading !== '') {
      // Fallback: calculate from current reading
      curReading = parseFloat(currentReading) || 0;
      
      if (curReading < prvReading) {
        return res.status(400).json({ 
          success: false, 
          message: `Current reading (${curReading}) cannot be less than previous reading (${prvReading})` 
        });
      }
      
      finalUnitsConsumed = Math.max(0, curReading - prvReading);
    }
    
    // Only calculate if we have units consumed
    if (finalUnitsConsumed > 0 || unitsConsumed === 0 || currentReading !== undefined) {
      const { slab, unitRate, fixRate, unitsSlab } = await getElectricitySlabForUnits(finalUnitsConsumed);
      
      if (!slab && finalUnitsConsumed > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No matching slab found for units consumed' 
        });
      }
      
      // Meter Rent, TV Fee, and NJ Surcharge removed from calculation
      const meterRent = 0;
      const tvFee = 0;
      const charges = calculateElectricityCharges(finalUnitsConsumed, unitRate, fixRate || 0, meterRent, tvFee);
      
      return res.json({
        success: true,
        data: {
          previousReading: prvReading,
          currentReading: curReading || (prvReading + finalUnitsConsumed),
          unitsConsumed: finalUnitsConsumed,
          previousArrears,
          meterNo,
          meterFloor: targetMeter.floor,
          slab: {
            unitsSlab,
            unitRate,
            fixRate
          },
          charges,
          grandTotal: charges.withSurcharge + previousArrears,
          // Include all meters info for frontend
          allMeters: activeMeters.length > 0 ? activeMeters.map(m => ({
            meterNo: m.meterNo || '',
            floor: m.floor || '',
            isActive: m.isActive !== false
          })) : undefined
        }
      });
    }
    
    // Return basic info if no calculation requested
    res.json({
      success: true,
      data: {
        previousReading: prvReading,
        previousArrears,
        meterNo,
        meterFloor: targetMeter.floor,
        // Include all meters info for frontend
        allMeters: activeMeters.length > 0 ? activeMeters.map(m => ({
          meterNo: m.meterNo || '',
          floor: m.floor || '',
          isActive: m.isActive !== false
        })) : undefined
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Create invoice for a property
router.post('/property/:propertyId', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId)
      .populate('rentalAgreement');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const { periodFrom, periodTo, dueDate, invoiceDate, includeCAM, includeElectricity, includeRent, charges: requestCharges, calculationData } = req.body;

    // Find latest charges/bills
    const propertyKey = property.address || property.plotNumber || property.ownerName;
    const conditions = [];
    if (propertyKey) conditions.push({ address: propertyKey });
    if (property.plotNumber) conditions.push({ plotNo: property.plotNumber });
    if (property.ownerName) conditions.push({ owner: property.ownerName });

    const charges = [];
    let camCharge = null;
    let electricityBill = null;
    let rentPayment = null;
    let rentChargeAdded = false; // Track if rent charge was calculated from agreement
    let rentCarryForwardArrears = 0; // Carry forward arrears from previous invoices
    const meterBillsData = []; // Store data for additional meters

    // Get CAM Charge
    if (includeCAM === true) {
      // Calculate carry forward of CAM Charges arrears from previous unpaid invoices
      let carryForwardArrears = 0;
      const previousCAMInvoices = await PropertyInvoice.find({
        property: property._id,
        chargeTypes: { $in: ['CAM'] },
        paymentStatus: { $in: ['unpaid', 'partial_paid'] },
        balance: { $gt: 0 }
      })
      .select('charges grandTotal totalPaid balance')
      .sort({ invoiceDate: 1 })
      .lean();
      
      // Calculate outstanding CAM charges from previous invoices
      previousCAMInvoices.forEach(inv => {
        const camCharge = inv.charges?.find(c => c.type === 'CAM');
        if (camCharge) {
          // Calculate the CAM portion of the outstanding balance
          // If invoice has only CAM, use full balance; otherwise calculate proportionally
          const hasOnlyCAM = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'CAM';
          if (hasOnlyCAM) {
            // If only CAM in invoice, use the full outstanding balance
            carryForwardArrears += (inv.balance || 0);
          } else {
            // If mixed charges, calculate CAM portion proportionally
            const camTotal = (camCharge.amount || 0) + (camCharge.arrears || 0);
            const invoiceTotal = inv.grandTotal || 0;
            if (invoiceTotal > 0) {
              const camProportion = camTotal / invoiceTotal;
              carryForwardArrears += (inv.balance || 0) * camProportion;
            }
          }
        }
      });
      
      // Round to 2 decimal places
      carryForwardArrears = Math.round(carryForwardArrears * 100) / 100;
      
      // First try to find existing CAM charge in database if we have property identifiers
      if (conditions.length > 0) {
        camCharge = await CAMCharge.findOne({ $or: conditions })
          .sort({ createdAt: -1 })
          .lean();
      }
      
      if (camCharge) {
        // Use existing CAM charge amount, but add carry forward arrears
        const camAmount = camCharge.amount || 0;
        const existingArrears = camCharge.arrears || 0;
        const totalArrears = existingArrears + carryForwardArrears;
        
        charges.push({
          type: 'CAM',
          description: carryForwardArrears > 0 
            ? 'CAM Charges (with Carry Forward Arrears)' 
            : 'CAM Charges',
          amount: camAmount,
          arrears: totalArrears,
          total: camAmount + totalArrears
        });
      } else {
        // If no existing CAM charge found, calculate from charges slab based on zone type and property size
        const propertySize = property.areaValue || 0;
        const areaUnit = property.areaUnit || 'Marla';
        const zoneType = property.zoneType || 'Residential';
        
        let camAmount = 0;
        let camDescription = 'CAM Charges';
        
        // For Commercial zone, use commercial CAM charges
        // For Residential zone, calculate based on property size
        if (zoneType === 'Commercial') {
          const camChargeInfo = await getCAMChargeForProperty(0, areaUnit, zoneType);
          camAmount = camChargeInfo.amount || 0;
          camDescription = 'Commercial CAM Charges';
        } else if (propertySize > 0) {
          // Residential zone: calculate based on property size
          const camChargeInfo = await getCAMChargeForProperty(propertySize, areaUnit, zoneType);
          camAmount = camChargeInfo.amount || 0;
          camDescription = `CAM Charges (${propertySize} ${areaUnit})`;
        }
        
        // Add carry forward arrears description if applicable
        if (carryForwardArrears > 0) {
          camDescription += ` + Carry Forward Arrears`;
        }
        
        // Always add CAM charge entry when includeCAM is true, even if amount is 0
        // This allows the invoice to be created and the amount can be set manually
        charges.push({
          type: 'CAM',
          description: camDescription,
          amount: camAmount,
          arrears: carryForwardArrears,
          total: camAmount + carryForwardArrears
        });
      }
    }

    // Get Electricity Bill - Handle multiple meters
    let hasReadings = false; // Declare at function scope
    if (includeElectricity === true) {
      // Note: Carry forward arrears are now calculated in getPreviousReading function
      // which is called when processing meter readings, so no need to calculate separately here
      const { currentReading, meterReadings } = req.body;
      
      // Check if frontend provided charges with correct calculation (from units consumed)
      // If charges are provided with amounts, use those instead of recalculating
      const hasProvidedCharges = requestCharges && Array.isArray(requestCharges) && requestCharges.length > 0;
      const electricityChargeFromRequest = hasProvidedCharges ? requestCharges.find(c => c.type === 'ELECTRICITY') : null;
      const shouldUseProvidedCharges = electricityChargeFromRequest && electricityChargeFromRequest.amount > 0;
      
      // Get active meters from property
      const activeMeters = (property.meters || []).filter(m => m.isActive !== false);
      
      // If no meters array, fallback to legacy single meter
      const metersToProcess = activeMeters.length > 0 
        ? activeMeters 
        : (property.meterNumber || property.electricityWaterMeterNo 
          ? [{ meterNo: property.meterNumber || property.electricityWaterMeterNo || '', floor: property.floor || 'Ground Floor' }]
          : []);
      
      // PRIORITY: If frontend provided charges (calculated from units consumed), use those
      // Only recalculate from readings if charges were NOT provided
      if (shouldUseProvidedCharges) {
        // Use charges provided from frontend - they're already calculated correctly from units consumed
        // Still need to create electricity bill record for reference, but use provided charge values
        const now = dayjs();
        const billInvoiceNumber = `ELEC-${now.format('YYYY-MM')}-${String(property.srNo || 1).padStart(4, '0')}`;
        
        // Get meter info for bill record
        const firstMeter = metersToProcess.length > 0 ? metersToProcess[0] : { meterNo: property.meterNumber || property.electricityWaterMeterNo || '', floor: property.floor || 'Ground Floor' };
        const meterNo = firstMeter.meterNo || '';
        const propertyKey = property.address || property.plotNumber || property.ownerName;
        
        // Get previous reading for reference
        const { prvReading: autoPrvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey, property._id);
        
        // PRIORITY: Use previousReading from calculationData if provided, otherwise fallback to auto-fetched one
        const prvReading = calculationData?.previousReading !== undefined 
          ? parseFloat(calculationData.previousReading) 
          : autoPrvReading;

        // Use values from calculationData if provided by frontend, otherwise fallback to request parameters
        const unitsConsumed = calculationData?.unitsConsumed !== undefined 
          ? parseFloat(calculationData.unitsConsumed) 
          : (parseFloat(currentReading) ? Math.max(0, parseFloat(currentReading) - prvReading) : 0);
          
        const curReading = calculationData?.currentReading !== undefined 
          ? parseFloat(calculationData.currentReading) 
          : (parseFloat(currentReading) || prvReading + unitsConsumed);
        
        // Create minimal electricity bill record for reference
        const billData = {
          invoiceNumber: billInvoiceNumber,
          meterNo: meterNo,
          propertyType: 'Residential',
          prvReading: prvReading, // Now uses the correct validated reading
          curReading: curReading,
          unitsConsumed: unitsConsumed,
          unitsConsumedForDays: unitsConsumed, // Explicitly save units consumed for calculation reference
          iescoSlabs: calculationData?.slab?.unitsSlab || '',
          iescoUnitPrice: parseFloat(calculationData?.slab?.unitRate) || 0,
          electricityCost: calculationData?.charges?.electricityCost || 0,
          fcSurcharge: calculationData?.charges?.fcSurcharge || 0,
          meterRent: calculationData?.charges?.meterRent || 0,
          njSurcharge: calculationData?.charges?.njSurcharge || 0,
          gst: calculationData?.charges?.gst || 0,
          electricityDuty: calculationData?.charges?.electricityDuty || 0,
          tvFee: calculationData?.charges?.tvFee || 0,
          fixedCharges: calculationData?.charges?.fixedCharges || (calculationData?.slab?.fixRate || 0),
          fromDate: periodFrom ? new Date(periodFrom) : now.startOf('month').toDate(),
          toDate: periodTo ? new Date(periodTo) : now.endOf('month').toDate(),
          month: now.format('MMM-YY'),
          dueDate: periodTo ? dayjs(periodTo).add(15, 'day').toDate() : now.add(30, 'day').toDate(),
          totalBill: electricityChargeFromRequest.amount || 0,
          withSurcharge: electricityChargeFromRequest.amount || 0,
          arrears: electricityChargeFromRequest.arrears || 0,
          amount: electricityChargeFromRequest.amount || 0,
          plotNo: property.plotNumber || '',
          rdaNo: property.rdaNumber || '',
          street: property.street || '',
          sector: property.sector || '',
          category: property.categoryType || '',
          address: property.address || property.fullAddress || '',
          project: property.project || '',
          owner: property.ownerName || '',
          contactNo: property.contactNumber || '',
          status: 'Active',
          createdBy: req.user.id
        };
        
        electricityBill = new Electricity(billData);
        await electricityBill.save();
        
        // Use the charges provided from frontend (already calculated correctly from units consumed)
        charges.push({
          type: 'ELECTRICITY',
          description: electricityChargeFromRequest.description || 'Electricity Bill',
          amount: electricityChargeFromRequest.amount || 0,
          arrears: electricityChargeFromRequest.arrears || 0,
          total: electricityChargeFromRequest.total || (electricityChargeFromRequest.amount || 0) + (electricityChargeFromRequest.arrears || 0)
        });
        
        hasReadings = false; // Mark that we didn't recalculate from readings
      } else {
        // No charges provided from frontend - recalculate from readings if available
      hasReadings = (currentReading !== undefined && currentReading !== null && currentReading !== '') ||
                    (meterReadings && typeof meterReadings === 'object' && Object.keys(meterReadings).length > 0);
      
      if (hasReadings) {
        const readingsMap = normalizeReadingsMap(meterReadings, currentReading, metersToProcess);
        const now = dayjs();
        const monthYear = `${now.year()}-${String(now.month() + 1).padStart(2, '0')}`;
        const propertyKey = property.address || property.plotNumber || property.ownerName;
        const meterRent = property.hasElectricityWater ? 75 : 0;
        const tvFee = property.hasElectricityWater ? 35 : 0;
        
        // Process each meter
        for (let meterIndex = 0; meterIndex < metersToProcess.length; meterIndex++) {
          const meter = metersToProcess[meterIndex];
          const meterNo = String(meter.meterNo || '');
          
          // Get current reading for this meter
          let curReading;
            let prvReadingFromPayload;
            
            const meterReading = readingsMap[meterNo];
            if (meterReading !== undefined) {
              if (typeof meterReading === 'object') {
                curReading = meterReading.currentReading;
                prvReadingFromPayload = meterReading.previousReading;
              } else {
                curReading = meterReading;
              }
          } else if (meterReadings && typeof meterReadings === 'object') {
            continue; // Skip if meterReadings provided but this meter has no reading
          } else if (meterIndex === 0 && typeof currentReading === 'number') {
            curReading = parseFloat(currentReading) || 0;
          } else {
            continue; // Skip if no reading for this meter
          }
          
          // Get previous reading for this specific meter (pass propertyId for carry forward calculation)
            const { prvReading: autoPrvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey, property._id);
            
            // PRIORITY: Use prvReading from payload if provided (manually adjusted), otherwise use auto-fetched one
            const prvReading = prvReadingFromPayload !== undefined ? prvReadingFromPayload : autoPrvReading;
          
          // Validate current reading
          if (curReading < prvReading) {
            return res.status(400).json({ 
              success: false, 
              message: `Current reading (${curReading}) for meter ${meterNo || meter.floor} cannot be less than previous reading (${prvReading})` 
            });
          }
          
          // Calculate units consumed and charges
          const unitsConsumed = Math.max(0, curReading - prvReading);
          const { slab, unitRate, fixRate, unitsSlab } = await getElectricitySlabForUnits(unitsConsumed);
          
          if (!slab && unitsConsumed > 0) {
            return res.status(400).json({ 
              success: false, 
              message: `No matching slab found for units consumed (${unitsConsumed}) for meter ${meterNo || meter.floor}` 
            });
          }
          
          const calculatedCharges = calculateElectricityCharges(unitsConsumed, unitRate, fixRate || 0, meterRent, tvFee);
          
          // Generate bill invoice number with meter suffix
          const meterSuffix = metersToProcess.length > 1 ? `M${meterIndex + 1}` : '';
          const billInvoiceNumber = `ELEC-${monthYear}-${String(property.srNo || 1).padStart(4, '0')}${meterSuffix ? `-${meterSuffix}` : ''}`;
          
          // Create electricity bill for this meter
          const billData = createElectricityBillData(
            meter, property, calculatedCharges,
            { prvReading, curReading, unitsConsumed, unitRate, unitsSlab, previousArrears },
            periodFrom, periodTo, billInvoiceNumber, req.user.id
          );
          
          const meterBill = new Electricity(billData);
          await meterBill.save();
          
          // Store first meter's bill for backward compatibility, or create separate invoices
          if (meterIndex === 0) {
            electricityBill = meterBill;
            // previousArrears already includes carry forward from getPreviousReading
            const electricityDescription = metersToProcess.length > 1 
              ? `Electricity Bill - ${meter.floor || 'Meter 1'}` 
              : (previousArrears > 0 ? 'Electricity Bill (with Carry Forward Arrears)' : 'Electricity Bill');
            
            charges.push({
              type: 'ELECTRICITY',
              description: electricityDescription,
              amount: calculatedCharges.withSurcharge,
              arrears: previousArrears,
              total: calculatedCharges.withSurcharge + previousArrears
            });
          } else {
            // For additional meters, store data to create separate invoices
            // Note: Carry forward arrears only added to first meter to avoid duplication
            meterBillsData.push({
              bill: meterBill,
              meter: meter,
              meterIndex: meterIndex + 1,
              charges: {
                type: 'ELECTRICITY',
                description: `Electricity Bill - ${meter.floor || `Meter ${meterIndex + 1}`}`,
                amount: calculatedCharges.withSurcharge,
                arrears: previousArrears,
                total: calculatedCharges.withSurcharge + previousArrears
              }
            });
          }
        }
        } else if (requestCharges && Array.isArray(requestCharges) && requestCharges.length > 0 && !hasReadings) {
          // Use manually entered charges from request (only if no readings were processed and charges not already used)
        const electricityCharge = requestCharges.find(c => c.type === 'ELECTRICITY');
        if (electricityCharge && electricityCharge.amount > 0) {
          // Create a minimal electricity bill record for reference
          const now = dayjs();
          const billInvoiceNumber = `ELEC-${now.format('YYYY-MM')}-${String(property.srNo || 1).padStart(4, '0')}`;
          
          const billData = {
            invoiceNumber: billInvoiceNumber,
            meterNo: property.meterNumber || '',
            propertyType: 'Residential',
            fromDate: periodFrom ? new Date(periodFrom) : now.startOf('month').toDate(),
            toDate: periodTo ? new Date(periodTo) : now.endOf('month').toDate(),
            month: now.format('MMM-YY'),
            dueDate: periodTo ? new Date(periodTo) : now.add(30, 'day').toDate(),
            totalBill: electricityCharge.amount || 0,
            withSurcharge: electricityCharge.amount || 0,
            arrears: electricityCharge.arrears || 0,
            amount: electricityCharge.amount || 0,
            plotNo: property.plotNumber || '',
            rdaNo: property.rdaNumber || '',
            street: property.street || '',
            sector: property.sector || '',
            category: property.categoryType || '',
            address: property.address || property.fullAddress || '',
            project: property.project || '',
            owner: property.ownerName || '',
            contactNo: property.contactNumber || '',
            status: 'Active',
            createdBy: req.user.id
          };
          
          electricityBill = new Electricity(billData);
          await electricityBill.save();
          
          // For manual charges, calculate carry forward arrears from PropertyInvoice
          let manualCarryForwardArrears = 0;
          const previousElectricityInvoices = await PropertyInvoice.find({
            property: property._id,
            chargeTypes: { $in: ['ELECTRICITY'] },
            paymentStatus: { $in: ['unpaid', 'partial_paid'] },
            balance: { $gt: 0 }
          })
          .select('charges grandTotal totalPaid balance')
          .sort({ invoiceDate: 1 })
          .lean();
          
          previousElectricityInvoices.forEach(inv => {
            const electricityCharges = inv.charges?.filter(c => c.type === 'ELECTRICITY') || [];
            if (electricityCharges.length > 0) {
              const hasOnlyElectricity = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY';
              if (hasOnlyElectricity) {
                manualCarryForwardArrears += (inv.balance || 0);
              } else {
                const electricityTotal = electricityCharges.reduce((sum, c) => sum + (c.amount || 0) + (c.arrears || 0), 0);
                const invoiceTotal = inv.grandTotal || 0;
                if (invoiceTotal > 0) {
                  const electricityProportion = electricityTotal / invoiceTotal;
                  manualCarryForwardArrears += (inv.balance || 0) * electricityProportion;
                }
              }
            }
          });
          
          manualCarryForwardArrears = Math.round(manualCarryForwardArrears * 100) / 100;
          
          const totalElectricityArrears = (electricityCharge.arrears || 0) + manualCarryForwardArrears;
          const electricityDesc = electricityCharge.description || 
            (manualCarryForwardArrears > 0 ? 'Electricity Bill (with Carry Forward Arrears)' : 'Electricity Bill');
          
          charges.push({
            type: 'ELECTRICITY',
            description: electricityDesc,
            amount: electricityCharge.amount || 0,
            arrears: totalElectricityArrears,
            total: (electricityCharge.amount || 0) + totalElectricityArrears
          });
        }
      } else if (conditions.length > 0) {
        // Fallback to existing bill
        electricityBill = await Electricity.findOne({ $or: conditions })
          .sort({ toDate: -1, createdAt: -1 })
          .lean();
        
        if (electricityBill) {
          // For existing bill, calculate carry forward arrears from PropertyInvoice
          let existingBillCarryForwardArrears = 0;
          const previousElectricityInvoices = await PropertyInvoice.find({
            property: property._id,
            chargeTypes: { $in: ['ELECTRICITY'] },
            paymentStatus: { $in: ['unpaid', 'partial_paid'] },
            balance: { $gt: 0 }
          })
          .select('charges grandTotal totalPaid balance')
          .sort({ invoiceDate: 1 })
          .lean();
          
          previousElectricityInvoices.forEach(inv => {
            const electricityCharges = inv.charges?.filter(c => c.type === 'ELECTRICITY') || [];
            if (electricityCharges.length > 0) {
              const hasOnlyElectricity = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY';
              if (hasOnlyElectricity) {
                existingBillCarryForwardArrears += (inv.balance || 0);
              } else {
                const electricityTotal = electricityCharges.reduce((sum, c) => sum + (c.amount || 0) + (c.arrears || 0), 0);
                const invoiceTotal = inv.grandTotal || 0;
                if (invoiceTotal > 0) {
                  const electricityProportion = electricityTotal / invoiceTotal;
                  existingBillCarryForwardArrears += (inv.balance || 0) * electricityProportion;
                }
              }
            }
          });
          
          existingBillCarryForwardArrears = Math.round(existingBillCarryForwardArrears * 100) / 100;
          
          const totalElectricityArrears = (electricityBill.arrears || 0) + existingBillCarryForwardArrears;
          const electricityDesc = existingBillCarryForwardArrears > 0 
            ? 'Electricity Bill (with Carry Forward Arrears)' 
            : 'Electricity Bill';
          
          charges.push({
            type: 'ELECTRICITY',
            description: electricityDesc,
            amount: electricityBill.withSurcharge || electricityBill.totalBill || 0,
            arrears: totalElectricityArrears,
            total: (electricityBill.withSurcharge || electricityBill.totalBill || 0) + totalElectricityArrears
          });
          }
        }
      }
    }

    // Get Rent Payment from Rental Agreement (especially for Personal Rent category)
    if (includeRent === true) {
      // Calculate carry forward of Rent arrears from previous unpaid invoices
      rentCarryForwardArrears = 0;
      const previousRentInvoices = await PropertyInvoice.find({
        property: property._id,
        chargeTypes: { $in: ['RENT'] },
        paymentStatus: { $in: ['unpaid', 'partial_paid'] },
        balance: { $gt: 0 }
      })
      .select('charges grandTotal totalPaid balance')
      .sort({ invoiceDate: 1 })
      .lean();
      
      // Calculate outstanding Rent charges from previous invoices
      previousRentInvoices.forEach(inv => {
        const rentCharge = inv.charges?.find(c => c.type === 'RENT');
        if (rentCharge) {
          // Calculate the Rent portion of the outstanding balance
          // If invoice has only Rent, use full balance; otherwise calculate proportionally
          const hasOnlyRent = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'RENT';
          if (hasOnlyRent) {
            // If only Rent in invoice, use the full outstanding balance
            rentCarryForwardArrears += (inv.balance || 0);
          } else {
            // If mixed charges, calculate Rent portion proportionally
            const rentTotal = (rentCharge.amount || 0) + (rentCharge.arrears || 0);
            const invoiceTotal = inv.grandTotal || 0;
            if (invoiceTotal > 0) {
              const rentProportion = rentTotal / invoiceTotal;
              rentCarryForwardArrears += (inv.balance || 0) * rentProportion;
            }
          }
        }
      });
      
      // Round to 2 decimal places
      rentCarryForwardArrears = Math.round(rentCarryForwardArrears * 100) / 100;
      
      let agreement = null;
      
      // Helper function to create rent charge object
      const createRentCharge = (amount, arrears) => {
        const totalRentArrears = (arrears || 0) + rentCarryForwardArrears;
        const rentDescription = rentCarryForwardArrears > 0 
          ? 'Rental Charges (with Carry Forward Arrears)' 
          : 'Rental Charges';
        
        return {
          type: 'RENT',
          description: rentDescription,
          amount: amount || 0,
          arrears: totalRentArrears,
          total: (amount || 0) + totalRentArrears
        };
      };
      
      // Try to get rent from rental agreement (priority for Personal Rent)
      if (property.categoryType === 'Personal Rent' || property.rentalAgreement) {
        // Check if already populated
        if (property.rentalAgreement?.monthlyRent !== undefined) {
          agreement = property.rentalAgreement;
        } else if (property.rentalAgreement) {
          try {
            const agreementId = typeof property.rentalAgreement === 'object' 
              ? (property.rentalAgreement._id || property.rentalAgreement)
              : property.rentalAgreement;
            agreement = await TajRentalAgreement.findById(agreementId).lean();
          } catch (err) {
            // Error fetching rental agreement - continue without it
          }
        }
        
        // If no agreement found and property is Personal Rent, try to find by property name
        if (!agreement && property.categoryType === 'Personal Rent' && property.propertyName) {
          try {
            agreement = await TajRentalAgreement.findOne({
              propertyName: property.propertyName,
              status: { $in: ['Active', 'Expired'] }
            }).sort({ createdAt: -1 }).lean();
          } catch (err) {
            // Error searching agreement by property name - continue without it
          }
        }
        
        if (agreement?.monthlyRent) {
          const monthlyRent = agreement.monthlyRent;
          
          // Use the carry forward arrears already calculated above
          // The createRentCharge function will automatically add rentCarryForwardArrears
          charges.push(createRentCharge(monthlyRent, 0));
          rentChargeAdded = true;
        }
      }
      
      // Fallback: Check for existing rent payments (legacy support for Personal Rent)
      if (!rentChargeAdded && property.categoryType === 'Personal Rent' && property.rentalPayments?.length > 0) {
        const latestRentPayment = [...property.rentalPayments]
          .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))[0];
        
        if (latestRentPayment) {
          rentPayment = latestRentPayment;
          charges.push(createRentCharge(latestRentPayment.amount, latestRentPayment.arrears));
          rentChargeAdded = true;
        }
      }
    }

    // If manual charges provided, update or add them to charges array
    // BUT: Don't override charges if we just calculated them from readings
    // For rental charges, if backend already calculated from agreement, use that instead of manual charges
    const hasCalculatedCharges = includeElectricity === true && hasReadings && (electricityBill || meterBillsData.length > 0);
    const hasCalculatedRentCharge = includeRent === true && rentChargeAdded;
    
    if (requestCharges?.length > 0 && !hasCalculatedCharges) {
      requestCharges.forEach(charge => {
        // For RENT charges, if backend already calculated them from agreement,
        // update the existing charge with manually entered values (if provided)
        if (charge.type === 'RENT' && hasCalculatedRentCharge) {
          const existingRentIndex = charges.findIndex(c => c.type === 'RENT');
          if (existingRentIndex >= 0) {
            const existingCharge = charges[existingRentIndex];
            // If user manually entered amount or arrears, use those values
            // This allows users to override values for the first invoice
            const manualAmount = (charge.amount !== undefined && charge.amount !== null) 
              ? charge.amount 
              : existingCharge.amount;
            const manualArrears = (charge.arrears !== undefined && charge.arrears !== null) 
              ? charge.arrears 
              : 0;
            // Add carry-forward arrears to manually entered arrears
            const totalArrears = manualArrears + rentCarryForwardArrears;
            charges[existingRentIndex] = {
              ...existingCharge,
              amount: manualAmount || 0,
              arrears: totalArrears,
              total: (manualAmount || 0) + totalArrears
            };
          }
          return; // Skip adding new charge, we updated the existing one
        }
        
        // For RENT charges, use createRentCharge to include carry-forward arrears
        let chargeData;
        if (charge.type === 'RENT' && includeRent === true) {
          chargeData = createRentCharge(charge.amount || 0, charge.arrears || 0);
        } else {
          chargeData = {
            type: charge.type,
            description: charge.description || `${charge.type} Charges`,
            amount: charge.amount || 0,
            arrears: charge.arrears || 0,
            total: (charge.amount || 0) + (charge.arrears || 0)
          };
        }
        
        const existingIndex = charges.findIndex(c => c.type === charge.type);
        if (existingIndex >= 0) {
          charges[existingIndex] = chargeData;
        } else {
          charges.push(chargeData);
        }
      });
    }
    
    // Allow creating invoice with empty charges if manually entered charges are provided (even if empty array)
    // This allows frontend to initialize invoice and user can fill in charges
    const hasManualChargesRequest = requestCharges !== undefined;
    
    // For Personal Rent properties, always allow creating invoice even if no charges found
    // (user can manually enter the rent amount)
    if (charges.length === 0 && !hasManualChargesRequest && property.categoryType !== 'Personal Rent') {
      return res.status(400).json({ 
        success: false, 
        message: 'No charges found for this property. Please ensure CAM charges, Electricity bills, or Rent payments exist, or provide charges manually.' 
      });
    }
    
    // If no charges found, create with default empty charge based on what was requested
    // This is especially important for Personal Rent properties
    if (charges.length === 0) {
      // Determine charge type based on what was requested
      if (includeRent) {
        charges.push({
          type: 'RENT',
          description: 'Rental Charges',
          amount: 0,
          arrears: 0,
          total: 0
        });
      } else if (includeElectricity) {
        charges.push({
          type: 'ELECTRICITY',
          description: 'Electricity Bill',
          amount: 0,
          arrears: 0,
          total: 0
        });
      } else if (includeCAM) {
        charges.push({
          type: 'CAM',
          description: 'CAM Charges',
          amount: 0,
          arrears: 0,
          total: 0
        });
      }
    }

    // Calculate overdue arrears from previous invoices (after due date amounts)
    const overdueArrears = await calculateOverdueArrears(property._id, new Date());
    
    // Add overdue arrears to the first charge (or distribute as needed)
    // For now, we'll add it to the first charge's arrears, or create a separate arrears entry
    if (overdueArrears > 0 && charges.length > 0) {
      // Add overdue arrears to the first charge's arrears
      charges[0].arrears = (charges[0].arrears || 0) + overdueArrears;
      charges[0].total = (charges[0].amount || 0) + (charges[0].arrears || 0);
    }
    
    // Calculate totals
    const subtotal = charges.reduce((sum, charge) => sum + charge.amount, 0);
    const totalArrears = charges.reduce((sum, charge) => sum + charge.arrears, 0);
    const grandTotal = subtotal + totalArrears;

    // Determine invoice type based on charge types
    let invoiceType = 'GEN';
    if (charges.length === 1) {
      const chargeType = charges[0].type;
      if (chargeType === 'CAM') {
        invoiceType = 'CAM';
      } else if (chargeType === 'ELECTRICITY') {
        invoiceType = 'ELECTRICITY';
      } else if (chargeType === 'RENT') {
        invoiceType = 'RENT';
      }
    } else if (charges.length > 1) {
      invoiceType = 'MIXED';
    }

    // Get active meters from property for electricity check
    const activeMeters = (property.meters || []).filter(m => m.isActive !== false);

    // Handle multiple meters for electricity invoices
    const now = dayjs();
    const hasMultipleMeters = activeMeters.length > 1 && includeElectricity === true && electricityBill && meterBillsData.length > 0;
    
    // If we have multiple meters with electricity, create separate invoices for each
    if (hasMultipleMeters) {
      const createdInvoices = [];
      const year = now.year();
      const month = now.month() + 1;
      
      // Check if invoices already exist for this month before creating
      // Only check for duplicates if periodTo or periodFrom is provided
      if (periodTo || periodFrom) {
        const periodDate = periodTo ? dayjs(periodTo) : dayjs(periodFrom);
        const periodYear = periodDate.year();
        const periodMonth = periodDate.month() + 1;
        const monthStart = dayjs(`${periodYear}-${String(periodMonth).padStart(2, '0')}-01`).startOf('month').toDate();
        const monthEnd = dayjs(`${periodYear}-${String(periodMonth).padStart(2, '0')}-01`).endOf('month').toDate();
        
        // Get unique charge types from charges array
        const chargeTypesArray = [...new Set(charges.map(c => c.type))];
        
        // Check for existing invoice for first meter (match by meter number)
        if (electricityBill && electricityBill.meterNo) {
          const meterNo = electricityBill.meterNo;
          const existingFirstInvoices = await PropertyInvoice.aggregate([
            {
              $match: {
                property: property._id,
                $or: [
                  { periodTo: { $gte: monthStart, $lte: monthEnd } },
                  { periodFrom: { $gte: monthStart, $lte: monthEnd } }
                ],
                chargeTypes: { 
                  $all: chargeTypesArray, 
                  $size: chargeTypesArray.length 
                }
              }
            },
            {
              $lookup: {
                from: 'electricities',
                localField: 'electricityBill',
                foreignField: '_id',
                as: 'electricityBillDoc'
              }
            },
            {
              $match: {
                'electricityBillDoc.0.meterNo': meterNo
              }
            }
          ]);
          
          if (existingFirstInvoices && existingFirstInvoices.length > 0) {
            return res.status(400).json({
              success: false,
              message: `An invoice already exists for meter ${meterNo} for ${dayjs(monthStart).format('MMMM YYYY')}. Please edit the existing invoice instead.`,
              data: { existingInvoiceId: existingFirstInvoices[0]._id }
            });
          }
        }
        
        // Check for existing invoices for additional meters (match by meter number)
        for (const { bill: meterBill, meter, meterIndex } of meterBillsData) {
          const meterNo = meterBill.meterNo || meter.meterNo || '';
          if (meterNo) {
            const existingMeterInvoices = await PropertyInvoice.aggregate([
              {
                $match: {
                  property: property._id,
                  $or: [
                    { periodTo: { $gte: monthStart, $lte: monthEnd } },
                    { periodFrom: { $gte: monthStart, $lte: monthEnd } }
                  ],
                  chargeTypes: ['ELECTRICITY']
                }
              },
              {
                $lookup: {
                  from: 'electricities',
                  localField: 'electricityBill',
                  foreignField: '_id',
                  as: 'electricityBillDoc'
                }
              },
              {
                $match: {
                  'electricityBillDoc.meterNo': meterNo
                }
              }
            ]);
            
            if (existingMeterInvoices && existingMeterInvoices.length > 0) {
              return res.status(400).json({
                success: false,
                message: `An invoice already exists for meter ${meterNo} for ${dayjs(monthStart).format('MMMM YYYY')}. Please edit the existing invoice instead.`,
                data: { existingInvoiceId: existingMeterInvoices[0]._id }
              });
            }
          }
        }
      }
      
      // Create invoice for first meter (already processed above)
      const firstInvoiceNumber = generateInvoiceNumber(property.srNo, year, month, invoiceType, activeMeters.length > 1 ? 'M1' : '');
      
      const firstInvoiceData = {
        property: property._id,
        invoiceNumber: firstInvoiceNumber,
        invoiceDate: new Date(),
        dueDate: periodTo ? new Date(periodTo) : now.add(30, 'day').toDate(),
        periodFrom: periodFrom ? new Date(periodFrom) : undefined,
        periodTo: periodTo ? new Date(periodTo) : undefined,
        chargeTypes: charges.map(c => c.type),
        camCharge: camCharge?._id,
        electricityBill: electricityBill?._id,
        rentPayment: rentPayment?._id,
        charges,
        subtotal,
        totalArrears,
        grandTotal,
        amountInWords: numberToWords(grandTotal),
        totalPaid: 0, // Explicitly set initial totalPaid
        balance: grandTotal, // Explicitly set initial balance (grandTotal - 0)
        calculationData: calculationData, // Persist calculation breakdown
        status: 'Issued',
        paymentStatus: 'unpaid',
        createdBy: req.user.id
      };
      
      const { invoice: firstInvoice } = await createOrUpdateInvoice(
        firstInvoiceData, firstInvoiceNumber, property._id, req.user.id, periodFrom, periodTo, property.srNo, invoiceType
      );
      
      await populateInvoiceReferences(firstInvoice, { camCharge, electricityBill });
      createdInvoices.push(firstInvoice.toObject());
      
      // Create invoices for additional meters
      for (const { bill: meterBill, meter, meterIndex, charges: meterCharges } of meterBillsData) {
        const meterSubtotal = meterCharges.amount || 0;
        const meterArrears = meterCharges.arrears || 0;
        const meterGrandTotal = meterSubtotal + meterArrears;
        const meterInvoiceNumber = generateInvoiceNumber(property.srNo, year, month, invoiceType, `M${meterIndex}`);
        
        const meterInvoiceData = {
          property: property._id,
          invoiceNumber: meterInvoiceNumber,
          invoiceDate: new Date(),
          dueDate: periodTo ? dayjs(periodTo).add(15, 'day').toDate() : now.add(30, 'day').toDate(),
          periodFrom: periodFrom ? new Date(periodFrom) : undefined,
          periodTo: periodTo ? new Date(periodTo) : undefined,
          chargeTypes: ['ELECTRICITY'],
          electricityBill: meterBill._id,
          charges: [meterCharges],
          subtotal: meterSubtotal,
          totalArrears: meterArrears,
          grandTotal: meterGrandTotal,
          amountInWords: numberToWords(meterGrandTotal),
          totalPaid: 0, // Explicitly set initial totalPaid
          balance: meterGrandTotal, // Explicitly set initial balance (grandTotal - 0)
          status: 'Issued',
          paymentStatus: 'unpaid',
          createdBy: req.user.id
        };
        
        const { invoice: meterInvoice } = await createOrUpdateInvoice(
          meterInvoiceData, meterInvoiceNumber, property._id, req.user.id, periodFrom, periodTo, property.srNo, invoiceType
        );
        
        await populateInvoiceReferences(meterInvoice, { electricityBill: meterBill });
        createdInvoices.push(meterInvoice.toObject());
      }
      
      // OPTIMIZATION: Invalidate caches on bulk invoice creation
      clearCached(CACHE_KEYS.INVOICES_OVERVIEW);
      clearCached(`${CACHE_KEYS.INVOICES_OVERVIEW}_property_${property._id}`);
      
      return res.status(201).json({
        success: true,
        message: `Invoices created successfully for ${createdInvoices.length} meter(s)`,
        data: createdInvoices.length === 1 ? createdInvoices[0] : createdInvoices
      });
    }
    
    // Single invoice creation (original logic for non-multiple meters or non-electricity)
    const invoiceNumber = generateInvoiceNumber(property.srNo, now.year(), now.month() + 1, invoiceType);
    
    // Check if invoice already exists for this month before creating
    // Only check for duplicates if periodTo or periodFrom is provided
    if (periodTo || periodFrom) {
      const periodDate = periodTo ? dayjs(periodTo) : dayjs(periodFrom);
      const periodYear = periodDate.year();
      const periodMonth = periodDate.month() + 1;
      const monthStart = dayjs(`${periodYear}-${String(periodMonth).padStart(2, '0')}-01`).startOf('month').toDate();
      const monthEnd = dayjs(`${periodYear}-${String(periodMonth).padStart(2, '0')}-01`).endOf('month').toDate();
      
      // Get unique charge types from charges array
      const chargeTypesArray = [...new Set(charges.map(c => c.type))];
      
      // Build query to find existing invoice for same month
      const duplicateQuery = {
        property: property._id,
        $or: [
          { periodTo: { $gte: monthStart, $lte: monthEnd } },
          { periodFrom: { $gte: monthStart, $lte: monthEnd } }
        ],
        chargeTypes: { 
          $all: chargeTypesArray, 
          $size: chargeTypesArray.length 
        }
      };
      
      // For electricity invoices, match by meter number instead of electricityBill._id
      // (since each invoice creates a new Electricity document)
      if (chargeTypesArray.includes('ELECTRICITY') && electricityBill) {
        // Use aggregation to find invoices with matching meter number
        const meterNo = electricityBill.meterNo || '';
        if (meterNo) {
          const existingInvoices = await PropertyInvoice.aggregate([
            {
              $match: {
                property: property._id,
                $or: [
                  { periodTo: { $gte: monthStart, $lte: monthEnd } },
                  { periodFrom: { $gte: monthStart, $lte: monthEnd } }
                ],
                chargeTypes: { 
                  $all: chargeTypesArray, 
                  $size: chargeTypesArray.length 
                }
              }
            },
            {
              $lookup: {
                from: 'electricities',
                localField: 'electricityBill',
                foreignField: '_id',
                as: 'electricityBillDoc'
              }
            },
            {
              $unwind: {
                path: '$electricityBillDoc',
                preserveNullAndEmptyArrays: false
              }
            },
            {
              $match: {
                'electricityBillDoc.meterNo': meterNo
              }
            }
          ]);
          
          if (existingInvoices && existingInvoices.length > 0) {
            return res.status(400).json({
              success: false,
              message: `An invoice already exists for meter ${meterNo} for ${dayjs(monthStart).format('MMMM YYYY')}. Please edit the existing invoice instead.`,
              data: { existingInvoiceId: existingInvoices[0]._id }
            });
          }
        } else {
          // Fallback: if meterNo is not available, use electricityBill._id (less reliable)
          duplicateQuery.electricityBill = electricityBill._id;
        }
      }
      
      // For CAM charges, check for duplicates
      // If camCharge exists, match by camCharge reference
      // If camCharge is null, still check for duplicates by charge type and month (same property, same month, CAM charges)
      if (chargeTypesArray.includes('CAM')) {
        if (camCharge) {
          duplicateQuery.camCharge = camCharge._id;
        } else {
          // If camCharge is null, we still want to prevent duplicates for the same month
          // Check for any CAM invoice for this property in this month
          // The chargeTypes filter above already ensures it's a CAM invoice
        }
      }
      
      // For RENT charges, match the rentPayment reference if available
      if (chargeTypesArray.includes('RENT') && rentPayment) {
        duplicateQuery.rentPayment = rentPayment._id;
      }
      
      const existingInvoice = await PropertyInvoice.findOne(duplicateQuery);
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: `An invoice already exists for ${dayjs(monthStart).format('MMMM YYYY')}. Please edit the existing invoice instead.`,
          data: { existingInvoiceId: existingInvoice._id }
        });
      }
    }
    
    const invoiceData = {
      property: property._id,
      invoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : (periodTo ? new Date(periodTo) : now.add(30, 'day').toDate()),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      chargeTypes: charges.map(c => c.type),
      camCharge: camCharge?._id,
      electricityBill: electricityBill?._id,
      rentPayment: rentPayment?._id,
      charges,
      subtotal,
      totalArrears,
      grandTotal,
      amountInWords: numberToWords(grandTotal),
      totalPaid: 0, // Explicitly set initial totalPaid
      balance: grandTotal, // Explicitly set initial balance (grandTotal - 0)
      calculationData: calculationData, // Persist calculation breakdown
      status: 'Issued',
      paymentStatus: 'unpaid',
      createdBy: req.user.id
    };

    const { invoice, isNew } = await createOrUpdateInvoice(
      invoiceData, invoiceNumber, property._id, req.user.id, periodFrom, periodTo, property.srNo, invoiceType
    );
    
    await populateInvoiceReferences(invoice, { camCharge, electricityBill });
    
    const invoiceObj = invoice.toObject();
    
    // OPTIMIZATION: Invalidate caches on invoice creation
    clearCached(CACHE_KEYS.INVOICES_OVERVIEW);
    clearCached(`${CACHE_KEYS.INVOICES_OVERVIEW}_property_${property._id}`);
    
    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoiceObj
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Create open invoice (without property) - for ground booking, billboard, events, etc.
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { 
      invoiceNumber, 
      invoiceDate, 
      dueDate, 
      periodFrom, 
      periodTo, 
      charges, 
      customerName, 
      customerEmail, 
      customerPhone, 
      customerAddress 
    } = req.body;

    if (!charges || !Array.isArray(charges) || charges.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one charge is required' });
    }

    // Calculate totals
    const subtotal = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const totalArrears = charges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
    const grandTotal = subtotal + totalArrears;

    // Generate invoice number if not provided
    let finalInvoiceNumber = invoiceNumber;
    if (!finalInvoiceNumber) {
      const now = dayjs();
      finalInvoiceNumber = generateInvoiceNumber(
        1, // Use default srNo for open invoices
        now.year(),
        now.month() + 1,
        'GEN'
      );
    }

    // Check for duplicate invoice number
    const existingInvoice = await PropertyInvoice.findOne({ invoiceNumber: finalInvoiceNumber });
    if (existingInvoice) {
      const timestamp = Date.now().toString().slice(-4);
      finalInvoiceNumber = `${finalInvoiceNumber}-${timestamp}`;
    }

    const invoiceData = {
      property: null, // No property for open invoices
      invoiceNumber: finalInvoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : (periodTo ? dayjs(periodTo).add(15, 'day').toDate() : dayjs().add(30, 'day').toDate()),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      chargeTypes: [...new Set(charges.map(c => c.type))],
      charges: charges.map(c => ({
        type: c.type,
        description: c.description || '',
        amount: c.amount || 0,
        arrears: c.arrears || 0,
        total: (c.amount || 0) + (c.arrears || 0)
      })),
      subtotal,
      totalArrears,
      grandTotal,
      amountInWords: numberToWords(grandTotal),
      customerName: customerName || '',
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      totalPaid: 0,
      balance: grandTotal,
      status: 'Issued',
      paymentStatus: 'unpaid',
      createdBy: req.user.id
    };

    const invoice = new PropertyInvoice(invoiceData);
    await invoice.save();

    // Don't create AR entry for open invoices (no property/resident)

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice.toObject()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get invoice by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoice = await PropertyInvoice.findById(req.params.id)
      .populate({
        path: 'property',
        populate: {
          path: 'resident',
          select: 'name accountType contactNumber email residentId'
        }
      })
      .populate('camCharge')
      .populate('electricityBill')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get invoices for a property
router.get('/property/:propertyId', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // OPTIMIZATION: Check cache first
    const cacheKey = `${CACHE_KEYS.INVOICES_OVERVIEW}_property_${req.params.propertyId}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log('📋 Returning cached invoices for property');
      return res.json(cached);
    }
    
    // OPTIMIZATION: Select only needed fields and use lean
    const invoices = await PropertyInvoice.find({ property: req.params.propertyId })
      .select('_id invoiceNumber invoiceDate periodFrom periodTo dueDate chargeTypes charges subtotal totalArrears grandTotal amountInWords payments totalPaid balance status paymentStatus camCharge electricityBill rentPayment property createdAt updatedAt calculationData')
      .populate({
        path: 'property',
        select: 'propertyName plotNumber address ownerName tenantName resident sector areaValue areaUnit meters floor electricityWaterMeterNo',
        populate: {
          path: 'resident',
          select: 'name accountType contactNumber email residentId'
        }
      })
      .populate('camCharge', 'invoiceNumber amount arrears')
      .populate('electricityBill', 'invoiceNumber meterNo prvReading curReading unitsConsumed unitsConsumedForDays iescoSlabs iescoUnitPrice electricityCost fcSurcharge gst electricityDuty fixedCharges totalBill withSurcharge receivedAmount arrears fromDate toDate dueDate month address')
      .populate('payments.recordedBy', 'firstName lastName')
      .sort({ invoiceDate: -1 })
      .lean();

    // OPTIMIZATION: Fetch all transactions for all invoices in one query
    const invoiceIds = invoices.map(inv => inv._id);
    const allTransactions = await TajTransaction.find({
      referenceId: { $in: invoiceIds },
        transactionType: 'bill_payment'
      })
      .select('referenceId amount createdAt bank depositUsages')
      .populate('depositUsages.depositId', 'bank')
      .sort({ createdAt: -1 })
      .lean();
    
    // Group transactions by invoice ID
    const transactionsByInvoice = new Map();
    allTransactions.forEach(txn => {
      const invoiceId = txn.referenceId?.toString();
      if (invoiceId) {
        if (!transactionsByInvoice.has(invoiceId)) {
          transactionsByInvoice.set(invoiceId, []);
        }
        transactionsByInvoice.get(invoiceId).push(txn);
      }
    });

    // Enhance payments with bank information from transactions
    const invoicesWithBankInfo = invoices.map((invoice) => {
      const invoiceObj = { ...invoice };
      
      // Get transactions for this invoice from the pre-fetched map
      const transactions = transactionsByInvoice.get(invoice._id.toString()) || [];
      
      // Match payments to transactions and enhance with bank info
      if (invoiceObj.payments && Array.isArray(invoiceObj.payments)) {
        invoiceObj.payments = invoiceObj.payments.map((payment) => {
          const paymentObj = { ...payment };
          
          // Try to find a matching transaction
          // Match by amount and payment date (within 1 day tolerance)
          const matchingTransaction = transactions.find(txn => {
            const amountMatch = Math.abs(txn.amount - (payment.amount || 0)) < 0.01;
            const dateMatch = payment.paymentDate && 
              Math.abs(new Date(txn.createdAt).getTime() - new Date(payment.paymentDate).getTime()) < 24 * 60 * 60 * 1000;
            return amountMatch && (dateMatch || !payment.paymentDate);
          });
          
          // If payment doesn't have bankName but transaction has bank info, use it
          if (!paymentObj.bankName && matchingTransaction) {
            // First try to get bank from transaction directly
            if (matchingTransaction.bank) {
              paymentObj.bankName = matchingTransaction.bank;
            } 
            // If not, try to get from deposit transactions
            else if (matchingTransaction.depositUsages && Array.isArray(matchingTransaction.depositUsages) && matchingTransaction.depositUsages.length > 0) {
              const firstDeposit = matchingTransaction.depositUsages[0]?.depositId;
              if (firstDeposit && firstDeposit.bank) {
                paymentObj.bankName = firstDeposit.bank;
              }
            }
          }
          
          return paymentObj;
        });
      }
      
      return invoiceObj;
    });

    const response = { success: true, data: invoicesWithBankInfo };
    
    // OPTIMIZATION: Cache the response
    setCached(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Update invoice
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoice = await PropertyInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const { invoiceNumber, invoiceDate, dueDate, periodFrom, periodTo, charges, subtotal, totalArrears, grandTotal, customerName, customerEmail, customerPhone, customerAddress } = req.body;

    // Check for duplicate invoices ONLY if periodTo or periodFrom is being changed to a different month
    const updatedPeriodFrom = periodFrom !== undefined ? (periodFrom ? new Date(periodFrom) : null) : invoice.periodFrom;
    const updatedPeriodTo = periodTo !== undefined ? (periodTo ? new Date(periodTo) : null) : invoice.periodTo;
    const updatedCharges = charges !== undefined ? charges : invoice.charges;
    
    // Only check for duplicates if the period is actually being changed to a different month
    const originalPeriodTo = invoice.periodTo ? dayjs(invoice.periodTo) : null;
    const originalPeriodFrom = invoice.periodFrom ? dayjs(invoice.periodFrom) : null;
    const newPeriodTo = updatedPeriodTo ? dayjs(updatedPeriodTo) : null;
    const newPeriodFrom = updatedPeriodFrom ? dayjs(updatedPeriodFrom) : null;
    
    // Check if period month/year has actually changed
    const periodChanged = (periodTo !== undefined && newPeriodTo && (!originalPeriodTo || 
      newPeriodTo.month() !== originalPeriodTo.month() || newPeriodTo.year() !== originalPeriodTo.year())) ||
      (periodFrom !== undefined && newPeriodFrom && (!originalPeriodFrom || 
      newPeriodFrom.month() !== originalPeriodFrom.month() || newPeriodFrom.year() !== originalPeriodFrom.year()));
    
    if (periodChanged && (updatedPeriodTo || updatedPeriodFrom)) {
      const periodDate = updatedPeriodTo ? dayjs(updatedPeriodTo) : dayjs(updatedPeriodFrom);
      const periodYear = periodDate.year();
      const periodMonth = periodDate.month() + 1;
      const monthStart = dayjs(`${periodYear}-${String(periodMonth).padStart(2, '0')}-01`).startOf('month').toDate();
      const monthEnd = dayjs(`${periodYear}-${String(periodMonth).padStart(2, '0')}-01`).endOf('month').toDate();
      
      // Get unique charge types from charges array
      const chargeTypesArray = [...new Set(updatedCharges.map(c => c.type))];
      
      // Build query to find existing invoice for same month (excluding current invoice)
      const duplicateQuery = {
        _id: { $ne: invoice._id }, // Exclude current invoice
        property: invoice.property,
        $or: [
          { periodTo: { $gte: monthStart, $lte: monthEnd } },
          { periodFrom: { $gte: monthStart, $lte: monthEnd } }
        ],
        chargeTypes: { 
          $all: chargeTypesArray, 
          $size: chargeTypesArray.length 
        }
      };
      
      // For electricity invoices, match by meter number instead of electricityBill._id
      if (chargeTypesArray.includes('ELECTRICITY') && invoice.electricityBill) {
        // Populate electricityBill to get meterNo
        await invoice.populate('electricityBill');
        const meterNo = invoice.electricityBill?.meterNo || '';
        if (meterNo) {
          const existingInvoices = await PropertyInvoice.aggregate([
            {
              $match: {
                _id: { $ne: invoice._id }, // Exclude current invoice
                property: invoice.property,
                $or: [
                  { periodTo: { $gte: monthStart, $lte: monthEnd } },
                  { periodFrom: { $gte: monthStart, $lte: monthEnd } }
                ],
                chargeTypes: { 
                  $all: chargeTypesArray, 
                  $size: chargeTypesArray.length 
                }
              }
            },
            {
              $lookup: {
                from: 'electricities',
                localField: 'electricityBill',
                foreignField: '_id',
                as: 'electricityBillDoc'
              }
            },
            {
              $match: {
                'electricityBillDoc.0.meterNo': meterNo
              }
            }
          ]);
          
          if (existingInvoices && existingInvoices.length > 0) {
            return res.status(400).json({
              success: false,
              message: `An invoice already exists for meter ${meterNo} for ${dayjs(monthStart).format('MMMM YYYY')}. Please edit the existing invoice instead.`,
              data: { existingInvoiceId: existingInvoices[0]._id }
            });
          }
        } else {
          // Fallback: if meterNo is not available, use electricityBill._id
          duplicateQuery.electricityBill = invoice.electricityBill;
        }
      }
      
      // For CAM charges, check for duplicates
      // If camCharge exists, match by camCharge reference
      // If camCharge is null, still check for duplicates by charge type and month
      if (chargeTypesArray.includes('CAM')) {
        if (invoice.camCharge) {
          duplicateQuery.camCharge = invoice.camCharge;
        }
        // If camCharge is null, the chargeTypes filter above already ensures it's a CAM invoice
        // So we'll still catch duplicates for the same property and month
      }
      
      // For RENT charges, match the rentPayment reference if available
      if (chargeTypesArray.includes('RENT') && invoice.rentPayment) {
        duplicateQuery.rentPayment = invoice.rentPayment;
      }
      
      const existingInvoice = await PropertyInvoice.findOne(duplicateQuery);
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: `An invoice already exists for ${dayjs(monthStart).format('MMMM YYYY')}. Please edit the existing invoice instead.`,
          data: { existingInvoiceId: existingInvoice._id }
        });
      }
    }

    // Update invoice fields
    if (invoiceNumber !== undefined) invoice.invoiceNumber = invoiceNumber;
    if (invoiceDate !== undefined) invoice.invoiceDate = invoiceDate ? new Date(invoiceDate) : invoice.invoiceDate;
    if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : invoice.dueDate;
    if (periodFrom !== undefined) invoice.periodFrom = periodFrom ? new Date(periodFrom) : invoice.periodFrom;
    if (periodTo !== undefined) invoice.periodTo = periodTo ? new Date(periodTo) : invoice.periodTo;
    if (charges !== undefined) {
      invoice.charges = charges;
      // Update chargeTypes based on charges
      invoice.chargeTypes = [...new Set(charges.map(c => c.type))];
    }
    if (subtotal !== undefined) invoice.subtotal = subtotal;
    if (totalArrears !== undefined) invoice.totalArrears = totalArrears;
    if (grandTotal !== undefined) {
      invoice.grandTotal = grandTotal;
      invoice.amountInWords = numberToWords(grandTotal);
    }
    // Update customer fields for open invoices
    if (customerName !== undefined) invoice.customerName = customerName;
    if (customerEmail !== undefined) invoice.customerEmail = customerEmail;
    if (customerPhone !== undefined) invoice.customerPhone = customerPhone;
    if (customerAddress !== undefined) invoice.customerAddress = customerAddress;

    invoice.updatedBy = req.user.id;
    invoice.updatedAt = new Date();

    await invoice.save();

    // OPTIMIZATION: Invalidate caches on invoice update
    clearCached(CACHE_KEYS.INVOICES_OVERVIEW);
    if (invoice.property) {
      clearCached(`${CACHE_KEYS.INVOICES_OVERVIEW}_property_${invoice.property}`);
    }

    // Populate references
    await invoice.populate({
      path: 'property',
      populate: {
        path: 'resident',
        select: 'name accountType contactNumber email residentId'
      }
    });
    await invoice.populate('camCharge');
    await invoice.populate('electricityBill');

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get all invoices
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // OPTIMIZATION: Check cache first (only if no filters and default pagination)
    const hasFilters = req.query.propertyId || req.query.status || req.query.paymentStatus || req.query.chargeType || req.query.residentId || req.query.sector || req.query.search || req.query.monthYear || req.query.openInvoices;
    const isDefaultPagination = page === 1 && limit === 50;
    const cacheKey = (hasFilters || !isDefaultPagination) ? null : CACHE_KEYS.INVOICES_OVERVIEW;
    
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log('📋 Returning cached invoices list');
        return res.json(cached);
      }
    }
    
    const { propertyId, status, paymentStatus, chargeType, residentId, sector, search, monthYear, openInvoices } = req.query;
    const filter = {};
    
    // Filter: openInvoices=true shows only invoices without properties, openInvoices=false or undefined shows only invoices with properties
    if (openInvoices === 'true') {
      filter.property = null; // Only open invoices (no property)
    } else {
      // Only property-based invoices (exclude open invoices)
      // But if propertyId is specified, use that instead
      if (propertyId) {
        filter.property = propertyId;
      } else {
        filter.property = { $ne: null }; // Exclude open invoices
      }
    }
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (chargeType) filter.chargeTypes = { $in: [chargeType] };
    
    // Handle month/year filter
    if (monthYear) {
      // monthYear format: "YYYY-MM" (e.g., "2026-01")
      const [year, month] = monthYear.split('-');
      if (year && month) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
        
        // Filter by periodTo (billing period end) or invoiceDate if periodTo is not available
        // Use periodTo if it exists, otherwise fall back to invoiceDate
        filter.$or = [
          { 
            periodTo: { 
              $exists: true,
              $gte: startDate, 
              $lte: endDate 
            } 
          },
          { 
            $and: [
              { periodTo: { $exists: false } },
              { invoiceDate: { $gte: startDate, $lte: endDate } }
            ]
          }
        ];
      }
    }

    // Handle search parameter - search across all invoices
    let searchFilter = {};
    let propertyIdsFromSearch = [];
    let residentIdsFromSearch = [];
    
    if (search) {
      const searchPattern = new RegExp(search, 'i');
      const TajProperty = require('../models/tajResidencia/TajProperty');
      const TajResident = require('../models/tajResidencia/TajResident');
      
      // Search by invoice number
      searchFilter.$or = [
        { invoiceNumber: searchPattern }
      ];
      
      // For open invoices (when openInvoices=true or when filtering for null property), search customer fields
      if (openInvoices === 'true' || filter.property === null) {
        searchFilter.$or.push(
          { customerName: searchPattern },
          { customerEmail: searchPattern },
          { customerPhone: searchPattern },
          { customerAddress: searchPattern }
        );
      }
      
      // For property-based invoices, search property and resident fields
      if (openInvoices !== 'true' && filter.property !== null) {
        // Find properties matching owner name
        const matchingProperties = await TajProperty.find({
          ownerName: searchPattern
        }).select('_id').lean();
        propertyIdsFromSearch = matchingProperties.map(p => p._id);
        
        // Find residents matching name, residentId, or CNIC
        const matchingResidents = await TajResident.find({
          $or: [
            { name: searchPattern },
            { residentId: searchPattern },
            { cnic: searchPattern }
          ]
        }).select('_id').lean();
        residentIdsFromSearch = matchingResidents.map(r => r._id);
        
        // Find properties for matching residents
        if (residentIdsFromSearch.length > 0) {
          const propertiesForResidents = await TajProperty.find({
            resident: { $in: residentIdsFromSearch }
          }).select('_id').lean();
          const propertyIdsFromResidents = propertiesForResidents.map(p => p._id);
          propertyIdsFromSearch = [...new Set([...propertyIdsFromSearch, ...propertyIdsFromResidents])];
        }
        
        // Add property IDs to search filter
        if (propertyIdsFromSearch.length > 0) {
          searchFilter.$or.push({ property: { $in: propertyIdsFromSearch } });
        }
      }
    }

    // Combine filters
    const combinedFilter = { ...filter, ...searchFilter };

    // Get total count for pagination (before applying resident/sector filters and in-memory filtering)
    let total = await PropertyInvoice.countDocuments(combinedFilter);

    // OPTIMIZATION: Select only needed fields and use lean with pagination
    // Fetch all matching invoices first (for search across all pages)
    let invoices = await PropertyInvoice.find(combinedFilter)
      .select('_id invoiceNumber invoiceDate periodFrom periodTo dueDate chargeTypes charges subtotal totalArrears grandTotal totalPaid balance status paymentStatus property createdBy customerName customerEmail customerPhone customerAddress')
      .populate({
        path: 'property',
        select: 'propertyName plotNumber address ownerName resident sector areaValue areaUnit',
        populate: {
          path: 'resident',
          select: 'name accountType _id residentId cnic'
        }
      })
      .populate('createdBy', 'firstName lastName')
      .sort({ invoiceDate: -1 })
      .lean();
    
    // Additional filtering for property-based invoices search (to ensure we catch all matches)
    // For open invoices, search is already done at database level
    if (search && openInvoices !== 'true' && filter.property !== null) {
      const searchLower = search.toLowerCase();
      invoices = invoices.filter(invoice => {
        // Search invoice number (already handled in DB query, but double-check)
        if (invoice.invoiceNumber?.toLowerCase().includes(searchLower)) return true;
        
        // For property-based invoices, search property/resident fields
        if (invoice.property) {
          // Search property owner name
          if (invoice.property?.ownerName?.toLowerCase().includes(searchLower)) return true;
          
          // Search resident name
          if (invoice.property?.resident?.name?.toLowerCase().includes(searchLower)) return true;
          
          // Search resident ID (check both string and number formats)
          const residentId = invoice.property?.resident?.residentId;
          if (residentId) {
            const residentIdStr = String(residentId).toLowerCase();
            if (residentIdStr.includes(searchLower)) return true;
          }
          
          // Search CNIC
          if (invoice.property?.resident?.cnic?.toLowerCase().includes(searchLower)) return true;
        }
        
        return false;
      });
      
      // Update total count after search filtering
      total = invoices.length;
    }
    
    // Apply resident filter if provided
    if (residentId) {
      invoices = invoices.filter(invoice => {
        const propertyResident = invoice.property?.resident;
        if (!propertyResident) return false;
        const residentIdValue = typeof propertyResident === 'object' && propertyResident !== null
          ? (propertyResident._id || propertyResident.id || propertyResident)
          : propertyResident;
        return String(residentIdValue) === String(residentId);
      });
    }
    
    // Apply sector filter if provided (only for property-based invoices)
    if (sector && openInvoices !== 'true') {
      invoices = invoices.filter(invoice => {
        const propertySector = invoice.property?.sector;
        if (!propertySector) return false;
        const sectorValue = typeof propertySector === 'object' && propertySector !== null
          ? (propertySector.name || propertySector.sectorName || String(propertySector))
          : String(propertySector);
        return sectorValue.toLowerCase() === String(sector).toLowerCase();
      });
    }
    
    // Get total count after all filters (search, resident, sector)
    // Update total if we did in-memory filtering
    if (search && openInvoices !== 'true' && filter.property !== null) {
      // Property-based invoices: search was done in-memory, update total
      total = invoices.length;
    } else if (residentId || (sector && openInvoices !== 'true')) {
      // Resident or sector filters are applied in-memory, update total
      total = invoices.length;
    }
    // For open invoices with DB-level search, total from countDocuments is already correct
    
    // Apply pagination after all filtering
    invoices = invoices.slice(skip, skip + limit);

    const totalPages = Math.ceil(total / limit);
    const response = { 
      success: true, 
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages
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
}));

// Delete payment from invoice
router.delete('/:invoiceId/payments/:paymentId', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoice = await PropertyInvoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const paymentIndex = invoice.payments.findIndex(
      p => p._id.toString() === req.params.paymentId
    );

    if (paymentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Remove payment from array
    invoice.payments.splice(paymentIndex, 1);

    // Recalculate totals
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    invoice.totalPaid = totalPaid;
    invoice.balance = invoice.grandTotal - totalPaid;

    // Update payment status
    if (invoice.balance <= 0 && totalPaid > 0) {
      invoice.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      invoice.paymentStatus = 'partial_paid';
    } else {
      invoice.paymentStatus = 'unpaid';
    }

    invoice.updatedBy = req.user.id;
    invoice.updatedAt = new Date();

    await invoice.save();

    // OPTIMIZATION: Invalidate caches on payment deletion
    clearCached(CACHE_KEYS.INVOICES_OVERVIEW);
    if (invoice.property) {
      clearCached(`${CACHE_KEYS.INVOICES_OVERVIEW}_property_${invoice.property}`);
    }

    res.json({
      success: true,
      message: 'Payment deleted successfully',
      data: invoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Delete invoice
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoice = await PropertyInvoice.findById(req.params.id).populate('electricityBill').populate('property', 'resident');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const propertyId = invoice.property?.toString() || invoice.property;
    
    // Find all payment transactions linked to this invoice
    const TajResident = require('../models/tajResidencia/TajResident');
    
    const paymentTransactions = await TajTransaction.find({
      transactionType: 'bill_payment',
      referenceId: invoice._id
    }).populate('resident').populate('depositUsages.depositId');

    // Reverse deposit usages for each payment transaction
    if (paymentTransactions.length > 0) {
      // Group reversals by resident to update balances correctly
      const residentReversals = {};
      
      for (const paymentTxn of paymentTransactions) {
        if (paymentTxn.depositUsages && Array.isArray(paymentTxn.depositUsages) && paymentTxn.depositUsages.length > 0) {
          const residentId = paymentTxn.resident._id?.toString() || paymentTxn.resident.toString();
          
          if (!residentReversals[residentId]) {
            residentReversals[residentId] = {
              resident: paymentTxn.resident,
              totalAmount: 0,
              reversals: []
            };
          }
          
          // Create reversal transactions for each deposit usage
          for (const depositUsage of paymentTxn.depositUsages) {
            const depositId = depositUsage.depositId?._id || depositUsage.depositId;
            const reversalAmount = depositUsage.amount || 0;
            
            if (reversalAmount > 0 && depositId) {
              // Get the deposit transaction to get its details
              const depositTxn = await TajTransaction.findById(depositId);
              if (depositTxn) {
                residentReversals[residentId].reversals.push({
                  depositTxn,
                  reversalAmount,
                  paymentTxnId: paymentTxn._id
                });
                residentReversals[residentId].totalAmount += reversalAmount;
              }
            }
          }
        }
      }
      
      // Process reversals for each resident
      for (const residentId in residentReversals) {
        const reversalData = residentReversals[residentId];
        const resident = await TajResident.findById(residentId);
        
        if (!resident) continue;
        
        let currentBalance = resident.balance || 0;
        const balanceBefore = currentBalance;
        
        // Create reversal transactions (one per deposit usage)
        for (const reversal of reversalData.reversals) {
          const balanceAfter = currentBalance + reversal.reversalAmount;
          
          const reversalTransaction = new TajTransaction({
            resident: resident._id,
            transactionType: 'deposit',
            amount: reversal.reversalAmount,
            balanceBefore: currentBalance,
            balanceAfter: balanceAfter,
            description: `Reversal: Invoice ${invoice.invoiceNumber || invoice._id} deleted - Deposit restored`,
            paymentMethod: reversal.depositTxn.paymentMethod || 'Bank Transfer',
            bank: reversal.depositTxn.bank || null,
            referenceNumberExternal: `REV-${reversal.paymentTxnId}`,
            createdBy: req.user.id
          });
          
          await reversalTransaction.save();
          currentBalance = balanceAfter; // Update for next reversal
        }
        
        // Update resident balance (add back the total reversed amount)
        if (reversalData.totalAmount > 0) {
          resident.balance = balanceBefore + reversalData.totalAmount;
          resident.updatedBy = req.user.id;
          await resident.save();
        }
      }
      
      // Delete all payment transactions linked to this invoice
      await TajTransaction.deleteMany({
        transactionType: 'bill_payment',
        referenceId: invoice._id
      });
    }
    
    // If invoice has ELECTRICITY charge type and references an electricity bill, delete it
    if (invoice.chargeTypes?.includes('ELECTRICITY') && invoice.electricityBill) {
      const electricityBillId = invoice.electricityBill._id || invoice.electricityBill;
      await Electricity.findByIdAndDelete(electricityBillId);
      
      // Invalidate electricity overview cache
      clearCached(CACHE_KEYS.ELECTRICITY_OVERVIEW);
    }
    
    await PropertyInvoice.findByIdAndDelete(req.params.id);

    // OPTIMIZATION: Invalidate caches on invoice deletion
    clearCached(CACHE_KEYS.INVOICES_OVERVIEW);
    if (propertyId) {
      clearCached(`${CACHE_KEYS.INVOICES_OVERVIEW}_property_${propertyId}`);
    }

    res.json({
      success: true,
      message: `Invoice deleted successfully${paymentTransactions.length > 0 ? `. ${paymentTransactions.length} payment(s) reversed and deposits restored.` : ''}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

module.exports = router;

