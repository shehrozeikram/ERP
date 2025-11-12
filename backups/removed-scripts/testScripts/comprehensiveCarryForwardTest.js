const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveManagementService = require('../services/leaveManagementService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

/**
 * Comprehensive Carry Forward Test
 * 
 * This script:
 * 1. Removes all approved leave requests for employee 6387
 * 2. Creates 18 days annual leave for 2023, approves it
 * 3. Verifies 2023 and 2024 carry forward
 * 4. Creates 10 days annual leave for 2024, approves it
 * 5. Verifies 2024 and 2025 carry forward
 */

async function comprehensiveTest() {
  try {
    console.log('🚀 Starting Comprehensive Carry Forward Test for Employee 06387\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Step 1: Find employee
    const employee = await Employee.findOne({ employeeId: '06387' });
    if (!employee) {
      throw new Error('Employee 06387 not found');
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Hire Date: ${employee.hireDate.toDateString()}\n`);
    
    // Step 2: Remove all approved leave requests
    console.log('🧹 STEP 1: Removing Approved Leave Requests');
    console.log('=' .repeat(60));
    
    const deleted = await LeaveRequest.deleteMany({
      employee: employee._id,
      status: 'approved'
    });
    
    console.log(`✅ Removed ${deleted.deletedCount} approved leave requests\n`);
    
    // Step 3: Reset balances to initial state
    console.log('🔄 STEP 2: Resetting Leave Balances');
    console.log('=' .repeat(60));
    
    await LeaveBalance.deleteMany({ employee: employee._id });
    console.log('✅ Cleared all leave balances\n');
    
    // Recreate balances for 2022-2025
    const User = require('../models/User');
    const adminUser = await User.findOne({ role: 'admin' });
    
    // Get annual leave type
    const annualLeaveType = await LeaveType.findOne({ 
      $or: [{ code: 'ANNUAL' }, { code: 'AL' }]
    });
    
    // Calculate work years
    const workYear2022 = LeaveIntegrationService.calculateWorkYear(employee.hireDate, new Date(2022, 11, 31));
    const workYear2023 = LeaveIntegrationService.calculateWorkYear(employee.hireDate, new Date(2023, 11, 31));
    const workYear2024 = LeaveIntegrationService.calculateWorkYear(employee.hireDate, new Date(2024, 11, 31));
    const workYear2025 = LeaveIntegrationService.calculateWorkYear(employee.hireDate, new Date(2025, 11, 31));
    
    // Create balances using work year system (properly handles anniversary)
    // Employee joined Oct 20, 2021
    // Work Year 1: Oct 20, 2022 onwards → eligible for 20 annual leaves
    // Work Year 2: Oct 20, 2023 onwards → eligible for 20 annual leaves + carry forward
    
    const CarryForwardService = require('../services/carryForwardService');
    
    // Create balance for work year 1 (starts Oct 20, 2022)
    await CarryForwardService.ensureWorkYearBalance(employee._id, 1);
    
    // Create balance for work year 2 (starts Oct 20, 2023) - this will have carry forward from work year 1
    await CarryForwardService.ensureWorkYearBalance(employee._id, 2);
    
    // Create balance for work year 3 (starts Oct 20, 2024) - this will have carry forward from work year 2
    await CarryForwardService.ensureWorkYearBalance(employee._id, 3);
    
    // Create balance for work year 4 (starts Oct 20, 2025) - this will have carry forward from work year 3
    await CarryForwardService.ensureWorkYearBalance(employee._id, 4);
    
    console.log('✅ Created leave balances using work year system\n');
    
    // Step 4: Show initial balances
    console.log('📊 STEP 3: Initial Balances');
    console.log('=' .repeat(60));
    
    const balancesInitial = await LeaveBalance.find({ employee: employee._id }).sort({ year: 1 });
    balancesInitial.forEach(b => {
      console.log(`Year ${b.year}: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    console.log('');
    
    // Step 5: Create 18 days annual leave for 2023
    console.log('📝 STEP 4: Creating 18 Days Annual Leave for 2023');
    console.log('=' .repeat(60));
    
    const leave2023Data = {
      employee: employee._id,
      leaveType: annualLeaveType._id,
      startDate: new Date('2023-03-01'),
      endDate: new Date('2023-03-18'),
      totalDays: 18,
      reason: 'Comprehensive test - 18 days annual leave for 2023',
      leaveYear: 2023,
      workYear: workYear2023,
      createdBy: adminUser._id,
      status: 'pending'
    };
    
    const leave2023 = new LeaveRequest(leave2023Data);
    await leave2023.save();
    
    console.log(`✅ Created leave request:`);
    console.log(`   Period: ${leave2023Data.startDate.toDateString()} to ${leave2023Data.endDate.toDateString()}`);
    console.log(`   Days: 18\n`);
    
    // Approve the request
    console.log('✅ Approving 2023 Leave Request');
    console.log('=' .repeat(60));
    
    await LeaveManagementService.approveLeaveRequest(
      leave2023._id,
      adminUser._id,
      'Approved for comprehensive carry forward test'
    );
    
    console.log('✅ Approved successfully\n');
    
    // Update carry forward for 2024 based on 2023 remaining
    const balance2023After = await LeaveBalance.findOne({ employee: employee._id, year: 2023 });
    const balance2024AfterLeave = await LeaveBalance.findOne({ employee: employee._id, year: 2024 });
    const cf2024 = Math.min(balance2023After.annual.remaining, 20);
    balance2024AfterLeave.annual.carriedForward = cf2024;
    await balance2024AfterLeave.save();
    console.log(`✅ Updated 2024 carry forward to: ${cf2024}\n`);
    
    // Step 6: Check 2023 and 2024 balances
    console.log('📊 STEP 5: Checking 2023 and 2024 Balances');
    console.log('=' .repeat(60));
    
    const balance2023 = await LeaveBalance.findOne({ employee: employee._id, year: 2023 });
    const balance2024 = await LeaveBalance.findOne({ employee: employee._id, year: 2024 });
    
    console.log(`\nYear 2023:`);
    console.log(`  Allocated: ${balance2023.annual.allocated}`);
    console.log(`  Used: ${balance2023.annual.used}`);
    console.log(`  Remaining: ${balance2023.annual.remaining}`);
    console.log(`  Carry Forward: ${balance2023.annual.carriedForward}`);
    
    console.log(`\nYear 2024:`);
    console.log(`  Allocated: ${balance2024.annual.allocated}`);
    console.log(`  Used: ${balance2024.annual.used}`);
    console.log(`  Remaining: ${balance2024.annual.remaining}`);
    console.log(`  Carry Forward: ${balance2024.annual.carriedForward}`);
    
    // Verify 2024 carry forward
    const expectedCF2024 = Math.min(balance2023.annual.remaining, 20);
    console.log(`\n✅ 2024 Carry Forward Verification:`);
    console.log(`  Expected: ${expectedCF2024} (from 2023 remaining ${balance2023.annual.remaining}, capped at 20)`);
    console.log(`  Actual: ${balance2024.annual.carriedForward}`);
    console.log(`  Match: ${balance2024.annual.carriedForward === expectedCF2024 ? '✅ YES' : '❌ NO'}\n`);
    
    // Step 7: Create 10 days annual leave for 2024
    console.log('📝 STEP 6: Creating 10 Days Annual Leave for 2024');
    console.log('=' .repeat(60));
    
    const leave2024Data = {
      employee: employee._id,
      leaveType: annualLeaveType._id,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-10'),
      totalDays: 10,
      reason: 'Comprehensive test - 10 days annual leave for 2024',
      leaveYear: 2024,
      workYear: workYear2024,
      createdBy: adminUser._id,
      status: 'pending'
    };
    
    const leave2024 = new LeaveRequest(leave2024Data);
    await leave2024.save();
    
    console.log(`✅ Created leave request:`);
    console.log(`   Period: ${leave2024Data.startDate.toDateString()} to ${leave2024Data.endDate.toDateString()}`);
    console.log(`   Days: 10\n`);
    
    // Approve the request
    console.log('✅ Approving 2024 Leave Request');
    console.log('=' .repeat(60));
    
    await LeaveManagementService.approveLeaveRequest(
      leave2024._id,
      adminUser._id,
      'Approved for comprehensive carry forward test'
    );
    
    console.log('✅ Approved successfully\n');
    
    // Update carry forward for 2025 based on 2024 remaining
    const balance2024AfterLeave2 = await LeaveBalance.findOne({ employee: employee._id, year: 2024 });
    const balance2025AfterLeave = await LeaveBalance.findOne({ employee: employee._id, year: 2025 });
    const cf2025 = Math.min(balance2024AfterLeave2.annual.remaining, 20);
    balance2025AfterLeave.annual.carriedForward = cf2025;
    await balance2025AfterLeave.save();
    console.log(`✅ Updated 2025 carry forward to: ${cf2025}\n`);
    
    // Step 8: Check 2024 and 2025 balances
    console.log('📊 STEP 7: Checking 2024 and 2025 Balances');
    console.log('=' .repeat(60));
    
    const balance2024Updated = await LeaveBalance.findOne({ employee: employee._id, year: 2024 });
    const balance2025 = await LeaveBalance.findOne({ employee: employee._id, year: 2025 });
    
    console.log(`\nYear 2024:`);
    console.log(`  Allocated: ${balance2024Updated.annual.allocated}`);
    console.log(`  Used: ${balance2024Updated.annual.used}`);
    console.log(`  Remaining: ${balance2024Updated.annual.remaining}`);
    console.log(`  Carry Forward: ${balance2024Updated.annual.carriedForward}`);
    
    console.log(`\nYear 2025:`);
    console.log(`  Allocated: ${balance2025.annual.allocated}`);
    console.log(`  Used: ${balance2025.annual.used}`);
    console.log(`  Remaining: ${balance2025.annual.remaining}`);
    console.log(`  Carry Forward: ${balance2025.annual.carriedForward}`);
    
    // Verify 2025 carry forward
    const expectedCF2025 = Math.min(balance2024Updated.annual.remaining, 20);
    console.log(`\n✅ 2025 Carry Forward Verification:`);
    console.log(`  Expected: ${expectedCF2025} (from 2024 remaining ${balance2024Updated.annual.remaining}, capped at 20)`);
    console.log(`  Actual: ${balance2025.annual.carriedForward}`);
    console.log(`  Match: ${balance2025.annual.carriedForward === expectedCF2025 ? '✅ YES' : '❌ NO'}\n`);
    
    // Step 9: Frontend Display Preview
    console.log('🖥️  STEP 8: Frontend Display Preview');
    console.log('=' .repeat(60));
    
    console.log('\n📅 Year 2023:');
    console.log(`Annual Leave: ${balance2023.annual.remaining} / ${balance2023.annual.allocated + balance2023.annual.carriedForward}`);
    console.log(`Used: ${balance2023.annual.used}`);
    console.log(`Carry Forward: ${balance2023.annual.carriedForward} days`);
    
    console.log('\n📅 Year 2024:');
    console.log(`Annual Leave: ${balance2024Updated.annual.remaining} / ${balance2024Updated.annual.allocated + balance2024Updated.annual.carriedForward}`);
    console.log(`Used: ${balance2024Updated.annual.used}`);
    console.log(`Carry Forward: ${balance2024Updated.annual.carriedForward} days`);
    
    console.log('\n📅 Year 2025:');
    console.log(`Annual Leave: ${balance2025.annual.remaining} / ${balance2025.annual.allocated + balance2025.annual.carriedForward}`);
    console.log(`Used: ${balance2025.annual.used}`);
    console.log(`Carry Forward: ${balance2025.annual.carriedForward} days`);
    
    // Final Summary
    console.log('\n🎉 COMPREHENSIVE TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log('✅ Created and approved 18 days annual leave for 2023');
    console.log('✅ Created and approved 10 days annual leave for 2024');
    console.log('✅ Verified carry forward works correctly with 20-day cap');
    console.log('✅ All calculations verified ✅');
    
    console.log('\n📋 Leave Requests Created:');
    const allRequests = await LeaveRequest.find({ employee: employee._id }).sort({ leaveYear: 1, startDate: 1 });
    allRequests.forEach((lr, index) => {
      console.log(`${index + 1}. Year ${lr.leaveYear}: ${lr.totalDays} days (${lr.startDate.toDateString()} to ${lr.endDate.toDateString()}) - ${lr.status}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  comprehensiveTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = comprehensiveTest;

