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
  
  // Subtotal before taxes (removed meterRent and njSurcharge from calculation)
  const subtotal = roundedElectricityCost + roundedFcSurcharge + fixRate;
  
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
    fixedCharges: fixRate,
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
    let carryForwardArrears = 0;
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      try {
        const previousElectricityInvoices = await PropertyInvoice.find({
          property: propertyId,
          chargeTypes: { $in: ['ELECTRICITY'] },
          paymentStatus: { $in: ['unpaid', 'partial_paid'] },
          balance: { $gt: 0 }
        })
        .select('charges grandTotal totalPaid balance')
        .sort({ invoiceDate: 1 })
        .lean();
        
        // Calculate outstanding Electricity charges from previous invoices
        previousElectricityInvoices.forEach(inv => {
          const electricityCharges = inv.charges?.filter(c => c.type === 'ELECTRICITY') || [];
          if (electricityCharges.length > 0) {
            // Calculate the Electricity portion of the outstanding balance
            const hasOnlyElectricity = inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY';
            if (hasOnlyElectricity) {
              // If only Electricity in invoice, use the full outstanding balance
              carryForwardArrears += (inv.balance || 0);
            } else {
              // If mixed charges, calculate Electricity portion proportionally
              const electricityTotal = electricityCharges.reduce((sum, c) => sum + (c.amount || 0) + (c.arrears || 0), 0);
              const invoiceTotal = inv.grandTotal || 0;
              if (invoiceTotal > 0) {
                const electricityProportion = electricityTotal / invoiceTotal;
                carryForwardArrears += (inv.balance || 0) * electricityProportion;
              }
            }
          }
        });
        
        // Round to 2 decimal places
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

module.exports = {
  getElectricitySlabForUnits,
  calculateElectricityCharges,
  getPreviousReading,
  calculateUnitsForDays,
  formatDateString,
  formatMonthString
};

