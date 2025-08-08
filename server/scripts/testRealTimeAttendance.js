#!/usr/bin/env node

/**
 * Test Real-Time Attendance Script
 * 
 * This script tests the ZKTeco Push SDK real-time attendance functionality
 * by simulating attendance data and sending it to the push server.
 * 
 * Usage: node server/scripts/testRealTimeAttendance.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoPushService = require('../services/zktecoPushService');

async function testRealTimeAttendance() {
  try {
    console.log('🧪 Testing ZKTeco Real-Time Attendance System');
    console.log('📡 This will test the push server and real-time functionality');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Start the push server
    console.log('🚀 Starting ZKTeco Push server...');
    const startResult = await zktecoPushService.startPushServer();
    console.log('✅ Push server started:', startResult.message);

    // Wait a moment for server to fully start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test real-time attendance processing
    console.log('\n📥 Testing real-time attendance processing...');
    
    const testRecords = [
      {
        deviceUserId: "6035",
        recordTime: new Date().toISOString(),
        state: 1, // Check-in
        ip: "splaza.nayatel.net"
      },
      {
        deviceUserId: "6035",
        recordTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours later
        state: 0, // Check-out
        ip: "splaza.nayatel.net"
      },
      {
        deviceUserId: "6313",
        recordTime: new Date().toISOString(),
        state: 1, // Check-in
        ip: "splaza.nayatel.net"
      }
    ];

    for (const record of testRecords) {
      console.log(`\n🔄 Processing test record: ${record.deviceUserId} - ${record.state === 1 ? 'Check-in' : 'Check-out'}`);
      
      const result = await zktecoPushService.processRealTimeAttendance(record);
      
      if (result.processed > 0) {
        console.log(`✅ Successfully processed: ${result.processed} record(s)`);
        if (result.created > 0) {
          console.log(`   📝 Created: ${result.created} new attendance record(s)`);
        }
        if (result.updated > 0) {
          console.log(`   🔄 Updated: ${result.updated} existing attendance record(s)`);
        }
      } else {
        console.log(`⚠️ No records processed: ${result.errors} error(s)`);
      }
      
      // Wait between records
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Get server status
    console.log('\n📊 Push Server Status:');
    const status = zktecoPushService.getStatus();
    console.log(`   Running: ${status.isRunning}`);
    console.log(`   Port: ${status.port}`);
    console.log(`   Push Endpoint: ${status.pushEndpoint}`);
    console.log(`   Connected Clients: ${status.clients}`);
    console.log(`   Timestamp: ${status.timestamp}`);

    console.log('\n🎉 Real-time attendance test completed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Check the Attendance Management page for real-time updates');
    console.log('   2. Open the "Real-Time Attendance" tab to see live updates');
    console.log('   3. Configure your ZKTeco device to send push notifications');
    console.log('   4. Real-time attendance will appear instantly when employees check in/out');

    // Keep the server running for a few more seconds
    console.log('\n⏳ Keeping server running for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Stop the push server
    console.log('\n🛑 Stopping ZKTeco Push server...');
    const stopResult = await zktecoPushService.stopPushServer();
    console.log('✅ Push server stopped:', stopResult.message);

  } catch (error) {
    console.error('❌ Error testing real-time attendance:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running and accessible');
    console.error('   2. Check that employee records exist in the database');
    console.error('   3. Verify the push server can start on the specified port');
    console.error('   4. Check for any conflicting services on port 8080');
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⏹️ Script interrupted by user');
  try {
    await zktecoPushService.stopPushServer();
  } catch (error) {
    console.error('Error stopping push server:', error);
  }
  await mongoose.disconnect();
  process.exit(0);
});

// Run the test
testRealTimeAttendance(); 