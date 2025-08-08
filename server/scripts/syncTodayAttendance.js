#!/usr/bin/env node

/**
 * Sync Today's Attendance from ZKTeco Device
 * 
 * This script syncs today's attendance data from the ZKTeco device to the database.
 * 
 * Usage: node server/scripts/syncTodayAttendance.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');
const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function syncTodayAttendance() {
  try {
    console.log('🔄 Syncing today\'s attendance from ZKTeco device...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Connect to ZKTeco device
    console.log('🔌 Connecting to ZKTeco device...');
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');

    // Get attendance data from device
    console.log('📥 Fetching attendance data from device...');
    const attendanceData = await zktecoService.getAttendanceData();
    
    if (!attendanceData.success || !attendanceData.data) {
      throw new Error('Failed to get attendance data from device');
    }

    console.log(`📊 Found ${attendanceData.data.length} total attendance records on device`);

    // Get today's date range in Pakistan timezone
    const today = new Date();
    const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5 for Pakistan
    const todayStart = new Date(today.getTime() - pakistanOffset);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    console.log(`📅 Filtering for today (Pakistan time): ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    // Filter records for today
    const todayRecords = attendanceData.data.filter(record => {
      const recordDate = new Date(record.recordTime);
      return recordDate >= todayStart && recordDate < todayEnd;
    });

    console.log(`📊 Found ${todayRecords.length} attendance records for today`);

    if (todayRecords.length === 0) {
      console.log('❌ No attendance records found for today on the device');
      return;
    }

    // Group records by employee and date
    const employeeAttendance = new Map();

    todayRecords.forEach(record => {
      try {
        const employeeId = record.deviceUserId || record.userId;
        const rawTimestamp = record.recordTime;
        const timestamp = processZKTecoTimestamp(rawTimestamp);
        
        if (!timestamp) {
          console.warn(`⚠️ Invalid timestamp for employee ${employeeId}: ${rawTimestamp}`);
          return;
        }

        // Get date key in Pakistan timezone
        const dateKey = timestamp.toLocaleDateString('en-CA', { 
          timeZone: 'Asia/Karachi' 
        });
        const key = `${employeeId}-${dateKey}`;

        if (!employeeAttendance.has(key)) {
          employeeAttendance.set(key, {
            employeeId,
            date: timestamp,
            checkInTime: null,
            checkOutTime: null,
            deviceId: 'ZKTeco Device',
            method: 'Biometric',
            location: 'Office'
          });
        }

        const attendance = employeeAttendance.get(key);
        
        // Since ZKTeco doesn't provide state field, we'll use time-based logic
        // First record of the day = check-in, subsequent records = check-out
        if (!attendance.checkInTime) {
          // First record = check-in
          attendance.checkInTime = timestamp;
        } else {
          // Subsequent records = check-out (use the latest time)
          if (!attendance.checkOutTime || timestamp > new Date(attendance.checkOutTime)) {
            attendance.checkOutTime = timestamp;
          }
        }

      } catch (error) {
        console.error(`❌ Error processing record:`, error);
      }
    });

    console.log(`📊 Processed ${employeeAttendance.size} employee attendance records for today`);

    // Save attendance records to database
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const [key, attendanceData] of employeeAttendance) {
      try {
        // Find employee
        const employee = await Employee.findOne({ employeeId: attendanceData.employeeId.toString() });
        if (!employee) {
          console.warn(`⚠️ Employee not found: ${attendanceData.employeeId}`);
          errors++;
          continue;
        }

        // Get attendance date in Pakistan timezone
        const attendanceDate = new Date(attendanceData.date.toLocaleDateString('en-CA', { 
          timeZone: 'Asia/Karachi' 
        }) + 'T00:00:00.000Z');

        // Find existing attendance record
        let attendance = await Attendance.findOne({
          employee: employee._id,
          date: {
            $gte: attendanceDate,
            $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
          },
          isActive: true
        });

        if (!attendance) {
          // Create new attendance record
          attendance = new Attendance({
            employee: employee._id,
            date: attendanceDate,
            status: 'Present',
            isActive: true
          });
          created++;
        } else {
          updated++;
        }

        // Update check-in/check-out times
        if (attendanceData.checkInTime) {
          attendance.checkIn = {
            time: attendanceData.checkInTime,
            location: 'Biometric Device',
            method: 'Biometric'
          };
        }

        if (attendanceData.checkOutTime) {
          attendance.checkOut = {
            time: attendanceData.checkOutTime,
            location: 'Biometric Device',
            method: 'Biometric'
          };
        }

        // Only save if we have at least a check-in time
        if (attendanceData.checkInTime) {
          await attendance.save();
          console.log(`✅ ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${attendanceData.checkInTime ? 'Check-in: ' + formatLocalDateTime(attendanceData.checkInTime) : ''} ${attendanceData.checkOutTime ? 'Check-out: ' + formatLocalDateTime(attendanceData.checkOutTime) : ''}`);
        } else {
          console.log(`⚠️ Skipping ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - No check-in time available`);
        }

      } catch (error) {
        console.error(`❌ Error saving attendance for employee ${attendanceData.employeeId}:`, error);
        errors++;
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`   Created: ${created} new attendance records`);
    console.log(`   Updated: ${updated} existing attendance records`);
    console.log(`   Errors:  ${errors} errors`);

    // Disconnect from device
    await zktecoService.disconnect();
    console.log('🔌 Disconnected from ZKTeco device');

  } catch (error) {
    console.error('❌ Error syncing today\'s attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the sync
syncTodayAttendance(); 