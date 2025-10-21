const mongoose = require('mongoose');
const LeaveIntegrationService = require('../services/leaveIntegrationService');
const Employee = require('../models/hr/Employee');

// Load required models
require('../models/User');
require('../models/hr/LeaveRequest');
require('../models/hr/LeaveBalance');
require('../models/hr/LeaveType');

// Test script to verify hire date is returned in leave summary
async function testHireDateInLeaveSummary() {
  try {
    console.log('🧪 Testing Hire Date in Leave Summary API\n');
    console.log('='.repeat(50));

    // Connect to database
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Find Employee 6031
    const employee = await Employee.findOne({ employeeId: '6031' });
    if (!employee) {
      console.log('❌ Employee 6031 not found in database');
      return;
    }

    console.log('👤 EMPLOYEE DETAILS:');
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee ID: ${employee.employeeId}`);
    console.log(`   Hire Date: ${employee.hireDate.toDateString()}`);
    console.log(`   Email: ${employee.email}\n`);

    // Test the leave summary API
    console.log('📋 TESTING LEAVE SUMMARY API:');
    const leaveSummary = await LeaveIntegrationService.getEmployeeLeaveSummary(employee._id);
    
    console.log('✅ API Response Structure:');
    console.log(`   Employee ID: ${leaveSummary.employee.employeeId}`);
    console.log(`   Employee Name: ${leaveSummary.employee.firstName} ${leaveSummary.employee.lastName}`);
    console.log(`   Employee Email: ${leaveSummary.employee.email}`);
    console.log(`   Hire Date: ${leaveSummary.employee.hireDate ? leaveSummary.employee.hireDate.toDateString() : 'NOT FOUND'}`);
    console.log(`   Work Year: ${leaveSummary.workYear}`);
    console.log(`   Year: ${leaveSummary.year}`);
    
    if (leaveSummary.anniversaryInfo) {
      console.log(`   Next Anniversary: ${leaveSummary.anniversaryInfo.nextAnniversary.toDateString()}`);
      console.log(`   Days to Anniversary: ${leaveSummary.anniversaryInfo.daysToAnniversary}`);
    }
    
    console.log('\n📊 LEAVE BALANCE:');
    console.log(`   Annual: ${leaveSummary.balance.annual.allocated} allocated, ${leaveSummary.balance.annual.used} used, ${leaveSummary.balance.annual.remaining} remaining`);
    console.log(`   Sick: ${leaveSummary.balance.sick.allocated} allocated, ${leaveSummary.balance.sick.used} used, ${leaveSummary.balance.sick.remaining} remaining`);
    console.log(`   Casual: ${leaveSummary.balance.casual.allocated} allocated, ${leaveSummary.balance.casual.used} used, ${leaveSummary.balance.casual.remaining} remaining`);

    console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
    console.log('\n📋 SUMMARY:');
    console.log(`   • Hire Date is included in API response: ${leaveSummary.employee.hireDate ? '✅ YES' : '❌ NO'}`);
    console.log(`   • Work Year is calculated: ${leaveSummary.workYear ? '✅ YES' : '❌ NO'}`);
    console.log(`   • Anniversary Info is available: ${leaveSummary.anniversaryInfo ? '✅ YES' : '❌ NO'}`);
    console.log(`   • Leave Balance is calculated: ${leaveSummary.balance ? '✅ YES' : '❌ NO'}`);

    console.log('\n🎯 FRONTEND INTEGRATION:');
    console.log('   The frontend can now display:');
    console.log('   • Date of Joining: ' + (leaveSummary.employee.hireDate ? leaveSummary.employee.hireDate.toDateString() : 'N/A'));
    console.log('   • Work Year: ' + (leaveSummary.workYear || 'N/A'));
    console.log('   • Next Anniversary: ' + (leaveSummary.anniversaryInfo ? leaveSummary.anniversaryInfo.nextAnniversary.toDateString() : 'N/A'));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the test
testHireDateInLeaveSummary();
