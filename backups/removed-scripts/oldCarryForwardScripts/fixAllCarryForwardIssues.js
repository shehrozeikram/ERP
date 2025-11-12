const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');

async function fixAllCarryForwardIssues() {
  try {
    console.log('🚀 Fixing All Carry Forward Issues for Employee 06387\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '06387' });
    if (!employee) {
      throw new Error('Employee 06387 not found');
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}\n`);
    
    // Get all balances sorted by year
    const balances = await LeaveBalance.find({ employee: employee._id }).sort({ year: 1 });
    
    console.log('📊 CURRENT BALANCES');
    console.log('=' .repeat(60));
    balances.forEach(b => {
      console.log(`Year ${b.year}: Remaining=${b.annual.remaining}, CarryForward=${b.annual.carriedForward}`);
    });
    
    console.log('\n🔧 FIXING CARRY FORWARD ISSUES');
    console.log('=' .repeat(60));
    
    // Fix each year's carry forward based on previous year's remaining
    for (let i = 1; i < balances.length; i++) {
      const currentBalance = balances[i];
      const previousBalance = balances[i - 1];
      
      const expectedCarryForward = previousBalance.annual.remaining;
      const currentCarryForward = currentBalance.annual.carriedForward;
      
      if (expectedCarryForward !== currentCarryForward) {
        console.log(`\nYear ${currentBalance.year}:`);
        console.log(`  Current Carry Forward: ${currentCarryForward}`);
        console.log(`  Expected Carry Forward: ${expectedCarryForward}`);
        console.log(`  Difference: ${expectedCarryForward - currentCarryForward} days`);
        
        // Update carry forward
        currentBalance.annual.carriedForward = expectedCarryForward;
        await currentBalance.save();
        
        console.log(`  ✅ Fixed! Updated to ${expectedCarryForward}`);
        
        // Show updated remaining
        const newRemaining = currentBalance.annual.allocated + currentBalance.annual.carriedForward - currentBalance.annual.used;
        console.log(`  New Remaining: ${newRemaining}`);
      } else {
        console.log(`\nYear ${currentBalance.year}: ✅ Already correct`);
      }
    }
    
    // Show final balances
    console.log('\n📊 FINAL BALANCES');
    console.log('=' .repeat(60));
    const finalBalances = await LeaveBalance.find({ employee: employee._id }).sort({ year: 1 });
    
    finalBalances.forEach(b => {
      console.log(`\nYear ${b.year} (Work Year ${b.workYear}):`);
      console.log(`  Allocated: ${b.annual.allocated}`);
      console.log(`  Used: ${b.annual.used}`);
      console.log(`  Remaining: ${b.annual.remaining}`);
      console.log(`  Carry Forward: ${b.annual.carriedForward}`);
    });
    
    // Frontend Display Preview for 2024
    console.log('\n🖥️  FRONTEND DISPLAY PREVIEW (2024)');
    console.log('=' .repeat(60));
    
    const balance2024 = finalBalances.find(b => b.year === 2024);
    if (balance2024) {
      console.log(`\nLeave Balance Summary (2024):`);
      console.log(`Annual Leave:`);
      console.log(`   ${balance2024.annual.remaining} / ${balance2024.annual.allocated + balance2024.annual.carriedForward}`);
      console.log(`   Used: ${balance2024.annual.used}`);
      console.log(`   Carry Forward: ${balance2024.annual.carriedForward} days`);
      
      // Verify calculation
      const expectedRemaining = balance2024.annual.allocated + balance2024.annual.carriedForward - balance2024.annual.used;
      console.log(`\n✅ Verification:`);
      console.log(`   Expected Remaining: ${expectedRemaining}`);
      console.log(`   Actual Remaining: ${balance2024.annual.remaining}`);
      console.log(`   Match: ${balance2024.annual.remaining === expectedRemaining ? '✅ YES' : '❌ NO'}`);
    }
    
    console.log('\n🎉 All Carry Forward Issues Fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  fixAllCarryForwardIssues()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = fixAllCarryForwardIssues;

