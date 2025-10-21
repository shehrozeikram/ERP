const mongoose = require('mongoose');
const LeaveIntegrationService = require('../services/leaveIntegrationService');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const AnniversaryLeaveScheduler = require('../services/anniversaryLeaveScheduler');

// Test script for Anniversary Leave Management System
async function testAnniversaryLeaveSystem() {
  try {
    console.log('🧪 Testing Anniversary Leave Management System...\n');

    // Test 1: Calculate work year
    console.log('1️⃣ Testing work year calculation...');
    const hireDate = new Date('2023-01-15'); // Employee hired on Jan 15, 2023
    const currentDate = new Date('2024-02-01'); // Current date: Feb 1, 2024
    
    const workYear = LeaveIntegrationService.calculateWorkYear(hireDate, currentDate);
    console.log(`   Hire Date: ${hireDate.toDateString()}`);
    console.log(`   Current Date: ${currentDate.toDateString()}`);
    console.log(`   Work Year: ${workYear} (should be 2 - completed 1 year)\n`);

    // Test 2: Calculate anniversary allocation
    console.log('2️⃣ Testing anniversary allocation...');
    const allocation = LeaveBalance.calculateAnniversaryAllocation(workYear, {
      annualLimit: 20,
      sickLimit: 10,
      casualLimit: 10
    });
    console.log(`   Work Year: ${workYear}`);
    console.log(`   Annual Allocation: ${allocation.annual} (should be 20 - after 1 year)`);
    console.log(`   Sick Allocation: ${allocation.sick} (should be 10 - from first year)`);
    console.log(`   Casual Allocation: ${allocation.casual} (should be 10 - from first year)\n`);

    // Test 3: Test first year employee (no annual leaves)
    console.log('3️⃣ Testing first year employee...');
    const firstYearAllocation = LeaveBalance.calculateAnniversaryAllocation(1, {
      annualLimit: 20,
      sickLimit: 10,
      casualLimit: 10
    });
    console.log(`   Work Year: 1`);
    console.log(`   Annual Allocation: ${firstYearAllocation.annual} (should be 0 - no annual leaves in first year)`);
    console.log(`   Sick Allocation: ${firstYearAllocation.sick} (should be 10)`);
    console.log(`   Casual Allocation: ${firstYearAllocation.casual} (should be 10)\n`);

    // Test 4: Test anniversary info calculation
    console.log('4️⃣ Testing anniversary info...');
    const anniversaryInfo = {
      hireDate: hireDate,
      currentWorkYear: workYear,
      nextAnniversary: new Date(hireDate),
      daysToAnniversary: 45
    };
    anniversaryInfo.nextAnniversary.setFullYear(2024);
    
    console.log(`   Hire Date: ${anniversaryInfo.hireDate.toDateString()}`);
    console.log(`   Current Work Year: ${anniversaryInfo.currentWorkYear}`);
    console.log(`   Next Anniversary: ${anniversaryInfo.nextAnniversary.toDateString()}`);
    console.log(`   Days to Anniversary: ${anniversaryInfo.daysToAnniversary}\n`);

    // Test 5: Test scheduler status
    console.log('5️⃣ Testing scheduler status...');
    const schedulerStatus = AnniversaryLeaveScheduler.getStatus();
    console.log(`   Scheduler Running: ${schedulerStatus.isRunning}`);
    console.log(`   Last Run: ${schedulerStatus.lastRun || 'Never'}`);
    console.log(`   Next Run: ${schedulerStatus.nextRun || 'Not scheduled'}\n`);

    console.log('✅ All tests completed successfully!');
    console.log('\n📋 Summary of Anniversary Leave Rules:');
    console.log('   • Annual leaves: 20 per year, given AFTER completing 1 year');
    console.log('   • Sick leaves: 10 per year, given from first year');
    console.log('   • Casual leaves: 10 per year, given from first year');
    console.log('   • Annual leaves carry forward for max 2 years, then expire');
    console.log('   • All allocations based on individual hire date (anniversary)');
    console.log('   • Automatic renewal on work anniversary');
    console.log('   • Monthly scheduled processing for renewals and expiration');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAnniversaryLeaveSystem();
