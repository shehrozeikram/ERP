const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');

async function checkCurrentState() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    
    const emp = await Employee.findOne({ employeeId: '06387' });
    
    console.log('📊 CURRENT BALANCE STATE');
    console.log('=' .repeat(60));
    const balances = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    balances.forEach(b => {
      console.log(`Year ${b.year}: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    console.log('\n📋 APPROVED LEAVE REQUESTS');
    console.log('=' .repeat(60));
    const leaveRequests = await LeaveRequest.find({ 
      employee: emp._id, 
      status: 'approved' 
    }).sort({ leaveYear: 1, startDate: 1 });
    
    leaveRequests.forEach(lr => {
      console.log(`Year ${lr.leaveYear}: ${lr.totalDays} days (${lr.startDate.toDateString()} to ${lr.endDate.toDateString()})`);
    });
    
    console.log(`\nTotal Approved Leaves: ${leaveRequests.length}`);
    
    // Check if carry forward is correct
    console.log('\n🔍 CARRY FORWARD CHECK');
    console.log('=' .repeat(60));
    
    for (let i = 1; i < balances.length; i++) {
      const prevBalance = balances[i - 1];
      const currBalance = balances[i];
      const expectedCF = Math.min(prevBalance.annual.remaining, 20);
      
      console.log(`\nYear ${currBalance.year}:`);
      console.log(`  Previous Year Remaining: ${prevBalance.annual.remaining}`);
      console.log(`  Expected Carry Forward: ${expectedCF}`);
      console.log(`  Actual Carry Forward: ${currBalance.annual.carriedForward}`);
      console.log(`  Match: ${currBalance.annual.carriedForward === expectedCF ? '✅ YES' : '❌ NO'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkCurrentState().then(() => process.exit(0));

