const mongoose = require('mongoose');

class ChangeStreamService {
  constructor() {
    this.changeStreams = new Map();
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('Change Stream Service is already running');
      return;
    }

    try {
      console.log('🚀 Starting Change Stream Service...');
      
      // Start change streams for different collections
      await this.startAttendanceChangeStream();
      await this.startEmployeeChangeStream();
      await this.startPayrollChangeStream();
      
      this.isRunning = true;
      console.log('✅ Change Stream Service started successfully');
      
    } catch (error) {
      console.error('❌ Error starting Change Stream Service:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Change Stream Service is not running');
      return;
    }

    try {
      console.log('🛑 Stopping Change Stream Service...');
      
      // Close all change streams
      for (const [collection, stream] of this.changeStreams) {
        if (stream) {
          stream.close();
          console.log(`📴 Closed change stream for ${collection}`);
        }
      }
      
      this.changeStreams.clear();
      this.isRunning = false;
      
      console.log('✅ Change Stream Service stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping Change Stream Service:', error);
      throw error;
    }
  }

  async startAttendanceChangeStream() {
    try {
      const Attendance = mongoose.model('Attendance');
      const changeStream = Attendance.watch();
      
      changeStream.on('change', async (change) => {
        try {
          console.log('📊 Attendance change detected:', change.operationType);
          
          switch (change.operationType) {
            case 'insert':
              await this.handleAttendanceInsert(change.fullDocument);
              break;
            case 'update':
              await this.handleAttendanceUpdate(change.documentKey._id, change.updateDescription);
              break;
            case 'delete':
              await this.handleAttendanceDelete(change.documentKey._id);
              break;
          }
        } catch (error) {
          console.error('❌ Error handling attendance change:', error);
        }
      });

      changeStream.on('error', (error) => {
        console.error('❌ Attendance change stream error:', error);
      });

      this.changeStreams.set('attendance', changeStream);
      console.log('📡 Attendance change stream started');
      
    } catch (error) {
      console.error('❌ Error starting attendance change stream:', error);
    }
  }

  async startEmployeeChangeStream() {
    try {
      const Employee = mongoose.model('Employee');
      const changeStream = Employee.watch();
      
      changeStream.on('change', async (change) => {
        try {
          console.log('👤 Employee change detected:', change.operationType);
          
          switch (change.operationType) {
            case 'insert':
              await this.handleEmployeeInsert(change.fullDocument);
              break;
            case 'update':
              await this.handleEmployeeUpdate(change.documentKey._id, change.updateDescription);
              break;
            case 'delete':
              await this.handleEmployeeDelete(change.documentKey._id);
              break;
          }
        } catch (error) {
          console.error('❌ Error handling employee change:', error);
        }
      });

      changeStream.on('error', (error) => {
        console.error('❌ Employee change stream error:', error);
      });

      this.changeStreams.set('employee', changeStream);
      console.log('📡 Employee change stream started');
      
    } catch (error) {
      console.error('❌ Error starting employee change stream:', error);
    }
  }

  async startPayrollChangeStream() {
    try {
      const Payroll = mongoose.model('Payroll');
      const changeStream = Payroll.watch();
      
      changeStream.on('change', async (change) => {
        try {
          console.log('💰 Payroll change detected:', change.operationType);
          
          switch (change.operationType) {
            case 'insert':
              await this.handlePayrollInsert(change.fullDocument);
              break;
            case 'update':
              await this.handlePayrollUpdate(change.documentKey._id, change.updateDescription);
              break;
            case 'delete':
              await this.handlePayrollDelete(change.documentKey._id);
              break;
          }
        } catch (error) {
          console.error('❌ Error handling payroll change:', error);
        }
      });

      changeStream.on('error', (error) => {
        console.error('❌ Payroll change stream error:', error);
      });

      this.changeStreams.set('payroll', changeStream);
      console.log('📡 Payroll change stream started');
      
    } catch (error) {
      console.error('❌ Error starting payroll change stream:', error);
    }
  }

  async handleAttendanceInsert(attendance) {
    try {
      console.log('✅ New attendance record:', attendance.employeeId, attendance.date);
      
      // Handle new attendance record
      // This could involve notifications, real-time updates, etc.
      
    } catch (error) {
      console.error('❌ Error handling attendance insert:', error);
    }
  }

  async handleAttendanceUpdate(attendanceId, updateDescription) {
    try {
      console.log('📝 Attendance updated:', attendanceId);
      
      // Handle attendance update
      // This could involve notifications, real-time updates, etc.
      
    } catch (error) {
      console.error('❌ Error handling attendance update:', error);
    }
  }

  async handleAttendanceDelete(attendanceId) {
    try {
      console.log('🗑️ Attendance deleted:', attendanceId);
      
      // Handle attendance deletion
      // This could involve cleanup, notifications, etc.
      
    } catch (error) {
      console.error('❌ Error handling attendance delete:', error);
    }
  }

  async handleEmployeeInsert(employee) {
    try {
      console.log('✅ New employee:', employee.employeeId, employee.name);
      
      // Handle new employee
      // This could involve onboarding tasks, notifications, etc.
      
    } catch (error) {
      console.error('❌ Error handling employee insert:', error);
    }
  }

  async handleEmployeeUpdate(employeeId, updateDescription) {
    try {
      console.log('📝 Employee updated:', employeeId);
      
      // Handle employee update
      // This could involve notifications, real-time updates, etc.
      
    } catch (error) {
      console.error('❌ Error handling employee update:', error);
    }
  }

  async handleEmployeeDelete(employeeId) {
    try {
      console.log('🗑️ Employee deleted:', employeeId);
      
      // Handle employee deletion
      // This could involve cleanup, notifications, etc.
      
    } catch (error) {
      console.error('❌ Error handling employee delete:', error);
    }
  }

  async handlePayrollInsert(payroll) {
    try {
      console.log('✅ New payroll record:', payroll.employeeId, payroll.month);
      
      // Handle new payroll record
      // This could involve notifications, real-time updates, etc.
      
    } catch (error) {
      console.error('❌ Error handling payroll insert:', error);
    }
  }

  async handlePayrollUpdate(payrollId, updateDescription) {
    try {
      console.log('📝 Payroll updated:', payrollId);
      
      // Handle payroll update
      // This could involve notifications, real-time updates, etc.
      
    } catch (error) {
      console.error('❌ Error handling payroll update:', error);
    }
  }

  async handlePayrollDelete(payrollId) {
    try {
      console.log('🗑️ Payroll deleted:', payrollId);
      
      // Handle payroll deletion
      // This could involve cleanup, notifications, etc.
      
    } catch (error) {
      console.error('❌ Error handling payroll delete:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeStreams: Array.from(this.changeStreams.keys()),
      streamsCount: this.changeStreams.size
    };
  }
}

module.exports = new ChangeStreamService();
