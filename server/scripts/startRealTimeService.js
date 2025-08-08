#!/usr/bin/env node

/**
 * Start Real-Time Attendance Service
 * 
 * This script starts the ZKTeco Push SDK real-time attendance service
 * without requiring authentication.
 * 
 * Usage: node server/scripts/startRealTimeService.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoPushService = require('../services/zktecoPushService');

async function startRealTimeService() {
  try {
    console.log('🚀 Starting ZKTeco Real-Time Attendance Service...');
    console.log('📡 This will start the push server for real-time attendance updates');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Start the push server
    console.log('🚀 Starting ZKTeco Push server...');
    const startResult = await zktecoPushService.startPushServer();
    
    if (startResult.success) {
      console.log('✅ Push server started successfully!');
      console.log(`📡 Push endpoint: http://localhost:${startResult.port}${startResult.pushEndpoint}`);
      console.log(`🔍 Health check: http://localhost:${startResult.port}/zkteco/health`);
      console.log('');
      console.log('🎉 Real-time attendance service is now running!');
      console.log('');
      console.log('📋 Next Steps:');
      console.log('   1. Open Attendance Management → Real-Time Attendance tab');
      console.log('   2. Configure your ZKTeco device to send push notifications to:');
      console.log(`      http://your-server-ip:${startResult.port}${startResult.pushEndpoint}`);
      console.log('   3. Real-time attendance will appear instantly when employees check in/out');
      console.log('');
      console.log('⏹️  To stop the service, press Ctrl+C');
      console.log('');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping ZKTeco Push server...');
        try {
          await zktecoPushService.stopPushServer();
          console.log('✅ Push server stopped successfully');
        } catch (error) {
          console.error('❌ Error stopping push server:', error);
        }
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
        process.exit(0);
      });

      // Keep the process alive
      setInterval(() => {
        // Heartbeat to keep the process running
      }, 60000); // Check every minute

    } else {
      console.error('❌ Failed to start push server:', startResult.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error starting real-time service:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running and accessible');
    console.error('   2. Check that port 8080 is not in use');
    console.error('   3. Verify the server can start on the specified port');
    process.exit(1);
  }
}

// Run the service
startRealTimeService(); 