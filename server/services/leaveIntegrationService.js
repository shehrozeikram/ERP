const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');

class LeaveIntegrationService {
  /**
   * Get employee leave summary for a specific year
   * @param {String} employeeId - Employee ID
   * @param {Number} year - Year (default: current year)
   * @returns {Object} Leave summary with balance and history
   */
  static async getEmployeeLeaveSummary(employeeId, year = new Date().getFullYear()) {
    try {
      // Get employee
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get or create leave balance
      const balance = await LeaveBalance.getOrCreateBalance(employeeId, year);

      // Get leave requests for the year
      const leaveRequests = await LeaveRequest.find({
        employee: employeeId,
        leaveYear: year,
        isActive: true
      })
        .populate('leaveType', 'name code color')
        .populate('approvedBy', 'firstName lastName')
        .populate('rejectedBy', 'firstName lastName')
        .sort({ appliedDate: -1 });

      // Calculate statistics
      const stats = {
        totalRequests: leaveRequests.length,
        approved: leaveRequests.filter(r => r.status === 'approved').length,
        pending: leaveRequests.filter(r => r.status === 'pending').length,
        rejected: leaveRequests.filter(r => r.status === 'rejected').length,
        totalDaysApproved: leaveRequests
          .filter(r => r.status === 'approved')
          .reduce((sum, r) => sum + r.totalDays, 0)
      };

      return {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email
        },
        year,
        balance: balance.getSummary(),
        leaveConfig: employee.leaveConfig,
        statistics: stats,
        history: leaveRequests
      };
    } catch (error) {
      throw new Error(`Failed to get employee leave summary: ${error.message}`);
    }
  }

  /**
   * Update employee leave configuration
   * @param {String} employeeId - Employee ID
   * @param {Object} config - Leave configuration
   * @returns {Object} Updated employee
   */
  static async updateEmployeeLeaveConfig(employeeId, config) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Update leave configuration
      if (config.annualLimit !== undefined) {
        employee.leaveConfig.annualLimit = config.annualLimit;
      }
      if (config.sickLimit !== undefined) {
        employee.leaveConfig.sickLimit = config.sickLimit;
      }
      if (config.casualLimit !== undefined) {
        employee.leaveConfig.casualLimit = config.casualLimit;
      }
      if (config.useGlobalDefaults !== undefined) {
        employee.leaveConfig.useGlobalDefaults = config.useGlobalDefaults;
      }

      // Save without validation to avoid required field errors
      await employee.save({ validateBeforeSave: false });

      // Update current year's balance allocation if needed
      const currentYear = new Date().getFullYear();
      const balance = await LeaveBalance.findOne({
        employee: employeeId,
        year: currentYear
      });

      if (balance && !employee.leaveConfig.useGlobalDefaults) {
        balance.annual.allocated = config.annualLimit || balance.annual.allocated;
        balance.sick.allocated = config.sickLimit || balance.sick.allocated;
        balance.casual.allocated = config.casualLimit || balance.casual.allocated;
        await balance.save();
      }

      return employee;
    } catch (error) {
      throw new Error(`Failed to update leave configuration: ${error.message}`);
    }
  }

  /**
   * Calculate advance leave deduction for payroll
   * @param {String} employeeId - Employee ID
   * @param {Number} year - Year
   * @param {Number} month - Month (1-12)
   * @param {Number} dailyRate - Employee's daily rate
   * @returns {Object} Deduction details
   */
  static async calculateAdvanceLeaveDeduction(employeeId, year, month, dailyRate) {
    try {
      // Get leave balance
      const balance = await LeaveBalance.getOrCreateBalance(employeeId, year);

      // Calculate deduction
      const deduction = balance.calculateAdvanceDeduction(dailyRate);

      return {
        totalAdvanceLeaves: balance.totalAdvanceLeaves,
        annualAdvance: balance.annual.advance,
        sickAdvance: balance.sick.advance,
        casualAdvance: balance.casual.advance,
        dailyRate,
        totalDeduction: deduction,
        breakdown: {
          annual: balance.annual.advance * dailyRate,
          sick: balance.sick.advance * dailyRate,
          casual: balance.casual.advance * dailyRate
        }
      };
    } catch (error) {
      throw new Error(`Failed to calculate advance leave deduction: ${error.message}`);
    }
  }

  /**
   * Update leave balance when a leave request is approved
   * @param {String} leaveRequestId - Leave request ID
   * @returns {Object} Updated balance
   */
  static async updateBalanceOnApproval(leaveRequestId) {
    try {
      const leaveRequest = await LeaveRequest.findById(leaveRequestId)
        .populate('leaveType', 'name code');

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.status !== 'approved') {
        throw new Error('Leave request is not approved');
      }

      // Update balance
      const balance = await LeaveBalance.updateBalanceForLeave(
        leaveRequest.employee,
        leaveRequest.leaveType.code,
        leaveRequest.totalDays,
        leaveRequest.leaveYear
      );

      // Also update employee's leaveBalance field for backward compatibility
      const employee = await Employee.findById(leaveRequest.employee);
      if (employee) {
        const typeMap = {
          'ANNUAL': 'annual',
          'AL': 'annual',
          'SICK': 'sick',
          'SL': 'sick',
          'CASUAL': 'casual',
          'CL': 'casual',
          'MEDICAL': 'sick',  // Medical maps to sick
          'ML': 'sick'
        };

        const balanceType = typeMap[leaveRequest.leaveType.code.toUpperCase()] || 'casual';
        
        if (employee.leaveBalance[balanceType]) {
          employee.leaveBalance[balanceType].used += leaveRequest.totalDays;
          
          const remaining = employee.leaveBalance[balanceType].allocated + 
                          employee.leaveBalance[balanceType].carriedForward - 
                          employee.leaveBalance[balanceType].used;
          
          if (remaining >= 0) {
            employee.leaveBalance[balanceType].remaining = remaining;
            employee.leaveBalance[balanceType].advance = 0;
          } else {
            employee.leaveBalance[balanceType].remaining = 0;
            employee.leaveBalance[balanceType].advance = Math.abs(remaining);
          }

          employee.lastLeaveBalanceUpdate = new Date();
          // Save without validation to avoid required field errors
          await employee.save({ validateBeforeSave: false });
        }
      }

      return balance;
    } catch (error) {
      throw new Error(`Failed to update balance on approval: ${error.message}`);
    }
  }

  /**
   * Sync leave balances from leave requests (for initialization or reconciliation)
   * @param {String} employeeId - Employee ID
   * @param {Number} year - Year
   * @returns {Object} Synced balance
   */
  static async syncLeaveBalance(employeeId, year) {
    try {
      const balance = await LeaveBalance.getOrCreateBalance(employeeId, year);

      // Get all approved leave requests for the year
      const approvedLeaves = await LeaveRequest.find({
        employee: employeeId,
        leaveYear: year,
        status: 'approved',
        isActive: true
      }).populate('leaveType', 'code');

      // Reset used days
      balance.annual.used = 0;
      balance.sick.used = 0;
      balance.casual.used = 0;

      // Calculate used days from approved leaves
      approvedLeaves.forEach(leave => {
        const typeMap = {
          'AL': 'annual',
          'SL': 'sick',
          'CL': 'casual',
          'ML': 'sick' // Map medical to sick
        };

        const balanceType = typeMap[leave.leaveType.code] || 'casual';
        balance[balanceType].used += leave.totalDays;
      });

      await balance.save();

      return balance;
    } catch (error) {
      throw new Error(`Failed to sync leave balance: ${error.message}`);
    }
  }

  /**
   * Initialize leave balance for a new employee
   * @param {String} employeeId - Employee ID
   * @returns {Object} Created balance
   */
  static async initializeEmployeeLeaveBalance(employeeId) {
    try {
      const currentYear = new Date().getFullYear();
      const balance = await LeaveBalance.getOrCreateBalance(employeeId, currentYear);
      return balance;
    } catch (error) {
      throw new Error(`Failed to initialize employee leave balance: ${error.message}`);
    }
  }

  /**
   * Get leave statistics for payroll period
   * @param {String} employeeId - Employee ID
   * @param {Number} year - Year
   * @param {Number} month - Month (1-12)
   * @returns {Object} Leave statistics for the month
   */
  static async getMonthlyLeaveStats(employeeId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month

      const leaves = await LeaveRequest.find({
        employee: employeeId,
        status: 'approved',
        isActive: true,
        $or: [
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } },
          { 
            startDate: { $lte: startDate },
            endDate: { $gte: endDate }
          }
        ]
      }).populate('leaveType', 'name code');

      // Calculate days that fall within the month
      let totalLeaveDays = 0;
      const leaveBreakdown = [];

      leaves.forEach(leave => {
        const leaveStart = leave.startDate > startDate ? leave.startDate : startDate;
        const leaveEnd = leave.endDate < endDate ? leave.endDate : endDate;
        
        const days = Math.ceil((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
        totalLeaveDays += days;

        leaveBreakdown.push({
          leaveType: leave.leaveType.name,
          startDate: leave.startDate,
          endDate: leave.endDate,
          daysInMonth: days
        });
      });

      return {
        totalLeaveDays,
        leaveBreakdown,
        leaves: leaves.length
      };
    } catch (error) {
      throw new Error(`Failed to get monthly leave stats: ${error.message}`);
    }
  }
}

module.exports = LeaveIntegrationService;

