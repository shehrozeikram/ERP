#!/usr/bin/env node

/**
 * Check Scheduled Sync Status Script
 * 
 * This script checks the status of scheduled sync jobs.
 * 
 * Usage: node server/scripts/checkScheduledSync.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BiometricIntegration = require('../models/hr/BiometricIntegration');

async function checkScheduledSync() {
  try {
    console.log('🔍 Checking scheduled sync status...');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all biometric integrations
    const integrations = await BiometricIntegration.find({});
    
    console.log(`📊 Found ${integrations.length} biometric integration(s)`);
    console.log('');

    if (integrations.length === 0) {
      console.log('⚠️ No biometric integrations found');
      console.log('💡 Run: node server/scripts/createZktecoIntegration.js');
      process.exit(0);
    }

    integrations.forEach((integration, index) => {
      console.log(`🔧 Integration ${index + 1}:`);
      console.log(`   ID: ${integration._id}`);
      console.log(`   System: ${integration.systemName}`);
      console.log(`   Type: ${integration.integrationType}`);
      console.log(`   Status: ${integration.isActive ? 'Active ✅' : 'Inactive ❌'}`);
      console.log('   Sync Configuration:');
      console.log(`     Auto Sync: ${integration.syncConfig.autoSync ? 'Enabled ✅' : 'Disabled ❌'}`);
      console.log(`     Scheduled Sync: ${integration.syncConfig.scheduledSync ? 'Enabled ✅' : 'Disabled ❌'}`);
      console.log(`     Cron Expression: ${integration.syncConfig.cronExpression || 'Not set'}`);
      console.log(`     Last Sync: ${integration.syncConfig.lastSyncAt ? integration.syncConfig.lastSyncAt.toLocaleString() : 'Never'}`);
      console.log(`     Sync Status: ${integration.syncConfig.syncStatus || 'Unknown'}`);
      
      if (integration.syncConfig.scheduledSync && integration.syncConfig.cronExpression) {
        const cronExpr = integration.syncConfig.cronExpression;
        if (cronExpr === '0 6 * * *') {
          console.log(`     ⏰ Schedule: Daily at 6:00 AM (Asia/Karachi timezone)`);
        } else {
          console.log(`     ⏰ Schedule: ${cronExpr}`);
        }
      }
      
      console.log('');
    });

    // Check for active scheduled sync integrations
    const activeScheduledSyncs = integrations.filter(i => 
      i.isActive && i.syncConfig.scheduledSync
    );

    if (activeScheduledSyncs.length > 0) {
      console.log('🎉 Automatic sync is properly configured!');
      console.log('📋 What happens automatically:');
      console.log('   • Every day at 6:00 AM:');
      console.log('     1. System connects to ZKTeco device');
      console.log('     2. Fetches new attendance data');
      console.log('     3. Processes and saves to database');
      console.log('     4. Makes data visible in Attendance Management');
      console.log('   • No manual intervention required');
      console.log('   • Check server logs for sync results');
      
      console.log('\n🔧 Manual sync options (if needed):');
      console.log('   • API: POST /api/attendance/process-biometric-data');
      console.log('   • UI: Use sync buttons in Biometric Integration page');
      
    } else {
      console.log('⚠️ No active scheduled syncs found');
      console.log('💡 To enable automatic sync:');
      console.log('   1. Ensure at least one integration is active');
      console.log('   2. Enable scheduledSync in syncConfig');
      console.log('   3. Set cronExpression (e.g., "0 6 * * *" for 6 AM daily)');
      console.log('   4. Restart your server to activate the scheduler');
    }

  } catch (error) {
    console.error('❌ Error checking scheduled sync status:', error.message);
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

// Run the check
checkScheduledSync();