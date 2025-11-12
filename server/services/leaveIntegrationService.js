const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');

class LeaveIntegrationService {
  /**
   * Get employee leave summary for a specific work year
   * @param {String} employeeId - Employee ID
   * @param {Number} workYear - Work year (optional, defaults to current work year)
   * @param {Number} year - Calendar year (optional, for backward compatibility - will calculate workYear from this)
   * @returns {Object} Leave summary with balance and history
   */
  static async getEmployeeLeaveSummary(employeeId, workYear = null, year = null) {
    try {
      // Get employee
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const hireDate = employee.hireDate || employee.joiningDate;
      if (!hireDate) {
        throw new Error('Employee does not have a hire date');
      }

      // Calculate work year if not provided
      let targetWorkYear = workYear;
      let targetYear = year;
      
      if (targetWorkYear === null) {
        if (targetYear !== null) {
          // Calculate work year from calendar year
          // The calendar year represents the anniversary year (when the work year period ends)
          // Work Year 0: Nov 01, 2023 - Nov 01, 2024 -> anniversary year = 2024
          // Work Year 1: Nov 01, 2024 - Nov 01, 2025 -> anniversary year = 2025
          // Formula: workYear = anniversaryYear - hireYear - 1
          const hireDateObj = new Date(hireDate);
          const hireYear = hireDateObj.getFullYear();
          targetWorkYear = targetYear - hireYear - 1;
          
          // Ensure workYear is not negative
          targetWorkYear = Math.max(0, targetWorkYear);
        } else {
          // Default to current work year
          targetWorkYear = this.calculateWorkYear(hireDate);
          const hireDateObj = new Date(hireDate);
          targetYear = hireDateObj.getFullYear() + targetWorkYear + 1; // Anniversary year
        }
      } else {
        // Work year provided, calculate the calendar year (anniversary year)
        const hireDateObj = new Date(hireDate);
        targetYear = hireDateObj.getFullYear() + targetWorkYear + 1;
      }
      
      // Get or create leave balance for the work year
      const balance = await this.getWorkYearBalance(employeeId, targetWorkYear);

      // Get leave requests for the work year (not calendar year)
      const leaveRequests = await LeaveRequest.find({
        employee: employeeId,
        workYear: targetWorkYear,
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

      // Calculate work year period dates
      const hireDateObj = new Date(hireDate);
      const workYearStartDate = new Date(hireDateObj.getFullYear() + targetWorkYear, hireDateObj.getMonth(), hireDateObj.getDate());
      const workYearEndDate = new Date(hireDateObj.getFullYear() + targetWorkYear + 1, hireDateObj.getMonth(), hireDateObj.getDate());

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
        year: targetYear,
        workYear: targetWorkYear,
        workYearPeriod: {
          startDate: workYearStartDate,
          endDate: workYearEndDate
        },
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

      // If it's an annual leave, recalculate carry forward for next work year
      if (leaveRequest.leaveType.code === 'ANNUAL' || leaveRequest.leaveType.code === 'AL') {
        await this.recalculateCarryForwardForNextYear(
          leaveRequest.employee, 
          leaveRequest.leaveYear, 
          leaveRequest.workYear
        );
      }

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
   * Recalculate carry forward for next work year after annual leave approval
   * Uses workYear (anniversary-based) instead of calendar year
   * @param {String} employeeId - Employee ID
   * @param {Number} currentLeaveYear - Current leave year (anniversary year)
   * @param {Number} currentWorkYear - Current work year (optional, will be calculated if not provided)
   */
  static async recalculateCarryForwardForNextYear(employeeId, currentLeaveYear, currentWorkYear = null) {
    try {
      // Get employee to calculate workYear if not provided
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return; // Employee not found, skip
      }

      // Get current work year balance
      // First try to find by workYear if provided
      let currentBalance;
      if (currentWorkYear !== null) {
        currentBalance = await LeaveBalance.findOne({
          employee: employeeId,
          workYear: currentWorkYear
        });
      } else {
        // Otherwise, find by leaveYear (anniversary year)
        currentBalance = await LeaveBalance.findOne({
          employee: employeeId,
          year: currentLeaveYear
        });
        
        // If found by year, get its workYear
        if (currentBalance && currentBalance.workYear !== undefined) {
          currentWorkYear = currentBalance.workYear;
        } else {
          // Calculate workYear from leave request's workYear
          // This should have been set during import
          return; // Can't determine work year, skip
        }
      }

      if (!currentBalance) {
        return; // No balance found, skip
      }

      // Get next work year balance (workYear + 1)
      const nextWorkYear = currentWorkYear + 1;
      let nextBalance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: nextWorkYear
      });

      // If next balance doesn't exist, try to create it
      if (!nextBalance) {
        const CarryForwardService = require('./carryForwardService');
        try {
          nextBalance = await CarryForwardService.ensureWorkYearBalance(employeeId, nextWorkYear);
        } catch (error) {
          // If creation fails, skip (balance will be created on anniversary)
          return;
        }
      }

      // Calculate carry forward with 40-day total cap
      // Formula: carry forward = min(previous remaining, 20, 40 - new allocation)
      const newAllocation = nextBalance.annual.allocated;
      const individualCap = Math.min(currentBalance.annual.remaining, 20);
      const maxCarryForwardWithTotalCap = Math.max(0, 40 - newAllocation); // Ensure non-negative
      const carryForward = Math.min(individualCap, maxCarryForwardWithTotalCap);

      // Only update if carry forward has changed
      if (nextBalance.annual.carriedForward !== carryForward) {
        nextBalance.annual.carriedForward = carryForward;
        nextBalance.isCarriedForward = carryForward > 0;
        await nextBalance.save();

        const total = newAllocation + carryForward;
        console.log(`✅ Updated carry forward for Work Year ${nextWorkYear}: ${carryForward} days (from Work Year ${currentWorkYear} remaining: ${currentBalance.annual.remaining}, new allocation: ${newAllocation}, total: ${total} ≤ 40)`);
      }
    } catch (error) {
      console.error(`Error recalculating carry forward for next work year:`, error);
      // Don't throw error, just log it
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
    const days = currentDate.getDate() - hireDate.getDate();
    
    // Check if anniversary has passed this year
    if (months < 0 || (months === 0 && days < 0)) {
      return Math.max(0, years - 1); // Haven't reached anniversary yet
    }
    return years; // Completed this many work years (anniversary has passed)
  }

  /**
   * Get available work years for an employee
   * @param {String} employeeId - Employee ID
   * @returns {Array} Array of work year objects with period information
   */
  static async getAvailableWorkYears(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const hireDate = employee.hireDate || employee.joiningDate;
      if (!hireDate) {
        throw new Error('Employee does not have a hire date');
      }

      const hireDateObj = new Date(hireDate);
      const currentWorkYear = this.calculateWorkYear(hireDate);
      const workYears = [];

      const today = new Date();
      let currentWorkYearValue = null;

      // Get all work years from 0 to current + 1 (to show next year)
      for (let wy = 0; wy <= currentWorkYear + 1; wy++) {
        const workYearStart = new Date(hireDateObj.getFullYear() + wy, hireDateObj.getMonth(), hireDateObj.getDate());
        const workYearEnd = new Date(hireDateObj.getFullYear() + wy + 1, hireDateObj.getMonth(), hireDateObj.getDate());
        const anniversaryYear = hireDateObj.getFullYear() + wy + 1;

        // Check if today falls within this work year period
        const isCurrent = today >= workYearStart && today < workYearEnd;
        if (isCurrent) {
          currentWorkYearValue = wy;
        }

        workYears.push({
          workYear: wy,
          year: anniversaryYear, // Calendar year when anniversary occurs
          startDate: workYearStart,
          endDate: workYearEnd,
          label: `${workYearStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${workYearEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          isCurrent: isCurrent
        });
      }

      return workYears.reverse(); // Most recent first
    } catch (error) {
      throw new Error(`Failed to get available work years: ${error.message}`);
    }
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

      // Calculate the correct year for this work year
      const hireDate = employee.hireDate;
      const workYearStartDate = new Date(hireDate.getFullYear() + workYear, hireDate.getMonth(), hireDate.getDate());
      const workYearEndDate = new Date(hireDate.getFullYear() + workYear + 1, hireDate.getMonth(), hireDate.getDate());
      
      // Use the year that contains the work year
      const year = workYearStartDate.getFullYear();
      
      // Check if balance already exists for this work year
      const existingBalance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear
      });

      if (existingBalance) {
        return existingBalance;
      }

      // Also check if balance exists for this year (to prevent duplicate key errors)
      const existingYearBalance = await LeaveBalance.findOne({
        employee: employeeId,
        year: year
      });

      if (existingYearBalance) {
        // Update the existing record with workYear if it's missing
        if (!existingYearBalance.workYear) {
          existingYearBalance.workYear = workYear;
          await existingYearBalance.save();
        }
        return existingYearBalance;
      }

      // Calculate allocation based on work year
      const allocation = LeaveBalance.calculateAnniversaryAllocation(workYear, employee.leaveConfig);
      
      // Calculate carry forward ONLY for annual leaves (with 40-day cap)
      // Sick and Casual leaves reset completely on anniversary - NO CARRY FORWARD
      const CarryForwardService = require('./carryForwardService');
      let annualCarryForward = 0;
      if (workYear > 0) {
        const carryForwardResult = await CarryForwardService.calculateCarryForward(employeeId, workYear, allocation.annual);
        annualCarryForward = carryForwardResult.annual;
      }
      
      // Set expiration date for annual leaves (2 years from allocation)
      const expirationDate = new Date(year + 2, 11, 31);

      // Create new balance
      const balance = new LeaveBalance({
        employee: employeeId,
        year: year,
        workYear: workYear,
        expirationDate: expirationDate,
        isCarriedForward: annualCarryForward > 0, // Only true if annual leaves have carry forward
        annual: {
          allocated: allocation.annual,
          used: 0,
          remaining: 0, // Will be calculated by pre-save middleware (allocated + carriedForward - used)
          carriedForward: annualCarryForward, // ONLY annual leaves have carry forward (with 40-day cap)
          advance: 0
        },
        sick: {
          allocated: allocation.sick,
          used: 0,
          remaining: 0, // Will be calculated by pre-save middleware
          carriedForward: 0, // NO CARRY FORWARD - resets completely on anniversary
          advance: 0
        },
        casual: {
          allocated: allocation.casual,
          used: 0,
          remaining: 0, // Will be calculated by pre-save middleware
          carriedForward: 0, // NO CARRY FORWARD - resets completely on anniversary
          advance: 0
        }
      });

      await balance.save();
      return balance;
    } catch (error) {
      // Handle duplicate key error specifically
      if (error.code === 11000) {
        // Duplicate key error - try to find and return existing record
        const existingBalance = await LeaveBalance.findOne({
          employee: employeeId,
          workYear: workYear
        });
        
        if (existingBalance) {
          return existingBalance;
        }
      }
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
      return await LeaveBalance.getOrCreateBalanceWithCarryForward(employeeId, workYear);
    } catch (error) {
      throw new Error(`Failed to get work year balance: ${error.message}`);
    }
  }
}

module.exports = LeaveIntegrationService;

