const WaterUtilitySlab = require('../models/tajResidencia/WaterUtilitySlab');
const Electricity = require('../models/tajResidencia/Electricity');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const mongoose = require('mongoose');

/**
 * Get electricity slab information based on units consumed
 * @param {Number} unitsConsumed - Total units consumed
 * @returns {Promise<{slab: Object|null, unitRate: Number, fixRate: Number}>}
 */
const getElectricitySlabForUnits = async (unitsConsumed) => {
  try {
    // Try with populate first, fallback to lean if User model not available
    let activeSlabs;
    try {
      activeSlabs = await WaterUtilitySlab.getActiveSlabs();
    } catch (err) {
      // If populate fails (e.g., User model not registered), use lean
      activeSlabs = await WaterUtilitySlab.findOne({ isActive: true }).lean();
    }
    
    if (!activeSlabs || !activeSlabs.slabs || activeSlabs.slabs.length === 0) {
      return { slab: null, unitRate: 0, fixRate: 0 };
    }

    // Find matching slab based on units consumed
    const matchingSlab = activeSlabs.slabs.find(slab => {
      return unitsConsumed >= slab.lowerSlab && unitsConsumed <= slab.higherSlab;
    });

    if (matchingSlab) {
      return {
        slab: matchingSlab,
        unitRate: parseFloat(matchingSlab.unitRate) || 0,
        fixRate: parseFloat(matchingSlab.fixRate) || 0,
        unitsSlab: matchingSlab.unitsSlab || ''
      };
    }

    // If no match found, check for "Above X" slab (highest slab)
    const sortedSlabs = [...activeSlabs.slabs].sort((a, b) => b.higherSlab - a.higherSlab);
    const highestSlab = sortedSlabs[0];
    
    if (highestSlab && unitsConsumed > highestSlab.higherSlab) {
      return {
        slab: highestSlab,
        unitRate: parseFloat(highestSlab.unitRate) || 0,
        fixRate: parseFloat(highestSlab.fixRate) || 0,
        unitsSlab: highestSlab.unitsSlab || 'Above ' + highestSlab.higherSlab
      };
    }

    return { slab: null, unitRate: 0, fixRate: 0, unitsSlab: '' };
  } catch (error) {
    return { slab: null, unitRate: 0, fixRate: 0, unitsSlab: '' };
  }
};

/**
 * Calculate all electricity bill charges
 * @param {Number} unitsConsumed - Total units consumed
 * @param {Number} unitRate - Price per unit from slab
 * @param {Number} fixRate - Fixed charges from slab
 * @param {Number} meterRent - Meter rent (default 0, removed from calculation)
 * @param {Number} tvFee - TV fee (default 0, removed from calculation)
 * @returns {Object} - All calculated charges
 */
const calculateElectricityCharges = (unitsConsumed, unitRate, fixRate = 0, meterRent = 0, tvFee = 0) => {
  // Ensure unitRate is a proper number with decimal precision
  const preciseUnitRate = parseFloat(unitRate) || 0;
  
  // Base calculations - using precise unit rate
  const electricityCost = unitsConsumed * preciseUnitRate;
  const fcSurcharge = 3.2 * unitsConsumed;
  // NJ Surcharge removed from calculation
  const njSurcharge = 0;
  
  // Round each component to 2 decimal places for accurate calculations
  const roundedElectricityCost = Math.round(electricityCost * 100) / 100;
  const roundedFcSurcharge = Math.round(fcSurcharge * 100) / 100;
  const roundedNjSurcharge = 0; // Always 0 now
  
  // Subtotal before taxes (removed meterRent, njSurcharge, and fixedCharges from calculation)
  const subtotal = roundedElectricityCost + roundedFcSurcharge;
  
  // Taxes
  const gst = Math.round((roundedElectricityCost * 0.18) * 100) / 100; // 18% of electricity cost only
  const electricityDuty = Math.round((subtotal * 0.015) * 100) / 100; // 1.5% of rounded subtotal
  
  // Total bill (removed tvFee from calculation)
  const totalBill = subtotal + gst + electricityDuty;
  
  // Round final bill amount to nearest integer (0.5 rounds up)
  const roundedTotalBill = Math.round(totalBill);
  
  return {
    electricityCost: roundedElectricityCost,
    fcSurcharge: roundedFcSurcharge,
    meterRent: 0, // Always 0 now
    njSurcharge: 0, // Always 0 now
    gst: gst,
    electricityDuty: electricityDuty,
    tvFee: 0, // Always 0 now
    fixedCharges: 0, // Removed from calculation
    totalBill: roundedTotalBill,
    withSurcharge: roundedTotalBill // Rounded to nearest integer
  };
};

/**
 * Get previous reading from last bill for a property
 * @param {String} meterNo - Meter number
 * @param {String} propertyKey - Property identifier (address, plotNo, or owner)
 * @param {String|ObjectId} propertyId - Property ID (optional, for checking PropertyInvoice records)
 * @returns {Promise<{prvReading: Number, previousArrears: Number}>}
 */
const getPreviousReading = async (meterNo, propertyKey, propertyId = null) => {
  try {
    // Try to find last bill by meter number first (must match exactly)
    let lastBill = null;
    if (meterNo) {
      // Convert meterNo to string for consistent matching
      const meterNoStr = String(meterNo);
      
      // OPTIMIZATION: Find the latest Electricity record that is actually linked to an active PropertyInvoice
      // This ensures that if an invoice is deleted, its reading is ignored
      const validInvoices = await PropertyInvoice.find({ 
        property: propertyId,
        chargeTypes: { $in: ['ELECTRICITY'] }
      }).select('electricityBill').lean();
      
      const validBillIds = validInvoices.map(inv => inv.electricityBill).filter(Boolean);

      lastBill = await Electricity.findOne({ 
        meterNo: meterNoStr,
        _id: { $in: validBillIds } // Only consider bills that still have an invoice
      })
        .sort({ toDate: -1, createdAt: -1 })
        .lean();
    }
    
    // If not found by meter, try by property key (fallback for legacy)
    if (!lastBill && propertyKey && (!meterNo || String(meterNo).trim() === '')) {
      const validInvoices = await PropertyInvoice.find({ 
        property: propertyId,
        chargeTypes: { $in: ['ELECTRICITY'] }
      }).select('electricityBill').lean();
      
      const validBillIds = validInvoices.map(inv => inv.electricityBill).filter(Boolean);

      lastBill = await Electricity.findOne({
        $or: [
          { address: propertyKey },
          { plotNo: propertyKey },
          { owner: propertyKey }
        ],
        _id: { $in: validBillIds }
      })
      .sort({ toDate: -1, createdAt: -1 })
      .lean();
    }

    // Get arrears from last Electricity bill
    const electricityBillArrears = lastBill ? (lastBill.arrears || 0) : 0;
    
    // Calculate carry forward arrears from unpaid PropertyInvoice records
    // Use same logic as Balance column: if invoice is overdue (after due date + 6-day grace), include 10% surcharge
    let carryForwardArrears = 0;
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      try {
        const previousElectricityInvoices = await PropertyInvoice.find({
          property: propertyId,
          chargeTypes: { $in: ['ELECTRICITY'] },
          paymentStatus: { $in: ['unpaid', 'partial_paid'] },
          balance: { $gt: 0 }
        })
        .populate('electricityBill', 'meterNo')
        .select('charges chargeTypes grandTotal totalPaid balance dueDate subtotal totalArrears paymentStatus electricityBill')
        .sort({ invoiceDate: 1 })
        .lean();

        const getAdjustedBalance = (inv) => {
          const GRACE_PERIOD_DAYS = 6;
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const dueStart = inv.dueDate ? new Date(inv.dueDate) : null;
          if (dueStart) dueStart.setHours(0, 0, 0, 0);
          const dueWithGrace = dueStart ? new Date(dueStart) : null;
          if (dueWithGrace) dueWithGrace.setDate(dueWithGrace.getDate() + GRACE_PERIOD_DAYS);
          const isOverdue = dueWithGrace && todayStart > dueWithGrace;
          const isUnpaid = inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial_paid' || (inv.balance || 0) > 0;
          if (!isOverdue || !isUnpaid) return inv.balance || 0;
          let chargesForMonth = inv.subtotal || 0;
          if (inv.charges && Array.isArray(inv.charges) && inv.charges.length > 0) {
            const totalChargesAmount = inv.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
            if (totalChargesAmount > 0) chargesForMonth = totalChargesAmount;
          }
          const baseAmount = chargesForMonth + (inv.totalArrears || 0);
          const latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
          return Math.max(0, baseAmount + latePaymentSurcharge - (inv.totalPaid || 0));
        };

        previousElectricityInvoices.forEach(inv => {
          // Arrears per meter: only include invoices for the same meter
          if (meterNo) {
            const invMeterNo = inv.electricityBill?.meterNo || '';
            if (String(invMeterNo) !== String(meterNo)) return;
          }
          const electricityCharges = inv.charges?.filter(c => c.type === 'ELECTRICITY') || [];
          if (electricityCharges.length > 0) {
            const adjustedBalance = getAdjustedBalance(inv);
            const hasOnlyElectricity = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY';
            if (hasOnlyElectricity) {
              carryForwardArrears += adjustedBalance;
            } else {
              const electricityTotal = electricityCharges.reduce((sum, c) => sum + (c.amount || 0) + (c.arrears || 0), 0);
              const invoiceTotal = inv.grandTotal || 0;
              if (invoiceTotal > 0) {
                const electricityProportion = electricityTotal / invoiceTotal;
                carryForwardArrears += adjustedBalance * electricityProportion;
              }
            }
          }
        });

        carryForwardArrears = Math.round(carryForwardArrears * 100) / 100;
      } catch (err) {
        console.error('Error calculating carry forward arrears from PropertyInvoice:', err);
        // Continue with electricityBillArrears only
      }
    }

    // Combine arrears from Electricity bill and carry forward from invoices
    const totalArrears = electricityBillArrears + carryForwardArrears;

    return {
      prvReading: lastBill ? (lastBill.curReading || 0) : 0,
      previousArrears: totalArrears
    };
  } catch (error) {
    return { prvReading: 0, previousArrears: 0 };
  }
};

/**
 * Calculate units consumed for specific days
 * @param {Number} totalUnits - Total units consumed
 * @param {Number} totalDays - Total days in billing period
 * @param {Number} daysForCalculation - Days to calculate for
 * @returns {Number}
 */
const calculateUnitsForDays = (totalUnits, totalDays, daysForCalculation) => {
  if (totalDays === 0) return 0;
  return Math.round((totalUnits / totalDays) * daysForCalculation * 100) / 100;
};

/**
 * Format date to string (e.g., "01-Sep-25")
 * @param {Date} date - Date to format
 * @returns {String}
 */
const formatDateString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

/**
 * Format month string (e.g., "Sep-25")
 * @param {Date} date - Date to format
 * @returns {String}
 */
const formatMonthString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${year}`;
};

/**
 * Get effective arrears for an electricity invoice (for display/PDF).
 * Uses adjusted balance from previous unpaid invoices (same meter) - includes 10% surcharge when overdue.
 * @param {Object} invoice - Invoice with property, periodFrom, electricityBill (with meterNo)
 * @returns {Promise<Number|null>}
 */
const getEffectiveArrearsForInvoice = async (invoice) => {
  if (!invoice?.property || !invoice.periodFrom) return null;
  const propertyId = invoice.property?._id || invoice.property;
  const meterNo = invoice.electricityBill?.meterNo || '';
  if (!propertyId || !meterNo) return null;
  try {
    const periodFrom = new Date(invoice.periodFrom);
    periodFrom.setHours(0, 0, 0, 0);

    const currentInvoiceId = invoice._id;
    const previousInvoices = await PropertyInvoice.find({
      property: propertyId,
      _id: { $ne: currentInvoiceId },
      chargeTypes: { $in: ['ELECTRICITY'] },
      paymentStatus: { $in: ['unpaid', 'partial_paid'] },
      balance: { $gt: 0 },
      periodTo: { $lte: periodFrom }
    })
      .populate('electricityBill', 'meterNo')
      .select('charges chargeTypes grandTotal totalPaid balance dueDate subtotal totalArrears paymentStatus')
      .sort({ invoiceDate: 1 })
      .lean();

    const getAdjustedBalance = (inv) => {
      const GRACE_PERIOD_DAYS = 6;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const dueStart = inv.dueDate ? new Date(inv.dueDate) : null;
      if (dueStart) dueStart.setHours(0, 0, 0, 0);
      const dueWithGrace = dueStart ? new Date(dueStart) : null;
      if (dueWithGrace) dueWithGrace.setDate(dueWithGrace.getDate() + GRACE_PERIOD_DAYS);
      const isOverdue = dueWithGrace && todayStart > dueWithGrace;
      const isUnpaid = inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial_paid' || (inv.balance || 0) > 0;
      if (!isOverdue || !isUnpaid) return inv.balance || 0;
      let chargesForMonth = inv.subtotal || 0;
      if (inv.charges && Array.isArray(inv.charges) && inv.charges.length > 0) {
        const totalChargesAmount = inv.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
        if (totalChargesAmount > 0) chargesForMonth = totalChargesAmount;
      }
      const latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
      return Math.max(0, chargesForMonth + (inv.totalArrears || 0) + latePaymentSurcharge - (inv.totalPaid || 0));
    };

    let carryForward = 0;
    previousInvoices.forEach(inv => {
      const invMeterNo = inv.electricityBill?.meterNo || '';
      if (String(invMeterNo) !== String(meterNo)) return;
      const electricityCharges = inv.charges?.filter(c => c.type === 'ELECTRICITY') || [];
      if (electricityCharges.length === 0) return;
      const adjustedBalance = getAdjustedBalance(inv);
      const hasOnlyElectricity = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY';
      if (hasOnlyElectricity) {
        carryForward += adjustedBalance;
      } else {
        const electricityTotal = electricityCharges.reduce((sum, c) => sum + (c.amount || 0) + (c.arrears || 0), 0);
        const invoiceTotal = inv.grandTotal || 0;
        if (invoiceTotal > 0) {
          carryForward += adjustedBalance * (electricityTotal / invoiceTotal);
        }
      }
    });
    return Math.round(carryForward * 100) / 100;
  } catch (err) {
    console.error('Error in getEffectiveArrearsForInvoice:', err);
    return null;
  }
};

/**
 * Get display amount for an electricity invoice (matches client getAdjustedGrandTotal).
 * baseAmount + effectiveArrears + 10% surcharge when overdue and unpaid.
 * @param {Object} invoice - Invoice with charges, dueDate, totalPaid, balance, paymentStatus
 * @param {Number} effectiveArrears - Pre-computed effective arrears (from getEffectiveArrearsForInvoice)
 * @returns {Number}
 */
const getDisplayAmountForElectricityInvoice = (invoice, effectiveArrears = 0) => {
  if (!invoice) return 0;
  let chargesForMonth = invoice.subtotal || 0;
  if (invoice.charges && Array.isArray(invoice.charges) && invoice.charges.length > 0) {
    const totalChargesAmount = invoice.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
    if (totalChargesAmount > 0) chargesForMonth = totalChargesAmount;
  }
  const arrears = effectiveArrears ?? invoice.totalArrears ?? 0;
  const baseAmount = chargesForMonth + arrears;

  const GRACE_PERIOD_DAYS = 6;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const dueWithGrace = dueStart ? new Date(dueStart) : null;
  if (dueWithGrace) dueWithGrace.setDate(dueWithGrace.getDate() + GRACE_PERIOD_DAYS);
  const isOverdue = dueWithGrace && todayStart > dueWithGrace;
  const isUnpaid = invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial_paid' || (invoice.balance || 0) > 0;

  if (!isOverdue || !isUnpaid) return Math.round(baseAmount * 100) / 100;
  const latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
  return Math.round((baseAmount + latePaymentSurcharge) * 100) / 100;
};

module.exports = {
  getElectricitySlabForUnits,
  calculateElectricityCharges,
  getPreviousReading,
  getEffectiveArrearsForInvoice,
  getDisplayAmountForElectricityInvoice,
  calculateUnitsForDays,
  formatDateString,
  formatMonthString
};

