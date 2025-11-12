const AnnualLeaveBalance = require('../models/hr/AnnualLeaveBalance');
const LeaveTransaction = require('../models/hr/LeaveTransaction');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const mongoose = require('mongoose');

/**
 * Annual Leave Management Service
 * 
 * This service implements the complete annual leave policy:
 * - 20 annual leaves per completed year
 * - First allocation exactly one year after hire date
 * - 40-leave cap with oldest bucket removal
 * - Oldest-first deduction rule
 * - Automatic anniversary processing
 */
class AnnualLeaveManagementService {
  
  /**
   * Process annual leave allocation for all employees on their anniversary dates
   * This method should be called daily via cron job
   */
  static async processAnniversaryAllocations(targetDate = new Date()) {
    const session = await mongoose.startSession();
    
    try {
      const results = await session.withTransaction(async () => {
        console.log(`🔄 Processing anniversary allocations for ${targetDate.toDateString()}`);
        
        // Find employees whose anniversary is today
        const anniversaryEmployees = await this.findAnniversaryEmployees(targetDate);
        
        console.log(`📅 Found ${anniversaryEmployees.length} employees with anniversaries today`);
        
        const results = {
          processed: 0,
          skipped: 0,
          errors: 0,
          details: []
        };
        
        for (const employee of anniversaryEmployees) {
          try {
            const result = await this.processEmployeeAnniversary(employee, targetDate, session);
            results.processed++;
            results.details.push({
              employeeId: employee._id,
              employeeName: `${employee.firstName} ${employee.lastName}`,
              hireDate: employee.hireDate,
              workYear: result.workYear,
              allocated: result.allocated,
              status: 'success'
            });
            
            console.log(`✅ Processed anniversary for ${employee.firstName} ${employee.lastName} (Work Year ${result.workYear})`);
          } catch (error) {
            results.errors++;
            results.details.push({
              employeeId: employee._id,
              employeeName: `${employee.firstName} ${employee.lastName}`,
              error: error.message,
              status: 'error'
            });
            
            console.error(`❌ Error processing anniversary for ${employee.firstName} ${employee.lastName}:`, error.message);
          }
        }
        
        console.log(`🎯 Anniversary processing complete: ${results.processed} processed, ${results.errors} errors`);
        return results;
      });
      
      return results;
      
    } catch (error) {
      console.error('❌ Error in anniversary processing transaction:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Find employees whose anniversary is on the target date
   */
  static async findAnniversaryEmployees(targetDate) {
    const targetMonth = targetDate.getMonth();
    const targetDay = targetDate.getDate();
    
    return await Employee.find({
      isActive: true,
      hireDate: {
        $exists: true,
        $ne: null
      },
      $expr: {
        $and: [
          { $eq: [{ $month: '$hireDate' }, targetMonth + 1] },
          { $eq: [{ $dayOfMonth: '$hireDate' }, targetDay] }
        ]
      }
    }).select('_id firstName lastName hireDate employeeId');
  }
  
  /**
   * Process anniversary for a single employee
   */
  static async processEmployeeAnniversary(employee, targetDate, session) {
    const hireDate = new Date(employee.hireDate);
    const currentYear = targetDate.getFullYear();
    const workYear = currentYear - hireDate.getFullYear();
    
    // Check if employee has completed at least one year
    if (workYear < 1) {
      throw new Error(`Employee ${employee.firstName} ${employee.lastName} hasn't completed one year yet`);
    }
    
    // Check if allocation already exists for this year
    const existingBalance = await AnnualLeaveBalance.findOne({
      employeeId: employee._id,
      year: currentYear
    }).session(session);
    
    if (existingBalance) {
      throw new Error(`Allocation already exists for year ${currentYear}`);
    }
    
    // Get previous year's balance for carry forward calculation
    const previousYearBalance = await AnnualLeaveBalance.findOne({
      employeeId: employee._id,
      year: currentYear - 1
    }).session(session);
    
    let carryForwardAmount = 0;
    if (previousYearBalance && previousYearBalance.remaining > 0) {
      carryForwardAmount = previousYearBalance.remaining;
    }
    
    // Calculate new allocation (20 days for completed year)
    const newAllocation = 20;
    const totalBeforeCap = newAllocation + carryForwardAmount;
    
    // Create new balance record
    const anniversaryDate = new Date(hireDate);
    anniversaryDate.setFullYear(currentYear);
    
    const newBalance = new AnnualLeaveBalance({
      employeeId: employee._id,
      year: currentYear,
      allocated: newAllocation,
      used: 0,
      carryForward: carryForwardAmount,
      total: totalBeforeCap,
      anniversaryDate
    });
    // Note: 'remaining' will be automatically calculated by pre-save middleware
    
    await newBalance.save({ session });
    
    // Log allocation transaction
    await LeaveTransaction.logAllocation(
      employee._id,
      currentYear,
      newAllocation,
      anniversaryDate,
      { allocated: 0, used: 0, remaining: 0, carryForward: 0, total: 0 },
      newBalance.getSummary(),
      session
    );
    
    // Log carry forward transaction if applicable
    if (carryForwardAmount > 0) {
      await LeaveTransaction.logCarryForward(
        employee._id,
        currentYear,
        carryForwardAmount,
        { allocated: 0, used: 0, remaining: 0, carryForward: 0, total: 0 },
        newBalance.getSummary(),
        session
      );
    }
    
    // Apply 40-leave cap if necessary
    if (totalBeforeCap > 40) {
      await this.applyFortyLeaveCap(employee._id, session);
    }
    
    return {
      workYear,
      allocated: newAllocation,
      carryForward: carryForwardAmount,
      totalBeforeCap,
      totalAfterCap: Math.min(totalBeforeCap, 40)
    };
  }
  
  /**
   * Apply 40-leave cap by removing oldest buckets
   */
  static async applyFortyLeaveCap(employeeId, session = null) {
    const balances = await AnnualLeaveBalance.find({
      employeeId,
      isActive: true
    }).sort({ year: 1 }).session(session);
    
    const totalLeaves = balances.reduce((total, balance) => total + balance.total, 0);
    
    if (totalLeaves <= 40) {
      return balances; // No cap needed
    }
    
    let leavesToRemove = totalLeaves - 40;
    const removedDetails = [];
    
    // Remove leaves starting from oldest buckets
    for (const balance of balances) {
      if (leavesToRemove <= 0) break;
      
      if (balance.total > 0) {
        const balanceBefore = balance.getSummary();
        const removeFromThisBucket = Math.min(leavesToRemove, balance.total);
        
        // Reduce carry forward first, then allocated
        if (balance.carryForward > 0) {
          const removeFromCarryForward = Math.min(removeFromThisBucket, balance.carryForward);
          balance.carryForward -= removeFromCarryForward;
          leavesToRemove -= removeFromCarryForward;
        }
        
        if (leavesToRemove > 0 && balance.allocated > 0) {
          const removeFromAllocated = Math.min(leavesToRemove, balance.allocated);
          balance.allocated -= removeFromAllocated;
          leavesToRemove -= removeFromAllocated;
        }
        
        await balance.save({ session });
        
        // Log cap enforcement transaction
        await LeaveTransaction.logCapEnforcement(
          employeeId,
          balance.year,
          removeFromThisBucket,
          balanceBefore,
          balance.getSummary(),
          `Cap enforcement: removed ${removeFromThisBucket} days from year ${balance.year}`,
          session
        );
        
        removedDetails.push({
          year: balance.year,
          removed: removeFromThisBucket
        });
      }
    }
    
    return {
      totalRemoved: totalLeaves - 40,
      removedDetails
    };
  }
  
  /**
   * Deduct leaves using oldest-first rule
   */
  static async deductLeaves(employeeId, daysToDeduct, leaveRequestId = null, description = null) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        if (daysToDeduct <= 0) {
          throw new Error('Days to deduct must be positive');
        }
        
        // Get all balances sorted by year (oldest first)
        const balances = await AnnualLeaveBalance.find({
          employeeId,
          isActive: true,
          remaining: { $gt: 0 }
        }).sort({ year: 1 }).session(session);
        
        let remainingToDeduct = daysToDeduct;
        const deductionDetails = [];
        
        // Deduct from oldest buckets first
        for (const balance of balances) {
          if (remainingToDeduct <= 0) break;
          
          if (balance.remaining > 0) {
            const balanceBefore = balance.getSummary();
            const deductFromThisBucket = Math.min(remainingToDeduct, balance.remaining);
            
            // Deduct from carry forward first, then allocated
            // Note: allocated field should never be reduced, only used should increment
            if (balance.carryForward > 0) {
              const deductFromCarryForward = Math.min(deductFromThisBucket, balance.carryForward);
              balance.carryForward -= deductFromCarryForward;
              remainingToDeduct -= deductFromCarryForward;
            }
            
            // Deduct remaining from allocated (don't reduce allocated, just track usage)
            if (remainingToDeduct > 0 && balance.allocated > 0) {
              const deductFromAllocated = Math.min(remainingToDeduct, balance.allocated);
              // Don't reduce allocated - only increase used
              remainingToDeduct -= deductFromAllocated;
            }
            
            balance.used += deductFromThisBucket;
            await balance.save({ session });
            
            // Log usage transaction
            await LeaveTransaction.logUsage(
              employeeId,
              balance.year,
              deductFromThisBucket,
              leaveRequestId,
              balanceBefore,
              balance.getSummary(),
              description || `Leave deduction of ${deductFromThisBucket} days from year ${balance.year}`,
              session
            );
            
            deductionDetails.push({
              year: balance.year,
              deducted: deductFromThisBucket,
              remaining: balance.remaining
            });
          }
        }
        
        if (remainingToDeduct > 0) {
          throw new Error(`Insufficient leaves. Available: ${daysToDeduct - remainingToDeduct}, Requested: ${daysToDeduct}`);
        }
        
        return {
          success: true,
          totalDeducted: daysToDeduct,
          deductionDetails
        };
      });
      
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Get employee's leave balance summary
   */
  static async getEmployeeBalance(employeeId) {
    const balances = await AnnualLeaveBalance.find({
      employeeId,
      isActive: true
    }).sort({ year: 1 });
    
    const totalAllocated = balances.reduce((total, balance) => total + balance.allocated, 0);
    const totalUsed = balances.reduce((total, balance) => total + balance.used, 0);
    const totalRemaining = balances.reduce((total, balance) => total + balance.remaining, 0);
    const totalCarryForward = balances.reduce((total, balance) => total + balance.carryForward, 0);
    const totalLeaves = balances.reduce((total, balance) => total + balance.total, 0);
    
    return {
      employeeId,
      balances: balances.map(balance => balance.getSummary()),
      summary: {
        totalAllocated,
        totalUsed,
        totalRemaining,
        totalCarryForward,
        totalLeaves,
        isAtCap: totalLeaves >= 40
      }
    };
  }
  
  /**
   * Get employee's transaction history
   */
  static async getEmployeeTransactionHistory(employeeId, year = null, limit = 50) {
    return await LeaveTransaction.getEmployeeHistory(employeeId, year, limit);
  }
  
  /**
   * Process leave request approval
   */
  static async processLeaveRequestApproval(leaveRequestId, userId) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const leaveRequest = await LeaveRequest.findById(leaveRequestId).session(session);
        
        if (!leaveRequest) {
          throw new Error('Leave request not found');
        }
        
        if (leaveRequest.status !== 'pending') {
          throw new Error('Leave request is not pending');
        }
        
        // Check if it's an annual leave request
        const leaveType = await mongoose.model('LeaveType').findById(leaveRequest.leaveType).session(session);
        
        if (!leaveType || (leaveType.code !== 'ANNUAL' && leaveType.code !== 'AL')) {
          throw new Error('This service only handles annual leave requests');
        }
        
        // Deduct leaves using oldest-first rule
        const deductionResult = await this.deductLeaves(
          leaveRequest.employee,
          leaveRequest.totalDays,
          leaveRequestId,
          `Approved leave request: ${leaveRequest.reason}`
        );
        
        // Update leave request status
        leaveRequest.status = 'approved';
        leaveRequest.approvedBy = userId;
        leaveRequest.approvedDate = new Date();
        await leaveRequest.save({ session });
        
        return {
          success: true,
          leaveRequest,
          deductionResult
        };
      });
      
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Get anniversary processing report for a specific date range
   */
  static async getAnniversaryReport(startDate, endDate) {
    const transactions = await LeaveTransaction.find({
      transactionType: 'ALLOCATION',
      processedAt: {
        $gte: startDate,
        $lte: endDate
      },
      isActive: true
    })
      .populate('employeeId', 'firstName lastName employeeId hireDate')
      .sort({ processedAt: -1 });
    
    return {
      period: { startDate, endDate },
      totalAllocations: transactions.length,
      totalDaysAllocated: transactions.reduce((total, t) => total + t.amount, 0),
      transactions: transactions.map(t => ({
        employee: t.employeeId,
        amount: t.amount,
        year: t.year,
        processedAt: t.processedAt,
        anniversaryDate: t.anniversaryDate
      }))
    };
  }
  
  /**
   * Manual adjustment for leave balance (admin function)
   */
  static async adjustLeaveBalance(employeeId, year, adjustment, reason, userId) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const balance = await AnnualLeaveBalance.findOne({
          employeeId,
          year
        }).session(session);
        
        if (!balance) {
          throw new Error(`No balance found for employee ${employeeId} in year ${year}`);
        }
        
        const balanceBefore = balance.getSummary();
        
        if (adjustment > 0) {
          balance.allocated += adjustment;
        } else {
          balance.allocated = Math.max(0, balance.allocated + adjustment);
        }
        
        await balance.save({ session });
        
        // Log adjustment transaction
        await LeaveTransaction.create({
          employeeId,
          transactionType: 'ADJUSTMENT',
          year,
          amount: Math.abs(adjustment),
          operation: adjustment > 0 ? 'ADD' : 'SUBTRACT',
          balanceBefore,
          balanceAfter: balance.getSummary(),
          description: reason || `Manual adjustment: ${adjustment > 0 ? '+' : ''}${adjustment} days`,
          processedBy: userId,
          processedAt: new Date()
        }).session(session);
        
        return {
          success: true,
          balance: balance.getSummary(),
          adjustment
        };
      });
      
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = AnnualLeaveManagementService;
