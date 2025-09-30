const mongoose = require('mongoose');
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const EmployeeIncrement = require('../models/hr/EmployeeIncrement');
const Employee = require('../models/hr/Employee');

/**
 * Script to remove all employee increment records from the cloud Atlas database
 * This script will:
 * 1. Delete all EmployeeIncrement records
 * 2. Clear increment history from Employee records
 * 3. Reset increment-related fields in Employee records
 */

const removeAllIncrements = async () => {
  try {
    console.log('🚀 Starting employee increments removal process...');
    
    // Connect to database
    await connectDB();
    
    // Step 1: Count existing increment records
    console.log('\n📊 Step 1: Analyzing existing increment records...');
    
    const totalIncrements = await EmployeeIncrement.countDocuments();
    const incrementsByStatus = await EmployeeIncrement.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log(`📋 Total increment records found: ${totalIncrements}`);
    console.log('📊 Increments by status:');
    incrementsByStatus.forEach(status => {
      console.log(`   - ${status._id}: ${status.count}`);
    });
    
    if (totalIncrements === 0) {
      console.log('✅ No increment records found to remove');
      return;
    }
    
    // Step 2: Delete all EmployeeIncrement records
    console.log('\n🗑️  Step 2: Deleting all EmployeeIncrement records...');
    
    const deleteResult = await EmployeeIncrement.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} increment records`);
    
    // Step 3: Clear increment history from Employee records
    console.log('\n🧹 Step 3: Clearing increment history from Employee records...');
    
    const employeeUpdateResult = await Employee.updateMany(
      { incrementHistory: { $exists: true, $ne: [] } },
      { 
        $unset: { 
          incrementHistory: 1,
          lastIncrementDate: 1,
          nextIncrementEligibleDate: 1
        }
      }
    );
    
    console.log(`✅ Cleared increment history from ${employeeUpdateResult.modifiedCount} employee records`);
    
    // Step 4: Verification
    console.log('\n🔍 Step 4: Verification...');
    
    // Count remaining increment records
    const remainingIncrements = await EmployeeIncrement.countDocuments();
    
    // Count employees with increment history
    const employeesWithIncrementHistory = await Employee.countDocuments({
      incrementHistory: { $exists: true, $ne: [] }
    });
    
    // Count employees with increment dates
    const employeesWithIncrementDates = await Employee.countDocuments({
      $or: [
        { lastIncrementDate: { $exists: true } },
        { nextIncrementEligibleDate: { $exists: true } }
      ]
    });
    
    console.log(`📊 Verification Results:`);
    console.log(`   - Remaining increment records: ${remainingIncrements}`);
    console.log(`   - Employees with increment history: ${employeesWithIncrementHistory}`);
    console.log(`   - Employees with increment dates: ${employeesWithIncrementDates}`);
    
    if (remainingIncrements === 0 && employeesWithIncrementHistory === 0 && employeesWithIncrementDates === 0) {
      console.log('\n🎉 SUCCESS: All employee increment records have been successfully removed!');
    } else {
      console.log('\n⚠️  WARNING: Some increment records may still exist. Please check manually.');
    }
    
    // Step 5: Show impact summary
    console.log('\n📈 Impact Summary:');
    console.log(`   - Deleted increment records: ${deleteResult.deletedCount}`);
    console.log(`   - Cleared employee increment history: ${employeeUpdateResult.modifiedCount}`);
    console.log('   - Employee salaries remain unchanged (only increment records removed)');
    console.log('   - Future payrolls will use current employee salary without increment history');
    
  } catch (error) {
    console.error('❌ Error removing increments:', error);
    throw error;
  } finally {
    // Disconnect from database
    await disconnectDB();
    console.log('\n✅ Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  removeAllIncrements()
    .then(() => {
      console.log('\n🏁 Employee increments removal process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Employee increments removal process failed:', error);
      process.exit(1);
    });
}

module.exports = removeAllIncrements;
