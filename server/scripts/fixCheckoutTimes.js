#!/usr/bin/env node

/**
 * Fix Check-out Times
 * 
 * This script quickly fixes check-out times for existing attendance records.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function fixCheckoutTimes() {
  try {
    console.log('🔧 Fixing check-out times for today\'s attendance...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get today's date range in Pakistan timezone
    const today = new Date();
    const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5 for Pakistan
    const todayStart = new Date(today.getTime() - pakistanOffset);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Find all attendance records for today
    const todayAttendance = await Attendance.find({
      date: {
        $gte: todayStart,
        $lt: todayEnd
      },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');

    console.log(`📊 Found ${todayAttendance.length} attendance records for today`);

    // Get ZKTeco data for today
    const zktecoService = require('../services/zktecoService');
    await zktecoService.connect('splaza.nayatel.net', 4370);
    
    const attendanceData = await zktecoService.getAttendanceData();
    await zktecoService.disconnect();

    if (!attendanceData.success || !attendanceData.data) {
      throw new Error('Failed to get ZKTeco data');
    }

    // Filter today's records
    const todayRecords = attendanceData.data.filter(record => {
      const recordDate = new Date(record.recordTime);
      return recordDate >= todayStart && recordDate < todayEnd;
    });

    console.log(`📊 Found ${todayRecords.length} ZKTeco records for today`);

    // Group ZKTeco records by employee
    const employeeRecords = new Map();

    todayRecords.forEach(record => {
      const employeeId = record.deviceUserId || record.userId;
      const timestamp = processZKTecoTimestamp(record.recordTime);
      
      if (!employeeRecords.has(employeeId)) {
        employeeRecords.set(employeeId, []);
      }

      employeeRecords.get(employeeId).push(timestamp);
    });

    // Fix check-out times
    let updated = 0;
    let errors = 0;

    for (const attendance of todayAttendance) {
      try {
        const employeeId = attendance.employee?.employeeId;
        if (!employeeId) continue;

        const records = employeeRecords.get(employeeId.toString());
        if (!records || records.length < 2) continue;

        // Sort records by time
        records.sort((a, b) => a - b);
        
        const checkInTime = records[0];
        const checkOutTime = records[records.length - 1];

        // Only update if we have a valid check-out time and it's different from check-in
        if (checkOutTime && checkOutTime > checkInTime) {
          // Update check-in time (earliest record)
          if (!attendance.checkIn || !attendance.checkIn.time || new Date(attendance.checkIn.time) > checkInTime) {
            attendance.checkIn = {
              time: checkInTime,
              location: 'Biometric Device',
              method: 'Biometric'
            };
          }

          // Update check-out time (latest record)
          if (!attendance.checkOut || !attendance.checkOut.time || new Date(attendance.checkOut.time) < checkOutTime) {
            attendance.checkOut = {
              time: checkOutTime,
              location: 'Biometric Device',
              method: 'Biometric'
            };
          }

          await attendance.save();
          updated++;
          
          console.log(`✅ ${attendance.employee.firstName} ${attendance.employee.lastName} (${employeeId}) - Check-in: ${formatLocalDateTime(checkInTime)} | Check-out: ${formatLocalDateTime(checkOutTime)}`);
        }

      } catch (error) {
        console.error(`❌ Error updating ${attendance.employee?.firstName} ${attendance.employee?.lastName}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Updated: ${updated} records`);
    console.log(`  Errors: ${errors} records`);

  } catch (error) {
    console.error('❌ Error fixing check-out times:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the fix
fixCheckoutTimes(); 