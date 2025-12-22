const ChargesSlab = require('../models/tajResidencia/ChargesSlab');

/**
 * Get CAM charge amount for a property based on its zone type and size
 * @param {Number|String} propertySize - Property size (e.g., 3.5, 4, 5, etc.)
 * @param {String} areaUnit - Unit of measurement (e.g., 'Marla', 'Sq Ft')
 * @param {String} zoneType - Zone type ('Commercial' or 'Residential')
 * @returns {Promise<{amount: Number, slab: Object|null}>}
 */
const getCAMChargeForProperty = async (propertySize, areaUnit = 'Marla', zoneType = 'Residential') => {
  try {
    // Get active charges slabs
    const activeSlabs = await ChargesSlab.getActiveSlabs();
    
    // If zone is Commercial, return commercial CAM charges
    if (zoneType && zoneType.toLowerCase() === 'commercial') {
      const commercialAmount = activeSlabs?.commercialCamCharges || 2000;
      return { amount: commercialAmount, slab: { type: 'commercial', commercialCamCharges: commercialAmount } };
    }
    
    if (!activeSlabs || !activeSlabs.slabs || activeSlabs.slabs.length === 0) {
      return { amount: 0, slab: null };
    }

    // Convert property size to string format matching slabs (e.g., "3.5M", "4M")
    let sizeToMatch = '';
    if (areaUnit.toLowerCase().includes('marla')) {
      // If in Marla, use as is (e.g., 3.5 -> "3.5M")
      sizeToMatch = `${propertySize}M`;
    } else {
      // For other units, might need conversion or use areaValue directly
      // For now, try to match the numeric value
      sizeToMatch = `${propertySize}M`;
    }

    // Find matching slab
    const matchingSlab = activeSlabs.slabs.find(slab => {
      const slabSize = slab.size?.toUpperCase().trim();
      const matchSize = sizeToMatch.toUpperCase().trim();
      return slabSize === matchSize;
    });

    if (matchingSlab) {
      return { amount: matchingSlab.camCharges || 0, slab: matchingSlab };
    }

    // If exact match not found, try numeric comparison
    const numericSize = parseFloat(propertySize);
    if (!isNaN(numericSize)) {
      // Try to find closest match or exact numeric match
      const numericMatch = activeSlabs.slabs.find(slab => {
        const slabSizeStr = slab.size?.replace(/[^0-9.]/g, '');
        const slabSizeNum = parseFloat(slabSizeStr);
        return !isNaN(slabSizeNum) && slabSizeNum === numericSize;
      });

      if (numericMatch) {
        return { amount: numericMatch.camCharges || 0, slab: numericMatch };
      }
    }

    return { amount: 0, slab: null };
  } catch (error) {
    console.error('Error getting CAM charge for property:', error);
    return { amount: 0, slab: null };
  }
};

/**
 * Convert number to words (reusable utility)
 * @param {Number} num - Number to convert
 * @returns {String} - Number in words
 */
const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero Rupees Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convert = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  
  const amount = Math.floor(num);
  const paise = Math.round((num - amount) * 100);
  
  let result = convert(amount) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  result += ' Only';
  
  return result;
};

module.exports = {
  getCAMChargeForProperty,
  numberToWords
};

