/**
 * Pakistan FBR Tax Calculator
 * Uses database-driven tax slabs for dynamic updates
 */

const FBRTaxSlab = require('../models/hr/FBRTaxSlab');

/**
 * Calculate monthly tax deduction using active tax slabs from database
 * @param {number} monthlySalary - Monthly salary (basic + allowances except medical)
 * @returns {Promise<number>} Monthly tax amount
 */
async function calculateMonthlyTax(monthlySalary) {
  if (!monthlySalary || monthlySalary <= 0) {
    return 0;
  }

  try {
    // Calculate annual taxable income (12 months)
    const annualTaxableIncome = monthlySalary * 12;
    
    // Get tax amount from database
    const annualTax = await FBRTaxSlab.calculateTax(annualTaxableIncome);
    
    // Convert to monthly tax
    const monthlyTax = annualTax / 12;
    
    return Math.round(monthlyTax);
  } catch (error) {
    console.error('Error calculating tax:', error);
    return 0;
  }
}

/**
 * Calculate taxable income based on new salary structure:
 * - 66.66% Basic Salary (taxable)
 * - 10% Medical Allowance (tax-exempt)
 * - 23.34% House Rent Allowance (taxable)
 * - Other Allowances (conveyance, meal, transport, etc.) are taxable
 * @param {Object} salary - Salary object with basic, allowances, etc.
 * @returns {number} Monthly taxable income
 */
function calculateTaxableIncome(salary) {
  if (!salary) return 0;

  let taxableIncome = 0;

  // Add basic salary (66.66% of gross - taxable)
  if (salary.basic) {
    taxableIncome += salary.basic;
  }

  // Add house rent allowance (23.34% of gross - taxable)
  if (salary.allowances && salary.allowances.housing) {
    taxableIncome += salary.allowances.housing;
  }

  // Add other allowances (all taxable except medical)
  if (salary.allowances) {
    if (salary.allowances.transport) {
      taxableIncome += salary.allowances.transport;
    }
    if (salary.allowances.meal) {
      taxableIncome += salary.allowances.meal;
    }
    if (salary.allowances.other) {
      taxableIncome += salary.allowances.other;
    }
  }

  // Medical allowance (10% of gross) is tax-exempt, so we don't add it
  // According to FBR 2025-2026: Only medical allowance is tax-exempt

  return taxableIncome;
}

/**
 * Get tax slab information for a given annual income
 * @param {number} annualIncome - Annual income
 * @returns {Promise<Object>} Tax slab information
 */
async function getTaxSlabInfo(annualIncome) {
  try {
    return await FBRTaxSlab.getTaxSlabInfo(annualIncome);
  } catch (error) {
    console.error('Error getting tax slab info:', error);
    return {
      slab: 'Error',
      rate: '0%',
      description: 'Unable to get tax slab information'
    };
  }
}

module.exports = {
  calculateMonthlyTax,
  calculateTaxableIncome,
  getTaxSlabInfo
}; 