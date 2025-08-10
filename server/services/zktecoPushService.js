/**
 * ZKTeco Push SDK Service
 * 
 * Handles real-time attendance notifications from ZKTeco devices
 * using Push SDK/HTTP server endpoint functionality.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');
const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');

class ZKTecoPushService {
  constructor() {
    this.pushServer = null;
    this.wss = null;
    this.clients = new Set();
    this.isRunning = false;
    this.port = process.env.ZKTECO_PUSH_PORT || 8080;
    this.deviceConfig = {
      host: 'splaza.nayatel.net',
      port: 4370,
      pushEndpoint: '/zkteco/push'
    };
  }

  /**
   * Start the push notification server
   */
  async startPushServer() {
    try {
      if (this.isRunning) {
        console.log('⚠️ Push server is already running');
        return { success: true, message: 'Push server already running' };
      }

      console.log('🚀 Starting ZKTeco Push SDK server...');
      
      // Create Express app for HTTP endpoints
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      // Add CORS support for cross-origin requests
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });

      // ZKTeco Push endpoint - receives real-time attendance data
      app.post(this.deviceConfig.pushEndpoint, async (req, res) => {
        try {
          console.log('📥 Received real-time attendance data:', req.body);
          
          const attendanceData = req.body;
          const result = await this.processRealTimeAttendance(attendanceData);
          
          // Broadcast successful records to connected WebSocket clients
          if (result.records && result.records.length > 0) {
            result.records.forEach((record, index) => {
              if (record.success) {
                // Broadcast individual attendance record
                this.broadcastToClients({
                  type: 'attendance',
                  data: record,
                  timestamp: new Date().toISOString()
                });
              }
            });
          }

          res.json({ success: true, message: 'Attendance processed successfully' });
        } catch (error) {
          console.error('❌ Error processing real-time attendance:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      });

      // Health check endpoint
      app.get('/zkteco/health', (req, res) => {
        res.json({ 
          success: true, 
          status: 'running',
          timestamp: new Date().toISOString(),
          clients: this.clients.size
        });
      });

      // Start HTTP server
      this.pushServer = http.createServer(app);
      this.pushServer.listen(this.port, () => {
        console.log(`✅ ZKTeco Push server running on port ${this.port}`);
        console.log(`📡 Push endpoint: http://localhost:${this.port}${this.deviceConfig.pushEndpoint}`);
        console.log(`🔍 Health check: http://localhost:${this.port}/zkteco/health`);
      });

      // Start WebSocket server for real-time updates
      this.wss = new WebSocket.Server({ 
        server: this.pushServer,
        clientTracking: true,
        perMessageDeflate: false
      });
      
      this.wss.on('connection', (ws, req) => {
        console.log('🔌 New WebSocket client connected from:', req.socket.remoteAddress);
        this.clients.add(ws);

        // Send current status
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Connected to ZKTeco real-time attendance',
          timestamp: new Date().toISOString()
        }));

        ws.on('close', () => {
          console.log('🔌 WebSocket client disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          this.clients.delete(ws);
        });
      });

      this.wss.on('error', (error) => {
        console.error('❌ WebSocket server error:', error);
      });

      this.isRunning = true;
      
      console.log('🎉 ZKTeco Push SDK server started successfully!');
      console.log('📋 Next steps:');
      console.log('   1. Configure ZKTeco device to send push notifications to:');
      console.log(`      http://your-server-ip:${this.port}${this.deviceConfig.pushEndpoint}`);
      console.log('   2. Real-time attendance will appear instantly in the Attendance module');
      console.log('   3. WebSocket clients will receive live updates');

      return { 
        success: true, 
        message: 'Push server started successfully',
        port: this.port,
        pushEndpoint: this.deviceConfig.pushEndpoint
      };

    } catch (error) {
      console.error('❌ Failed to start push server:', error);
      throw error;
    }
  }

  /**
   * Stop the push notification server
   */
  async stopPushServer() {
    try {
      if (!this.isRunning) {
        return { success: true, message: 'Push server not running' };
      }

      console.log('🛑 Stopping ZKTeco Push SDK server...');

      // Close WebSocket connections
      if (this.wss) {
        this.wss.clients.forEach((client) => {
          client.close();
        });
        this.wss.close();
        this.wss = null;
      }

      // Close HTTP server
      if (this.pushServer) {
        this.pushServer.close();
        this.pushServer = null;
      }

      this.clients.clear();
      this.isRunning = false;

      console.log('✅ ZKTeco Push SDK server stopped');
      return { success: true, message: 'Push server stopped successfully' };

    } catch (error) {
      console.error('❌ Error stopping push server:', error);
      throw error;
    }
  }

  /**
   * Process real-time attendance data from ZKTeco device
   */
  async processRealTimeAttendance(attendanceData) {
    try {
      console.log('🔄 Processing real-time attendance data...');

      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        records: []
      };

      // Handle single record or array of records
      const records = Array.isArray(attendanceData) ? attendanceData : [attendanceData];

      for (const record of records) {
        try {
          const result = await this.processSingleAttendanceRecord(record);
          results.records.push(result);
          
          if (result.success) {
            results.processed++;
            if (result.action === 'created') {
              results.created++;
            } else if (result.action === 'updated') {
              results.updated++;
            }
          } else {
            results.errors++;
          }
        } catch (error) {
          console.error('❌ Error processing record:', error);
          results.errors++;
          results.records.push({
            success: false,
            error: error.message,
            record
          });
        }
      }

      console.log(`✅ Real-time processing complete: ${results.processed} processed, ${results.created} created, ${results.updated} updated, ${results.errors} errors`);

      return results;

    } catch (error) {
      console.error('❌ Error processing real-time attendance:', error);
      throw error;
    }
  }

  /**
   * Process a single attendance record
   */
  async processSingleAttendanceRecord(record) {
    try {
      // Extract employee ID and timestamp
      const employeeId = record.deviceUserId || record.uid || record.userId;
      const rawTimestamp = record.recordTime || record.timestamp;
      
      if (!employeeId || !rawTimestamp) {
        return {
          success: false,
          error: 'Missing employee ID or timestamp',
          record
        };
      }

      // Process timestamp with local timezone
      const timestamp = processZKTecoTimestamp(rawTimestamp);
      if (!timestamp) {
        return {
          success: false,
          error: 'Invalid timestamp',
          record
        };
      }

      // Find employee
      const employee = await Employee.findOne({ employeeId: employeeId.toString() });
      if (!employee) {
        return {
          success: false,
          error: `Employee not found: ${employeeId}`,
          record
        };
      }

      // Get date for attendance record - use the timestamp's date directly
      // ZKTeco sends timestamps in Pakistan time, so extract the date part
      const attendanceDate = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());

      // Find existing attendance record
      let attendance = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: attendanceDate,
          $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
        },
        isActive: true
      });

      const isCheckIn = record.state === 0 || record.state === '0' || record.state === 'IN';
      let action = 'none';

      if (!attendance) {
        // Create new attendance record
        attendance = new Attendance({
          employee: employee._id,
          date: attendanceDate,
          status: 'Present',
          isActive: true
        });

        if (isCheckIn) {
          attendance.checkIn = {
            time: timestamp,
            location: 'Biometric Device',
            method: 'Biometric'
          };
        } else {
          // For check-out, also set a default check-in if required by schema
          attendance.checkIn = {
            time: timestamp, // Use same time as default
            location: 'Biometric Device',
            method: 'Biometric'
          };
          attendance.checkOut = {
            time: timestamp,
            location: 'Biometric Device',
            method: 'Biometric'
          };
        }

        await attendance.save();
        action = 'created';
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
          // Ensure updatedAt is set to current time for proper sorting
          attendance.updatedAt = new Date();
          await attendance.save();
          action = 'updated';
        }
      }

      const result = {
        success: true,
        action,
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        timestamp: formatLocalDateTime(timestamp), // Send as formatted local time string
        localTimestamp: timestamp.toISOString(), // Keep ISO for consistency
        isCheckIn,
        attendanceId: attendance._id,
        attendance: {
          _id: attendance._id,
          date: attendance.date,
          status: attendance.status,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          workHours: attendance.workHours,
          updatedAt: attendance.updatedAt,
          createdAt: attendance.createdAt
        }
      };

      console.log(`✅ Real-time: ${employee.firstName} ${employee.lastName} (${employeeId}) - ${isCheckIn ? 'Check-in' : 'Check-out'} at ${formatLocalDateTime(timestamp)}`);

      return result;

    } catch (error) {
      console.error('❌ Error processing single attendance record:', error);
      return {
        success: false,
        error: error.message,
        record
      };
    }
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcastToClients(message) {
    console.log(`📡 Broadcasting to ${this.clients.size} clients:`, message);
    
    if (!this.wss || this.clients.size === 0) {
      console.log('⚠️ No WebSocket server or no clients connected');
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
        sentCount++;
      } else {
        console.log('⚠️ Client connection not open, state:', client.readyState);
      }
    });
    
    console.log(`✅ Message broadcasted to ${sentCount} clients`);
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      pushEndpoint: this.deviceConfig.pushEndpoint,
      clients: this.clients.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Configure device settings
   */
  configureDevice(config) {
    this.deviceConfig = { ...this.deviceConfig, ...config };
    console.log('⚙️ Device configuration updated:', this.deviceConfig);
  }
}

// Export singleton instance
module.exports = new ZKTecoPushService(); 