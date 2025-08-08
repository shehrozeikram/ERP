#!/usr/bin/env node

/**
 * Debug Check-out Times
 * 
 * This script checks how check-out times are being processed from ZKTeco device.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

async function debugCheckoutTimes() {
  try {
    console.log('🔍 Debugging check-out time processing...');
    
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

    // Group records by employee to see check-in/check-out patterns
    const employeeRecords = new Map();

    todayRecords.forEach(record => {
      const employeeId = record.deviceUserId || record.userId;
      const timestamp = processZKTecoTimestamp(record.recordTime);
      
      if (!employeeRecords.has(employeeId)) {
        employeeRecords.set(employeeId, []);
      }

      employeeRecords.get(employeeId).push({
        timestamp,
        state: record.state,
        rawRecord: record
      });
    });

    // Show employees with multiple records (potential check-in/check-out)
    console.log('\n📋 Employees with multiple records (potential check-in/check-out):');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    let multiRecordEmployees = 0;
    
    for (const [employeeId, records] of employeeRecords.entries()) {
      if (records.length > 1) {
        multiRecordEmployees++;
        console.log(`\nEmployee ID: ${employeeId} (${records.length} records)`);
        
        // Sort records by time
        records.sort((a, b) => a.timestamp - b.timestamp);
        
        records.forEach((record, index) => {
          console.log(`  Record ${index + 1}: ${formatLocalDateTime(record.timestamp)} | State: ${record.state} | Raw: ${record.rawRecord.recordTime}`);
        });
        
        // Determine check-in/check-out
        const firstRecord = records[0];
        const lastRecord = records[records.length - 1];
        
        console.log(`  → Check-in: ${formatLocalDateTime(firstRecord.timestamp)}`);
        console.log(`  → Check-out: ${formatLocalDateTime(lastRecord.timestamp)}`);
        
        if (records.length > 2) {
          console.log(`  ⚠️  Multiple records - may need better logic`);
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Total employees: ${employeeRecords.size}`);
    console.log(`  Employees with multiple records: ${multiRecordEmployees}`);
    console.log(`  Employees with single records: ${employeeRecords.size - multiRecordEmployees}`);

    // Show sample of raw record structure
    console.log('\n📋 Sample raw record structure:');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    if (todayRecords.length > 0) {
      const sampleRecord = todayRecords[0];
      console.log('Sample record:');
      console.log(JSON.stringify(sampleRecord, null, 2));
    }

    // Disconnect from device
    await zktecoService.disconnect();
    console.log('🔌 Disconnected from ZKTeco device');

  } catch (error) {
    console.error('❌ Error debugging check-out times:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the debug
debugCheckoutTimes(); 