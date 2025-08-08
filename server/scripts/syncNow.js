#!/usr/bin/env node

/**
 * Immediate Sync Script
 * 
 * This script performs an immediate sync of biometric attendance data
 * to get current day's check-ins visible in the attendance system.
 * 
 * Usage: node server/scripts/syncNow.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BiometricIntegration = require('../models/hr/BiometricIntegration');
const attendanceService = require('../services/attendanceService');

async function syncNow() {
  try {
    console.log('🔄 Starting immediate biometric attendance sync...');
    console.log('📅 This will sync today\'s attendance data to make it visible immediately');
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

    // Set sync date range - today and yesterday to catch any missed records
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // Yesterday
    startDate.setHours(0, 0, 0, 0); // Start of yesterday

    console.log(`\n📅 Syncing attendance from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    console.log('⏰ This includes your 8:06 AM check-in and any other recent attendance...');
    console.log('');

    const allResults = [];

    // Sync each integration
    for (const integration of integrations) {
      try {
        console.log(`🔄 Syncing ${integration.systemName}...`);
        
        const result = await attendanceService.syncBiometricAttendance(
          integration._id,
          startDate,
          endDate
        );

        console.log(`   ✅ ${integration.systemName} sync completed:`);
        console.log(`      📊 Processed: ${result.processed || 0} records`);
        console.log(`      ➕ Created: ${result.created || 0} new records`);
        console.log(`      🔄 Updated: ${result.updated || 0} existing records`);
        console.log(`      ❌ Errors: ${result.errors || 0} errors`);

        if (result.errorDetails && result.errorDetails.length > 0) {
          console.log(`      🔍 Error details:`);
          result.errorDetails.forEach((error, index) => {
            console.log(`         ${index + 1}. ${error.error} (Employee ID: ${error.record?.employeeId || 'Unknown'})`);
          });
        }

        allResults.push({
          integrationId: integration._id,
          systemName: integration.systemName,
          success: true,
          ...result
        });

      } catch (error) {
        console.log(`   ❌ ${integration.systemName} sync failed: ${error.message}`);
        allResults.push({
          integrationId: integration._id,
          systemName: integration.systemName,
          success: false,
          error: error.message
        });
      }
      console.log('');
    }

    // Summary
    const totalProcessed = allResults.reduce((sum, r) => sum + (r.processed || 0), 0);
    const totalCreated = allResults.reduce((sum, r) => sum + (r.created || 0), 0);
    const totalUpdated = allResults.reduce((sum, r) => sum + (r.updated || 0), 0);
    const totalErrors = allResults.reduce((sum, r) => sum + (r.errors || 0), 0);

    console.log('📊 Final Summary:');
    console.log(`   🔄 Total processed: ${totalProcessed} records`);
    console.log(`   ➕ Total created: ${totalCreated} new attendance records`);
    console.log(`   🔄 Total updated: ${totalUpdated} existing records`);
    console.log(`   ❌ Total errors: ${totalErrors} errors`);

    if (totalCreated > 0 || totalUpdated > 0) {
      console.log('\n🎉 Sync completed successfully!');
      console.log('✅ Your attendance data should now be visible in the Attendance Management page');
      console.log('🕐 This includes your 8:06 AM check-in with Employee ID 6035');
      console.log('🔄 Refresh your attendance page to see the latest data');
    } else if (totalErrors > 0) {
      console.log('\n⚠️ Sync completed with errors');
      console.log('🔍 Check the error details above to resolve any issues');
      console.log('💡 Common issues:');
      console.log('   • Employee ID 6035 not found in database');
      console.log('   • Biometric device connection issues');
      console.log('   • Date/time format mismatches');
    } else {
      console.log('\n📭 No new attendance data found');
      console.log('💡 This could mean:');
      console.log('   • Data has already been synced');
      console.log('   • No one checked in during the specified time range');
      console.log('   • Biometric device communication issues');
    }

  } catch (error) {
    console.error('❌ Error during immediate sync:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running and accessible');
    console.error('   2. Check your .env file for correct MONGODB_URI');
    console.error('   3. Verify biometric integrations are properly configured');
    console.error('   4. Check if ZKTeco device is accessible from server');
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

// Run the immediate sync
syncNow();