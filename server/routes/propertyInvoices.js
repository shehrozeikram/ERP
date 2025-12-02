const express = require('express');
const router = express.Router();
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const TajProperty = require('../models/tajResidencia/TajProperty');
const CAMCharge = require('../models/tajResidencia/CAMCharge');
const Electricity = require('../models/tajResidencia/Electricity');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const { authMiddleware } = require('../middleware/auth');
const { numberToWords } = require('../utils/camChargesHelper');
const { getPreviousReading, getElectricitySlabForUnits, calculateElectricityCharges } = require('../utils/electricityBillHelper');
const dayjs = require('dayjs');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;

// Generate invoice number with type prefix
const generateInvoiceNumber = (propertySrNo, year, month, type = 'GEN') => {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedIndex = String(propertySrNo || 1).padStart(4, '0');
  
  // Determine prefix based on type
  let prefix = 'INV';
  if (type === 'CAM' || type === 'CMC') {
    prefix = 'INV-CMC';
  } else if (type === 'ELECTRICITY' || type === 'ELC') {
    prefix = 'INV-ELC';
  } else if (type === 'RENT' || type === 'REN') {
    prefix = 'INV-REN';
  } else if (type === 'MIXED' || type === 'MIX') {
    prefix = 'INV-MIX';
  }
  
  return `${prefix}-${year}-${paddedMonth}-${paddedIndex}`;
};

// Get previous reading and calculate charges for property
router.get('/property/:propertyId/electricity-calculation', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const property = await TajProperty.findById(req.params.propertyId)
      .populate('rentalAgreement');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const { currentReading } = req.query;
    const meterNo = property.meterNumber || '';
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
          slab: {
            unitsSlab,
            unitRate,
            fixRate
          },
          charges,
          grandTotal: charges.withSurcharge + previousArrears
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        previousReading: prvReading,
        previousArrears,
        meterNo
      }
    });
  } catch (error) {
    console.error('Error calculating electricity:', error);
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

    // Get CAM Charge
    if (includeCAM === true && conditions.length > 0) {
      camCharge = await CAMCharge.findOne({ $or: conditions })
        .sort({ createdAt: -1 })
        .lean();
      
      if (camCharge) {
        charges.push({
          type: 'CAM',
          description: 'CAM Charges',
          amount: camCharge.amount || 0,
          arrears: camCharge.arrears || 0,
          total: (camCharge.amount || 0) + (camCharge.arrears || 0)
        });
      }
    }

    // Get Electricity Bill
    if (includeElectricity === true) {
      const { currentReading } = req.body;
      
      // If current reading provided, calculate and create new bill
      if (currentReading !== undefined && currentReading !== null && currentReading !== '') {
        
        // Get previous reading
        const meterNo = property.meterNumber || '';
        const propertyKey = property.address || property.plotNumber || property.ownerName;
        const { prvReading, previousArrears } = await getPreviousReading(meterNo, propertyKey);
        
        // Validate current reading
        const curReading = parseFloat(currentReading) || 0;
        if (curReading < prvReading) {
          return res.status(400).json({ 
            success: false, 
            message: `Current reading (${curReading}) cannot be less than previous reading (${prvReading})` 
          });
        }
        
        // Calculate units consumed
        const unitsConsumed = Math.max(0, curReading - prvReading);
        
        // Get slab and calculate charges
        const { slab, unitRate, fixRate, unitsSlab } = await getElectricitySlabForUnits(unitsConsumed);
        if (!slab && unitsConsumed > 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'No matching slab found for units consumed' 
          });
        }
        
        // Calculate charges
        const meterRent = property.hasElectricityWater ? 75 : 0;
        const tvFee = property.hasElectricityWater ? 35 : 0;
        const calculatedCharges = calculateElectricityCharges(unitsConsumed, unitRate, fixRate || 0, meterRent, tvFee);
        
        // Generate bill invoice number
        const now = dayjs();
        const monthYear = `${now.year()}-${String(now.month() + 1).padStart(2, '0')}`;
        const billInvoiceNumber = `ELEC-${monthYear}-${String(property.srNo || 1).padStart(4, '0')}`;
        
        // Create electricity bill
        const billData = {
          invoiceNumber: billInvoiceNumber,
          meterNo: meterNo,
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
          createdBy: req.user.id
        };
        
        electricityBill = new Electricity(billData);
        await electricityBill.save();
        
        charges.push({
          type: 'ELECTRICITY',
          description: 'Electricity Bill',
          amount: calculatedCharges.withSurcharge,
          arrears: previousArrears,
          total: calculatedCharges.withSurcharge + previousArrears
        });
      } else if (requestCharges && Array.isArray(requestCharges)) {
        // Use manually entered charges from request
        const electricityCharge = requestCharges.find(c => c.type === 'ELECTRICITY');
        if (electricityCharge) {
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
      let rentChargeAdded = false;
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
            console.error('Error fetching rental agreement:', err);
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
            console.error('Error searching agreement by property name:', err);
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
    // Prioritize manually entered charges over fetched charges
    if (requestCharges?.length > 0) {
      requestCharges.forEach(charge => {
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

    // Generate invoice number
    const now = dayjs();
    const invoiceNumber = generateInvoiceNumber(
      property.srNo,
      now.year(),
      now.month() + 1,
      invoiceType
    );

    // Check if invoice already exists for this period
    const existingInvoice = await PropertyInvoice.findOne({
      property: property._id,
      invoiceNumber
    });

    if (existingInvoice) {
      // Update existing invoice with new charges and data
      existingInvoice.charges = charges;
      existingInvoice.subtotal = subtotal;
      existingInvoice.totalArrears = totalArrears;
      existingInvoice.grandTotal = grandTotal;
      existingInvoice.amountInWords = numberToWords(grandTotal);
      existingInvoice.chargeTypes = charges.map(c => c.type);
      if (periodFrom) existingInvoice.periodFrom = new Date(periodFrom);
      if (periodTo) existingInvoice.periodTo = new Date(periodTo);
      if (periodTo) existingInvoice.dueDate = new Date(periodTo);
      existingInvoice.updatedBy = req.user.id;
      
      await existingInvoice.save();
      
      // Populate references
      await existingInvoice.populate('property');
      if (camCharge) await existingInvoice.populate('camCharge');
      if (electricityBill) await existingInvoice.populate('electricityBill');
      
      // Convert to plain object to ensure charges are included
      const updatedInvoiceObj = existingInvoice.toObject();
      return res.json({ success: true, data: updatedInvoiceObj, message: 'Invoice updated successfully' });
    }

    // Create invoice
    const invoiceData = {
      property: property._id,
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: periodTo ? new Date(periodTo) : dayjs().add(30, 'day').toDate(),
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

    const invoice = new PropertyInvoice(invoiceData);
    await invoice.save();

    // Populate references
    await invoice.populate('property');
    if (camCharge) await invoice.populate('camCharge');
    if (electricityBill) await invoice.populate('electricityBill');

    // Convert to plain object to ensure charges are included
    const invoiceObj = invoice.toObject();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoiceObj
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
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
      .sort({ invoiceDate: -1 });

    res.json({ success: true, data: invoices });
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
    console.error('Error updating invoice:', error);
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
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}));

module.exports = router;

