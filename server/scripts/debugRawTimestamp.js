#!/usr/bin/env node

/**
 * Debug Raw Timestamp Format
 * 
 * This script checks the actual raw timestamp format from ZKTeco device.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function debugRawTimestamp() {
  try {
    console.log('🔍 Debugging raw timestamp format from ZKTeco device...');
    
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

    // Find today's records
    const today = new Date();
    const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5 for Pakistan
    const todayStart = new Date(today.getTime() - pakistanOffset);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const todayRecords = attendanceData.data.filter(record => {
      const recordDate = new Date(record.recordTime);
      return recordDate >= todayStart && recordDate < todayEnd;
    });

    console.log(`📊 Found ${todayRecords.length} records for today`);

    // Show first few records with detailed timestamp analysis
    console.log('\n📋 Raw timestamp analysis (first 5 records):');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    todayRecords.slice(0, 5).forEach((record, index) => {
      const rawTimestamp = record.recordTime;
      const employeeId = record.deviceUserId || record.userId;
      
      console.log(`\nRecord ${index + 1} - Employee ID: ${employeeId}`);
      console.log(`  Raw timestamp: ${rawTimestamp}`);
      console.log(`  Raw timestamp type: ${typeof rawTimestamp}`);
      
      // Parse as UTC
      const utcDate = new Date(rawTimestamp);
      console.log(`  UTC date: ${utcDate.toISOString()}`);
      console.log(`  UTC time: ${utcDate.toLocaleString('en-US', { timeZone: 'UTC' })}`);
      
      // Parse as local time
      const localDate = new Date(rawTimestamp);
      console.log(`  Local date: ${localDate.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })}`);
      
      // Test our conversion
      const convertedTime = processZKTecoTimestamp(rawTimestamp);
      console.log(`  Converted time: ${convertedTime ? formatLocalDateTime(convertedTime) : 'null'}`);
      
      // Test direct conversion
      const directTime = new Date(rawTimestamp);
      console.log(`  Direct time: ${directTime.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })}`);
    });

    // Disconnect from device
    await zktecoService.disconnect();
    console.log('🔌 Disconnected from ZKTeco device');

  } catch (error) {
    console.error('❌ Error debugging raw timestamp:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the debug
debugRawTimestamp(); 