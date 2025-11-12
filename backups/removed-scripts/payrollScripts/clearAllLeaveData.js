/**
 * Script to clear all leave data from the system
 * This will remove:
 * - All leave requests (LeaveRequest collection)
 * - All leave balances (LeaveBalance collection)
 * - Reset employee leave balances to default (20, 10, 10)
 * 
 * WARNING: This is a destructive operation and cannot be undone!
 * 
 * Usage: node server/scripts/clearAllLeaveData.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');

async function clearAllLeaveData() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    console.log('\n⚠️  WARNING: This will delete all leave data!');
    console.log('Starting in 2 seconds...\n');
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Delete all leave requests
    console.log('🗑️  Deleting all leave requests...');
    const leaveRequestsResult = await LeaveRequest.deleteMany({});
    console.log(`✅ Deleted ${leaveRequestsResult.deletedCount} leave requests`);

    // 2. Delete all leave balances
    console.log('\n🗑️  Deleting all leave balances...');
    const leaveBalancesResult = await LeaveBalance.deleteMany({});
    console.log(`✅ Deleted ${leaveBalancesResult.deletedCount} leave balance records`);

    // 3. Reset all employee leave balances to default (20, 10, 10)
    console.log('\n🔄 Resetting employee leave balances to defaults (20, 10, 10)...');
    
    const employees = await Employee.find({});
    let updatedCount = 0;

    for (const employee of employees) {
      // Reset leave balance to default values
      employee.leaveBalance = {
        annual: {
          allocated: 20,
          used: 0,
          remaining: 20,
          carriedForward: 0,
          advance: 0
        },
        casual: {
          allocated: 10,
          used: 0,
          remaining: 10,
          carriedForward: 0,
          advance: 0
        },
        sick: {
          allocated: 10,
          used: 0,
          remaining: 10,
          carriedForward: 0,
          advance: 0
        },
        medical: {
          allocated: 10,
          used: 0,
          remaining: 10,
          carriedForward: 0,
          advance: 0
        },
        maternity: {
          allocated: 0,
          used: 0,
          remaining: 0
        },
        paternity: {
          allocated: 0,
          used: 0,
          remaining: 0
        }
      };

      // Reset leave config to defaults
      employee.leaveConfig = {
        annualLimit: 20,
        sickLimit: 10,
        casualLimit: 10,
        useGlobalDefaults: true
      };

      // Clear leave requests array
      employee.leaveRequests = [];
      employee.lastLeaveBalanceUpdate = new Date();

      // Save without validation to avoid required field errors
      await employee.save({ validateBeforeSave: false });
      updatedCount++;
    }

    console.log(`✅ Reset leave balances for ${updatedCount} employees`);

    // 4. Summary
    console.log('\n📊 Summary:');
    console.log(`   - Leave Requests Deleted: ${leaveRequestsResult.deletedCount}`);
    console.log(`   - Leave Balances Deleted: ${leaveBalancesResult.deletedCount}`);
    console.log(`   - Employees Reset: ${updatedCount}`);
    console.log('\n✅ All leave data cleared successfully!');
    console.log('\n📝 All employees now have default leave balances:');
    console.log('   - Annual: 20 days');
    console.log('   - Sick: 10 days');
    console.log('   - Casual: 10 days');
    console.log('   - No advance leaves');
    console.log('   - No leave requests');
    
  } catch (error) {
    console.error('❌ Error clearing leave data:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
clearAllLeaveData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

