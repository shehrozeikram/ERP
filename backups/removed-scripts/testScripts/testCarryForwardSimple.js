const mongoose = require('mongoose');
const AnnualLeaveManagementService = require('../services/annualLeaveManagementService');
const AnnualLeaveBalance = require('../models/hr/AnnualLeaveBalance');
const LeaveTransaction = require('../models/hr/LeaveTransaction');
const Employee = require('../models/hr/Employee');

/**
 * Simple Carry Forward Test
 * Tests employee 06387 with hire date Oct 20, 2021
 */

async function testCarryForward() {
  try {
    console.log('🚀 Starting Carry Forward Test for Employee 06387\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '06387' });
    if (!employee) {
      throw new Error('Employee 06387 not found');
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Hire Date: ${employee.hireDate.toDateString()}\n`);
    
    const employeeId = employee._id;
    
    // Clean up existing data
    console.log('🧹 Cleaning up existing data...');
    await AnnualLeaveBalance.deleteMany({ employeeId });
    await LeaveTransaction.deleteMany({ employeeId });
    console.log('✅ Cleanup complete\n');
    
    // Year 2022 - First Anniversary (Oct 20, 2022)
    console.log('📅 YEAR 2022 - First Anniversary');
    console.log('=' .repeat(60));
    const anniversary2022 = new Date(employee.hireDate);
    anniversary2022.setFullYear(2022);
    
    await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2022);
    
    const balance2022 = await AnnualLeaveBalance.findOne({ employeeId, year: 2022 });
    console.log(`   Allocated: ${balance2022.allocated}`);
    console.log(`   Used: ${balance2022.used}`);
    console.log(`   Remaining: ${balance2022.remaining}`);
    console.log(`   Carry Forward: ${balance2022.carryForward}`);
    console.log(`   Total: ${balance2022.total}\n`);
    
    // Use 10 days in 2022
    console.log('📝 Using 10 days in 2022...');
    await AnnualLeaveManagementService.deductLeaves(employeeId, 10, null, 'Test leave in 2022');
    
    const updatedBalance2022 = await AnnualLeaveBalance.findOne({ employeeId, year: 2022 });
    console.log(`   Allocated: ${updatedBalance2022.allocated}`);
    console.log(`   Used: ${updatedBalance2022.used}`);
    console.log(`   Remaining: ${updatedBalance2022.remaining}`);
    console.log(`   Carry Forward: ${updatedBalance2022.carryForward}`);
    console.log(`   Total: ${updatedBalance2022.total}\n`);
    
    // Year 2023 - Second Anniversary (Oct 20, 2023)
    console.log('📅 YEAR 2023 - Second Anniversary');
    console.log('=' .repeat(60));
    console.log(`   Expected: Carry forward ${updatedBalance2022.remaining} from 2022`);
    console.log(`   Expected: New allocation 20`);
    console.log(`   Expected: Total ${updatedBalance2022.remaining + 20}\n`);
    
    const anniversary2023 = new Date(employee.hireDate);
    anniversary2023.setFullYear(2023);
    
    await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2023);
    
    const balance2023 = await AnnualLeaveBalance.findOne({ employeeId, year: 2023 });
    console.log(`   Allocated: ${balance2023.allocated}`);
    console.log(`   Used: ${balance2023.used}`);
    console.log(`   Remaining: ${balance2023.remaining}`);
    console.log(`   Carry Forward: ${balance2023.carryForward}`);
    console.log(`   Total: ${balance2023.total}\n`);
    
    // Verify carry forward
    console.log('✅ VERIFICATION:');
    console.log('=' .repeat(60));
    const expectedCarryForward = updatedBalance2022.remaining;
    const expectedRemaining = balance2023.allocated + balance2023.carryForward - balance2023.used;
    
    console.log(`Carry Forward Check:`);
    console.log(`   Expected: ${expectedCarryForward}`);
    console.log(`   Actual: ${balance2023.carryForward}`);
    console.log(`   ${balance2023.carryForward === expectedCarryForward ? '✅ PASS' : '❌ FAIL'}\n`);
    
    console.log(`Remaining Check:`);
    console.log(`   Expected: ${expectedRemaining}`);
    console.log(`   Actual: ${balance2023.remaining}`);
    console.log(`   ${balance2023.remaining === expectedRemaining ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Final summary
    console.log('📊 FINAL SUMMARY');
    console.log('=' .repeat(60));
    const finalBalance = await AnnualLeaveManagementService.getEmployeeBalance(employeeId);
    console.log(`Total Leaves: ${finalBalance.summary.totalLeaves}`);
    console.log(`Total Used: ${finalBalance.summary.totalUsed}`);
    console.log(`Total Remaining: ${finalBalance.summary.totalRemaining}`);
    console.log(`Total Carry Forward: ${finalBalance.summary.totalCarryForward}\n`);
    
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  }
}

if (require.main === module) {
  testCarryForward()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = testCarryForward;

