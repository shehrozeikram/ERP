const ZKLib = require('node-zklib');
const { getDeviceConfig } = require('../config/zktecoConfig');

class ZKTecoService {
  constructor() {
    this.device = null;
    this.isConnected = false;
  }

  // Connect to ZKTeco device
  async connect(host = null, port = null) {
    try {
      const deviceConfig = getDeviceConfig();
      const targetHost = host || deviceConfig.host;
      const targetPort = port || deviceConfig.port;
      
      console.log(`🔌 Connecting to ZKTeco device at ${targetHost}:${targetPort}...`);
      
      // Using the exact format you provided: new ZKLib(IP, port, timeout, inMsgDelay)
      this.device = new ZKLib(targetHost, targetPort, deviceConfig.timeout, deviceConfig.inMsgDelay);

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

  // Get unique users from attendance data (fallback method)
  async getUsersFromAttendance() {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      // Get attendance data first
      const attendanceData = await this.getAttendanceData();
      
      if (!attendanceData.success || !attendanceData.data) {
        return {
          success: true,
          data: [],
          count: 0,
          source: 'attendance_data'
        };
      }

      // Extract unique users from attendance records
      const uniqueUsers = new Map();
      
      attendanceData.data.forEach(record => {
        const userId = record.deviceUserId || record.uid || record.userId;
        if (userId && !uniqueUsers.has(userId)) {
          uniqueUsers.set(userId, {
            uid: userId,
            userId: userId,
            deviceUserId: userId,
            name: `User ${userId}`,
            userName: `User ${userId}`,
            role: 'Employee',
            userRole: 'Employee',
            password: false,
            card: '',
            group: 'Default',
            timeZone: 'UTC',
            privilege: 'User',
            fingerprints: [],
            faces: [],
            status: 'Active',
            lastAttendance: record.recordTime || record.timestamp,
            attendanceCount: 1
          });
        } else if (userId) {
          // Update attendance count for existing user
          const user = uniqueUsers.get(userId);
          user.attendanceCount++;
          if (record.recordTime || record.timestamp) {
            user.lastAttendance = record.recordTime || record.timestamp;
          }
        }
      });

      const usersArray = Array.from(uniqueUsers.values());
      
      return {
        success: true,
        data: usersArray,
        count: usersArray.length,
        source: 'attendance_data'
      };
    } catch (error) {
      console.error('❌ Failed to get users from attendance:', error.message);
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

  // Fetch attendance from device on-demand
  async fetchAttendanceFromDevice(integrationConfig, startDate = null, endDate = null) {
    try {
      console.log('🔄 Fetching attendance from ZKTeco device on-demand...');
      
      // Connect to the device using integration config
      const host = integrationConfig.apiConfig?.endpoints?.attendance?.split(':')[0] || 'splaza.nayatel.net';
      const port = parseInt(integrationConfig.apiConfig?.endpoints?.attendance?.split(':')[1]) || 4370;
      
      await this.connect(host, port);
      
      // Get attendance data from device
      const attendanceData = await this.getAttendanceData();
      
      if (!attendanceData.success || !attendanceData.data || attendanceData.data.length === 0) {
        console.log('ℹ️ No attendance data found on device');
        await this.disconnect();
        return {
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          message: 'No attendance data found on device'
        };
      }
      
      console.log(`📊 Found ${attendanceData.data.length} attendance records on device`);
      
      // Filter by date range if provided
      let filteredData = attendanceData.data;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        filteredData = attendanceData.data.filter(record => {
          const recordDate = new Date(record.recordTime || record.timestamp);
          return recordDate >= start && recordDate <= end;
        });
        console.log(`📅 Filtered to ${filteredData.length} records within date range`);
      }
      
      // Process and sync the attendance data
      const syncResult = await this.syncAttendanceToDatabase();
      
      // Disconnect from device
      await this.disconnect();
      
      return {
        recordsProcessed: filteredData.length,
        recordsCreated: syncResult.syncedRecords || 0,
        recordsUpdated: 0, // We're not updating existing records in this method
        message: `Successfully processed ${filteredData.length} attendance records`,
        deviceInfo: {
          host,
          port,
          totalRecordsOnDevice: attendanceData.data.length,
          filteredRecords: filteredData.length
        }
      };
      
    } catch (error) {
      console.error('❌ Error fetching attendance from device:', error.message);
      
      // Make sure we disconnect on error
      if (this.isConnected) {
        try {
          await this.disconnect();
        } catch (disconnectError) {
          console.error('❌ Error disconnecting:', disconnectError.message);
        }
      }
      
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
        
        const result = {
          port,
          success: true,
          deviceInfo,
          usersCount: users.count || 0,
          attendanceCount: attendance.count || 0
        };

        // Disconnect and try next port
        await this.disconnect();
        
        console.log(`✅ Port ${port} works!`);
        console.log(`   Users: ${result.usersCount}`);
        console.log(`   Attendance records: ${result.attendanceCount}`);
        
        // If we found a working port, return early
        return result;
        
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

    // If all ports failed, return the last error
    if (results.length > 0) {
      const lastResult = results[results.length - 1];
      throw new Error(`All ports failed. Last error (port ${lastResult.port}): ${lastResult.error}`);
    }

    throw new Error('No ports were tested');
  }
}

module.exports = new ZKTecoService(); 