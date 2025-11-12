const mongoose = require('mongoose');
const AnnualLeaveManagementService = require('../services/annualLeaveManagementService');
const AnnualLeaveBalance = require('../models/hr/AnnualLeaveBalance');
const LeaveTransaction = require('../models/hr/LeaveTransaction');
const Employee = require('../models/hr/Employee');

/**
 * Test Script for Employee 6387 Annual Leave Workflow
 * 
 * This script demonstrates the complete annual leave system workflow
 * for employee 6387 with hire date 2021-10-21, showing how the system
 * handles allocations, carry forward, cap enforcement, and deductions
 * over multiple years (2021-2029).
 */
class Employee6387TestWorkflow {
  
  constructor() {
    this.employeeId = null;
    this.testResults = [];
  }
  
  /**
   * Initialize test environment
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Employee 6387 Test Workflow...');
      
      // Connect to database
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
      console.log('✅ Connected to database');
      
      // Find or create employee 6387
      await this.setupEmployee6387();
      
      console.log('✅ Test environment initialized');
      
    } catch (error) {
      console.error('❌ Error initializing test environment:', error);
      throw error;
    }
  }
  
  /**
   * Setup employee 6387 for testing
   */
  async setupEmployee6387() {
    try {
      // Try to find existing employee
      let employee = await Employee.findOne({ employeeId: '6387' });
      
      if (!employee) {
        console.log('👤 Creating test employee 6387...');
        
        // Create test employee
        employee = new Employee({
          employeeId: '6387',
          firstName: 'Test',
          lastName: 'Employee',
          email: 'test.employee6387@sgc.com',
          hireDate: new Date('2021-10-21'),
          isActive: true,
          department: 'IT',
          designation: 'Software Developer',
          employmentType: 'permanent'
        });
        
        await employee.save();
        console.log('✅ Created test employee 6387');
      } else {
        console.log('👤 Found existing employee 6387');
      }
      
      this.employeeId = employee._id;
      
      // Clean up any existing test data
      await this.cleanupTestData();
      
    } catch (error) {
      console.error('❌ Error setting up employee 6387:', error);
      throw error;
    }
  }
  
  /**
   * Clean up existing test data
   */
  async cleanupTestData() {
    try {
      console.log('🧹 Cleaning up existing test data...');
      
      // Remove existing balances
      await AnnualLeaveBalance.deleteMany({ employeeId: this.employeeId });
      
      // Remove existing transactions
      await LeaveTransaction.deleteMany({ employeeId: this.employeeId });
      
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      console.error('❌ Error cleaning up test data:', error);
      throw error;
    }
  }
  
  /**
   * Run the complete workflow test
   */
  async runCompleteWorkflow() {
    try {
      console.log('\n🎯 Starting Complete Annual Leave Workflow Test for Employee 6387');
      console.log('📅 Hire Date: 2021-10-21');
      console.log('📋 Testing years: 2021-2029\n');
      
      // Year 1 (2021-2022): No leaves yet
      await this.testYear1();
      
      // Year 2 (2022-2023): First allocation
      await this.testYear2();
      
      // Year 3 (2023-2024): Carry forward + new allocation
      await this.testYear3();
      
      // Year 4 (2024-2025): Cap enforcement
      await this.testYear4();
      
      // Year 5 (2025-2026): Leave usage and allocation
      await this.testYear5();
      
      // Year 6 (2026-2027): More cap enforcement
      await this.testYear6();
      
      // Year 7 (2027-2028): Partial bucket removal
      await this.testYear7();
      
      // Year 8 (2028-2029): Full bucket removal
      await this.testYear8();
      
      // Generate final report
      await this.generateFinalReport();
      
      console.log('\n🎉 Complete workflow test finished successfully!');
      
    } catch (error) {
      console.error('❌ Error in workflow test:', error);
      throw error;
    }
  }
  
  /**
   * Test Year 1 (2021-2022): No leaves yet
   */
  async testYear1() {
    console.log('\n📅 YEAR 1 (2021-2022) - No leaves yet');
    console.log('Hire date: 2021-10-21');
    console.log('Status: Employee must complete 1 full year before eligibility');
    
    const testDate = new Date('2022-10-20'); // Day before anniversary
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2021,
        phase: 'Before Anniversary',
        result: result,
        expected: 'No allocations (employee hasn\'t completed 1 year)',
        status: result.processed === 0 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 0)`);
      
    } catch (error) {
      console.error('❌ Error in Year 1 test:', error);
      this.testResults.push({
        year: 2021,
        phase: 'Before Anniversary',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 2 (2022-2023): First allocation
   */
  async testYear2() {
    console.log('\n📅 YEAR 2 (2022-2023) - First allocation');
    console.log('Anniversary: 2022-10-21');
    console.log('Expected: +20 leaves allocated');
    
    const testDate = new Date('2022-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2022,
        phase: 'First Anniversary',
        result: result,
        expected: '20 leaves allocated',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 20)`);
      
    } catch (error) {
      console.error('❌ Error in Year 2 test:', error);
      this.testResults.push({
        year: 2022,
        phase: 'First Anniversary',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 3 (2023-2024): Carry forward + new allocation
   */
  async testYear3() {
    console.log('\n📅 YEAR 3 (2023-2024) - Carry forward + new allocation');
    console.log('Anniversary: 2023-10-21');
    console.log('Expected: Carry forward 15 + new 20 = 35 total (below 40 cap)');
    
    // First, simulate using 5 leaves in 2022
    await this.simulateLeaveUsage(2022, 5, 'Used 5 leaves during 2022-2023');
    
    const testDate = new Date('2023-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2023,
        phase: 'Second Anniversary',
        result: result,
        expected: 'Carry forward 15 + new 20 = 35 total',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 35)`);
      
    } catch (error) {
      console.error('❌ Error in Year 3 test:', error);
      this.testResults.push({
        year: 2023,
        phase: 'Second Anniversary',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 4 (2024-2025): Cap enforcement
   */
  async testYear4() {
    console.log('\n📅 YEAR 4 (2024-2025) - Cap enforcement');
    console.log('Anniversary: 2024-10-21');
    console.log('Expected: Use 5 → remaining 30, new 20 → total 50, drop oldest 15 → final 35');
    
    // First, simulate using 5 leaves in 2023
    await this.simulateLeaveUsage(2023, 5, 'Used 5 leaves during 2023-2024');
    
    const testDate = new Date('2024-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2024,
        phase: 'Third Anniversary - Cap Enforcement',
        result: result,
        expected: 'Cap enforcement: drop oldest bucket to maintain 40-day limit',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 35)`);
      
    } catch (error) {
      console.error('❌ Error in Year 4 test:', error);
      this.testResults.push({
        year: 2024,
        phase: 'Third Anniversary - Cap Enforcement',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 5 (2025-2026): Leave usage and allocation
   */
  async testYear5() {
    console.log('\n📅 YEAR 5 (2025-2026) - Leave usage and allocation');
    console.log('Anniversary: 2025-10-21');
    console.log('Expected: Use 15 → remaining 20, new 20 → total 40 (within cap)');
    
    // First, simulate using 15 leaves in 2024
    await this.simulateLeaveUsage(2024, 15, 'Used 15 leaves during 2024-2025');
    
    const testDate = new Date('2025-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2025,
        phase: 'Fourth Anniversary',
        result: result,
        expected: 'Use 15 → remaining 20, new 20 → total 40',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 40)`);
      
    } catch (error) {
      console.error('❌ Error in Year 5 test:', error);
      this.testResults.push({
        year: 2025,
        phase: 'Fourth Anniversary',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 6 (2026-2027): More cap enforcement
   */
  async testYear6() {
    console.log('\n📅 YEAR 6 (2026-2027) - More cap enforcement');
    console.log('Anniversary: 2026-10-21');
    console.log('Expected: Use 10 → remaining 30, new 20 → total 50, drop oldest 15 → final 35');
    
    // First, simulate using 10 leaves in 2025
    await this.simulateLeaveUsage(2025, 10, 'Used 10 leaves during 2025-2026');
    
    const testDate = new Date('2026-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2026,
        phase: 'Fifth Anniversary - Cap Enforcement',
        result: result,
        expected: 'Cap enforcement: drop oldest bucket to maintain 40-day limit',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 35)`);
      
    } catch (error) {
      console.error('❌ Error in Year 6 test:', error);
      this.testResults.push({
        year: 2026,
        phase: 'Fifth Anniversary - Cap Enforcement',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 7 (2027-2028): Partial bucket removal
   */
  async testYear7() {
    console.log('\n📅 YEAR 7 (2027-2028) - Partial bucket removal');
    console.log('Anniversary: 2027-10-21');
    console.log('Expected: Use 5 → remaining 30, new 20 → total 50, drop oldest 10 → final 40');
    
    // First, simulate using 5 leaves in 2026
    await this.simulateLeaveUsage(2026, 5, 'Used 5 leaves during 2026-2027');
    
    const testDate = new Date('2027-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2027,
        phase: 'Sixth Anniversary - Partial Bucket Removal',
        result: result,
        expected: 'Partial bucket removal: drop oldest 10 to maintain 40-day limit',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 40)`);
      
    } catch (error) {
      console.error('❌ Error in Year 7 test:', error);
      this.testResults.push({
        year: 2027,
        phase: 'Sixth Anniversary - Partial Bucket Removal',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Test Year 8 (2028-2029): Full bucket removal
   */
  async testYear8() {
    console.log('\n📅 YEAR 8 (2028-2029) - Full bucket removal');
    console.log('Anniversary: 2028-10-21');
    console.log('Expected: Add 20 new → total 60, drop oldest 20 → final 40');
    
    const testDate = new Date('2028-10-21'); // Anniversary date
    
    try {
      const result = await AnnualLeaveManagementService.processAnniversaryAllocations(testDate);
      
      this.testResults.push({
        year: 2028,
        phase: 'Seventh Anniversary - Full Bucket Removal',
        result: result,
        expected: 'Full bucket removal: drop oldest 20 to maintain 40-day limit',
        status: result.processed === 1 ? 'PASS' : 'FAIL'
      });
      
      console.log(`✅ Result: ${result.processed} allocations processed (expected: 1)`);
      
      // Verify balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      console.log(`📊 Total leaves: ${balance.summary.totalLeaves} (expected: 40)`);
      
    } catch (error) {
      console.error('❌ Error in Year 8 test:', error);
      this.testResults.push({
        year: 2028,
        phase: 'Seventh Anniversary - Full Bucket Removal',
        error: error.message,
        status: 'ERROR'
      });
    }
  }
  
  /**
   * Simulate leave usage for a specific year
   */
  async simulateLeaveUsage(year, days, description) {
    try {
      console.log(`📝 Simulating leave usage: ${days} days in ${year} - ${description}`);
      
      const result = await AnnualLeaveManagementService.deductLeaves(
        this.employeeId,
        days,
        null,
        description
      );
      
      console.log(`✅ Deducted ${result.totalDeducted} days successfully`);
      
    } catch (error) {
      console.error(`❌ Error simulating leave usage:`, error);
      throw error;
    }
  }
  
  /**
   * Generate final report
   */
  async generateFinalReport() {
    console.log('\n📊 FINAL REPORT - Employee 6387 Annual Leave System');
    console.log('=' .repeat(60));
    
    try {
      // Get final balance
      const balance = await AnnualLeaveManagementService.getEmployeeBalance(this.employeeId);
      
      console.log('\n📈 FINAL BALANCE SUMMARY:');
      console.log(`Total Allocated: ${balance.summary.totalAllocated} days`);
      console.log(`Total Used: ${balance.summary.totalUsed} days`);
      console.log(`Total Remaining: ${balance.summary.totalRemaining} days`);
      console.log(`Total Carry Forward: ${balance.summary.totalCarryForward} days`);
      console.log(`Total Leaves: ${balance.summary.totalLeaves} days`);
      console.log(`At Cap: ${balance.summary.isAtCap ? 'Yes' : 'No'}`);
      
      console.log('\n📋 YEAR-BY-YEAR BREAKDOWN:');
      balance.balances.forEach(balance => {
        console.log(`Year ${balance.year}: Allocated=${balance.allocated}, Used=${balance.used}, Remaining=${balance.remaining}, CarryForward=${balance.carryForward}, Total=${balance.total}`);
      });
      
      console.log('\n🧪 TEST RESULTS SUMMARY:');
      this.testResults.forEach(result => {
        const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${status} Year ${result.year} - ${result.phase}: ${result.status}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });
      
      // Get transaction history
      const transactions = await AnnualLeaveManagementService.getEmployeeTransactionHistory(this.employeeId);
      
      console.log('\n📜 TRANSACTION HISTORY:');
      transactions.forEach(transaction => {
        console.log(`${transaction.processedAt.toDateString()}: ${transaction.transactionType} - ${transaction.description} (${transaction.amount} days)`);
      });
      
    } catch (error) {
      console.error('❌ Error generating final report:', error);
    }
  }
  
  /**
   * Clean up test environment
   */
  async cleanup() {
    try {
      console.log('\n🧹 Cleaning up test environment...');
      
      await this.cleanupTestData();
      
      console.log('✅ Test environment cleaned up');
      
    } catch (error) {
      console.error('❌ Error cleaning up test environment:', error);
    }
  }
}

// Export the test class
module.exports = Employee6387TestWorkflow;

// If this file is run directly, execute the test
if (require.main === module) {
  const test = new Employee6387TestWorkflow();
  
  async function runTest() {
    try {
      await test.initialize();
      await test.runCompleteWorkflow();
      await test.cleanup();
      
      console.log('\n🎉 Test completed successfully!');
      process.exit(0);
      
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    }
  }
  
  runTest();
}
