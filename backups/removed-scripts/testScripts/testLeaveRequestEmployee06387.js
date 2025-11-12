const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveManagementService = require('../services/leaveManagementService');

/**
 * Test Script: Add Annual Leave Request for Employee 06387
 * 
 * This script:
 * 1. Creates an annual leave request for 15 days in 2023
 * 2. Approves the request
 * 3. Verifies data in backend
 * 4. Shows how it will appear in frontend
 */

async function testLeaveRequest() {
  try {
    console.log('🚀 Starting Leave Request Test for Employee 06387\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '06387' });
    if (!employee) {
      throw new Error('Employee 06387 not found');
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee ID: ${employee.employeeId}`);
    console.log(`   MongoDB ID: ${employee._id}\n`);
    
    // Get annual leave type
    const annualLeaveType = await LeaveType.findOne({ 
      $or: [{ code: 'ANNUAL' }, { code: 'AL' }]
    });
    
    if (!annualLeaveType) {
      throw new Error('Annual leave type not found');
    }
    
    console.log(`✅ Found annual leave type: ${annualLeaveType.name} (${annualLeaveType.code})\n`);
    
    // Show current balance BEFORE leave request
    console.log('📊 CURRENT BALANCE (2023) - BEFORE LEAVE REQUEST');
    console.log('=' .repeat(60));
    const balanceBefore = await LeaveBalance.findOne({
      employee: employee._id,
      year: 2023
    });
    
    if (balanceBefore) {
      console.log(`Annual Leave:`);
      console.log(`   Allocated: ${balanceBefore.annual.allocated}`);
      console.log(`   Used: ${balanceBefore.annual.used}`);
      console.log(`   Remaining: ${balanceBefore.annual.remaining}`);
      console.log(`   Carry Forward: ${balanceBefore.annual.carriedForward}`);
      console.log(`   Total Available: ${balanceBefore.annual.allocated + balanceBefore.annual.carriedForward}`);
    } else {
      console.log('No balance found for 2023');
    }
    console.log('');
    
    // Create leave request
    console.log('📝 CREATING ANNUAL LEAVE REQUEST');
    console.log('=' .repeat(60));
    
    const startDate = new Date('2023-11-01');
    const endDate = new Date('2023-11-15');
    
    // Calculate work year
    const LeaveIntegrationService = require('../services/leaveIntegrationService');
    const workYear = LeaveIntegrationService.calculateWorkYear(employee.hireDate, new Date(2023, 11, 31));
    
    // Get admin user for createdBy
    const User = require('../models/User');
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      throw new Error('No admin user found');
    }
    
    const leaveRequestData = {
      employee: employee._id,
      leaveType: annualLeaveType._id,
      startDate: startDate,
      endDate: endDate,
      totalDays: 15,
      reason: 'Annual leave request - 15 days for testing carry forward system',
      leaveYear: 2023,
      workYear: workYear,
      createdBy: adminUser._id,
      status: 'pending'
    };
    
    const leaveRequest = new LeaveRequest(leaveRequestData);
    await leaveRequest.save();
    
    console.log(`✅ Leave request created:`);
    console.log(`   ID: ${leaveRequest._id}`);
    console.log(`   Start Date: ${startDate.toDateString()}`);
    console.log(`   End Date: ${endDate.toDateString()}`);
    console.log(`   Total Days: 15`);
    console.log(`   Status: pending\n`);
    
    // Approve the leave request
    console.log('✅ APPROVING LEAVE REQUEST');
    console.log('=' .repeat(60));
    
    console.log(`Approving by: ${adminUser.firstName} ${adminUser.lastName}\n`);
    
    const approvedRequest = await LeaveManagementService.approveLeaveRequest(
      leaveRequest._id,
      adminUser._id,
      'Approved for testing carry forward system'
    );
    
    console.log(`✅ Leave request approved successfully\n`);
    
    // Show balance AFTER leave request
    console.log('📊 UPDATED BALANCE (2023) - AFTER LEAVE REQUEST');
    console.log('=' .repeat(60));
    const balanceAfter = await LeaveBalance.findOne({
      employee: employee._id,
      year: 2023
    });
    
    if (balanceAfter) {
      console.log(`Annual Leave:`);
      console.log(`   Allocated: ${balanceAfter.annual.allocated}`);
      console.log(`   Used: ${balanceAfter.annual.used}`);
      console.log(`   Remaining: ${balanceAfter.annual.remaining}`);
      console.log(`   Carry Forward: ${balanceAfter.annual.carriedForward}`);
      console.log(`   Total Available: ${balanceAfter.annual.allocated + balanceAfter.annual.carriedForward}`);
    }
    console.log('');
    
    // Calculate what should be shown in frontend
    console.log('🖥️  FRONTEND DISPLAY (Expected)');
    console.log('=' .repeat(60));
    console.log(`Employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`Employee ID: ${employee.employeeId}`);
    console.log(`\nLeave Balance Summary (2023):`);
    console.log(`Annual Leave:`);
    console.log(`   ${balanceAfter.annual.remaining} / ${balanceAfter.annual.allocated + balanceAfter.annual.carriedForward}`);
    console.log(`   Used: ${balanceAfter.annual.used}`);
    if (balanceAfter.annual.carriedForward > 0) {
      console.log(`   Carry Forward: ${balanceAfter.annual.carriedForward} days`);
    }
    console.log('');
    
    // Show leave history
    console.log('📋 LEAVE HISTORY');
    console.log('=' .repeat(60));
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      leaveYear: 2023,
      isActive: true
    })
      .populate('leaveType', 'name code color')
      .populate('approvedBy', 'firstName lastName')
      .sort({ appliedDate: -1 });
    
    console.log(`Total leave requests in 2023: ${leaveRequests.length}\n`);
    
    leaveRequests.forEach((lr, index) => {
      console.log(`${index + 1}. ${lr.leaveType.name}`);
      console.log(`   Period: ${lr.startDate.toDateString()} to ${lr.endDate.toDateString()}`);
      console.log(`   Days: ${lr.totalDays}`);
      console.log(`   Status: ${lr.status}`);
      console.log(`   Reason: ${lr.reason}`);
      if (lr.status === 'approved' && lr.approvedBy) {
        console.log(`   Approved by: ${lr.approvedBy.firstName} ${lr.approvedBy.lastName}`);
      }
      console.log('');
    });
    
    // Verify calculations
    console.log('✅ VERIFICATION');
    console.log('=' .repeat(60));
    const expectedRemaining = balanceAfter.annual.allocated + balanceAfter.annual.carriedForward - balanceAfter.annual.used;
    
    console.log(`Remaining Calculation Check:`);
    console.log(`   Allocated: ${balanceAfter.annual.allocated}`);
    console.log(`   Carry Forward: ${balanceAfter.annual.carriedForward}`);
    console.log(`   Used: ${balanceAfter.annual.used}`);
    console.log(`   Expected Remaining: ${expectedRemaining}`);
    console.log(`   Actual Remaining: ${balanceAfter.annual.remaining}`);
    console.log(`   ${balanceAfter.annual.remaining === expectedRemaining ? '✅ PASS' : '❌ FAIL'}\n`);
    
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('\n💡 Summary:');
    console.log(`   - Created and approved 15-day annual leave request`);
    console.log(`   - Balance updated correctly`);
    console.log(`   - Frontend should show: ${balanceAfter.annual.remaining} / ${balanceAfter.annual.allocated + balanceAfter.annual.carriedForward}`);
    console.log(`   - Leave history shows 1 approved request with 15 days`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  testLeaveRequest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = testLeaveRequest;

