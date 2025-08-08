#!/usr/bin/env node

/**
 * Setup Daily Sync Script
 * 
 * This script sets up daily 6 AM sync for all active biometric integrations.
 * Run this script once to enable automatic daily sync for attendance data.
 * 
 * Usage: node server/scripts/setupDailySync.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BiometricIntegration = require('../models/hr/BiometricIntegration');

async function setupDailySync() {
  try {
    console.log('🚀 Setting up daily 6 AM sync for biometric attendance...');
    console.log('📅 This will sync attendance data automatically every day at 6:00 AM');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all active biometric integrations
    const integrations = await BiometricIntegration.find({ isActive: true });
    console.log(`📊 Found ${integrations.length} active biometric integration(s)`);

    if (integrations.length === 0) {
      console.log('⚠️ No active biometric integrations found. Please create and activate at least one integration first.');
      process.exit(0);
    }

    // Display integrations
    console.log('\n🔍 Active Integrations:');
    integrations.forEach((integration, index) => {
      console.log(`   ${index + 1}. ${integration.systemName} (${integration.integrationType})`);
    });

    // Initialize scheduled sync service
    const scheduledSyncService = require('../services/scheduledSyncService');

    // Setup daily sync for all integrations
    console.log('\n⏰ Setting up daily sync at 6:00 AM for all integrations...');
    const results = await scheduledSyncService.setupDailySyncForAll();

    // Display results
    console.log('\n📋 Setup Results:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.systemName}: ${result.success ? result.message : result.error}`);
    });

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully configured: ${successCount} integration(s)`);
    console.log(`   ❌ Failed to configure: ${failureCount} integration(s)`);

    if (successCount > 0) {
      console.log('\n🎉 Daily sync setup completed successfully!');
      console.log('📅 Attendance data will now be automatically synced every day at 6:00 AM');
      console.log('🔄 This includes yesterday\'s and today\'s data to ensure no missed records');
      console.log('');
      console.log('📋 What happens next:');
      console.log('   • Server will start the scheduled sync jobs automatically');
      console.log('   • You can monitor sync status via the Biometric Integration page');
      console.log('   • Check attendance data after 6:00 AM each day');
      console.log('   • Logs will show sync progress and results');
    }

    if (failureCount > 0) {
      console.log('\n⚠️ Some integrations failed to configure. Please:');
      console.log('   1. Check the error messages above');
      console.log('   2. Verify integration settings in the admin panel');
      console.log('   3. Re-run this script or configure manually via API');
    }

  } catch (error) {
    console.error('❌ Error setting up daily sync:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running and accessible');
    console.error('   2. Check your .env file for correct MONGODB_URI');
    console.error('   3. Verify biometric integrations are properly configured');
    process.exit(1);
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

// Run the setup
setupDailySync();