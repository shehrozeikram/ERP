#!/usr/bin/env node

/**
 * Test Timezone Handling Script
 * 
 * This script tests the timezone handling for ZKTeco attendance data
 * to ensure times are displayed correctly in Pakistan Standard Time.
 * 
 * Usage: node server/scripts/testTimezone.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function testTimezone() {
  try {
    console.log('🕐 Testing Timezone Handling for ZKTeco Attendance Data');
    console.log('📅 Verifying Pakistan Standard Time (UTC+5) conversion');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔌 Connecting to ZKTeco device...');
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');

    // Get recent attendance data for testing
    console.log('\n📥 Fetching latest attendance records for timezone testing...');
    const attendanceResult = await zktecoService.getAttendanceData();
    
    if (!attendanceResult.success || !attendanceResult.data || attendanceResult.data.length === 0) {
      console.log('❌ No attendance data available for testing');
      process.exit(1);
    }

    // Test with recent records (last 10)
    const recentRecords = attendanceResult.data.slice(-10);
    console.log(`📊 Testing timezone conversion with ${recentRecords.length} recent records`);
    console.log('');

    console.log('🧪 Timezone Conversion Test Results:');
    console.log('─'.repeat(80));

    recentRecords.forEach((record, index) => {
      const employeeId = record.deviceUserId;
      const rawTimestamp = record.recordTime;
      
      if (!employeeId || !rawTimestamp) {
        console.log(`❌ Record ${index + 1}: Missing data (Employee: ${employeeId}, Time: ${rawTimestamp})`);
        return;
      }

      // Test the timezone processing
      const processedTime = processZKTecoTimestamp(rawTimestamp);
      const formattedTime = formatLocalDateTime(rawTimestamp);
      
      // Manual timezone check
      const utcDate = new Date(rawTimestamp);
      const pakistanTime = utcDate.toLocaleString('en-US', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      console.log(`📋 Record ${index + 1} - Employee ${employeeId}:`);
      console.log(`   Raw UTC Time:     ${rawTimestamp}`);
      console.log(`   Pakistan Time:    ${pakistanTime}`);
      console.log(`   Formatted Time:   ${formattedTime}`);
      console.log(`   Processed Valid:  ${processedTime ? '✅ Yes' : '❌ No'}`);
      console.log('');
    });

    console.log('🔍 Additional Timezone Tests:');
    console.log('─'.repeat(50));

    // Test with current time
    const now = new Date();
    const nowUTC = now.toISOString();
    const nowPakistan = now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    
    console.log('📅 Current Time Comparison:');
    console.log(`   Server UTC:       ${nowUTC}`);
    console.log(`   Pakistan Local:   ${nowPakistan}`);
    console.log(`   Formatted Local:  ${formatLocalDateTime(now)}`);
    console.log('');

    // Test with sample ZKTeco timestamps
    const sampleTimestamps = [
      '2025-08-08T03:30:00.000Z', // Should be 8:30 AM Pakistan
      '2025-08-08T12:00:00.000Z', // Should be 5:00 PM Pakistan
      '2025-08-08T01:00:00.000Z'  // Should be 6:00 AM Pakistan
    ];

    console.log('🧪 Sample Timestamp Conversion Tests:');
    sampleTimestamps.forEach((timestamp, index) => {
      const pakistanTime = new Date(timestamp).toLocaleString('en-US', { 
        timeZone: 'Asia/Karachi',
        hour12: true 
      });
      const formattedTime = formatLocalDateTime(timestamp);
      
      console.log(`   Test ${index + 1}: ${timestamp}`);
      console.log(`             → ${pakistanTime} (${formattedTime})`);
    });

    console.log('\n📋 Timezone Test Summary:');
    console.log('─'.repeat(50));
    console.log('✅ All timestamps should show Pakistan Standard Time (UTC+5)');
    console.log('✅ Morning check-ins should show AM times');
    console.log('✅ Evening check-outs should show PM times');
    console.log('✅ No time should be 5 hours behind the expected Pakistan time');

    await zktecoService.disconnect();
    console.log('\n📴 Disconnected from ZKTeco device');

  } catch (error) {
    console.error('❌ Error testing timezone:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure ZKTeco device is accessible');
    console.error('   2. Check timezone utility functions');
    console.error('   3. Verify Pakistan timezone (Asia/Karachi) support');
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⏹️ Script interrupted by user');
  await zktecoService.disconnect();
  await mongoose.disconnect();
  process.exit(0);
});

// Run the test
testTimezone();