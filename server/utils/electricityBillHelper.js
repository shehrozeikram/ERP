const WaterUtilitySlab = require('../models/tajResidencia/WaterUtilitySlab');
const Electricity = require('../models/tajResidencia/Electricity');

/**
 * Get electricity slab information based on units consumed
 * @param {Number} unitsConsumed - Total units consumed
 * @returns {Promise<{slab: Object|null, unitRate: Number, fixRate: Number}>}
 */
const getElectricitySlabForUnits = async (unitsConsumed) => {
  try {
    const activeSlabs = await WaterUtilitySlab.getActiveSlabs();
    
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
    console.error('Error getting electricity slab for units:', error);
    return { slab: null, unitRate: 0, fixRate: 0, unitsSlab: '' };
  }
};

/**
 * Calculate all electricity bill charges
 * @param {Number} unitsConsumed - Total units consumed
 * @param {Number} unitRate - Price per unit from slab
 * @param {Number} fixRate - Fixed charges from slab
 * @param {Number} meterRent - Meter rent (default 75)
 * @param {Number} tvFee - TV fee (default 35)
 * @returns {Object} - All calculated charges
 */
const calculateElectricityCharges = (unitsConsumed, unitRate, fixRate = 0, meterRent = 75, tvFee = 35) => {
  // Ensure unitRate is a proper number with decimal precision
  const preciseUnitRate = parseFloat(unitRate) || 0;
  
  // Base calculations - using precise unit rate
  const electricityCost = unitsConsumed * preciseUnitRate;
  const fcSurcharge = 3.2 * unitsConsumed;
  const njSurcharge = 0.10 * unitsConsumed;
  
  // Round each component to 2 decimal places for accurate calculations
  const roundedElectricityCost = Math.round(electricityCost * 100) / 100;
  const roundedFcSurcharge = Math.round(fcSurcharge * 100) / 100;
  const roundedNjSurcharge = Math.round(njSurcharge * 100) / 100;
  
  // Subtotal before taxes (using rounded values for consistency)
  const subtotal = roundedElectricityCost + roundedFcSurcharge + meterRent + roundedNjSurcharge + fixRate;
  
  // Taxes
  const gst = Math.round((roundedElectricityCost * 0.18) * 100) / 100; // 18% of electricity cost only
  const electricityDuty = Math.round((subtotal * 0.015) * 100) / 100; // 1.5% of rounded subtotal
  
  // Total bill
  const totalBill = subtotal + gst + electricityDuty + tvFee;
  
  return {
    electricityCost: roundedElectricityCost,
    fcSurcharge: roundedFcSurcharge,
    meterRent: meterRent,
    njSurcharge: roundedNjSurcharge,
    gst: gst,
    electricityDuty: electricityDuty,
    tvFee: tvFee,
    fixedCharges: fixRate,
    totalBill: Math.round(totalBill * 100) / 100,
    withSurcharge: Math.round(totalBill * 100) / 100 // Can be modified if additional surcharge needed
  };
};

/**
 * Get previous reading from last bill for a property
 * @param {String} meterNo - Meter number
 * @param {String} propertyKey - Property identifier (address, plotNo, or owner)
 * @returns {Promise<{prvReading: Number, previousArrears: Number}>}
 */
const getPreviousReading = async (meterNo, propertyKey) => {
  try {
    // Try to find last bill by meter number first
    let lastBill = null;
    if (meterNo) {
      lastBill = await Electricity.findOne({ meterNo })
        .sort({ toDate: -1 })
        .lean();
    }
    
    // If not found by meter, try by property key
    if (!lastBill && propertyKey) {
      lastBill = await Electricity.findOne({
        $or: [
          { address: propertyKey },
          { plotNo: propertyKey },
          { owner: propertyKey }
        ]
      })
      .sort({ toDate: -1 })
      .lean();
    }

    if (lastBill) {
      return {
        prvReading: lastBill.curReading || 0,
        previousArrears: lastBill.arrears || 0
      };
    }

    return { prvReading: 0, previousArrears: 0 };
  } catch (error) {
    console.error('Error getting previous reading:', error);
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

