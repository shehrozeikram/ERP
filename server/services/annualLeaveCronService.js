const cron = require('node-cron');
const AnnualLeaveManagementService = require('./annualLeaveManagementService');
const mongoose = require('mongoose');

/**
 * Annual Leave Cron Job Service
 * 
 * This service handles scheduled tasks for the annual leave management system:
 * - Daily anniversary processing
 * - Monthly reports
 * - Yearly cleanup tasks
 */
class AnnualLeaveCronService {
  
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }
  
  /**
   * Start all cron jobs
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Annual Leave Cron Service is already running');
      return;
    }
    
    console.log('🚀 Starting Annual Leave Cron Service...');
    
    try {
      // Daily anniversary processing - runs at 2:00 AM every day
      this.scheduleAnniversaryProcessing();
      
      // Monthly report generation - runs on the 1st of every month at 3:00 AM
      this.scheduleMonthlyReports();
      
      // Yearly cleanup - runs on January 1st at 4:00 AM
      this.scheduleYearlyCleanup();
      
      // Health check - runs every hour
      this.scheduleHealthCheck();
      
      this.isRunning = true;
      console.log('✅ Annual Leave Cron Service started successfully');
      
    } catch (error) {
      console.error('❌ Error starting Annual Leave Cron Service:', error);
      throw error;
    }
  }
  
  /**
   * Stop all cron jobs
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Annual Leave Cron Service is not running');
      return;
    }
    
    console.log('🛑 Stopping Annual Leave Cron Service...');
    
    for (const [name, job] of this.jobs) {
      job.destroy();
      console.log(`✅ Stopped job: ${name}`);
    }
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Annual Leave Cron Service stopped successfully');
  }
  
  /**
   * Schedule daily anniversary processing
   */
  scheduleAnniversaryProcessing() {
    const jobName = 'anniversary-processing';
    
    const job = cron.schedule('0 2 * * *', async () => {
      console.log('🔄 Starting daily anniversary processing...');
      
      try {
        const result = await AnnualLeaveManagementService.processAnniversaryAllocations();
        
        console.log('✅ Anniversary processing completed:', {
          processed: result.processed,
          errors: result.errors,
          total: result.details.length
        });
        
        // Log detailed results
        result.details.forEach(detail => {
          if (detail.status === 'success') {
            console.log(`  ✅ ${detail.employeeName}: Work Year ${detail.workYear}, Allocated: ${detail.allocated}`);
          } else {
            console.log(`  ❌ ${detail.employeeName}: ${detail.error}`);
          }
        });
        
      } catch (error) {
        console.error('❌ Error in anniversary processing:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Karachi' // Adjust timezone as needed
    });
    
    this.jobs.set(jobName, job);
    console.log(`📅 Scheduled ${jobName}: Daily at 2:00 AM`);
  }
  
  /**
   * Schedule monthly reports
   */
  scheduleMonthlyReports() {
    const jobName = 'monthly-reports';
    
    const job = cron.schedule('0 3 1 * *', async () => {
      console.log('📊 Generating monthly anniversary report...');
      
      try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        
        const report = await AnnualLeaveManagementService.getAnniversaryReport(startDate, endDate);
        
        console.log('📈 Monthly Anniversary Report:', {
          period: `${startDate.toDateString()} to ${endDate.toDateString()}`,
          totalAllocations: report.totalAllocations,
          totalDaysAllocated: report.totalDaysAllocated
        });
        
        // Here you could send the report via email or save to a file
        // await this.sendMonthlyReport(report);
        
      } catch (error) {
        console.error('❌ Error generating monthly report:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.set(jobName, job);
    console.log(`📅 Scheduled ${jobName}: 1st of every month at 3:00 AM`);
  }
  
  /**
   * Schedule yearly cleanup
   */
  scheduleYearlyCleanup() {
    const jobName = 'yearly-cleanup';
    
    const job = cron.schedule('0 4 1 1 *', async () => {
      console.log('🧹 Starting yearly cleanup...');
      
      try {
        // Archive old transactions (older than 3 years)
        await this.archiveOldTransactions();
        
        // Clean up expired leave balances
        await this.cleanupExpiredBalances();
        
        // Generate yearly report
        await this.generateYearlyReport();
        
        console.log('✅ Yearly cleanup completed');
        
      } catch (error) {
        console.error('❌ Error in yearly cleanup:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.set(jobName, job);
    console.log(`📅 Scheduled ${jobName}: January 1st at 4:00 AM`);
  }
  
  /**
   * Schedule health check
   */
  scheduleHealthCheck() {
    const jobName = 'health-check';
    
    const job = cron.schedule('0 * * * *', async () => {
      try {
        // Check database connection
        const dbState = mongoose.connection.readyState;
        if (dbState !== 1) {
          console.error('❌ Database connection issue:', dbState);
          return;
        }
        
        // Check if any jobs are still running
        const runningJobs = Array.from(this.jobs.values()).filter(job => job.running);
        if (runningJobs.length === 0 && this.isRunning) {
          console.log('✅ Health check passed - All systems operational');
        }
        
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.set(jobName, job);
    console.log(`📅 Scheduled ${jobName}: Every hour`);
  }
  
  /**
   * Archive old transactions
   */
  async archiveOldTransactions() {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    
    const LeaveTransaction = mongoose.model('LeaveTransaction');
    
    const result = await LeaveTransaction.updateMany(
      {
        processedAt: { $lt: threeYearsAgo },
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );
    
    console.log(`📦 Archived ${result.modifiedCount} old transactions`);
  }
  
  /**
   * Clean up expired balances
   */
  async cleanupExpiredBalances() {
    const AnnualLeaveBalance = mongoose.model('AnnualLeaveBalance');
    
    // Mark balances older than 5 years as inactive
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    
    const result = await AnnualLeaveBalance.updateMany(
      {
        year: { $lt: fiveYearsAgo.getFullYear() },
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );
    
    console.log(`🧹 Cleaned up ${result.modifiedCount} expired balances`);
  }
  
  /**
   * Generate yearly report
   */
  async generateYearlyReport() {
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, 0, 1);
    const endDate = new Date(now.getFullYear() - 1, 11, 31);
    
    const report = await AnnualLeaveManagementService.getAnniversaryReport(startDate, endDate);
    
    console.log('📊 Yearly Anniversary Report:', {
      year: now.getFullYear() - 1,
      totalAllocations: report.totalAllocations,
      totalDaysAllocated: report.totalDaysAllocated
    });
    
    // Here you could save the report to a file or send via email
    // await this.saveYearlyReport(report);
  }
  
  /**
   * Manually trigger anniversary processing for a specific date
   */
  async triggerAnniversaryProcessing(targetDate = new Date()) {
    console.log(`🔄 Manually triggering anniversary processing for ${targetDate.toDateString()}`);
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(targetDate);
      
      console.log('✅ Manual anniversary processing completed:', {
        processed: result.processed,
        errors: result.errors,
        total: result.details.length
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in manual anniversary processing:', error);
      throw error;
    }
  }
  
  /**
   * Get cron job status
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      jobs: {}
    };
    
    for (const [name, job] of this.jobs) {
      status.jobs[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }
    
    return status;
  }
  
  /**
   * Test a specific job
   */
  async testJob(jobName) {
    console.log(`🧪 Testing job: ${jobName}`);
    
    switch (jobName) {
      case 'anniversary-processing':
        return await this.triggerAnniversaryProcessing();
      
      case 'monthly-reports':
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        return await AnnualLeaveManagementService.getAnniversaryReport(startDate, endDate);
      
      case 'yearly-cleanup':
        await this.archiveOldTransactions();
        await this.cleanupExpiredBalances();
        return { message: 'Yearly cleanup test completed' };
      
      case 'health-check':
        return {
          database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          jobs: this.getStatus()
        };
      
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }
}

// Create singleton instance
const annualLeaveCronService = new AnnualLeaveCronService();

module.exports = annualLeaveCronService;
