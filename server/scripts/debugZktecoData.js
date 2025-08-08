#!/usr/bin/env node

/**
 * Debug ZKTeco Data Script
 * 
 * This script examines the raw data structure returned by ZKTeco device
 * to understand why employee IDs and timestamps are undefined.
 * 
 * Usage: node server/scripts/debugZktecoData.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');

async function debugZktecoData() {
  try {
    console.log('🔍 Debugging ZKTeco device data structure...');
    console.log('📋 This will show the actual raw data format returned by the device');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔌 Connecting to ZKTeco device...');
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');

    // Get raw attendance data
    console.log('\n📥 Fetching raw attendance data...');
    const attendanceResult = await zktecoService.getAttendanceData();
    
    if (!attendanceResult.success) {
      console.log('❌ Failed to get attendance data:', attendanceResult.error);
      process.exit(1);
    }

    console.log(`✅ Retrieved attendance data structure`);
    console.log(`📊 Total records in result: ${attendanceResult.data ? attendanceResult.data.length : 'N/A'}`);
    
    // Examine the data structure
    if (attendanceResult.data && Array.isArray(attendanceResult.data)) {
      console.log('\n🔍 Sample of raw attendance records:');
      
      // Show first 5 records with full structure
      const sampleRecords = attendanceResult.data.slice(0, 5);
      sampleRecords.forEach((record, index) => {
        console.log(`\n📋 Record ${index + 1}:`);
        console.log(`   Full object:`, JSON.stringify(record, null, 2));
        console.log(`   Object keys:`, Object.keys(record));
        console.log(`   Types - uid: ${typeof record.uid}, userId: ${typeof record.userId}, timestamp: ${typeof record.timestamp}`);
        console.log(`   Values - uid: ${record.uid}, userId: ${record.userId}, timestamp: ${record.timestamp}`);
      });

      // Count undefined values
      let undefinedUids = 0;
      let undefinedTimestamps = 0;
      let validRecords = 0;

      attendanceResult.data.forEach(record => {
        if (!record.uid && !record.userId) undefinedUids++;
        if (!record.timestamp || record.timestamp === undefined) undefinedTimestamps++;
        if ((record.uid || record.userId) && record.timestamp && record.timestamp !== undefined) validRecords++;
      });

      console.log('\n📊 Data Quality Analysis:');
      console.log(`   Total records: ${attendanceResult.data.length}`);
      console.log(`   Records with undefined employee ID: ${undefinedUids}`);
      console.log(`   Records with undefined timestamp: ${undefinedTimestamps}`);
      console.log(`   Valid records (have both ID and timestamp): ${validRecords}`);

      // Show valid records if any
      if (validRecords > 0) {
        console.log('\n✅ Sample of VALID records:');
        const validSamples = attendanceResult.data
          .filter(record => (record.uid || record.userId) && record.timestamp && record.timestamp !== undefined)
          .slice(0, 3);
        
        validSamples.forEach((record, index) => {
          console.log(`   ${index + 1}. Employee: ${record.uid || record.userId}, Time: ${record.timestamp}, State: ${record.state}`);
        });
      }

      // Check different possible property names
      console.log('\n🔍 Checking for alternative property names in first record:');
      if (attendanceResult.data.length > 0) {
        const firstRecord = attendanceResult.data[0];
        const possibleIdFields = ['uid', 'userId', 'user_id', 'id', 'empId', 'employeeId', 'pin', 'cardno'];
        const possibleTimeFields = ['timestamp', 'time', 'datetime', 'date', 'checktime', 'punch_time'];
        
        console.log('   Possible ID fields:');
        possibleIdFields.forEach(field => {
          if (firstRecord.hasOwnProperty(field)) {
            console.log(`     ✅ ${field}: ${firstRecord[field]} (${typeof firstRecord[field]})`);
          } else {
            console.log(`     ❌ ${field}: not found`);
          }
        });

        console.log('   Possible timestamp fields:');
        possibleTimeFields.forEach(field => {
          if (firstRecord.hasOwnProperty(field)) {
            console.log(`     ✅ ${field}: ${firstRecord[field]} (${typeof firstRecord[field]})`);
          } else {
            console.log(`     ❌ ${field}: not found`);
          }
        });
      }

    } else {
      console.log('⚠️ Attendance data is not in expected array format');
      console.log('Raw data:', attendanceResult);
    }

    // Get users data for comparison
    console.log('\n👥 Fetching user data for comparison...');
    const usersResult = await zktecoService.getUsers();
    
    if (usersResult.success && usersResult.data) {
      console.log(`✅ Retrieved ${usersResult.data.length} users`);
      
      if (usersResult.data.length > 0) {
        console.log('\n👤 Sample user records:');
        usersResult.data.slice(0, 3).forEach((user, index) => {
          console.log(`   ${index + 1}. User:`, JSON.stringify(user, null, 2));
        });

        // Look for user 6035
        const user6035 = usersResult.data.find(u => 
          u.userId === '6035' || u.uid === '6035' || u.userId === 6035 || u.uid === 6035
        );
        
        if (user6035) {
          console.log('\n🎯 Found user 6035:');
          console.log('   Details:', JSON.stringify(user6035, null, 2));
        } else {
          console.log('\n⚠️ User 6035 not found in device user list');
          console.log('💡 Available user IDs (first 10):');
          usersResult.data.slice(0, 10).forEach((user, index) => {
            console.log(`   ${index + 1}. ID: ${user.userId || user.uid}, Name: ${user.name}`);
          });
        }
      }
    }

    await zktecoService.disconnect();
    console.log('\n📴 Disconnected from ZKTeco device');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⏹️ Script interrupted by user');
  try {
    await zktecoService.disconnect();
  } catch (e) {
    // Ignore
  }
  await mongoose.disconnect();
  process.exit(0);
});

// Run the debug
debugZktecoData();