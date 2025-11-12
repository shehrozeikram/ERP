const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveManagementService = require('../services/leaveManagementService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function testAutoCarryForwardUpdate() {
  try {
    console.log('🚀 Testing Automatic Carry Forward Update\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    
    const emp = await Employee.findOne({ employeeId: '06387' });
    const User = require('../models/User');
    const adminUser = await User.findOne({ role: 'admin' });
    const annualLeaveType = await LeaveType.findOne({ 
      $or: [{ code: 'ANNUAL' }, { code: 'AL' }]
    });
    
    console.log('✅ Found employee:', emp.firstName, emp.lastName);
    
    // Show current state before test
    console.log('\n📊 BEFORE TEST - Current Balances');
    console.log('=' .repeat(60));
    const balancesBefore = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    balancesBefore.forEach(b => {
      console.log(`Year ${b.year}: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    // Create a new leave request for 2024
    console.log('\n📝 Creating Leave Request for 2024');
    console.log('=' .repeat(60));
    
    const leaveData = {
      employee: emp._id,
      leaveType: annualLeaveType._id,
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-05'),
      totalDays: 5,
      reason: 'Test automatic carry forward update',
      leaveYear: 2024,
      workYear: 3,
      createdBy: adminUser._id,
      status: 'pending'
    };
    
    const leaveRequest = new LeaveRequest(leaveData);
    await leaveRequest.save();
    
    console.log(`✅ Created leave request: ${leaveData.totalDays} days`);
    
    // Approve the leave request (this should trigger automatic carry forward update)
    console.log('\n✅ Approving Leave Request');
    console.log('=' .repeat(60));
    
    await LeaveManagementService.approveLeaveRequest(
      leaveRequest._id,
      adminUser._id,
      'Testing automatic carry forward update'
    );
    
    console.log('✅ Leave request approved');
    
    // Check if carry forward was updated automatically
    console.log('\n📊 AFTER APPROVAL - Updated Balances');
    console.log('=' .repeat(60));
    const balancesAfter = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    balancesAfter.forEach(b => {
      console.log(`Year ${b.year}: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    // Verify carry forward for 2025
    console.log('\n✅ VERIFICATION');
    console.log('=' .repeat(60));
    
    const balance2024 = balancesAfter.find(b => b.year === 2024);
    const balance2025 = balancesAfter.find(b => b.year === 2025);
    
    const expectedCF2025 = Math.min(balance2024.annual.remaining, 20);
    
    console.log(`\nYear 2024:`);
    console.log(`  Used: ${balance2024.annual.used}`);
    console.log(`  Remaining: ${balance2024.annual.remaining}`);
    
    console.log(`\nYear 2025:`);
    console.log(`  Expected Carry Forward: ${expectedCF2025}`);
    console.log(`  Actual Carry Forward: ${balance2025.annual.carriedForward}`);
    console.log(`  Match: ${balance2025.annual.carriedForward === expectedCF2025 ? '✅ YES' : '❌ NO'}`);
    
    // Frontend Preview
    console.log('\n🖥️  FRONTEND DISPLAY PREVIEW');
    console.log('=' .repeat(60));
    
    console.log('\n📅 Year 2024:');
    console.log(`Annual Leave: ${balance2024.annual.remaining} / ${balance2024.annual.allocated + balance2024.annual.carriedForward}`);
    console.log(`Used: ${balance2024.annual.used}`);
    console.log(`Carry Forward: ${balance2024.annual.carriedForward} days`);
    
    console.log('\n📅 Year 2025:');
    console.log(`Annual Leave: ${balance2025.annual.remaining} / ${balance2025.annual.allocated + balance2025.annual.carriedForward}`);
    console.log(`Used: ${balance2025.annual.used}`);
    console.log(`Carry Forward: ${balance2025.annual.carriedForward} days`);
    
    if (balance2025.annual.carriedForward === expectedCF2025) {
      console.log('\n🎉 SUCCESS! Automatic carry forward update is working!');
    } else {
      console.log('\n❌ FAILED! Automatic carry forward update is not working correctly.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testAutoCarryForwardUpdate().then(() => process.exit(0));

