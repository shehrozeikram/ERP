const cron = require('node-cron');
const LeaveIntegrationService = require('./leaveIntegrationService');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');

class AnniversaryLeaveScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
  }

  /**
   * Start the anniversary leave scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('Anniversary leave scheduler is already running');
      return;
    }

    // Run on the 1st of every month at 2:00 AM
    const task = cron.schedule('0 2 1 * *', async () => {
      await this.processMonthlyAnniversaryTasks();
    }, {
      scheduled: false,
      timezone: 'Asia/Karachi' // Pakistan timezone
    });

    task.start();
    this.isRunning = true;
    this.nextRun = this.getNextRunDate();

    console.log('✅ Anniversary leave scheduler started');
    console.log(`Next run: ${this.nextRun}`);
  }

  /**
   * Stop the anniversary leave scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('Anniversary leave scheduler is not running');
      return;
    }

    cron.destroy();
    this.isRunning = false;
    this.nextRun = null;

    console.log('❌ Anniversary leave scheduler stopped');
  }

  /**
   * Process monthly anniversary tasks
   */
  async processMonthlyAnniversaryTasks() {
    console.log('🔄 Starting monthly anniversary leave processing...');
    this.lastRun = new Date();

    try {
      const results = {
        anniversaryRenewals: null,
        expiredLeaves: null,
        errors: []
      };

      // 1. Process anniversary renewals
      console.log('📅 Processing anniversary renewals...');
      try {
        results.anniversaryRenewals = await LeaveIntegrationService.processAnniversaryRenewals();
        console.log(`✅ Processed ${results.anniversaryRenewals.processed} employees, renewed ${results.anniversaryRenewals.renewed}`);
      } catch (error) {
        console.error('❌ Error processing anniversary renewals:', error.message);
        results.errors.push({ task: 'anniversaryRenewals', error: error.message });
      }

      // 2. Expire old annual leaves
      console.log('⏰ Expiring old annual leaves...');
      try {
        results.expiredLeaves = await LeaveIntegrationService.expireOldAnnualLeaves();
        console.log(`✅ Expired ${results.expiredLeaves} annual leave balances`);
      } catch (error) {
        console.error('❌ Error expiring old annual leaves:', error.message);
        results.errors.push({ task: 'expireOldAnnualLeaves', error: error.message });
      }

      // 3. Process carry forward for annual leaves
      console.log('🔄 Processing annual leave carry forward...');
      try {
        await this.processAnnualLeaveCarryForward();
        console.log('✅ Processed annual leave carry forward');
      } catch (error) {
        console.error('❌ Error processing carry forward:', error.message);
        results.errors.push({ task: 'carryForward', error: error.message });
      }

      console.log('✅ Monthly anniversary leave processing completed');
      console.log('Results:', JSON.stringify(results, null, 2));

      return results;
    } catch (error) {
      console.error('❌ Critical error in monthly anniversary processing:', error);
      throw error;
    }
  }

  /**
   * Process annual leave carry forward
   */
  async processAnnualLeaveCarryForward() {
    const employees = await Employee.find({ 
      isActive: true,
      hireDate: { $exists: true }
    });

    for (const employee of employees) {
      try {
        const currentWorkYear = LeaveIntegrationService.calculateWorkYear(employee.hireDate);
        
        // Get previous work year balance
        const previousBalance = await LeaveBalance.findOne({
          employee: employee._id,
          workYear: currentWorkYear - 1
        });

        if (previousBalance && previousBalance.annual.remaining > 0) {
          // Get current work year balance
          let currentBalance = await LeaveBalance.findOne({
            employee: employee._id,
            workYear: currentWorkYear
          });

          if (!currentBalance) {
            // Create current year balance if it doesn't exist
            currentBalance = await LeaveIntegrationService.processAnniversaryAllocation(employee._id, currentWorkYear);
          }

          // Carry forward remaining annual leaves with 40-day cap enforcement
          // Formula: carry forward = min(previous remaining, 40 - new allocation)
          const newAllocation = currentBalance.annual.allocated;
          const maxCarryForward = 40 - newAllocation;
          const carryForwardDays = Math.min(previousBalance.annual.remaining, maxCarryForward);
          
          if (carryForwardDays > 0) {
            currentBalance.annual.carriedForward = carryForwardDays;
            currentBalance.isCarriedForward = true;
            
            // Don't modify remaining directly - let pre-save middleware calculate it
            await currentBalance.save();
            
            console.log(`📋 Carried forward ${carryForwardDays} annual leaves for ${employee.firstName} ${employee.lastName} (from ${previousBalance.annual.remaining} remaining, capped at ${maxCarryForward})`);
          }
        }
      } catch (error) {
        console.error(`Error processing carry forward for employee ${employee._id}:`, error.message);
      }
    }
  }

  /**
   * Get next run date
   */
  getNextRunDate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0);
    return nextMonth;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      timezone: 'Asia/Karachi'
    };
  }

  /**
   * Run anniversary tasks manually (for testing)
   */
  async runManually() {
    console.log('🔧 Running anniversary tasks manually...');
    return await this.processMonthlyAnniversaryTasks();
  }

  /**
   * Get employees with upcoming anniversaries (next 30 days)
   */
  async getUpcomingAnniversaries() {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));

    const employees = await Employee.find({ 
      isActive: true,
      hireDate: { $exists: true }
    });

    const upcomingAnniversaries = [];

    for (const employee of employees) {
      const hireDate = new Date(employee.hireDate);
      const nextAnniversary = new Date(hireDate);
      nextAnniversary.setFullYear(today.getFullYear());

      // If anniversary has passed this year, it's next year
      if (nextAnniversary <= today) {
        nextAnniversary.setFullYear(today.getFullYear() + 1);
      }

      if (nextAnniversary >= today && nextAnniversary <= thirtyDaysFromNow) {
        const daysToAnniversary = Math.ceil((nextAnniversary - today) / (1000 * 60 * 60 * 24));
        
        upcomingAnniversaries.push({
          employee: {
            id: employee._id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeId: employee.employeeId
          },
          hireDate: employee.hireDate,
          nextAnniversary: nextAnniversary,
          daysToAnniversary: daysToAnniversary,
          workYear: LeaveIntegrationService.calculateWorkYear(employee.hireDate, nextAnniversary)
        });
      }
    }

    return upcomingAnniversaries.sort((a, b) => a.daysToAnniversary - b.daysToAnniversary);
  }
}

module.exports = new AnniversaryLeaveScheduler();
