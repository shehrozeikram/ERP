#!/usr/bin/env node

/**
 * Check Attendance Timezone Script
 * 
 * This script checks existing attendance records to see
 * how times are currently stored and displayed.
 * 
 * Usage: node server/scripts/checkAttendanceTimezone.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { formatLocalDateTime, formatLocalTime } = require('../utils/timezoneHelper');

async function checkAttendanceTimezone() {
  try {
    console.log('🕐 Checking Attendance Records Timezone Handling');
    console.log('📅 Verifying how times are stored and should be displayed');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get recent attendance records
    console.log('📊 Fetching recent attendance records...');
    const recentAttendance = await Attendance.find({
      $or: [
        { 'checkIn.time': { $exists: true } },
        { 'checkOut.time': { $exists: true } }
      ]
    })
    .populate('employee', 'firstName lastName employeeId')
    .sort({ 'checkIn.time': -1 })
    .limit(10);

    console.log(`📋 Found ${recentAttendance.length} recent attendance records`);
    console.log('');

    if (recentAttendance.length === 0) {
      console.log('⚠️ No attendance records found');
      console.log('💡 Run attendance sync first: POST /api/attendance/process-biometric-data');
      process.exit(0);
    }

    console.log('📋 Attendance Records Timezone Analysis:');
    console.log('─'.repeat(100));

    recentAttendance.forEach((record, index) => {
      const employee = record.employee || {};
      const employeeName = employee.firstName && employee.lastName 
        ? `${employee.firstName} ${employee.lastName}` 
        : 'Unknown Employee';
      const employeeId = employee.employeeId || 'N/A';

      console.log(`📄 Record ${index + 1} - ${employeeName} (ID: ${employeeId}):`);
      
      // Check-in analysis
      if (record.checkIn && record.checkIn.time) {
        const checkInRaw = record.checkIn.time;
        const checkInLocal = formatLocalTime(checkInRaw);
        const checkInFormatted = formatLocalDateTime(checkInRaw);
        
        console.log(`   ⏰ Check-in:`);
        console.log(`      Raw (DB):        ${checkInRaw.toISOString()}`);
        console.log(`      Local Time:      ${checkInLocal}`);
        console.log(`      Full Format:     ${checkInFormatted}`);
        console.log(`      Method:          ${record.checkIn.method || 'N/A'}`);
        console.log(`      Location:        ${record.checkIn.location || 'N/A'}`);
      } else {
        console.log(`   ⏰ Check-in:        Not recorded`);
      }

      // Check-out analysis
      if (record.checkOut && record.checkOut.time) {
        const checkOutRaw = record.checkOut.time;
        const checkOutLocal = formatLocalTime(checkOutRaw);
        const checkOutFormatted = formatLocalDateTime(checkOutRaw);
        
        console.log(`   🏁 Check-out:`);
        console.log(`      Raw (DB):        ${checkOutRaw.toISOString()}`);
        console.log(`      Local Time:      ${checkOutLocal}`);
        console.log(`      Full Format:     ${checkOutFormatted}`);
        console.log(`      Method:          ${record.checkOut.method || 'N/A'}`);
        console.log(`      Location:        ${record.checkOut.location || 'N/A'}`);
      } else {
        console.log(`   🏁 Check-out:       Not recorded`);
      }

      // Work hours and status
      console.log(`   📊 Status:          ${record.status || 'N/A'}`);
      console.log(`   ⏱️  Work Hours:      ${record.workHours || 0} hours`);
      console.log(`   ⏰ Date:            ${record.date ? record.date.toDateString() : 'N/A'}`);
      console.log('');
    });

    console.log('🔍 Timezone Verification Checklist:');
    console.log('─'.repeat(60));
    console.log('✅ Times should display in Pakistan Standard Time (UTC+5)');
    console.log('✅ Morning check-ins should show realistic AM times (e.g., 8:00 AM - 10:00 AM)');
    console.log('✅ Evening check-outs should show realistic PM times (e.g., 5:00 PM - 7:00 PM)');
    console.log('✅ No times should be off by 5 hours from expected local time');
    console.log('');

    // Current server time comparison
    const now = new Date();
    console.log('📅 Current Time Comparison:');
    console.log(`   Server Time:     ${now.toString()}`);
    console.log(`   UTC Time:        ${now.toISOString()}`);
    console.log(`   Local Time:      ${formatLocalDateTime(now)}`);
    console.log('');

    console.log('🎯 Expected vs Actual Analysis:');
    console.log('─'.repeat(60));
    console.log('💡 If you see any issues:');
    console.log('   1. Check if times look realistic for Pakistan (5 hours ahead of UTC)');
    console.log('   2. Verify morning check-ins are in AM (not PM)');
    console.log('   3. Ensure evening check-outs are in PM (not early AM next day)');
    console.log('   4. Times should match your expectations for employee work hours');

  } catch (error) {
    console.error('❌ Error checking attendance timezone:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⏹️ Script interrupted by user');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the check
checkAttendanceTimezone();