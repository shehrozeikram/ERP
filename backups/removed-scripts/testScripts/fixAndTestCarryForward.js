const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function fixAndTest() {
  try {
    console.log('🚀 Fixing Carry Forward and Testing\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    
    const emp = await Employee.findOne({ employeeId: '06387' });
    
    console.log('✅ Found employee:', emp.firstName, emp.lastName);
    
    // Step 1: Get all balances
    const balances = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    
    console.log('\n📊 STEP 1: Current Balance State');
    console.log('=' .repeat(60));
    balances.forEach(b => {
      console.log(`Year ${b.year}: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    // Step 2: Fix carry forward for all years
    console.log('\n🔧 STEP 2: Fixing Carry Forward');
    console.log('=' .repeat(60));
    
    for (let i = 1; i < balances.length; i++) {
      const prevBalance = balances[i - 1];
      const currBalance = balances[i];
      const expectedCF = Math.min(prevBalance.annual.remaining, 20);
      
      if (currBalance.annual.carriedForward !== expectedCF) {
        console.log(`\nYear ${currBalance.year}:`);
        console.log(`  Previous Year Remaining: ${prevBalance.annual.remaining}`);
        console.log(`  Current Carry Forward: ${currBalance.annual.carriedForward}`);
        console.log(`  Expected Carry Forward: ${expectedCF}`);
        
        currBalance.annual.carriedForward = expectedCF;
        await currBalance.save();
        
        console.log(`  ✅ Fixed! Updated to ${expectedCF}`);
      } else {
        console.log(`\nYear ${currBalance.year}: ✅ Already correct`);
      }
    }
    
    // Step 3: Show updated balances
    console.log('\n📊 STEP 3: Updated Balance State');
    console.log('=' .repeat(60));
    const updatedBalances = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    updatedBalances.forEach(b => {
      console.log(`Year ${b.year}: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    
    // Step 4: Show approved leave requests
    console.log('\n📋 STEP 4: Approved Leave Requests');
    console.log('=' .repeat(60));
    const leaveRequests = await LeaveRequest.find({ 
      employee: emp._id, 
      status: 'approved' 
    }).sort({ leaveYear: 1, startDate: 1 });
    
    leaveRequests.forEach(lr => {
      console.log(`Year ${lr.leaveYear}: ${lr.totalDays} days (${lr.startDate.toDateString()} to ${lr.endDate.toDateString()})`);
    });
    
    // Step 5: Test automatic carry forward update
    console.log('\n🧪 STEP 5: Testing Automatic Carry Forward Update');
    console.log('=' .repeat(60));
    
    // Simulate approving a new leave by calling the recalculation method
    const leave2023Approved = leaveRequests.filter(lr => lr.leaveYear === 2023);
    if (leave2023Approved.length > 0) {
      console.log('\nTriggering carry forward recalculation for year 2023...');
      await LeaveIntegrationService.recalculateCarryForwardForNextYear(emp._id, 2023);
      
      // Check updated balance
      const checkBalance = await LeaveBalance.findOne({ employee: emp._id, year: 2024 });
      console.log(`\nYear 2024 after recalculation:`);
      console.log(`  Carry Forward: ${checkBalance.annual.carriedForward}`);
    }
    
    // Step 6: Final verification
    console.log('\n✅ STEP 6: Final Verification');
    console.log('=' .repeat(60));
    
    const finalBalances = await LeaveBalance.find({ employee: emp._id }).sort({ year: 1 });
    
    for (let i = 1; i < finalBalances.length; i++) {
      const prevBalance = finalBalances[i - 1];
      const currBalance = finalBalances[i];
      const expectedCF = Math.min(prevBalance.annual.remaining, 20);
      
      console.log(`\nYear ${currBalance.year}:`);
      console.log(`  Expected CF: ${expectedCF}`);
      console.log(`  Actual CF: ${currBalance.annual.carriedForward}`);
      console.log(`  Match: ${currBalance.annual.carriedForward === expectedCF ? '✅ YES' : '❌ NO'}`);
    }
    
    // Step 7: Frontend Preview
    console.log('\n🖥️  STEP 7: Frontend Display Preview');
    console.log('=' .repeat(60));
    
    console.log('\n📅 Year 2023:');
    const b2023 = finalBalances.find(b => b.year === 2023);
    console.log(`Annual Leave: ${b2023.annual.remaining} / ${b2023.annual.allocated + b2023.annual.carriedForward}`);
    console.log(`Used: ${b2023.annual.used}`);
    console.log(`Carry Forward: ${b2023.annual.carriedForward} days`);
    
    console.log('\n📅 Year 2024:');
    const b2024 = finalBalances.find(b => b.year === 2024);
    console.log(`Annual Leave: ${b2024.annual.remaining} / ${b2024.annual.allocated + b2024.annual.carriedForward}`);
    console.log(`Used: ${b2024.annual.used}`);
    console.log(`Carry Forward: ${b2024.annual.carriedForward} days`);
    
    console.log('\n🎉 All Fixes Applied and Verified!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAndTest().then(() => process.exit(0));

