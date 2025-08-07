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
 * Calculate taxable income based on Pakistan FBR 2025-2026 rules:
 * - Calculate total gross amount (basic + all allowances)
 * - Deduct 10% of total gross as medical allowance (tax-exempt)
 * - Calculate tax on remaining amount
 * @param {Object} salary - Salary object with basic, allowances, etc.
 * @returns {number} Monthly taxable income
 */
function calculateTaxableIncome(salary) {
  if (!salary) return 0;

  // Calculate total gross amount (basic + all allowances)
  let totalGrossAmount = 0;

  // Add basic salary
  if (salary.basic) {
    totalGrossAmount += salary.basic;
  }

  // Add all allowances
  if (salary.allowances) {
    // Handle both old structure (direct amounts) and new structure (with isActive)
    if (typeof salary.allowances.transport === 'number') {
      totalGrossAmount += salary.allowances.transport;
    } else if (salary.allowances.transport?.isActive) {
      totalGrossAmount += salary.allowances.transport.amount || 0;
    }
    
    if (typeof salary.allowances.meal === 'number') {
      totalGrossAmount += salary.allowances.meal;
    } else if (salary.allowances.meal?.isActive) {
      totalGrossAmount += salary.allowances.meal.amount || 0;
    }
    
    if (typeof salary.allowances.food === 'number') {
      totalGrossAmount += salary.allowances.food;
    } else if (salary.allowances.food?.isActive) {
      totalGrossAmount += salary.allowances.food.amount || 0;
    }
    
    if (typeof salary.allowances.vehicleFuel === 'number') {
      totalGrossAmount += salary.allowances.vehicleFuel;
    } else if (salary.allowances.vehicleFuel?.isActive) {
      totalGrossAmount += salary.allowances.vehicleFuel.amount || 0;
    }
    
    if (typeof salary.allowances.other === 'number') {
      totalGrossAmount += salary.allowances.other;
    } else if (salary.allowances.other?.isActive) {
      totalGrossAmount += salary.allowances.other.amount || 0;
    }
    
    if (typeof salary.allowances.medical === 'number') {
      totalGrossAmount += salary.allowances.medical;
    } else if (salary.allowances.medical?.isActive) {
      totalGrossAmount += salary.allowances.medical.amount || 0;
    }
  }

  // Calculate medical allowance as 10% of total gross amount
  const medicalAllowance = totalGrossAmount * 0.10; // 10% of total gross (tax-exempt)

  // Calculate taxable income by deducting medical allowance
  const taxableIncome = totalGrossAmount - medicalAllowance;

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