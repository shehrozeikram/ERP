const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the service
const MonthlyTaxUpdateService = require('./services/monthlyTaxUpdateService');

const testMonthlyTaxUpdate = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('🧪 Testing Monthly Tax Update Service...\n');
    
    // Test 1: Get current month tax summary
    console.log('📊 Test 1: Getting current month tax summary...');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const summary = await MonthlyTaxUpdateService.getMonthlyTaxSummary(currentMonth, currentYear);
    console.log('✅ Current Month Tax Summary:');
    console.log(`   Month/Year: ${summary.month}/${summary.year}`);
    console.log(`   Total Payrolls: ${summary.totalPayrolls}`);
    console.log(`   Total Tax: Rs. ${summary.totalTax?.toLocaleString() || 0}`);
    console.log(`   Average Tax: Rs. ${summary.averageTax?.toLocaleString() || 0}`);
    
    if (summary.payrolls.length > 0) {
      console.log('\n📋 Sample Payrolls:');
      summary.payrolls.slice(0, 3).forEach(p => {
        console.log(`   ${p.employeeId}: ${p.employeeName} - Earnings: Rs. ${p.totalEarnings?.toLocaleString() || 0}, Tax: Rs. ${p.incomeTax?.toLocaleString() || 0}`);
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Update taxes for current month
    console.log('🔄 Test 2: Updating taxes for current month...');
    const updateResult = await MonthlyTaxUpdateService.updateCurrentMonthTaxes();
    
    if (updateResult.success) {
      console.log('✅ Current Month Tax Update Result:');
      console.log(`   Total Payrolls: ${updateResult.totalCount}`);
      console.log(`   Successfully Updated: ${updateResult.updatedCount}`);
      console.log(`   Failed: ${updateResult.errorCount}`);
      
      if (updateResult.results.length > 0) {
        console.log('\n📋 Sample Update Results:');
        updateResult.results.slice(0, 3).forEach(r => {
          if (r.success) {
            console.log(`   ${r.employeeId}: ${r.updated ? '✅ Updated' : 'ℹ️ Already Updated'} - Old Tax: Rs. ${r.oldTax?.toLocaleString() || 0}, New Tax: Rs. ${r.newTax?.toLocaleString() || 0}`);
          } else {
            console.log(`   ${r.employeeId}: ❌ Failed - ${r.message}`);
          }
        });
      }
    } else {
      console.log('❌ Tax update failed:', updateResult.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 3: Force update for a specific month (example: previous month)
    console.log('🔄 Test 3: Force updating taxes for previous month...');
    let previousMonth = now.getMonth();
    let previousYear = now.getFullYear();
    
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear--;
    }
    
    const forceUpdateResult = await MonthlyTaxUpdateService.updateMonthlyTaxes(previousMonth, previousYear, true);
    
    if (forceUpdateResult.success) {
      console.log('✅ Previous Month Force Update Result:');
      console.log(`   Month/Year: ${forceUpdateResult.month}/${forceUpdateResult.year}`);
      console.log(`   Total Payrolls: ${forceUpdateResult.totalCount}`);
      console.log(`   Successfully Updated: ${forceUpdateResult.updatedCount}`);
      console.log(`   Failed: ${forceUpdateResult.errorCount}`);
    } else {
      console.log('❌ Force update failed:', forceUpdateResult.message);
    }
    
    console.log('\n🎯 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testMonthlyTaxUpdate()
    .then(() => {
      console.log('🎯 Test execution completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testMonthlyTaxUpdate };
