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

      // Calculate current work year
      const currentWorkYear = this.calculateWorkYear(employee.hireDate);
      
      // Get or create leave balance for current work year
      const balance = await this.getWorkYearBalance(employeeId, currentWorkYear);

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

      // Sync balance with approved leave requests
      await this.syncBalanceWithLeaveRequests(balance, leaveRequests);

      // Get anniversary information
      const anniversaryInfo = await this.getEmployeeAnniversaryInfo(employeeId);

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
          email: employee.email,
          hireDate: employee.hireDate
        },
        year,
        workYear: currentWorkYear,
        balance: balance.getSummary(),
        leaveConfig: employee.leaveConfig,
        anniversaryInfo: anniversaryInfo,
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
   * Sync balance with approved leave requests
   * @param {Object} balance - Leave balance document
   * @param {Array} leaveRequests - Array of leave requests
   */
  static async syncBalanceWithLeaveRequests(balance, leaveRequests) {
    try {
      // Reset used days to 0
      balance.annual.used = 0;
      balance.sick.used = 0;
      balance.casual.used = 0;

      // Update balance for each approved leave
      const approvedLeaves = leaveRequests.filter(r => r.status === 'approved');
      for (const leave of approvedLeaves) {
        if (leave.leaveType && leave.leaveType.code) {
          const typeMap = {
            'ANNUAL': 'annual',
            'AL': 'annual',
            'annual': 'annual',
            'SICK': 'sick',
            'SL': 'sick',
            'sick': 'sick',
            'CASUAL': 'casual',
            'CL': 'casual',
            'casual': 'casual',
            'MEDICAL': 'sick',
            'ML': 'sick',
            'medical': 'sick'
          };

          const balanceType = typeMap[leave.leaveType.code] || typeMap[leave.leaveType.code.toUpperCase()] || 'casual';
          balance[balanceType].used += leave.totalDays;
        }
      }

      // Save the updated balance
      await balance.save();
    } catch (error) {
      console.error('Error syncing balance with leave requests:', error);
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

  /**
   * Calculate work year based on hire date
   * @param {Date} hireDate - Employee hire date
   * @param {Date} currentDate - Current date (default: now)
   * @returns {Number} Work year number
   */
  static calculateWorkYear(hireDate, currentDate = new Date()) {
    const years = currentDate.getFullYear() - hireDate.getFullYear();
    const months = currentDate.getMonth() - hireDate.getMonth();
    
    if (months < 0 || (months === 0 && currentDate.getDate() < hireDate.getDate())) {
      return years; // Haven't reached anniversary yet
    }
    return years + 1; // Completed this many work years
  }

  /**
   * Process anniversary-based leave allocation for an employee
   * @param {String} employeeId - Employee ID
   * @param {Number} workYear - Work year to allocate for
   * @returns {Object} Created leave balance
   */
  static async processAnniversaryAllocation(employeeId, workYear) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const currentYear = new Date().getFullYear();
      
      // Check if balance already exists for this work year
      const existingBalance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear
      });

      if (existingBalance) {
        return existingBalance;
      }

      // Calculate allocation based on work year
      const allocation = LeaveBalance.calculateAnniversaryAllocation(workYear, employee.leaveConfig);
      
      // Set expiration date for annual leaves (2 years from allocation)
      const expirationDate = new Date(currentYear + 2, 11, 31);

      // Create new balance
      const balance = new LeaveBalance({
        employee: employeeId,
        year: currentYear,
        workYear: workYear,
        expirationDate: expirationDate,
        isCarriedForward: false,
        annual: {
          allocated: allocation.annual,
          used: 0,
          remaining: allocation.annual,
          carriedForward: 0,
          advance: 0
        },
        sick: {
          allocated: allocation.sick,
          used: 0,
          remaining: allocation.sick,
          carriedForward: 0,
          advance: 0
        },
        casual: {
          allocated: allocation.casual,
          used: 0,
          remaining: allocation.casual,
          carriedForward: 0,
          advance: 0
        }
      });

      await balance.save();
      return balance;
    } catch (error) {
      throw new Error(`Failed to process anniversary allocation: ${error.message}`);
    }
  }

  /**
   * Process anniversary renewals for all employees
   * @returns {Object} Processing results
   */
  static async processAnniversaryRenewals() {
    try {
      const today = new Date();
      const employees = await Employee.find({ 
        isActive: true,
        hireDate: { $exists: true }
      });

      const results = {
        processed: 0,
        renewed: 0,
        errors: []
      };

      for (const employee of employees) {
        try {
          const currentWorkYear = this.calculateWorkYear(employee.hireDate, today);
          
          // Check if employee has reached a new work year
          const lastBalance = await LeaveBalance.findOne({
            employee: employee._id
          }).sort({ workYear: -1 });

          if (!lastBalance || lastBalance.workYear < currentWorkYear) {
            // Process new work year allocation
            await this.processAnniversaryAllocation(employee._id, currentWorkYear);
            results.renewed++;
          }
          
          results.processed++;
        } catch (error) {
          results.errors.push({
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to process anniversary renewals: ${error.message}`);
    }
  }

  /**
   * Expire old annual leaves (older than 2 years)
   * @returns {Number} Number of expired balances
   */
  static async expireOldAnnualLeaves() {
    try {
      return await LeaveBalance.expireOldAnnualLeaves();
    } catch (error) {
      throw new Error(`Failed to expire old annual leaves: ${error.message}`);
    }
  }

  /**
   * Get employee's anniversary information
   * @param {String} employeeId - Employee ID
   * @returns {Object} Anniversary information
   */
  static async getEmployeeAnniversaryInfo(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const today = new Date();
      const workYear = this.calculateWorkYear(employee.hireDate, today);
      
      // Calculate next anniversary date
      const nextAnniversary = new Date(employee.hireDate);
      nextAnniversary.setFullYear(today.getFullYear() + 1);
      
      // If next anniversary has passed this year, it's next year
      if (nextAnniversary <= today) {
        nextAnniversary.setFullYear(today.getFullYear() + 1);
      }

      const daysToAnniversary = Math.ceil((nextAnniversary - today) / (1000 * 60 * 60 * 24));

      return {
        hireDate: employee.hireDate,
        currentWorkYear: workYear,
        nextAnniversary: nextAnniversary,
        daysToAnniversary: daysToAnniversary,
        isAnniversaryThisMonth: nextAnniversary.getMonth() === today.getMonth() && 
                               nextAnniversary.getFullYear() === today.getFullYear()
      };
    } catch (error) {
      throw new Error(`Failed to get anniversary info: ${error.message}`);
    }
  }

  /**
   * Get leave balance for specific work year
   * @param {String} employeeId - Employee ID
   * @param {Number} workYear - Work year
   * @returns {Object} Leave balance for work year
   */
  static async getWorkYearBalance(employeeId, workYear) {
    try {
      const balance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear
      });

      if (!balance) {
        // Create balance for the work year if it doesn't exist
        return await this.processAnniversaryAllocation(employeeId, workYear);
      }

      return balance;
    } catch (error) {
      throw new Error(`Failed to get work year balance: ${error.message}`);
    }
  }
}

module.exports = LeaveIntegrationService;

