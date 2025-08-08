#!/usr/bin/env node

/**
 * Fix Historical Attendance Data
 * 
 * This script fixes all historical attendance data with correct check-in and check-out times.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function fixHistoricalAttendance() {
  try {
    console.log('🔧 Fixing historical attendance data...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get ZKTeco data for the last 30 days
    const zktecoService = require('../services/zktecoService');
    await zktecoService.connect('splaza.nayatel.net', 4370);
    
    const attendanceData = await zktecoService.getAttendanceData();
    await zktecoService.disconnect();

    if (!attendanceData.success || !attendanceData.data) {
      throw new Error('Failed to get ZKTeco data');
    }

    console.log(`📊 Found ${attendanceData.data.length} total ZKTeco records`);

    // Get date range for last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5 for Pakistan
    
    const startDate = new Date(thirtyDaysAgo.getTime() - pakistanOffset);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today.getTime() - pakistanOffset);
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Processing data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Filter records for the last 30 days
    const historicalRecords = attendanceData.data.filter(record => {
      const recordDate = new Date(record.recordTime);
      return recordDate >= startDate && recordDate <= endDate;
    });

    console.log(`📊 Found ${historicalRecords.length} historical records`);

    // Group records by employee and date
    const employeeDateRecords = new Map();

    historicalRecords.forEach(record => {
      const employeeId = record.deviceUserId || record.userId;
      const timestamp = processZKTecoTimestamp(record.recordTime);
      
      if (!timestamp) return;

      // Get date key in Pakistan timezone
      const dateKey = timestamp.toLocaleDateString('en-CA', { 
        timeZone: 'Asia/Karachi' 
      });
      const key = `${employeeId}-${dateKey}`;

      if (!employeeDateRecords.has(key)) {
        employeeDateRecords.set(key, []);
      }

      employeeDateRecords.get(key).push(timestamp);
    });

    console.log(`📊 Found ${employeeDateRecords.size} employee-date combinations`);

    // Get all attendance records for the last 30 days
    const historicalAttendance = await Attendance.find({
      date: {
        $gte: startDate,
        $lte: endDate
      },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId');

    console.log(`📊 Found ${historicalAttendance.length} historical attendance records`);

    // Fix each attendance record
    let updated = 0;
    let errors = 0;

    for (const attendance of historicalAttendance) {
      try {
        const employeeId = attendance.employee?.employeeId;
        if (!employeeId) continue;

        // Get date key for this attendance record
        const attendanceDate = new Date(attendance.date);
        const dateKey = attendanceDate.toLocaleDateString('en-CA', { 
          timeZone: 'Asia/Karachi' 
        });
        const key = `${employeeId}-${dateKey}`;

        const records = employeeDateRecords.get(key);
        if (!records || records.length === 0) continue;

        // Sort records by time
        records.sort((a, b) => a - b);
        
        const checkInTime = records[0];
        const checkOutTime = records.length > 1 ? records[records.length - 1] : null;

        let needsUpdate = false;

        // Update check-in time if different
        if (!attendance.checkIn || !attendance.checkIn.time || 
            Math.abs(new Date(attendance.checkIn.time) - checkInTime) > 60000) { // 1 minute tolerance
          attendance.checkIn = {
            time: checkInTime,
            location: 'Biometric Device',
            method: 'Biometric'
          };
          needsUpdate = true;
        }

        // Update check-out time if we have one and it's different
        if (checkOutTime && checkOutTime > checkInTime) {
          if (!attendance.checkOut || !attendance.checkOut.time || 
              Math.abs(new Date(attendance.checkOut.time) - checkOutTime) > 60000) { // 1 minute tolerance
            attendance.checkOut = {
              time: checkOutTime,
              location: 'Biometric Device',
              method: 'Biometric'
            };
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await attendance.save();
          updated++;
          
          const checkInStr = formatLocalDateTime(checkInTime);
          const checkOutStr = checkOutTime ? formatLocalDateTime(checkOutTime) : 'No check-out';
          
          console.log(`✅ ${attendance.employee.firstName} ${attendance.employee.lastName} (${employeeId}) - ${dateKey} - Check-in: ${checkInStr} | Check-out: ${checkOutStr}`);
        }

      } catch (error) {
        console.error(`❌ Error updating ${attendance.employee?.firstName} ${attendance.employee?.lastName}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Updated: ${updated} records`);
    console.log(`  Errors: ${errors} records`);
    console.log(`  Total processed: ${historicalAttendance.length} records`);

  } catch (error) {
    console.error('❌ Error fixing historical attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the fix
fixHistoricalAttendance(); 