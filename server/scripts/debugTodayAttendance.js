#!/usr/bin/env node

/**
 * Debug Today's Attendance from ZKTeco Device
 * 
 * This script checks all attendance records for today from the ZKTeco device
 * to see if we're missing any records.
 * 
 * Usage: node server/scripts/debugTodayAttendance.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');
const Employee = require('../models/hr/Employee');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function debugTodayAttendance() {
  try {
    console.log('🔍 Debugging today\'s attendance from ZKTeco device...');
    
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

    // Group records by employee
    const employeeRecords = new Map();

    todayRecords.forEach(record => {
      try {
        const employeeId = record.deviceUserId || record.userId;
        const rawTimestamp = record.recordTime;
        const timestamp = processZKTecoTimestamp(rawTimestamp);
        
        if (!timestamp) {
          console.warn(`⚠️ Invalid timestamp for employee ${employeeId}: ${rawTimestamp}`);
          return;
        }

        if (!employeeRecords.has(employeeId)) {
          employeeRecords.set(employeeId, []);
        }

        employeeRecords.get(employeeId).push({
          timestamp,
          state: record.state,
          rawRecord: record
        });

      } catch (error) {
        console.error(`❌ Error processing record:`, error);
      }
    });

    console.log(`📊 Found ${employeeRecords.size} unique employees with attendance today`);

    // Check which employees exist in our database
    const employeeIds = Array.from(employeeRecords.keys());
    const existingEmployees = await Employee.find({ 
      employeeId: { $in: employeeIds.map(id => id.toString()) } 
    });

    console.log(`📊 Found ${existingEmployees.length} employees in database out of ${employeeIds.length} from device`);

    // Show missing employees
    const existingEmployeeIds = existingEmployees.map(emp => emp.employeeId.toString());
    const missingEmployeeIds = employeeIds.filter(id => !existingEmployeeIds.includes(id.toString()));

    if (missingEmployeeIds.length > 0) {
      console.log(`\n⚠️ Missing employees in database (${missingEmployeeIds.length}):`);
      missingEmployeeIds.forEach(id => {
        const records = employeeRecords.get(id);
        const firstRecord = records[0];
        console.log(`   Employee ID: ${id} - First record: ${formatLocalDateTime(firstRecord.timestamp)}`);
      });
    }

    // Show all employees with attendance today
    console.log(`\n📋 All employees with attendance today (${employeeRecords.size}):`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    const sortedEmployees = Array.from(employeeRecords.entries()).sort((a, b) => {
      const aFirstRecord = a[1][0];
      const bFirstRecord = b[1][0];
      return aFirstRecord.timestamp - bFirstRecord.timestamp;
    });

    sortedEmployees.forEach(([employeeId, records]) => {
      const employee = existingEmployees.find(emp => emp.employeeId.toString() === employeeId.toString());
      const firstRecord = records[0];
      const lastRecord = records[records.length - 1];
      
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee';
      const checkInTime = formatLocalDateTime(firstRecord.timestamp);
      const checkOutTime = records.length > 1 ? formatLocalDateTime(lastRecord.timestamp) : 'No check-out';
      
      console.log(`${employeeId.toString().padStart(4)} | ${employeeName.padEnd(25)} | Check-in: ${checkInTime} | Check-out: ${checkOutTime} | Records: ${records.length}`);
    });

    // Show summary by hour
    console.log(`\n📊 Attendance Summary by Hour:`);
    const hourlyStats = new Map();
    
    todayRecords.forEach(record => {
      const timestamp = processZKTecoTimestamp(record.recordTime);
      if (timestamp) {
        const hour = timestamp.getHours();
        hourlyStats.set(hour, (hourlyStats.get(hour) || 0) + 1);
      }
    });

    Array.from(hourlyStats.entries()).sort((a, b) => a[0] - b[0]).forEach(([hour, count]) => {
      console.log(`   ${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:59: ${count} records`);
    });

    // Disconnect from device
    await zktecoService.disconnect();
    console.log('🔌 Disconnected from ZKTeco device');

  } catch (error) {
    console.error('❌ Error debugging today\'s attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the debug
debugTodayAttendance(); 