const mongoose = require('mongoose');
const Attendance = require('../models/hr/Attendance');

class ChangeStreamService {
  constructor(io) {
    this.io = io;
    this.changeStream = null;
    this.isWatching = false;
  }

  // Start watching for changes in the attendance collection
  async startWatching() {
    try {
      if (this.isWatching) {
        console.log('🔄 Change stream already running');
        return;
      }

      console.log('🚀 Starting MongoDB Change Streams for attendance collection...');
      
      // Get the native MongoDB collection
      const collection = mongoose.connection.db.collection('attendances');
      
      // Create change stream
      this.changeStream = collection.watch([
        {
          $match: {
            operationType: { $in: ['insert', 'update', 'replace', 'delete'] }
          }
        }
      ]);

      // Listen for changes
      this.changeStream.on('change', (change) => {
        console.log('📊 Change detected in attendance collection:', change.operationType);
        this.handleChange(change);
      });

      this.changeStream.on('error', (error) => {
        console.error('❌ Change stream error:', error);
        this.isWatching = false;
        // Attempt to restart after error
        setTimeout(() => this.startWatching(), 5000);
      });

      this.isWatching = true;
      console.log('✅ MongoDB Change Streams started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start change stream:', error);
      this.isWatching = false;
    }
  }

  // Handle changes and broadcast to connected clients
  async handleChange(change) {
    try {
      let attendanceData = null;
      let operation = change.operationType;

      switch (operation) {
        case 'insert':
          // New attendance record
          attendanceData = change.fullDocument;
          if (attendanceData) {
            // Populate employee details
            attendanceData = await this.populateEmployeeDetails(attendanceData);
            this.broadcastAttendanceUpdate('attendance_added', attendanceData);
          }
          break;

        case 'update':
        case 'replace':
          // Updated attendance record
          const documentId = change.documentKey._id;
          if (documentId) {
            attendanceData = await Attendance.findById(documentId)
              .populate('employee', 'firstName lastName employeeId department position')
              .lean();
            if (attendanceData) {
              this.broadcastAttendanceUpdate('attendance_updated', attendanceData);
            }
          }
          break;

        case 'delete':
          // Deleted attendance record
          this.broadcastAttendanceUpdate('attendance_deleted', { _id: change.documentKey._id });
          break;
      }

    } catch (error) {
      console.error('❌ Error handling change stream event:', error);
    }
  }

  // Populate employee details for new records
  async populateEmployeeDetails(attendanceData) {
    try {
      if (attendanceData.employee) {
        const Employee = require('../models/hr/Employee');
        const employee = await Employee.findById(attendanceData.employee)
          .select('firstName lastName employeeId department position')
          .lean();
        
        if (employee) {
          attendanceData.employee = employee;
        }
      }
      return attendanceData;
    } catch (error) {
      console.error('❌ Error populating employee details:', error);
      return attendanceData;
    }
  }

  // Broadcast attendance updates to all connected clients
  broadcastAttendanceUpdate(eventType, data) {
    if (this.io) {
      console.log(`📡 Broadcasting ${eventType}:`, data._id || data.employee?.employeeId);
      this.io.emit('attendance_update', {
        type: eventType,
        data: data,
        timestamp: new Date()
      });
    }
  }

  // Stop watching for changes
  stopWatching() {
    if (this.changeStream) {
      console.log('🛑 Stopping MongoDB Change Streams...');
      this.changeStream.close();
      this.changeStream = null;
      this.isWatching = false;
      console.log('✅ MongoDB Change Streams stopped');
    }
  }

  // Get current status
  getStatus() {
    return {
      isWatching: this.isWatching,
      hasIO: !!this.io
    };
  }
}

module.exports = ChangeStreamService;
