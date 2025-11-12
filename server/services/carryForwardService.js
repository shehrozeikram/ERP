const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');

/**
 * Carry Forward Service
 * Handles automatic calculation and management of leave carry forward
 * based on employee hire date and work years
 */
class CarryForwardService {
  /**
   * Calculate carry forward for a specific work year
   * @param {ObjectId} employeeId - Employee ID
   * @param {number} workYear - Work year to calculate carry forward for
   * @param {number} newAllocation - New annual leave allocation for this work year (default: 20)
   * @returns {Object} Carry forward calculation result
   */
  static async calculateCarryForward(employeeId, workYear, newAllocation = 20) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // For work year 0 (hire year), no carry forward
      if (workYear === 0) {
        return {
          annual: 0,
          sick: 0,
          casual: 0,
          reason: 'Work year 0 - no carry forward'
        };
      }

      // Get previous work year's balance
      const previousWorkYearBalance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear - 1
      });

      if (!previousWorkYearBalance) {
        // If no previous balance exists, create it first
        await this.ensureWorkYearBalance(employeeId, workYear - 1);
        const newPreviousBalance = await LeaveBalance.findOne({
          employee: employeeId,
          workYear: workYear - 1
        });
        
        return this.calculateFromBalance(newPreviousBalance, workYear, newAllocation);
      }

      return this.calculateFromBalance(previousWorkYearBalance, workYear, newAllocation);
    } catch (error) {
      throw new Error(`Failed to calculate carry forward: ${error.message}`);
    }
  }

  /**
   * Calculate carry forward from a specific balance
   * @param {Object} balance - Previous work year balance
   * @param {number} workYear - Current work year
   * @param {number} newAllocation - New annual leave allocation for this work year (default: 20)
   * @returns {Object} Carry forward calculation
   */
  static calculateFromBalance(balance, workYear, newAllocation = 20) {
    const result = {
      annual: 0,
      sick: 0,
      casual: 0,
      reason: `Calculated from work year ${workYear - 1}`
    };

    // Annual leave carry forward with two caps:
    // 1. Individual cap: carry forward cannot exceed 20 days
    // 2. Total cap: new allocation + carry forward cannot exceed 40 days
    // Formula: carry forward = min(previous remaining, 20, 40 - new allocation)
    if (balance.annual.remaining > 0) {
      const individualCap = Math.min(balance.annual.remaining, 20);
      const maxCarryForwardWithTotalCap = Math.max(0, 40 - newAllocation); // Ensure non-negative
      result.annual = Math.min(individualCap, maxCarryForwardWithTotalCap);
      
      if (balance.annual.remaining > 20) {
        result.reason += ` (carrying forward ${result.annual} days from ${balance.annual.remaining} remaining, capped at 20 days and total cap of 40)`;
      } else if (result.annual < balance.annual.remaining) {
        result.reason += ` (carrying forward ${result.annual} days from ${balance.annual.remaining} remaining, capped by 40-day total limit: ${newAllocation} + ${result.annual} = ${newAllocation + result.annual} ≤ 40)`;
      } else {
        result.reason += ` (carrying forward ${result.annual} days from remaining)`;
      }
    }

    // Sick leave - NO CARRY FORWARD
    result.sick = 0;

    // Casual leave - NO CARRY FORWARD
    result.casual = 0;

    return result;
  }

  /**
   * Ensure a work year balance exists for an employee
   * @param {ObjectId} employeeId - Employee ID
   * @param {number} workYear - Work year to ensure
   * @returns {Object} Created or existing balance
   */
  static async ensureWorkYearBalance(employeeId, workYear) {
    try {
      // Check if balance already exists
      let balance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear
      });

      if (balance) {
        return await this.alignCarryForwardWithPreviousYear(balance, employeeId);
      }

      // Create new balance for this work year
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Calculate allocation for this work year
      const allocation = LeaveBalance.calculateAnniversaryAllocation(workYear, employee.leaveConfig);
      
      // Calculate carry forward ONLY for annual leaves (with 40-day cap)
      // Sick and Casual leaves reset completely on anniversary - NO CARRY FORWARD
      // For workYear 0, no carry forward
      let carryForward;
      if (workYear === 0) {
        carryForward = { annual: 0, sick: 0, casual: 0, reason: 'Work year 0 - no carry forward' };
      } else {
        // Only calculate carry forward for annual leaves (sick and casual are always 0)
        const annualCarryForward = await this.calculateCarryForward(employeeId, workYear, allocation.annual);
        carryForward = {
          annual: annualCarryForward.annual,
          sick: 0, // NO CARRY FORWARD - resets on anniversary
          casual: 0, // NO CARRY FORWARD - resets on anniversary
          reason: annualCarryForward.reason
        };
      }
      
      // Calculate year for this work year (anniversary year - when the work year period ends)
      // Work Year 0: Nov 01, 2023 - Nov 01, 2024 -> year = 2024
      // Work Year 1: Nov 01, 2024 - Nov 01, 2025 -> year = 2025
      // Formula: year = hireYear + workYear + 1
      const hireDate = employee.hireDate || employee.joiningDate;
      const hireYear = hireDate.getFullYear();
      const year = hireYear + workYear + 1;
      
      // Set expiration date for annual leaves (2 years from allocation)
      const expirationDate = new Date(year + 2, 11, 31);

      // Create new balance
      balance = new LeaveBalance({
        employee: employeeId,
        year: year,
        workYear: workYear,
        expirationDate: expirationDate,
        isCarriedForward: workYear > 0 && carryForward.annual > 0,
        annual: {
          allocated: allocation.annual,
          used: 0,
          remaining: 0, // Will be calculated by pre-save middleware
          carriedForward: carryForward.annual,
          advance: 0
        },
        sick: {
          allocated: allocation.sick,
          used: 0,
          remaining: 0, // Will be calculated by pre-save middleware
          carriedForward: carryForward.sick,
          advance: 0
        },
        casual: {
          allocated: allocation.casual,
          used: 0,
          remaining: 0, // Will be calculated by pre-save middleware
          carriedForward: carryForward.casual,
          advance: 0
        }
      });

      try {
        await balance.save();
        return balance;
      } catch (error) {
        // Handle duplicate key error
        if (error.code === 11000) {
          // Try to find existing record by year
          const existingBalance = await LeaveBalance.findOne({
            employee: employeeId,
            year: year
          });
          
          if (existingBalance) {
            // Update the existing record with workYear if it's missing
            if (!existingBalance.workYear && workYear >= 0) {
              existingBalance.workYear = workYear;
              await existingBalance.save();
            }
            return existingBalance;
          }
          
          // If still not found, try to find by workYear
          const existingWorkYearBalance = await LeaveBalance.findOne({
            employee: employeeId,
            workYear: workYear
          });
          
          if (existingWorkYearBalance) {
            return existingWorkYearBalance;
          }
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to ensure work year balance: ${error.message}`);
    }
  }

  /**
   * Get or create balance for an employee with automatic carry forward
   * @param {ObjectId} employeeId - Employee ID
   * @param {number} workYear - Work year
   * @returns {Object} Balance with carry forward
   */
  static async getOrCreateBalanceWithCarryForward(employeeId, workYear) {
    try {
      // First check if the requested work year balance already exists
      let balance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear
      });

      if (balance) {
        return await this.alignCarryForwardWithPreviousYear(balance, employeeId);
      }

      // If not found, try to find by year (for backward compatibility)
      const currentYear = new Date().getFullYear();
      balance = await LeaveBalance.findOne({
        employee: employeeId,
        year: currentYear
      });

      if (balance) {
        // Update with workYear if missing
        if (!balance.workYear) {
          balance.workYear = workYear;
          await balance.save();
        }
        return await this.alignCarryForwardWithPreviousYear(balance, employeeId);
      }

      // If still not found, ensure all previous work year balances exist
      for (let year = 0; year <= workYear; year++) {
        try {
          await this.ensureWorkYearBalance(employeeId, year);
        } catch (error) {
          // If it's a duplicate key error, continue
          if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
            console.log(`Duplicate key error for work year ${year}, continuing...`);
            continue;
          }
          // For other errors, log but continue
          console.warn(`Warning: Failed to ensure work year ${year} balance: ${error.message}`);
        }
      }

      // Get the requested work year balance again
      balance = await LeaveBalance.findOne({
        employee: employeeId,
        workYear: workYear
      });

      if (!balance) {
        // Try one more time with year-based search
        balance = await LeaveBalance.findOne({
          employee: employeeId,
          year: currentYear
        });
        
        if (balance) {
          balance.workYear = workYear;
          await balance.save();
          return await this.alignCarryForwardWithPreviousYear(balance, employeeId);
        }
        
        // Last resort: try to create directly
        try {
          const employee = await Employee.findById(employeeId);
          if (!employee) {
            throw new Error(`Employee not found: ${employeeId}`);
          }
          
          const allocation = LeaveBalance.calculateAnniversaryAllocation(workYear, employee.leaveConfig);
          const hireDate = employee.hireDate || employee.joiningDate;
          const workYearStartDate = new Date(hireDate.getFullYear() + workYear, hireDate.getMonth(), hireDate.getDate());
          const year = workYearStartDate.getFullYear();
          
          balance = new LeaveBalance({
            employee: employeeId,
            year: year,
            workYear: workYear,
            expirationDate: new Date(year + 2, 11, 31),
            isCarriedForward: false,
            annual: {
              allocated: allocation.annual,
              used: 0,
              remaining: 0,
              carriedForward: 0,
              advance: 0
            },
            sick: {
              allocated: allocation.sick,
              used: 0,
              remaining: 0,
              carriedForward: 0,
              advance: 0
            },
            casual: {
              allocated: allocation.casual,
              used: 0,
              remaining: 0,
              carriedForward: 0,
              advance: 0
            }
          });
          
          await balance.save();
          return await this.alignCarryForwardWithPreviousYear(balance, employeeId);
        } catch (createError) {
          console.error(`Failed to create balance for work year ${workYear}:`, createError);
          throw new Error(`Failed to create balance for work year ${workYear}: ${createError.message}`);
        }
      }

      return await this.alignCarryForwardWithPreviousYear(balance, employeeId);
    } catch (error) {
      throw new Error(`Failed to get balance with carry forward: ${error.message}`);
    }
  }

  /**
   * Ensure carry forward values align with previous year's remaining balance
   * @param {Object} balance - Leave balance document for the target work year
   * @param {ObjectId} employeeId - Employee ID
   * @returns {Object} Updated balance document
   */
  static async alignCarryForwardWithPreviousYear(balance, employeeId) {
    if (!balance) {
      return balance;
    }

    try {
      const workYear = typeof balance.workYear === 'number' ? balance.workYear : null;
      const annualAllocated = Number(balance.annual?.allocated || 0);
      let expectedAnnualCarryForward = 0;

      if (workYear !== null && workYear > 0) {
        const previousBalance = await LeaveBalance.findOne({
          employee: employeeId,
          workYear: workYear - 1
        });

        if (previousBalance) {
          const previousRemaining = Number(previousBalance.annual?.remaining || 0);
          const maxCarryForward = Math.max(0, 40 - annualAllocated);
          expectedAnnualCarryForward = Math.min(previousRemaining, maxCarryForward);
          expectedAnnualCarryForward = Math.max(0, expectedAnnualCarryForward);
        }
      }

      const currentAnnualCarryForward = Number(balance.annual?.carriedForward || 0);
      const needsAnnualUpdate = currentAnnualCarryForward !== expectedAnnualCarryForward;
      const needsSickReset = Number(balance.sick?.carriedForward || 0) !== 0;
      const needsCasualReset = Number(balance.casual?.carriedForward || 0) !== 0;

      if (needsAnnualUpdate || needsSickReset || needsCasualReset) {
        if (balance.annual) {
          balance.annual.carriedForward = expectedAnnualCarryForward;
        }
        if (balance.sick) {
          balance.sick.carriedForward = 0;
        }
        if (balance.casual) {
          balance.casual.carriedForward = 0;
        }

        balance.isCarriedForward = expectedAnnualCarryForward > 0;
        balance.markModified('annual');
        balance.markModified('sick');
        balance.markModified('casual');
        await balance.save();
      }

      return balance;
    } catch (error) {
      console.warn(`Warning: Failed to align carry forward for employee ${employeeId} workYear ${balance.workYear}: ${error.message}`);
      return balance;
    }
  }

  /**
   * Recalculate carry forward for all work years for an employee
   * @param {ObjectId} employeeId - Employee ID
   * @returns {Object} Recalculation result
   */
  static async recalculateCarryForward(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get all existing balances
      const balances = await LeaveBalance.find({
        employee: employeeId
      }).sort({ workYear: 1 });

      const results = [];

      // Recalculate carry forward for each work year
      for (const balance of balances) {
        const carryForward = await this.calculateCarryForward(employeeId, balance.workYear);
        
        // Update carry forward values
        balance.annual.carriedForward = carryForward.annual;
        balance.sick.carriedForward = carryForward.sick;
        balance.casual.carriedForward = carryForward.casual;
        
        // Recalculate remaining (allocated + carried forward - used)
        balance.annual.remaining = balance.annual.allocated + carryForward.annual - balance.annual.used;
        balance.sick.remaining = balance.sick.allocated + carryForward.sick - balance.sick.used;
        balance.casual.remaining = balance.casual.allocated + carryForward.casual - balance.casual.used;
        
        await balance.save();
        
        results.push({
          workYear: balance.workYear,
          carryForward: carryForward,
          updated: true
        });
      }

      return {
        employeeId: employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        results: results
      };
    } catch (error) {
      throw new Error(`Failed to recalculate carry forward: ${error.message}`);
    }
  }

  /**
   * Get carry forward summary for an employee
   * @param {ObjectId} employeeId - Employee ID
   * @returns {Object} Carry forward summary
   */
  static async getCarryForwardSummary(employeeId) {
    try {
      const balances = await LeaveBalance.find({
        employee: employeeId
      }).sort({ workYear: 1 });

      const summary = {
        employeeId: employeeId,
        workYears: [],
        totalCarryForward: {
          annual: 0,
          sick: 0,
          casual: 0
        }
      };

      for (const balance of balances) {
        const workYearSummary = {
          workYear: balance.workYear,
          year: balance.year,
          carryForward: {
            annual: balance.annual.carriedForward,
            sick: balance.sick.carriedForward,
            casual: balance.casual.carriedForward
          },
          remaining: {
            annual: balance.annual.remaining,
            sick: balance.sick.remaining,
            casual: balance.casual.remaining
          },
          used: {
            annual: balance.annual.used,
            sick: balance.sick.used,
            casual: balance.casual.used
          }
        };

        summary.workYears.push(workYearSummary);
        summary.totalCarryForward.annual += balance.annual.carriedForward;
        summary.totalCarryForward.sick += balance.sick.carriedForward;
        summary.totalCarryForward.casual += balance.casual.carriedForward;
      }

      return summary;
    } catch (error) {
      throw new Error(`Failed to get carry forward summary: ${error.message}`);
    }
  }
}

module.exports = CarryForwardService;
