#!/usr/bin/env node

/**
 * Test Sync Script
 * 
 * This script tests the ZKTeco connection and performs a sync to troubleshoot issues.
 * 
 * Usage: node server/scripts/testSync.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');

async function testSync() {
  try {
    console.log('🧪 Testing ZKTeco connection and data retrieval...');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔌 Testing ZKTeco connection...');
    const connectionResult = await zktecoService.testConnection('splaza.nayatel.net', [4370, 5200, 5000]);
    
    if (connectionResult.success) {
      console.log('✅ ZKTeco connection successful');
      console.log(`📊 Device Info: ${JSON.stringify(connectionResult.data, null, 2)}`);
    } else {
      console.log('❌ ZKTeco connection failed:', connectionResult.error);
      process.exit(1);
    }

    console.log('\n📥 Fetching attendance data from device...');
    const attendanceResult = await zktecoService.getAttendanceData();
    
    if (attendanceResult.success && attendanceResult.data) {
      console.log(`✅ Retrieved ${attendanceResult.data.length} attendance records`);
      
      // Show sample records
      if (attendanceResult.data.length > 0) {
        console.log('\n🔍 Sample attendance records:');
        attendanceResult.data.slice(0, 5).forEach((record, index) => {
          console.log(`   ${index + 1}. Employee ID: ${record.uid || record.userId}, Timestamp: ${record.timestamp}, State: ${record.state}`);
        });
        
        // Look for your specific employee ID
        const userRecord = attendanceResult.data.find(r => (r.uid || r.userId) === '6035');
        if (userRecord) {
          console.log('\n🎯 Found your attendance record:');
          console.log(`   Employee ID: ${userRecord.uid || userRecord.userId}`);
          console.log(`   Timestamp: ${userRecord.timestamp}`);
          console.log(`   State: ${userRecord.state}`);
          console.log(`   Device ID: ${userRecord.deviceId || 'N/A'}`);
        } else {
          console.log('\n⚠️ No attendance record found for Employee ID 6035');
          console.log('💡 This could mean:');
          console.log('   • The check-in hasn\'t been saved to the device yet');
          console.log('   • The employee ID mapping is different');
          console.log('   • The data is in a different date range');
        }
        
        if (attendanceResult.data.length > 5) {
          console.log(`\n   ... and ${attendanceResult.data.length - 5} more records`);
        }
      } else {
        console.log('📭 No attendance data found on device');
      }
    } else {
      console.log('❌ Failed to retrieve attendance data:', attendanceResult.error);
    }

    console.log('\n📥 Fetching user data from device...');
    const usersResult = await zktecoService.getUsers();
    
    if (usersResult.success && usersResult.data) {
      console.log(`✅ Retrieved ${usersResult.data.length} user records`);
      
      // Look for your specific user
      const user = usersResult.data.find(u => u.userId === '6035' || u.uid === '6035');
      if (user) {
        console.log('\n🎯 Found your user record:');
        console.log(`   User ID: ${user.userId || user.uid}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Card Number: ${user.cardno || 'N/A'}`);
        console.log(`   Role: ${user.role || 'N/A'}`);
      } else {
        console.log('\n⚠️ User with ID 6035 not found in device user list');
        console.log('💡 Available users (first 5):');
        usersResult.data.slice(0, 5).forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.userId || user.uid}, Name: ${user.name}`);
        });
      }
    } else {
      console.log('❌ Failed to retrieve user data:', usersResult.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure ZKTeco device is powered on and connected to network');
    console.error('   2. Check if splaza.nayatel.net is accessible from this server');
    console.error('   3. Verify the device IP address and port configuration');
    console.error('   4. Check firewall settings');
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

// Run the test
testSync();