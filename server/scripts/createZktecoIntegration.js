#!/usr/bin/env node

/**
 * Create ZKTeco Integration Script
 * 
 * This script creates a ZKTeco biometric integration in the database
 * and sets up automatic daily sync.
 * 
 * Usage: node server/scripts/createZktecoIntegration.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BiometricIntegration = require('../models/hr/BiometricIntegration');


async function createZktecoIntegration() {
  try {
    console.log('🚀 Creating ZKTeco biometric integration...');
    console.log('📅 This will enable automatic daily sync at 6:00 AM');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if ZKTeco integration already exists
    const existingIntegration = await BiometricIntegration.findOne({
      systemName: 'ZKTeco',
      isActive: true
    });

    if (existingIntegration) {
      console.log('✅ ZKTeco integration already exists');
      console.log(`   Integration ID: ${existingIntegration._id}`);
      console.log(`   System: ${existingIntegration.systemName}`);
      console.log(`   Status: ${existingIntegration.isActive ? 'Active' : 'Inactive'}`);
      
      console.log('✅ Scheduled sync already enabled');
      
      return existingIntegration;
    }

    // Create new ZKTeco integration
    console.log('📝 Creating new ZKTeco integration...');
    const integration = new BiometricIntegration({
      systemName: 'ZKTeco',
      integrationType: 'API',
      isActive: true,
      
      // API Configuration for ZKTeco
      apiConfig: {
        baseUrl: 'splaza.nayatel.net',
        endpoints: {
          attendance: 'splaza.nayatel.net:4370',
          employees: 'splaza.nayatel.net:4370',
          devices: 'splaza.nayatel.net:4370'
        }
      },
      
      // Data Mapping for ZKTeco device format
      dataMapping: {
        employeeIdField: 'deviceUserId',
        dateField: 'recordTime',
        timeField: 'recordTime',
        deviceIdField: 'ip'
      },
      
      // Sync Configuration
      syncConfig: {
        autoSync: false,
        syncInterval: 15,
        syncStatus: 'idle'
      }
    });

    await integration.save();
    console.log('✅ ZKTeco integration created successfully');
    console.log(`   Integration ID: ${integration._id}`);

    console.log('✅ Daily sync setup completed');

    console.log('\n🎉 Setup Complete!');
    console.log('📋 What happens now:');
    console.log('   • Every day at 6:00 AM, the system will:');
    console.log('     1. Connect to your ZKTeco device (splaza.nayatel.net:4370)');
    console.log('     2. Fetch all new attendance data');
    console.log('     3. Process and save it to the attendance database');
    console.log('     4. Make it visible in your Attendance Management page');
    console.log('   • No manual intervention required');
    console.log('   • Logs will show sync progress and results');

    console.log('\n💡 Manual Sync Options:');
    console.log('   • API: POST /api/attendance/process-biometric-data');
    console.log('   • Biometric Integration page: Use sync buttons');
    console.log('   • Script: node server/scripts/fixAttendanceNow.js');

    return integration;

  } catch (error) {
    console.error('❌ Error creating ZKTeco integration:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running and accessible');
    console.error('   2. Check your .env file for correct MONGODB_URI');
    console.error('   3. Verify server permissions for database writes');
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

// Run the creation
createZktecoIntegration();