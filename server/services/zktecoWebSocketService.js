const WebSocket = require('ws');
const Employee = require('../models/hr/Employee');
const Attendance = require('../models/hr/Attendance');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

class ZKTecoWebSocketService {
  constructor(io) {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds
    this.connectedClients = new Set();
    this.lastPunchEvent = null;
    this.connectionStatus = 'disconnected';
    this.io = io; // Socket.IO instance for broadcasting to frontend clients
  }

  /**
   * Start WebSocket connection to ZKTeco device
   */
  async startWebSocketConnection() {
    try {
      console.log('🔌 Starting ZKTeco WebSocket connection...');
      
      // Set up WebSocket connection with authentication cookies
      const cookies = [
        'account_info=eyJ1c2VybmFtZSI6ICJhZGlsLmFhbWlyIiwgInBhc3N3b3JkIjogIlBhazEyMzQ1NiIsICJlbXBOYW1lIjogIiIsICJlbXBQd2QiOiAiIiwgInJlbWVtYmVyX21lX2FkbWluIjogImNoZWNrZWQiLCAicmVtZW1iZXJfbWVfZW1wbG95ZWUiOiAiIn0=',
        'csrftoken=KjcOVAc9xIL5pwwuooQbLVgbPHk9rlWY',
        'django_language=en',
        'sessionid=enuay9f6ztl8jqvyd0pdo0ewq7kiw7ak'
      ].join('; ');

      this.ws = new WebSocket('ws://182.180.55.96:85/base/dashboard/realtime_punch/', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      this.setupWebSocketEventHandlers();
      
    } catch (error) {
      console.error('❌ Error starting WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketEventHandlers() {
    this.ws.on('open', () => {
      console.log('✅ Connected to ZKTeco WebSocket!');
      this.isConnected = true;
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      
      // Connection status broadcasts removed to reduce log noise
    });

    this.ws.on('message', async (data) => {
      try {
        await this.handlePunchEvent(data);
      } catch (error) {
        console.error('❌ Error handling punch event:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('🔌 ZKTeco WebSocket connection closed');
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      
      // Connection status broadcasts removed to reduce log noise
      
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('❌ ZKTeco WebSocket error:', error);
      this.connectionStatus = 'error';
      
      // Connection status broadcasts removed to reduce log noise
    });
  }

  /**
   * Handle real-time punch events from ZKTeco
   */
  async handlePunchEvent(data) {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
        console.log('📥 Received punch event from ZKTeco:', parsed.data.length, 'records');
        
        // Process each punch event
        for (const event of parsed.data) {
          await this.processPunchEvent(event);
        }
        
        // Update last punch event
        this.lastPunchEvent = parsed.data[0];
        
        // Broadcast to connected clients
        this.broadcastToClients({
          type: 'realtime_attendance',
          data: parsed.data,
          timestamp: new Date().toISOString(),
          totalRecords: parsed.data.length
        });
      }
      
    } catch (error) {
      console.error('❌ Error parsing punch event:', error);
    }
  }

  /**
   * Process individual punch event
   */
  async processPunchEvent(event) {
    try {
      // Parse event data (array format from ZKTeco)
      const [punchId, empCode, empName, punchTime, punchStatus, snapshotPath, photoPath, location, deviceIcon, verificationMode, gps] = event;
      
      console.log(`📝 Processing punch: ${empName} (${empCode}) - ${punchStatus} at ${punchTime}`);
      
      // Find employee by code
      const employee = await Employee.findOne({
        $or: [
          { employeeId: empCode },
          { deviceUserId: empCode },
          { biometricId: empCode }
        ],
        isActive: true
      });
      
      if (!employee) {
        console.log(`⚠️ Employee not found for code: ${empCode}`);
        return;
      }
      
      // Process timestamp (convert to full date)
      const today = new Date();
      const [hours, minutes, seconds] = punchTime.split(':');
      const punchDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
      
      // Determine check-in/check-out/break events
      const isCheckIn = punchStatus === 'Check In';
      const isCheckOut = punchStatus === 'Check Out';
      const isBreakOut = punchStatus === 'Break Out';
      
      // Check if attendance record exists for today
      const existingAttendance = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        },
        isActive: true
      });
      
      let attendance;
      
      if (existingAttendance) {
        // For attendance tracking, we want to record EVERY punch event
        // So we'll create a new record for each punch, not update existing ones
        
        // Create new attendance record for this punch event
        const attendanceData = {
          employee: employee._id,
          date: today,
          isActive: true,
          isRealTime: true,
          lastRealTimeUpdate: new Date(),
          deviceType: 'ZKTeco',
          deviceId: 'ZKTeco_Device',
          location: location || 'Office'
        };
        
        if (isCheckIn) {
          attendanceData.checkIn = {
            time: punchDateTime,
            location: location || 'Office',
            method: 'Biometric',
            deviceId: 'ZKTeco_Device',
            deviceType: 'ZKTeco'
          };
        } else if (isCheckOut || isBreakOut) {
          // Handle both Check Out and Break Out the same way for now
          attendanceData.checkOut = {
            time: punchDateTime,
            location: location || 'Office',
            method: 'Biometric',
            deviceId: 'ZKTeco_Device',
            deviceType: 'ZKTeco'
          };
        }
        
        attendance = new Attendance(attendanceData);
        await attendance.save();
        
      } else {
        // Create new attendance record
        const attendanceData = {
          employee: employee._id,
          date: today,
          isActive: true,
          isRealTime: true,
          lastRealTimeUpdate: new Date(),
          deviceType: 'ZKTeco',
          deviceId: 'ZKTeco_Device',
          location: location || 'Office'
        };
        
        if (isCheckIn) {
          attendanceData.checkIn = {
            time: punchDateTime,
            location: location || 'Office',
            method: 'Biometric',
            deviceId: 'ZKTeco_Device',
            deviceType: 'ZKTeco'
          };
        } else if (isCheckOut || isBreakOut) {
          // Handle both Check Out and Break Out the same way for now
          attendanceData.checkOut = {
            time: punchDateTime,
            location: location || 'Office',
            method: 'Biometric',
            deviceId: 'ZKTeco_Device',
            deviceType: 'ZKTeco'
          };
        }
        
        attendance = new Attendance(attendanceData);
        await attendance.save();
      }
      
      // Populate employee details
      await attendance.populate('employee', 'firstName lastName employeeId');
      
      console.log(`✅ Punch processed: ${employee.firstName} ${employee.lastName} - ${punchStatus}`);
      
      // Broadcast attendance update to frontend clients
      this.broadcastToClients({
        type: 'attendance_update',
        data: {
          type: 'attendance_added', // Always 'attendance_added' since we create new records for each punch
          attendance: attendance,
          employee: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeId: employee.employeeId
          },
          action: punchStatus,
          timestamp: punchDateTime
        }
      });
      
    } catch (error) {
      console.error('❌ Error processing punch event:', error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // Reconnection attempts are now silent to reduce log noise
      
      setTimeout(() => {
        this.startWebSocketConnection();
      }, this.reconnectInterval);
    } else {
      console.error('❌ Max reconnection attempts reached. Manual restart required.');
    }
  }

  /**
   * Add client to connected clients
   */
  addClient(client) {
    this.connectedClients.add(client);
    // Client connection logs are now silent to reduce log noise
  }

  /**
   * Remove client from connected clients
   */
  removeClient(client) {
    this.connectedClients.delete(client);
    // Client disconnection logs are now silent to reduce log noise
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToClients(message) {
    // Broadcast to Socket.IO clients in attendance room
    if (this.io) {
      this.io.to('attendance').emit('attendance_update', {
        type: 'realtime_attendance',
        data: message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Also broadcast to WebSocket clients if any
    this.connectedClients.forEach(client => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error('❌ Error broadcasting to WebSocket client:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionStatus: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      connectedClients: this.connectedClients.size,
      lastPunchEvent: this.lastPunchEvent,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stop WebSocket connection
   */
  stopWebSocketConnection() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.connectionStatus = 'stopped';
      console.log('🛑 ZKTeco WebSocket connection stopped');
    }
  }
}

module.exports = ZKTecoWebSocketService;
