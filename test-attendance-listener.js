require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('./server/models/hr/Attendance');
const Employee = require('./server/models/hr/Employee');

// Simple polling listener that works with any MongoDB
class SimpleAttendanceListener {
  constructor() {
    this.lastChecked = new Date();
    this.isRunning = false;
  }

  async start() {
    try {
      console.log('🚀 Starting Simple Attendance Listener...');
      
      // Connect with IPv4
      await mongoose.connect('mongodb://127.0.0.1:27017/sgc_erp');
      console.log('✅ Connected to MongoDB');
      
      this.isRunning = true;
      this.lastChecked = new Date();
      
      console.log('🎧 Monitoring attendance records...');
      console.log('👂 Checking every 2 seconds for new records...');
      console.log('===============================================\n');
      
      // Check every 2 seconds
      setInterval(async () => {
        if (this.isRunning) {
          await this.checkForNewRecords();
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ Error starting listener:', error.message);
    }
  }

  async checkForNewRecords() {
    try {
      // Find records created since last check
      const newRecords = await Attendance.find({
        createdAt: { $gt: this.lastChecked },
        isActive: true
      })
      .populate('employee', 'firstName lastName employeeId')
      .sort({ createdAt: -1 })
      .lean();

      if (newRecords.length > 0) {
        console.log(`🔥 ===============================================`);
        console.log(`🔥 ⚡ DETECTED ${newRecords.length} NEW ATTENDANCE RECORD(S)! ⚡`);
        console.log(`🔥 ===============================================`);
        
        for (const record of newRecords) {
          console.log(`👤 ${record.employee?.firstName} ${record.employee?.lastName} (${record.employee?.employeeId})`);
          
          if (record.checkIn?.time) {
            const checkInTime = new Date(record.checkIn.time).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', hour12: true 
            });
            console.log(`⏰ Check-in: ${checkInTime} (${record.checkIn.location})`);
          }
          
          if (record.checkOut?.time) {
            const checkOutTime = new Date(record.checkOut.time).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', hour12: true 
            });
            console.log(`⏰ Check-out: ${checkOutTime} (${record.checkOut.location})`);
          }
          
          // Calculate work hours
          let workHours = 'N/A';
          if (record.checkIn?.time && record.checkOut?.time) {
            const diffHours = (new Date(record.checkOut.time) - new Date(record.checkIn.time)) / (1000 * 60 * 60);
            workHours = `${diffHours.toFixed(2)} hrs`;
          }
          
          console.log(`⏱️ Work Hours: ${workHours}`);
          console.log(`📍 Status: ${record.status} ✅`);
          console.log(`🕐 Created: ${new Date(record.createdAt).toLocaleString()}`);
          console.log(`💾 ID: ${record._id}`);
          console.log('---');
        }
        
        console.log(`🔥 ===============================================\n`);
      }

      this.lastChecked = new Date();
      
    } catch (error) {
      console.error('❌ Error checking records:', error.message);
    }
  }
}

// Start the listener
const listener = new SimpleAttendanceListener();
listener.start();

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping attendance listener...');
  process.exit(0);
});

