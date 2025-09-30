const EmployeeIncrement = require('../models/hr/EmployeeIncrement');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');
const { calculateMonthlyTax } = require('../utils/taxCalculator');

class IncrementService {
  
  /**
   * Create a new increment request
   */
  async createIncrementRequest(incrementData, requestedBy) {
    try {
      const { employeeId, incrementType, newSalary, reason, effectiveDate } = incrementData;
      
      // Get employee current salary
      const employee = await Employee.findById(employeeId).select('salary.gross');
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      const previousSalary = employee.salary.gross;
      const incrementAmount = newSalary - previousSalary;
      const incrementPercentage = previousSalary > 0 ? 
        ((incrementAmount / previousSalary) * 100).toFixed(2) : 0;
      
      // Create increment request
      const increment = new EmployeeIncrement({
        employee: employeeId,
        incrementType,
        previousSalary,
        newSalary,
        incrementAmount,
        incrementPercentage,
        reason,
        effectiveDate: new Date(effectiveDate),
        requestedBy,
        status: 'pending'
      });
      
      await increment.save();
      
      // Populate employee details for response
      await increment.populate([
        { path: 'employee', select: 'employeeId firstName lastName department position' },
        { path: 'requestedBy', select: 'firstName lastName' }
      ]);
      
      return {
        success: true,
        data: increment,
        message: 'Increment request created successfully'
      };
      
    } catch (error) {
      console.error('Error creating increment request:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Approve increment request
   */
  async approveIncrement(incrementId, approvedBy, comments = '') {
    try {
      const increment = await EmployeeIncrement.findById(incrementId)
        .populate('employee');
      
      if (!increment) {
        throw new Error('Increment request not found');
      }
      
      if (increment.status !== 'pending') {
        throw new Error('Increment request is not pending');
      }
      
      // Update increment status
      increment.status = 'approved';
      increment.approvedBy = approvedBy;
      increment.comments = comments;
      await increment.save();
      
      // Update employee salary
      await this.updateEmployeeSalary(increment.employee._id, increment.newSalary);
      
      // Update future payrolls
      await this.updateFuturePayrolls(increment.employee._id, increment.newSalary);
      
      return {
        success: true,
        data: increment,
        message: 'Increment approved and implemented successfully'
      };
      
    } catch (error) {
      console.error('Error approving increment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Reject increment request
   */
  async rejectIncrement(incrementId, approvedBy, comments = '') {
    try {
      const increment = await EmployeeIncrement.findById(incrementId);
      
      if (!increment) {
        throw new Error('Increment request not found');
      }
      
      increment.status = 'rejected';
      increment.approvedBy = approvedBy;
      increment.comments = comments;
      await increment.save();
      
      return {
        success: true,
        data: increment,
        message: 'Increment request rejected'
      };
      
    } catch (error) {
      console.error('Error rejecting increment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Update employee salary and mark increment as implemented
   */
  async updateEmployeeSalary(employeeId, newSalary) {
    try {
      // Calculate new salary breakdown (66.66% basic, 10% medical, 23.34% house rent)
      const basicSalary = Math.round(newSalary * 0.6666);
      const medicalAllowance = Math.round(newSalary * 0.10);
      const houseRentAllowance = Math.round(newSalary * 0.2334);
      
      // Update employee salary
      await Employee.findByIdAndUpdate(employeeId, {
        'salary.gross': newSalary,
        'salary.basic': basicSalary,
        'salary.medical': medicalAllowance,
        'salary.houseRent': houseRentAllowance
      });
      
      // Mark increment as implemented
      await EmployeeIncrement.updateMany(
        { employee: employeeId, status: 'approved' },
        { status: 'implemented' }
      );
      
      console.log(`✅ Employee ${employeeId} salary updated to Rs. ${newSalary}`);
      
    } catch (error) {
      console.error('Error updating employee salary:', error);
      throw error;
    }
  }
  
  /**
   * Update future payrolls with new salary
   */
  async updateFuturePayrolls(employeeId, newSalary) {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Find future payrolls (current month onwards)
      const futurePayrolls = await Payroll.find({
        employee: employeeId,
        $or: [
          { year: { $gt: currentYear } },
          { year: currentYear, month: { $gte: currentMonth } }
        ]
      });
      
      // Calculate new salary components
      const basicSalary = Math.round(newSalary * 0.6666);
      const medicalAllowance = Math.round(newSalary * 0.10);
      const houseRentAllowance = Math.round(newSalary * 0.2334);
      
      // Update each future payroll
      for (const payroll of futurePayrolls) {
        payroll.basicSalary = basicSalary;
        payroll.medicalAllowance = medicalAllowance;
        payroll.houseRentAllowance = houseRentAllowance;
        
        // Recalculate gross salary
        payroll.grossSalary = basicSalary + medicalAllowance + houseRentAllowance;
        
        // Recalculate total earnings
        const additionalAllowances = 
          (payroll.allowances?.conveyance?.isActive ? payroll.allowances.conveyance.amount : 0) +
          (payroll.allowances?.food?.isActive ? payroll.allowances.food.amount : 0) +
          (payroll.allowances?.vehicleFuel?.isActive ? payroll.allowances.vehicleFuel.amount : 0) +
          (payroll.allowances?.special?.isActive ? payroll.allowances.special.amount : 0) +
          (payroll.allowances?.other?.isActive ? payroll.allowances.other.amount : 0);
        
        payroll.totalEarnings = payroll.grossSalary + additionalAllowances + 
          (payroll.overtimeAmount || 0) + 
          (payroll.performanceBonus || 0) + 
          (payroll.otherBonus || 0);
        
        // Recalculate tax (simplified calculation)
        const medicalAllowanceForTax = Math.round(payroll.totalEarnings * 0.10);
        const taxableIncome = payroll.totalEarnings - medicalAllowanceForTax;
        const annualTaxableIncome = taxableIncome * 12;
        
        let annualTax = 0;
        if (annualTaxableIncome <= 600000) {
          annualTax = 0;
        } else if (annualTaxableIncome <= 1200000) {
          annualTax = (annualTaxableIncome - 600000) * 0.01;
        } else if (annualTaxableIncome <= 2200000) {
          annualTax = 6000 + (annualTaxableIncome - 1200000) * 0.11;
        } else if (annualTaxableIncome <= 3200000) {
          annualTax = 116000 + (annualTaxableIncome - 2200000) * 0.23;
        } else if (annualTaxableIncome <= 4100000) {
          annualTax = 346000 + (annualTaxableIncome - 3200000) * 0.30;
        } else {
          annualTax = 616000 + (annualTaxableIncome - 4100000) * 0.35;
        }
        
        payroll.incomeTax = Math.round(annualTax / 12);
        
        // Recalculate total deductions
        payroll.totalDeductions = (payroll.incomeTax || 0) + 
          (payroll.eobi || 370) + 
          (payroll.healthInsurance || 0) + 
          (payroll.attendanceDeduction || 0) + 
          (payroll.otherDeductions || 0);
        
        // Recalculate net salary
        payroll.netSalary = payroll.totalEarnings - payroll.totalDeductions;
        
        await payroll.save();
      }
      
      console.log(`✅ Updated ${futurePayrolls.length} future payrolls for employee ${employeeId}`);
      
    } catch (error) {
      console.error('Error updating future payrolls:', error);
      throw error;
    }
  }
  
  /**
   * Get employee increment history
   */
  async getEmployeeIncrementHistory(employeeId) {
    try {
      const increments = await EmployeeIncrement.find({ employee: employeeId })
        .populate('requestedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .sort({ requestDate: -1 });
      
      return {
        success: true,
        data: increments
      };
      
    } catch (error) {
      console.error('Error getting increment history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get all increment requests
   */
  async getAllIncrements() {
    try {
      const increments = await EmployeeIncrement.find({})
        .populate('employee', 'employeeId firstName lastName')
        .populate('requestedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .sort({ requestDate: -1 });
      
      return {
        success: true,
        data: increments
      };
      
    } catch (error) {
      console.error('Error getting all increments:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get pending increment requests
   */
  async getPendingIncrements() {
    try {
      const increments = await EmployeeIncrement.getPendingIncrements();
      
      return {
        success: true,
        data: increments
      };
      
    } catch (error) {
      console.error('Error getting pending increments:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get employee's current salary (with latest increment applied)
   */
  async getEmployeeCurrentSalary(employeeId) {
    try {
      const latestIncrement = await EmployeeIncrement.getLatestIncrement(employeeId);
      
      if (latestIncrement) {
        return {
          success: true,
          data: {
            currentSalary: latestIncrement.newSalary,
            lastIncrementDate: latestIncrement.effectiveDate,
            incrementType: latestIncrement.incrementType
          }
        };
      }
      
      // Fallback to employee master salary
      const employee = await Employee.findById(employeeId).select('salary.gross');
      return {
        success: true,
        data: {
          currentSalary: employee.salary.gross,
          lastIncrementDate: null,
          incrementType: null
        }
      };
      
    } catch (error) {
      console.error('Error getting current salary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get increment by ID
   */
  async getIncrementById(incrementId) {
    try {
      const increment = await EmployeeIncrement.findById(incrementId)
        .populate('employee', 'employeeId firstName lastName department position')
        .populate('requestedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName');
      
      if (!increment) {
        return {
          success: false,
          error: 'Increment not found'
        };
      }
      
      return {
        success: true,
        data: increment
      };
      
    } catch (error) {
      console.error('Error getting increment by ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new IncrementService();
