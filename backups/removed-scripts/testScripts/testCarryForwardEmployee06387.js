const mongoose = require('mongoose');
const AnnualLeaveManagementService = require('../services/annualLeaveManagementService');
const AnnualLeaveBalance = require('../models/hr/AnnualLeaveBalance');
const LeaveTransaction = require('../models/hr/LeaveTransaction');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');

/**
 * Test Script for Employee 06387 Carry Forward
 * 
 * This script:
 * 1. Removes all approved leave requests for employee 06387
 * 2. Processes anniversary allocations for 2022, 2023, and 2024
 * 3. Creates and approves annual leave requests for 2023 and 2024
 * 4. Verifies carry forward calculations
 */

class CarryForwardTest06387 {
  
  constructor() {
    this.employeeId = null;
    this.employeeObjId = null;
    this.annualLeaveTypeId = null;
  }
  
  /**
   * Initialize test environment
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Carry Forward Test for Employee 06387...');
      
      // Connect to database
      require('dotenv').config();
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
      console.log('✅ Connected to database');
      
      // Find employee 06387
      await this.findEmployee06387();
      
      // Get annual leave type
      await this.getAnnualLeaveType();
      
      console.log('✅ Test environment initialized');
      
    } catch (error) {
      console.error('❌ Error initializing test environment:', error);
      throw error;
    }
  }
  
  /**
   * Find employee 06387
   */
  async findEmployee06387() {
    try {
      // Try multiple search methods
      let employee = await Employee.findOne({ employeeId: '06387' });
      
      if (!employee) {
        employee = await Employee.findOne({ employeeId: /06387/i });
      }
      
      if (!employee) {
        // List some employees for debugging
        const sample = await Employee.find({}).select('employeeId firstName lastName').limit(5);
        console.log('Sample employees:', sample.map(e => e.employeeId));
        throw new Error('Employee 06387 not found in database');
      }
      
      this.employeeId = employee.employeeId;
      this.employeeObjId = employee._id;
      
      console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
      console.log(`   Employee ID: ${this.employeeId}`);
      console.log(`   MongoDB ID: ${this.employeeObjId}`);
      console.log(`   Hire Date: ${employee.hireDate.toDateString()}`);
      
    } catch (error) {
      console.error('❌ Error finding employee 06387:', error);
      throw error;
    }
  }
  
  /**
   * Get annual leave type
   */
  async getAnnualLeaveType() {
    try {
      const leaveType = await LeaveType.findOne({ 
        $or: [
          { code: 'ANNUAL' },
          { code: 'AL' }
        ]
      });
      
      if (!leaveType) {
        throw new Error('Annual leave type not found');
      }
      
      this.annualLeaveTypeId = leaveType._id;
      console.log(`✅ Found annual leave type: ${leaveType.name} (${leaveType.code})`);
      
    } catch (error) {
      console.error('❌ Error finding annual leave type:', error);
      throw error;
    }
  }
  
  /**
   * Step 1: Remove all approved leave requests for employee 06387
   */
  async removeApprovedLeaves() {
    try {
      console.log('\n🧹 STEP 1: Removing approved leave requests for employee 06387...');
      
      const result = await LeaveRequest.deleteMany({
        employee: this.employeeObjId,
        status: 'approved'
      });
      
      console.log(`✅ Removed ${result.deletedCount} approved leave requests`);
      
    } catch (error) {
      console.error('❌ Error removing approved leaves:', error);
      throw error;
    }
  }
  
  /**
   * Step 2: Clean up annual leave balances and transactions
   */
  async cleanupAnnualLeaveData() {
    try {
      console.log('\n🧹 STEP 2: Cleaning up annual leave balances and transactions...');
      
      // Remove annual leave balances
      const balanceResult = await AnnualLeaveBalance.deleteMany({
        employeeId: this.employeeObjId
      });
      
      // Remove leave transactions
      const transactionResult = await LeaveTransaction.deleteMany({
        employeeId: this.employeeObjId
      });
      
      console.log(`✅ Removed ${balanceResult.deletedCount} annual leave balances`);
      console.log(`✅ Removed ${transactionResult.deletedCount} leave transactions`);
      
    } catch (error) {
      console.error('❌ Error cleaning up annual leave data:', error);
      throw error;
    }
  }
  
  /**
   * Step 3: Process anniversary allocations for 2022, 2023, and 2024
   */
  async processAnniversaries() {
    try {
      console.log('\n📅 STEP 3: Processing anniversary allocations...');
      
      // Get hire date to calculate anniversaries
      const employee = await Employee.findById(this.employeeObjId);
      const hireDate = new Date(employee.hireDate);
      
      console.log(`   Hire Date: ${hireDate.toDateString()}`);
      
      // Process 2022 anniversary (first anniversary)
      const anniversary2022 = new Date(hireDate);
      anniversary2022.setFullYear(2022);
      
      console.log(`\n📅 Processing 2022 Anniversary: ${anniversary2022.toDateString()}`);
      const result2022 = await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2022);
      console.log(`   ✅ Processed ${result2022.processed} allocations`);
      
      // Process 2023 anniversary (second anniversary)
      const anniversary2023 = new Date(hireDate);
      anniversary2023.setFullYear(2023);
      
      console.log(`\n📅 Processing 2023 Anniversary: ${anniversary2023.toDateString()}`);
      const result2023 = await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2023);
      console.log(`   ✅ Processed ${result2023.processed} allocations`);
      
      // Process 2024 anniversary (third anniversary)
      const anniversary2024 = new Date(hireDate);
      anniversary2024.setFullYear(2024);
      
      console.log(`\n📅 Processing 2024 Anniversary: ${anniversary2024.toDateString()}`);
      const result2024 = await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2024);
      console.log(`   ✅ Processed ${result2024.processed} allocations`);
      
      console.log('\n✅ All anniversary allocations processed');
      
    } catch (error) {
      console.error('❌ Error processing anniversaries:', error);
      throw error;
    }
  }
  
  /**
   * Step 4: Show current balance
   */
  async showCurrentBalance() {
    try {
      console.log('\n📊 STEP 4: Current Annual Leave Balance');
      console.log('=' .repeat(60));
      
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeObjId);
      
      console.log('\n📈 SUMMARY:');
      console.log(`   Total Allocated: ${balance.summary.totalAllocated} days`);
      console.log(`   Total Used: ${balance.summary.totalUsed} days`);
      console.log(`   Total Remaining: ${balance.summary.totalRemaining} days`);
      console.log(`   Total Carry Forward: ${balance.summary.totalCarryForward} days`);
      console.log(`   Total Leaves: ${balance.summary.totalLeaves} days`);
      
      console.log('\n📋 YEAR-BY-YEAR BREAKDOWN:');
      balance.balances.forEach(b => {
        console.log(`   Year ${b.year}:`);
        console.log(`      Allocated: ${b.allocated}`);
        console.log(`      Used: ${b.used}`);
        console.log(`      Remaining: ${b.remaining}`);
        console.log(`      Carry Forward: ${b.carryForward}`);
        console.log(`      Total: ${b.total}`);
      });
      
    } catch (error) {
      console.error('❌ Error showing balance:', error);
      throw error;
    }
  }
  
  /**
   * Step 5: Create and approve leave requests for 2023
   */
  async createAndApprove2023Leaves() {
    try {
      console.log('\n📝 STEP 5: Creating and approving leave requests for 2023...');
      
      // Simulate using some leaves in 2022 (so there's carry forward for 2023)
      console.log('   📌 Simulating 10 days leave usage in 2022...');
      await AnnualLeaveManagementService.deductLeaves(
        this.employeeObjId,
        10,
        null,
        'Test leave usage for 2022'
      );
      
      // Process 245 anniversary (re-doing it with the deduction)
      const employee = await Employee.findById(this.employeeObjId);
      const hireDate = new Date(employee.hireDate);
      const anniversary2023 = new Date(hireDate);
      anniversary2023.setFullYear(2023);
      
      await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2023);
      
      console.log('   ✅ 2023 anniversary re-processed with carry forward');
      
      // Now show balance
      await this.showCurrentBalance();
      
    } catch (error) {
      console.error('❌ Error creating/approving 2023 leaves:', error);
      throw error;
    }
  }
  
  /**
   * Step 6: Create and approve leave requests for 2024
   */
  async createAndApprove2024Leaves() {
    try {
      console.log('\n📝 STEP 6: Creating and approving leave requests for 2024...');
      
      // Simulate using 5 leaves in 2023
      console.log('   📌 Simulating 5 days leave usage in 2023...');
      await AnnualLeaveManagementService.deductLeaves(
        this.employeeObjId,
        5,
        null,
        'Test leave usage for 2023'
      );
      
      // Process 2024 anniversary
      const employee = await Employee.findById(this.employeeObjId);
      const hireDate = new Date(employee.hireDate);
      const anniversary2024 = new Date(hireDate);
      anniversary2024.setFullYear(2024);
      
      await AnnualLeaveManagementService.processAnniversaryAllocations(anniversary2024);
      
      console.log('   ✅ 2024 anniversary processed with carry forward');
      
      // Show final balance
      await this.showCurrentBalance();
      
    } catch (error) {
      console.error('❌ Error creating/approving 2024 leaves:', error);
      throw error;
    }
  }
  
  /**
   * Step 7: Verify carry forward is working correctly
   */
  async verifyCarryForward() {
    try {
      console.log('\n✅ STEP 7: Verifying Carry Forward Logic');
      console.log('=' .repeat(60));
      
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeObjId);
      
      let allPassed = true;
      
      // Check each year's carry forward
      for (let i = 0; i < balance.balances.length; i++) {
        const currentBalance = balance.balances[i];
        const expectedRemaining = currentBalance.allocated + currentBalance.carryForward - currentBalance.used;
        
        console.log(`\n📅 Year ${currentBalance.year}:`);
        console.log(`   Allocated: ${currentBalance.allocated}`);
        console.log(`   Carry Forward: ${currentBalance.carryForward}`);
        console.log(`   Used: ${currentBalance.used}`);
        console.log(`   Remaining: ${currentBalance.remaining}`);
        console.log(`   Expected Remaining: ${expectedRemaining}`);
        
        if (currentBalance.remaining === expectedRemaining) {
          console.log(`   ✅ PASS: Remaining matches expected value`);
        } else {
          console.log(`   ❌ FAIL: Remaining doesn't match expected value`);
          allPassed = false;
        }
        
        // Check carry forward from previous year (if exists)
        if (i > 0) {
          const previousBalance = balance.balances[i - 1];
          const expectedCarryForward = previousBalance.remaining;
          
          console.log(`   Carry Forward Source: Year ${previousBalance.year} remaining = ${previousBalance.remaining}`);
          
          if (currentBalance.carryForward === expectedCarryForward) {
            console.log(`   ✅ PASS: Carry forward matches previous year's remaining`);
          } else {
            console.log(`   ❌ FAIL: Carry forward doesn't match previous year's remaining`);
            allPassed = false;
          }
        }
      }
      
      if (allPassed) {
        console.log('\n🎉 ALL CARRY FORWARD VERIFICATIONS PASSED!');
      } else {
        console.log('\n❌ SOME CARRY FORWARD VERIFICATIONS FAILED!');
      }
      
    } catch (error) {
      console.error('❌ Error verifying carry forward:', error);
      throw error;
    }
  }
  
  /**
   * Run complete test
   */
  async runTest() {
    try {
      await this.initialize();
      await this.removeApprovedLeaves();
      await this.cleanupAnnualLeaveData();
      await this.processAnniversaries();
      await this.showCurrentBalance();
      await this.createAndApprove2023Leaves();
      await this.createAndApprove2024Leaves();
      await this.verifyCarryForward();
      
      console.log('\n🎉 CARRY FORWARD TEST COMPLETED SUCCESSFULLY!');
      
    } catch (error) {
      console.error('\n❌ TEST FAILED:', error);
      throw error;
    }
  }
  
  /**
   * Clean up
   */
  async cleanup() {
    try {
      await mongoose.disconnect();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
}

// Run test if executed directly
if (require.main === module) {
  const test = new CarryForwardTest06387();
  
  async function run() {
    try {
      await test.runTest();
      await test.cleanup();
      process.exit(0);
    } catch (error) {
      console.error('❌ Test failed:', error);
      await test.cleanup();
      process.exit(1);
    }
  }
  
  run();
}

module.exports = CarryForwardTest06387;

