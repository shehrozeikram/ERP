const cron = require('node-cron');
const BiometricIntegration = require('../models/hr/BiometricIntegration');
const attendanceService = require('./attendanceService');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

class ScheduledSyncService {
  constructor() {
    this.scheduledJobs = new Map();
    this.attendanceService = attendanceService;
  }

  // Initialize all scheduled syncs from database
  async initializeScheduledSyncs() {
    try {
      console.log('🕒 Initializing scheduled biometric syncs...');
      
      const integrations = await BiometricIntegration.find({
        isActive: true,
        'syncConfig.scheduledSync': true
      });

      for (const integration of integrations) {
        await this.scheduleSync(integration._id, integration.syncConfig.cronExpression);
      }

      console.log(`✅ Initialized ${integrations.length} scheduled sync(s)`);
    } catch (error) {
      console.error('❌ Error initializing scheduled syncs:', error);
    }
  }

  // Schedule a sync job for specific integration
  async scheduleSync(integrationId, cronExpression = '0 6 * * *') { // Default: 6:00 AM daily
    try {
      // Stop existing job if any
      this.stopScheduledSync(integrationId);

      const integration = await BiometricIntegration.findById(integrationId);
      if (!integration || !integration.isActive) {
        throw new Error('Integration not found or inactive');
      }

      // Create cron job
      const job = cron.schedule(cronExpression, async () => {
        await this.executeDailySync(integrationId);
      }, {
        scheduled: false, // Don't start immediately
        timezone: process.env.TIMEZONE || 'Asia/Karachi'
      });

      // Start the job
      job.start();
      this.scheduledJobs.set(integrationId.toString(), job);

      // Update integration with schedule info
      integration.syncConfig.scheduledSync = true;
      integration.syncConfig.cronExpression = cronExpression;
      integration.syncConfig.lastScheduleUpdate = new Date();
      await integration.save();

      console.log(`✅ Scheduled sync for ${integration.systemName} at: ${cronExpression}`);
      
      return {
        success: true,
        message: `Sync scheduled successfully for ${cronExpression}`,
        integrationId,
        cronExpression
      };
    } catch (error) {
      console.error(`❌ Error scheduling sync for ${integrationId}:`, error);
      throw error;
    }
  }

  // Execute the daily sync
  async executeDailySync(integrationId) {
    try {
      console.log(`🔄 Starting scheduled sync for integration: ${integrationId}`);
      
      const integration = await BiometricIntegration.findById(integrationId);
      if (!integration || !integration.isActive) {
        console.log(`⚠️ Integration ${integrationId} not found or inactive, skipping sync`);
        return;
      }

      // Sync yesterday's data and today's data to catch any missed records
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1); // Yesterday
      startDate.setHours(0, 0, 0, 0); // Start of yesterday

      console.log(`📅 Syncing attendance from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const result = await this.attendanceService.syncBiometricAttendance(
        integrationId,
        startDate,
        endDate
      );

      // Also process raw biometric data to attendance database
      console.log(`📥 Processing raw biometric data to attendance database...`);
      const processResult = await this.processRawDataToAttendance(integration, 2); // Last 2 days
      
      // Log results
      console.log(`✅ Scheduled sync completed for ${integration.systemName}:`);
      console.log(`   📊 Raw sync - Processed: ${result.processed || 0} records`);
      console.log(`   📊 Attendance DB - Processed: ${processResult.processed || 0} records`);
      console.log(`   ➕ Created: ${processResult.created || 0} attendance records`);
      console.log(`   🔄 Updated: ${processResult.updated || 0} attendance records`);
      console.log(`   ❌ Errors: ${(result.errors || 0) + (processResult.errors || 0)} total errors`);

      // Update last sync time
      integration.syncConfig.lastSyncAt = new Date();
      integration.syncConfig.syncStatus = 'completed';
      await integration.save();

      return result;
    } catch (error) {
      console.error(`❌ Scheduled sync failed for integration ${integrationId}:`, error);
      
      // Update sync status to failed
      try {
        const integration = await BiometricIntegration.findById(integrationId);
        if (integration) {
          integration.syncConfig.syncStatus = 'failed';
          integration.errorLog.push({
            error: error.message,
            details: { method: 'executeDailySync', timestamp: new Date() }
          });
          await integration.save();
        }
      } catch (updateError) {
        console.error('Error updating sync status:', updateError);
      }
    }
  }

  // Stop scheduled sync for an integration
  stopScheduledSync(integrationId) {
    const jobKey = integrationId.toString();
    const job = this.scheduledJobs.get(jobKey);
    
    if (job) {
      job.stop();
      job.destroy();
      this.scheduledJobs.delete(jobKey);
      console.log(`🛑 Stopped scheduled sync for integration: ${integrationId}`);
      return true;
    }
    
    return false;
  }

  // Stop all scheduled syncs
  async stopAllScheduledSyncs() {
    console.log('🛑 Stopping all scheduled syncs...');
    
    for (const [integrationId, job] of this.scheduledJobs) {
      job.stop();
      job.destroy();
      console.log(`   Stopped sync for: ${integrationId}`);
    }
    
    this.scheduledJobs.clear();
    console.log('✅ All scheduled syncs stopped');
  }

  // Get scheduled sync status
  getScheduledSyncStatus() {
    const status = [];
    
    for (const [integrationId, job] of this.scheduledJobs) {
      status.push({
        integrationId,
        isRunning: job.running || false,
        nextRun: job.nextDate ? job.nextDate() : null
      });
    }
    
    return status;
  }

  // Update schedule for existing integration
  async updateSchedule(integrationId, newCronExpression) {
    try {
      const integration = await BiometricIntegration.findById(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      // Stop current job
      this.stopScheduledSync(integrationId);
      
      // Schedule with new expression
      return await this.scheduleSync(integrationId, newCronExpression);
    } catch (error) {
      console.error(`Error updating schedule for ${integrationId}:`, error);
      throw error;
    }
  }

  // Setup default daily sync at 6 AM for all active integrations
  async setupDailySyncForAll() {
    try {
      console.log('🚀 Setting up daily 6 AM sync for all active biometric integrations...');
      
      const integrations = await BiometricIntegration.find({ isActive: true });
      const results = [];

      for (const integration of integrations) {
        try {
          const result = await this.scheduleSync(integration._id, '0 6 * * *'); // 6:00 AM daily
          results.push({
            integrationId: integration._id,
            systemName: integration.systemName,
            success: true,
            message: result.message
          });
        } catch (error) {
          results.push({
            integrationId: integration._id,
            systemName: integration.systemName,
            success: false,
            error: error.message
          });
        }
      }

      console.log(`✅ Setup completed for ${results.length} integration(s)`);
      return results;
    } catch (error) {
      console.error('❌ Error setting up daily sync for all integrations:', error);
      throw error;
    }
  }

  // Process raw biometric data to attendance database
  async processRawDataToAttendance(integration, daysBack = 2) {
    const zktecoService = require('./zktecoService');
    const Employee = require('../models/hr/Employee');
    const Attendance = require('../models/hr/Attendance');

    try {
      // Get raw attendance data from ZKTeco device
      const rawData = await zktecoService.getAttendanceData();
      
      if (!rawData.success || !rawData.data || rawData.data.length === 0) {
        return {
          processed: 0,
          created: 0,
          updated: 0,
          errors: 0
        };
      }

      // Filter out invalid records first
      const validRecords = rawData.data.filter(record => {
        const employeeId = record.uid || record.userId || record.deviceUserId;
        const timestamp = record.timestamp || record.recordTime;
        
        // Skip records with no employee ID or timestamp
        if (!employeeId || !timestamp || timestamp === undefined) {
          return false;
        }
        
        // Check if timestamp can be converted to valid date
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          return false;
        }
        
        return true;
      });

      console.log(`📊 Filtered ${validRecords.length} valid records out of ${rawData.data.length} total records`);

      // Filter by date range
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const filteredData = validRecords.filter(record => {
        const recordDate = new Date(record.timestamp || record.recordTime);
        return recordDate >= cutoffDate;
      });

      // Process each record
      let processed = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const record of filteredData) {
        try {
          const employeeId = record.uid || record.userId || record.deviceUserId;
          const timestamp = new Date(record.timestamp || record.recordTime);
          
          if (!employeeId) {
            continue;
          }

          // Find employee by employeeId
          const employee = await Employee.findOne({ employeeId: employeeId.toString() });
          
          if (!employee) {
            errors++;
            continue;
          }

          // Get date (without time) for grouping
          const attendanceDate = new Date(timestamp);
          attendanceDate.setHours(0, 0, 0, 0);

          // Find existing attendance record for this employee and date
          let attendance = await Attendance.findOne({
            employee: employee._id,
            date: {
              $gte: attendanceDate,
              $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
            },
            isActive: true
          });

          const isCheckIn = record.state === 1 || record.state === '1' || record.state === 'IN';
          
          if (!attendance) {
            // Create new attendance record
            attendance = new Attendance({
              employee: employee._id,
              date: attendanceDate,
              status: 'Present',
              isActive: true
            });

            // Set check-in or check-out
            if (isCheckIn) {
              attendance.checkIn = {
                time: timestamp,
                location: 'Biometric Device',
                method: 'Biometric'
              };
            } else {
              attendance.checkOut = {
                time: timestamp,
                location: 'Biometric Device',
                method: 'Biometric'
              };
            }

            await attendance.save();
            created++;
          } else {
            // Update existing attendance record
            let needsUpdate = false;

            if (isCheckIn) {
              if (!attendance.checkIn || !attendance.checkIn.time || timestamp < attendance.checkIn.time) {
                attendance.checkIn = {
                  time: timestamp,
                  location: 'Biometric Device',
                  method: 'Biometric'
                };
                needsUpdate = true;
              }
            } else {
              if (!attendance.checkOut || !attendance.checkOut.time || timestamp > attendance.checkOut.time) {
                attendance.checkOut = {
                  time: timestamp,
                  location: 'Biometric Device',
                  method: 'Biometric'
                };
                needsUpdate = true;
              }
            }

            if (needsUpdate) {
              await attendance.save();
              updated++;
            }
          }

          processed++;
        } catch (error) {
          console.error(`❌ Error processing record for employee ${record.uid || record.userId}:`, error.message);
          errors++;
        }
      }

      return {
        processed,
        created,
        updated,
        errors
      };

    } catch (error) {
      console.error('Error processing raw biometric data:', error);
      return {
        processed: 0,
        created: 0,
        updated: 0,
        errors: 1
      };
    }
  }
}

module.exports = new ScheduledSyncService();