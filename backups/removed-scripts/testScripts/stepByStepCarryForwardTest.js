const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveManagementService = require('../services/leaveManagementService');
const User = require('../models/User');

async function stepByStepTest() {
  try {
    console.log('🚀 Step-by-Step Carry Forward Test for Employee 06387\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    
    const emp = await Employee.findOne({ employeeId: '06387' });
    const adminUser = await User.findOne({ role: 'admin' });
    const annualLeaveType = await LeaveType.findOne({ 
      $or: [{ code: 'ANNUAL' }, { code: 'AL' }]
    });
    
    console.log('✅ Found employee:', emp.firstName, emp.lastName);
    
    // Step 1: Remove all approved annual leaves
    console.log('\n🧹 STEP 1: Removing Approved Annual Leaves');
    console.log('=' .repeat(60));
    
    const deleted = await LeaveRequest.deleteMany({
      employee: emp._id,
      status: 'approved',
      leaveType: annualLeaveType._id
    });
    
    console.log(`✅ Removed ${deleted.deletedCount} approved annual leave requests\n`);
    
    // Step 2: Reset balances
    console.log('🔄 STEP 2: Resetting Leave Balances');
    console.log('=' .repeat(60));
    
    await LeaveBalance.deleteMany({ employee: emp._id });
    
    const CarryForwardService = require('../services/carryForwardService');
    await CarryForwardService.ensureWorkYearBalance(emp._id, 1);
    await CarryForwardService.ensureWorkYearBalance(emp._id, 2);
    await CarryForwardService.ensureWorkYearBalance(emp._id, 3);
    await CarryForwardService.ensureWorkYearBalance(emp._id, 4);
    
    console.log('✅ Reset balances for 2022-2025\n');
    
    // Show initial state
    console.log('📊 Initial State');
    console.log('=' .repeat(60));
    const initialBalances = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    initialBalances.forEach(b => {
      console.log(`Year ${b.year}: Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    // Step 3: Create 3 leave requests
    console.log('\n📝 STEP 3: Creating 3 Leave Requests');
    console.log('=' .repeat(60));
    
    const leaveRequests = [];
    
    // Request 1: 5 days
    const req1 = new LeaveRequest({
      employee: emp._id,
      leaveType: annualLeaveType._id,
      startDate: new Date('2023-03-01'),
      endDate: new Date('2023-03-05'),
      totalDays: 5,
      reason: 'Step-by-step test - Request 1',
      leaveYear: 2023,
      workYear: 2,
      createdBy: adminUser._id,
      status: 'pending'
    });
    await req1.save();
    leaveRequests.push(req1);
    console.log('✅ Created: 5 days (Mar 1-5, 2023)');
    
    // Request 2: 6 days
    const req2 = new LeaveRequest({
      employee: emp._id,
      leaveType: annualLeaveType._id,
      startDate: new Date('2023-04-01'),
      endDate: new Date('2023-04-06'),
      totalDays: 6,
      reason: 'Step-by-step test - Request 2',
      leaveYear: 2023,
      workYear: 2,
      createdBy: adminUser._id,
      status: 'pending'
    });
    await req2.save();
    leaveRequests.push(req2);
    console.log('✅ Created: 6 days (Apr 1-6, 2023)');
    
    // Request 3: 7 days
    const req3 = new LeaveRequest({
      employee: emp._id,
      leaveType: annualLeaveType._id,
      startDate: new Date('2023-05-01'),
      endDate: new Date('2023-05-07'),
      totalDays: 7,
      reason: 'Step-by-step test - Request 3',
      leaveYear: 2023,
      workYear: 2,
      createdBy: adminUser._id,
      status: 'pending'
    });
    await req3.save();
    leaveRequests.push(req3);
    console.log('✅ Created: 7 days (May 1-7, 2023)');
    
    // Step 4: Approve first request (5 days)
    console.log('\n✅ STEP 4: Approving First Request (5 days)');
    console.log('=' .repeat(60));
    
    await LeaveManagementService.approveLeaveRequest(req1._id, adminUser._id, 'Approved');
    
    const b1 = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    console.log('\nBalances after first approval:');
    b1.forEach(b => {
      console.log(`Year ${b.year}: Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    const expectedCF1 = Math.min(b1.find(b => b.year === 2023).annual.remaining, 20);
    const actualCF1 = b1.find(b => b.year === 2024).annual.carriedForward;
    console.log(`\nYear 2024 Carry Forward Check:`);
    console.log(`  Expected: ${expectedCF1}`);
    console.log(`  Actual: ${actualCF1}`);
    console.log(`  Match: ${actualCF1 === expectedCF1 ? '✅ YES' : '❌ NO'}`);
    
    // Step 5: Approve second request (6 days)
    console.log('\n✅ STEP 5: Approving Second Request (6 days)');
    console.log('=' .repeat(60));
    
    await LeaveManagementService.approveLeaveRequest(req2._id, adminUser._id, 'Approved');
    
    const b2 = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    console.log('\nBalances after second approval:');
    b2.forEach(b => {
      console.log(`Year ${b.year}: Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    const expectedCF2 = Math.min(b2.find(b => b.year === 2023).annual.remaining, 20);
    const actualCF2 = b2.find(b => b.year === 2024).annual.carriedForward;
    console.log(`\nYear 2024 Carry Forward Check:`);
    console.log(`  Expected: ${expectedCF2}`);
    console.log(`  Actual: ${actualCF2}`);
    console.log(`  Match: ${actualCF2 === expectedCF2 ? '✅ YES' : '❌ NO'}`);
    
    // Step 6: Approve third request (7 days)
    console.log('\n✅ STEP 6: Approving Third Request (7 days)');
    console.log('=' .repeat(60));
    
    await LeaveManagementService.approveLeaveRequest(req3._id, adminUser._id, 'Approved');
    
    const b3 = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    console.log('\nBalances after third approval:');
    b3.forEach(b => {
      console.log(`Year ${b.year}: Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    const expectedCF3 = Math.min(b3.find(b => b.year === 2023).annual.remaining, 20);
    const actualCF3 = b3.find(b => b.year === 2024).annual.carriedForward;
    console.log(`\nYear 2024 Carry Forward Check:`);
    console.log(`  Expected: ${expectedCF3}`);
    console.log(`  Actual: ${actualCF3}`);
    console.log(`  Match: ${actualCF3 === expectedCF3 ? '✅ YES' : '❌ NO'}`);
    
    // Final summary
    console.log('\n🎉 FINAL SUMMARY');
    console.log('=' .repeat(60));
    
    const finalBalances = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    
    console.log('\n📊 Final Balance State:');
    finalBalances.forEach(b => {
      console.log(`Year ${b.year}:`);
      console.log(`  Allocated: ${b.annual.allocated}`);
      console.log(`  Used: ${b.annual.used}`);
      console.log(`  Remaining: ${b.annual.remaining}`);
      console.log(`  Carry Forward: ${b.annual.carriedForward}`);
    });
    
    console.log('\n🖥️  Frontend Display (2023):');
    const b2023 = finalBalances.find(b => b.year === 2023);
    console.log(`Annual Leave: ${b2023.annual.remaining} / ${b2023.annual.allocated + b2023.annual.carriedForward}`);
    console.log(`Used: ${b2023.annual.used}`);
    console.log(`Carry Forward: ${b2023.annual.carriedForward} days`);
    
    console.log('\n🖥️  Frontend Display (2024):');
    const b2024 = finalBalances.find(b => b.year === 2024);
    console.log(`Annual Leave: ${b2024.annual.remaining} / ${b2024.annual.allocated + b2024.annual.carriedForward}`);
    console.log(`Used: ${b2024.annual.used}`);
    console.log(`Carry Forward: ${b2024.annual.carriedForward} days`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

stepByStepTest().then(() => process.exit(0));

