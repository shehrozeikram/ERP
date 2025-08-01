const ZKLib = require('node-zklib');

class ZKTecoService {
  constructor() {
    this.device = null;
    this.isConnected = false;
  }

  // Connect to ZKTeco device
  async connect(host = 'splaza.nayatel.net', port = 4370) {
    try {
      console.log(`🔌 Connecting to ZKTeco device at ${host}:${port}...`);
      
      // Using the exact format you provided: new ZKLib(IP, port, timeout, inMsgDelay)
      this.device = new ZKLib(host, port, 10000, 4000);

      await this.device.createSocket();
      this.isConnected = true;
      
      console.log('✅ Connected to ZKTeco device successfully!');
      return { success: true, message: 'Connected to ZKTeco device' };
      
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  // Get device information
  async getDeviceInfo() {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      const info = await this.device.getInfo();
      return {
        success: true,
        data: info
      };
    } catch (error) {
      console.error('❌ Failed to get device info:', error.message);
      throw error;
    }
  }

  // Get users from device
  async getUsers() {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      const users = await this.device.getUsers();
      return {
        success: true,
        data: users.data || users,
        count: users.data ? users.data.length : users.length
      };
    } catch (error) {
      console.error('❌ Failed to get users:', error.message);
      throw error;
    }
  }

  // Get attendance data from device
  async getAttendanceData() {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      const attendance = await this.device.getAttendances();
      return {
        success: true,
        data: attendance.data || attendance,
        count: attendance.data ? attendance.data.length : attendance.length
      };
    } catch (error) {
      console.error('❌ Failed to get attendance data:', error.message);
      throw error;
    }
  }

  // Get device time
  async getDeviceTime() {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      const time = await this.device.getTime();
      return {
        success: true,
        data: time
      };
    } catch (error) {
      console.error('❌ Failed to get device time:', error.message);
      throw error;
    }
  }

  // Get device version
  async getDeviceVersion() {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      const version = await this.device.getVersion();
      return {
        success: true,
        data: version
      };
    } catch (error) {
      console.error('❌ Failed to get device version:', error.message);
      throw error;
    }
  }

  // Sync attendance data to database
  async syncAttendanceToDatabase() {
    try {
      const attendanceData = await this.getAttendanceData();
      
      if (!attendanceData.success || !attendanceData.data) {
        throw new Error('No attendance data received from device');
      }

      // Import the Attendance model
      const Attendance = require('../models/hr/Attendance');
      
      const syncedRecords = [];
      const errors = [];

      for (const record of attendanceData.data) {
        try {
          // Check if attendance record already exists
          const existingRecord = await Attendance.findOne({
            employeeId: record.uid || record.userId,
            timestamp: new Date(record.timestamp),
            deviceId: 'splaza.nayatel.net'
          });

          if (!existingRecord) {
            // Create new attendance record
            const attendanceRecord = new Attendance({
              employeeId: record.uid || record.userId,
              timestamp: new Date(record.timestamp),
              status: record.state || record.status || 'check-in',
              deviceId: 'splaza.nayatel.net',
              deviceType: 'ZKTeco',
              location: 'Splaza Office'
            });

            await attendanceRecord.save();
            syncedRecords.push(attendanceRecord);
          }
        } catch (error) {
          errors.push({
            record,
            error: error.message
          });
        }
      }

      return {
        success: true,
        syncedRecords: syncedRecords.length,
        totalRecords: attendanceData.data.length,
        errors: errors.length,
        errorDetails: errors
      };

    } catch (error) {
      console.error('❌ Failed to sync attendance data:', error.message);
      throw error;
    }
  }

  // Disconnect from device
  async disconnect() {
    if (this.device && this.isConnected) {
      try {
        await this.device.disconnect();
        this.isConnected = false;
        console.log('🔌 Disconnected from ZKTeco device');
        return { success: true, message: 'Disconnected from ZKTeco device' };
      } catch (error) {
        console.error('❌ Disconnect error:', error.message);
        throw error;
      }
    }
  }

  // Test connection with different ports
  async testConnection(host = 'splaza.nayatel.net', ports = [4370, 5200, 5000]) {
    const results = [];

    for (const port of ports) {
      try {
        console.log(`\n🔍 Testing port ${port}...`);
        
        // Try to connect
        await this.connect(host, port);
        
        // Test basic operations
        const deviceInfo = await this.getDeviceInfo();
        const users = await this.getUsers();
        const attendance = await this.getAttendanceData();
        
        results.push({
          port,
          success: true,
          deviceInfo,
          usersCount: users.count,
          attendanceCount: attendance.count
        });

        // Disconnect and try next port
        await this.disconnect();
        
        console.log(`✅ Port ${port} works!`);
        console.log(`   Users: ${users.count}`);
        console.log(`   Attendance records: ${attendance.count}`);
        
        // If we found a working port, return early
        return results[results.length - 1];
        
      } catch (error) {
        console.log(`❌ Port ${port} failed: ${error.message}`);
        results.push({
          port,
          success: false,
          error: error.message
        });
        
        // Make sure we're disconnected before trying next port
        if (this.isConnected) {
          try {
            await this.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      }
    }

    return results;
  }
}

module.exports = new ZKTecoService(); 