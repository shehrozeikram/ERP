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
const { getPreviousReading, getElectricitySlabForUnits, calculateElectricityCharges } = require('../utils/electricityBillHelper');
const dayjs = require('dayjs');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;

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

// Helper: Normalize readings map from various input formats
const normalizeReadingsMap = (meterReadings, currentReading, metersToProcess) => {
  const readingsMap = {};
  
  if (meterReadings && typeof meterReadings === 'object' && Object.keys(meterReadings).length > 0) {
    Object.entries(meterReadings).forEach(([key, value]) => {
      readingsMap[String(key)] = parseFloat(value) || 0;
    });
  } else if (typeof currentReading === 'object' && currentReading !== null) {
    Object.entries(currentReading).forEach(([key, value]) => {
      readingsMap[String(key)] = parseFloat(value) || 0;
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
  await invoice.populate('property');
  if (camCharge) await invoice.populate('camCharge');
  if (electricityBill) await invoice.populate('electricityBill');
};

// Helper: Create new invoice (always creates new, never updates existing)
// If invoice number exists, generates new unique number with timestamp
const createOrUpdateInvoice = async (invoiceData, invoiceNumber, propertyId, userId, periodFrom, periodTo, propertySrNo, invoiceType) => {
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month() + 1;
  
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
      currentYear,
      currentMonth,
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
          currentYear,
          currentMonth,
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
    iescoSlabs: unitsSlab || '',
    fromDate: periodFrom ? new Date(periodFrom) : now.startOf('month').toDate(),
    toDate: periodTo ? new Date(periodTo) : now.endOf('month').toDate(),
    month: now.format('MMM-YY'),
    dueDate: periodTo ? new Date(periodTo) : now.add(30, 'day').toDate(),
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

// Get previous reading and calculate charges for property
router.get('/property/:propertyId/electricity-calculation', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId)
      .populate('rentalAgreement');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const { currentReading, meterNo: requestedMeterNo } = req.query;
    
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
    
    // Get previous reading
    const { prvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey);
    
    if (currentReading !== undefined && currentReading !== null) {
      const curReading = parseFloat(currentReading) || 0;
      
      if (curReading < prvReading) {
        return res.status(400).json({ 
          success: false, 
          message: `Current reading (${curReading}) cannot be less than previous reading (${prvReading})` 
        });
      }
      
      const unitsConsumed = Math.max(0, curReading - prvReading);
      const { slab, unitRate, fixRate, unitsSlab } = await getElectricitySlabForUnits(unitsConsumed);
      
      if (!slab && unitsConsumed > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No matching slab found for units consumed' 
        });
      }
      
      const meterRent = property.hasElectricityWater ? 75 : 0;
      const tvFee = property.hasElectricityWater ? 35 : 0;
      const charges = calculateElectricityCharges(unitsConsumed, unitRate, fixRate || 0, meterRent, tvFee);
      
      return res.json({
        success: true,
        data: {
          previousReading: prvReading,
          currentReading: curReading,
          unitsConsumed,
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

    const { periodFrom, periodTo, includeCAM, includeElectricity, includeRent, charges: requestCharges } = req.body;

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
    const meterBillsData = []; // Store data for additional meters

    // Get CAM Charge
    if (includeCAM === true) {
      // First try to find existing CAM charge in database if we have property identifiers
      if (conditions.length > 0) {
        camCharge = await CAMCharge.findOne({ $or: conditions })
          .sort({ createdAt: -1 })
          .lean();
      }
      
      if (camCharge) {
        charges.push({
          type: 'CAM',
          description: 'CAM Charges',
          amount: camCharge.amount || 0,
          arrears: camCharge.arrears || 0,
          total: (camCharge.amount || 0) + (camCharge.arrears || 0)
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
        
        // Always add CAM charge entry when includeCAM is true, even if amount is 0
        // This allows the invoice to be created and the amount can be set manually
        charges.push({
          type: 'CAM',
          description: camDescription,
          amount: camAmount,
          arrears: 0,
          total: camAmount
        });
      }
    }

    // Get Electricity Bill - Handle multiple meters
    let hasReadings = false; // Declare at function scope
    if (includeElectricity === true) {
      const { currentReading, meterReadings } = req.body;
      
      // Get active meters from property
      const activeMeters = (property.meters || []).filter(m => m.isActive !== false);
      
      // If no meters array, fallback to legacy single meter
      const metersToProcess = activeMeters.length > 0 
        ? activeMeters 
        : (property.meterNumber || property.electricityWaterMeterNo 
          ? [{ meterNo: property.meterNumber || property.electricityWaterMeterNo || '', floor: property.floor || 'Ground Floor' }]
          : []);
      
      // If current reading or meterReadings provided, calculate and create new bill(s)
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
          if (readingsMap[meterNo] !== undefined) {
            curReading = readingsMap[meterNo];
          } else if (meterReadings && typeof meterReadings === 'object') {
            continue; // Skip if meterReadings provided but this meter has no reading
          } else if (meterIndex === 0 && typeof currentReading === 'number') {
            curReading = parseFloat(currentReading) || 0;
          } else {
            continue; // Skip if no reading for this meter
          }
          
          // Get previous reading for this specific meter
          const { prvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey);
          
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
            charges.push({
              type: 'ELECTRICITY',
              description: metersToProcess.length > 1 ? `Electricity Bill - ${meter.floor || 'Meter 1'}` : 'Electricity Bill',
              amount: calculatedCharges.withSurcharge,
              arrears: previousArrears,
              total: calculatedCharges.withSurcharge + previousArrears
            });
          } else {
            // For additional meters, store data to create separate invoices
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
      } else if (requestCharges && Array.isArray(requestCharges) && requestCharges.length > 0) {
        // Use manually entered charges from request (only if no readings were processed)
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
          
          charges.push({
            type: 'ELECTRICITY',
            description: electricityCharge.description || 'Electricity Bill',
            amount: electricityCharge.amount || 0,
            arrears: electricityCharge.arrears || 0,
            total: (electricityCharge.amount || 0) + (electricityCharge.arrears || 0)
          });
        }
      } else if (conditions.length > 0) {
        // Fallback to existing bill
        electricityBill = await Electricity.findOne({ $or: conditions })
          .sort({ toDate: -1, createdAt: -1 })
          .lean();
        
        if (electricityBill) {
          charges.push({
            type: 'ELECTRICITY',
            description: 'Electricity Bill',
            amount: electricityBill.withSurcharge || electricityBill.totalBill || 0,
            arrears: electricityBill.arrears || 0,
            total: (electricityBill.withSurcharge || electricityBill.totalBill || 0) + (electricityBill.arrears || 0)
          });
        }
      }
    }

    // Get Rent Payment from Rental Agreement (especially for Personal Rent category)
    if (includeRent === true) {
      let agreement = null;
      
      // Helper function to create rent charge object
      const createRentCharge = (amount, arrears) => ({
        type: 'RENT',
        description: 'Rental Charges',
        amount: amount || 0,
        arrears: arrears || 0,
        total: (amount || 0) + (arrears || 0)
      });
      
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
          
          // Check for previous arrears from unpaid invoices
          const previousInvoices = await PropertyInvoice.find({
            property: property._id,
            chargeTypes: { $in: ['RENT'] },
            paymentStatus: { $in: ['unpaid', 'partial_paid'] }
          }).lean();
          
          const previousArrears = previousInvoices.reduce((sum, inv) => {
            const rentCharge = inv.charges?.find(c => c.type === 'RENT');
            return rentCharge ? sum + (rentCharge.arrears || 0) + (inv.balance || 0) : sum;
          }, 0);
          
          charges.push(createRentCharge(monthlyRent, previousArrears));
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
        // Skip RENT charges if backend already calculated them from agreement
        if (charge.type === 'RENT' && hasCalculatedRentCharge) {
          return; // Skip this charge, use the one calculated from agreement
        }
        
        const chargeData = {
          type: charge.type,
          description: charge.description || `${charge.type} Charges`,
          amount: charge.amount || 0,
          arrears: charge.arrears || 0,
          total: (charge.amount || 0) + (charge.arrears || 0)
        };
        
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

    // Handle multiple meters for electricity invoices
    const now = dayjs();
    const activeMeters = (property.meters || []).filter(m => m.isActive !== false);
    const hasMultipleMeters = activeMeters.length > 1 && includeElectricity === true && electricityBill && meterBillsData.length > 0;
    
    // If we have multiple meters with electricity, create separate invoices for each
    if (hasMultipleMeters) {
      const createdInvoices = [];
      const year = now.year();
      const month = now.month() + 1;
      
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
          dueDate: periodTo ? new Date(periodTo) : now.add(30, 'day').toDate(),
          periodFrom: periodFrom ? new Date(periodFrom) : undefined,
          periodTo: periodTo ? new Date(periodTo) : undefined,
          chargeTypes: ['ELECTRICITY'],
          electricityBill: meterBill._id,
          charges: [meterCharges],
          subtotal: meterSubtotal,
          totalArrears: meterArrears,
          grandTotal: meterGrandTotal,
          amountInWords: numberToWords(meterGrandTotal),
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
      
      return res.status(201).json({
        success: true,
        message: `Invoices created successfully for ${createdInvoices.length} meter(s)`,
        data: createdInvoices.length === 1 ? createdInvoices[0] : createdInvoices
      });
    }
    
    // Single invoice creation (original logic for non-multiple meters or non-electricity)
    const invoiceNumber = generateInvoiceNumber(property.srNo, now.year(), now.month() + 1, invoiceType);
    
    const invoiceData = {
      property: property._id,
      invoiceNumber,
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
      status: 'Issued',
      paymentStatus: 'unpaid',
      createdBy: req.user.id
    };

    const { invoice, isNew } = await createOrUpdateInvoice(
      invoiceData, invoiceNumber, property._id, req.user.id, periodFrom, periodTo, property.srNo, invoiceType
    );
    
    await populateInvoiceReferences(invoice, { camCharge, electricityBill });
    
    const invoiceObj = invoice.toObject();
    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoiceObj
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get invoice by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoice = await PropertyInvoice.findById(req.params.id)
      .populate('property')
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
    const invoices = await PropertyInvoice.find({ property: req.params.propertyId })
      .populate('camCharge')
      .populate('electricityBill')
      .populate('payments.recordedBy', 'firstName lastName')
      .sort({ invoiceDate: -1 });

    // Enhance payments with bank information from transactions
    const invoicesWithBankInfo = await Promise.all(invoices.map(async (invoice) => {
      const invoiceObj = invoice.toObject();
      
      // Find transactions that reference this invoice
      const transactions = await TajTransaction.find({
        referenceId: invoice._id,
        transactionType: 'bill_payment'
      })
        .populate('depositUsages.depositId')
        .sort({ createdAt: -1 });
      
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
    }));

    res.json({ success: true, data: invoicesWithBankInfo });
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

    const { invoiceNumber, invoiceDate, dueDate, periodFrom, periodTo, charges, subtotal, totalArrears, grandTotal } = req.body;

    // Update invoice fields
    if (invoiceNumber !== undefined) invoice.invoiceNumber = invoiceNumber;
    if (invoiceDate !== undefined) invoice.invoiceDate = invoiceDate ? new Date(invoiceDate) : invoice.invoiceDate;
    if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : invoice.dueDate;
    if (periodFrom !== undefined) invoice.periodFrom = periodFrom ? new Date(periodFrom) : invoice.periodFrom;
    if (periodTo !== undefined) invoice.periodTo = periodTo ? new Date(periodTo) : invoice.periodTo;
    if (charges !== undefined) invoice.charges = charges;
    if (subtotal !== undefined) invoice.subtotal = subtotal;
    if (totalArrears !== undefined) invoice.totalArrears = totalArrears;
    if (grandTotal !== undefined) {
      invoice.grandTotal = grandTotal;
      invoice.amountInWords = numberToWords(grandTotal);
    }

    invoice.updatedBy = req.user.id;
    invoice.updatedAt = new Date();

    await invoice.save();

    // Populate references
    await invoice.populate('property');
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
    const { propertyId, status, paymentStatus } = req.query;
    const filter = {};
    
    if (propertyId) filter.property = propertyId;
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const invoices = await PropertyInvoice.find(filter)
      .populate('property', 'propertyName plotNumber address ownerName')
      .sort({ invoiceDate: -1 })
      .limit(100);

    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Delete invoice
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoice = await PropertyInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await PropertyInvoice.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

module.exports = router;

