const Payroll = require('../models/hr/Payroll');

/**
 * Simple Monthly Tax Update Service
 * Uses the simple calculateTax method from Payroll model
 */
class MonthlyTaxUpdateService {
  
  /**
   * Update taxes for all payrolls in a specific month/year
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {boolean} forceUpdate - Force update even if tax already exists
   * @returns {Object} Update results
   */
  static async updateMonthlyTaxes(month, year, forceUpdate = false) {
    try {
      console.log(`🔄 Starting Monthly Tax Update for ${month}/${year}...`);
      
      // Find all payrolls for the specified month/year
      const payrolls = await Payroll.find({ month, year })
        .populate('employee', 'firstName lastName employeeId department salary allowances');
      
      if (payrolls.length === 0) {
        return {
          success: false,
          message: `No payrolls found for ${month}/${year}`,
          updatedCount: 0,
          errorCount: 0,
          totalCount: 0
        };
      }
      
      console.log(`📊 Found ${payrolls.length} payrolls for ${month}/${year}`);
      
      let updatedCount = 0;
      let errorCount = 0;
      const results = [];
      
      // Process each payroll
      for (const payroll of payrolls) {
        try {
          const result = await this.updatePayrollTax(payroll, forceUpdate);
          results.push(result);
          
          if (result.success) {
            updatedCount++;
          } else {
            errorCount++;
          }
          
          // Log progress
          console.log(`📝 ${payroll.employee?.employeeId || 'Unknown'} - ${result.success ? '✅ Updated' : '❌ Failed'}: ${result.message}`);
          
        } catch (error) {
          console.error(`❌ Error updating payroll ${payroll._id}:`, error);
          errorCount++;
          results.push({
            payrollId: payroll._id,
            employeeId: payroll.employee?.employeeId || 'Unknown',
            success: false,
            message: `Error: ${error.message}`,
            oldTax: payroll.incomeTax,
            newTax: null
          });
        }
      }
      
      // Summary
      const summary = {
        success: true,
        message: `Monthly tax update completed for ${month}/${year}`,
        month,
        year,
        totalCount: payrolls.length,
        updatedCount,
        errorCount,
        results
      };
      
      console.log(`🎯 Monthly Tax Update Summary for ${month}/${year}:`);
      console.log(`   Total Payrolls: ${summary.totalCount}`);
      console.log(`   Successfully Updated: ${summary.updatedCount}`);
      console.log(`   Failed: ${summary.errorCount}`);
      
      return summary;
      
    } catch (error) {
      console.error('❌ Monthly Tax Update Service Error:', error);
      return {
        success: false,
        message: `Service error: ${error.message}`,
        updatedCount: 0,
        errorCount: 0,
        totalCount: 0
      };
    }
  }
  
  /**
   * Update tax for a single payroll using simple calculateTax method
   * @param {Object} payroll - Payroll document
   * @param {boolean} forceUpdate - Force update even if tax already exists
   * @returns {Object} Update result
   */
  static async updatePayrollTax(payroll, forceUpdate = false) {
    try {
      const oldTax = payroll.incomeTax;
      
      // Check if we should update
      if (!forceUpdate && payroll.incomeTax && payroll.totalEarnings) {
        return {
          payrollId: payroll._id,
          employeeId: payroll.employee?.employeeId || 'Unknown',
          success: true,
          message: 'Tax already calculated and up-to-date',
          oldTax,
          newTax: oldTax,
          updated: false
        };
      }
      
      // Simple tax calculation - same as deduction section
      const newTax = payroll.calculateTax();
      
      // Update the payroll with new tax
      payroll.incomeTax = newTax;
      
      // Also recalculate total deductions and net salary
      payroll.totalDeductions = 
        (payroll.incomeTax || 0) + 
        (payroll.healthInsurance || 0) + 
        (payroll.vehicleLoanDeduction || 0) +
        (payroll.companyLoanDeduction || 0) +
        (payroll.eobi || 0) + 
        (payroll.attendanceDeduction || 0) + 
        (payroll.otherDeductions || 0);
      
      payroll.netSalary = payroll.totalEarnings - payroll.totalDeductions;
      
      // Save the updated payroll
      await payroll.save();
      
      return {
        payrollId: payroll._id,
        employeeId: payroll.employee?.employeeId || 'Unknown',
        success: true,
        message: 'Tax updated successfully',
        oldTax,
        newTax,
        updated: true
      };
      
    } catch (error) {
      console.error(`❌ Error updating tax for payroll ${payroll._id}:`, error);
      return {
        payrollId: payroll._id,
        employeeId: payroll.employee?.employeeId || 'Unknown',
        success: false,
        message: `Calculation error: ${error.message}`,
        oldTax: payroll.incomeTax,
        newTax: null,
        updated: false
      };
    }
  }
  
  /**
   * Update taxes for the current month
   * @returns {Object} Update results
   */
  static async updateCurrentMonthTaxes() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const currentYear = now.getFullYear();
    
    return await this.updateMonthlyTaxes(currentMonth, currentYear);
  }
  
  /**
   * Update taxes for the previous month
   * @returns {Object} Update results
   */
  static async updatePreviousMonthTaxes() {
    const now = new Date();
    let previousMonth = now.getMonth(); // getMonth() returns 0-11
    let previousYear = now.getFullYear();
    
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear--;
    }
    
    return await this.updateMonthlyTaxes(previousMonth, previousYear);
  }
  
  /**
   * Get tax calculation summary for a month
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Tax summary
   */
  static async getMonthlyTaxSummary(month, year) {
    try {
      const payrolls = await Payroll.find({ month, year })
        .select('incomeTax totalEarnings employee')
        .populate('employee', 'employeeId firstName lastName');
      
      if (payrolls.length === 0) {
        return {
          month,
          year,
          totalPayrolls: 0,
          totalTax: 0,
          averageTax: 0,
          payrolls: []
        };
      }
      
      const totalTax = payrolls.reduce((sum, p) => sum + (p.incomeTax || 0), 0);
      const averageTax = totalTax / payrolls.length;
      
      return {
        month,
        year,
        totalPayrolls: payrolls.length,
        totalTax,
        averageTax: Math.round(averageTax),
        payrolls: payrolls.map(p => ({
          employeeId: p.employee?.employeeId,
          employeeName: `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.trim(),
          totalEarnings: p.totalEarnings,
          incomeTax: p.incomeTax
        }))
      };
      
    } catch (error) {
      console.error('❌ Error getting monthly tax summary:', error);
      throw error;
    }
  }
}

module.exports = MonthlyTaxUpdateService;
