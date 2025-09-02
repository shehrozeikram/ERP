const zkbioTimeApiService = require('./zkbioTimeApiService');
const zkbioTimeDatabaseService = require('./zkbioTimeDatabaseService');

class ZKBioTimeBackgroundService {
  constructor() {
    this.isRunning = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.syncIntervalMinutes = 5; // Sync every 5 minutes
    this.maxRetries = 3;
    this.retryDelay = 30000; // 30 seconds
  }

  /**
   * Start the background sync service
   */
  start() {
    if (this.isRunning) {
      console.log('🔄 ZKBio Time background service is already running');
      return;
    }

    console.log('🚀 Starting ZKBio Time background sync service...');
    this.isRunning = true;

    // Initial sync
    this.performSync();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalMinutes * 60 * 1000);

    console.log(`✅ Background sync service started - syncing every ${this.syncIntervalMinutes} minutes`);
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (!this.isRunning) {
      console.log('🛑 ZKBio Time background service is not running');
      return;
    }

    console.log('🛑 Stopping ZKBio Time background sync service...');
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    console.log('✅ Background sync service stopped');
  }

  /**
   * Perform a sync operation with retry logic
   */
  async performSync(retryCount = 0) {
    try {
      const startTime = Date.now();
      console.log(`🔄 Starting background sync (attempt ${retryCount + 1})...`);

      // Fetch latest attendance data
      const attendanceResult = await zkbioTimeApiService.getTodayAttendance();
      
      if (attendanceResult.success && attendanceResult.data.length > 0) {
        // Save attendance records
        const saveResult = await zkbioTimeDatabaseService.saveAttendanceRecords(attendanceResult.data);
        
        // Fetch and save employee data
        const employeeResult = await zkbioTimeApiService.getEmployees();
        if (employeeResult.success && employeeResult.data.length > 0) {
          await zkbioTimeDatabaseService.saveEmployees(employeeResult.data);
        }

        const duration = Date.now() - startTime;
        this.lastSyncTime = new Date();
        
        console.log(`✅ Background sync completed successfully:`);
        console.log(`   📊 Attendance: ${attendanceResult.data.length} records`);
        console.log(`   👥 Employees: ${employeeResult.success ? employeeResult.data.length : 0} records`);
        console.log(`   ⏱️ Duration: ${duration}ms`);
        console.log(`   🕒 Next sync: ${new Date(Date.now() + this.syncIntervalMinutes * 60 * 1000).toLocaleTimeString()}`);
      } else {
        console.log('⚠️ No attendance data available for sync');
      }

    } catch (error) {
      console.error(`❌ Background sync failed (attempt ${retryCount + 1}):`, error.message);
      
      // Retry logic
      if (retryCount < this.maxRetries) {
        console.log(`🔄 Retrying in ${this.retryDelay / 1000} seconds...`);
        setTimeout(() => {
          this.performSync(retryCount + 1);
        }, this.retryDelay);
      } else {
        console.error('❌ Background sync failed after maximum retries');
      }
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      syncIntervalMinutes: this.syncIntervalMinutes,
      nextSyncTime: this.lastSyncTime ? 
        new Date(this.lastSyncTime.getTime() + this.syncIntervalMinutes * 60 * 1000) : null
    };
  }

  /**
   * Update sync interval
   */
  updateSyncInterval(minutes) {
    this.syncIntervalMinutes = minutes;
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop();
      this.start();
    }
    
    console.log(`🔄 Sync interval updated to ${minutes} minutes`);
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    console.log('🔄 Force sync requested...');
    await this.performSync();
  }
}

// Export singleton instance
module.exports = new ZKBioTimeBackgroundService();
