const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');

async function applyCarryForwardCap() {
  try {
    console.log('🚀 Applying 20-Day Carry Forward Cap for Employee 06387\n');
    
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
    
    console.log('\n🔧 APPLYING 20-DAY CARRY FORWARD CAP');
    console.log('=' .repeat(60));
    
    // Apply cap to each year's carry forward
    for (let i = 1; i < balances.length; i++) {
      const currentBalance = balances[i];
      const previousBalance = balances[i - 1];
      
      // Calculate expected carry forward (capped at 20)
      const rawCarryForward = previousBalance.annual.remaining;
      const cappedCarryForward = Math.min(rawCarryForward, 20);
      const currentCarryForward = currentBalance.annual.carriedForward;
      
      if (cappedCarryForward !== currentCarryForward) {
        console.log(`\nYear ${currentBalance.year}:`);
        console.log(`  Previous Year Remaining: ${rawCarryForward}`);
        console.log(`  Current Carry Forward: ${currentCarryForward}`);
        console.log(`  Expected Carry Forward (capped): ${cappedCarryForward}`);
        
        // Update carry forward
        currentBalance.annual.carriedForward = cappedCarryForward;
        await currentBalance.save();
        
        console.log(`  ✅ Updated! Carry forward set to ${cappedCarryForward}`);
        
        // Show updated remaining
        const newRemaining = currentBalance.annual.allocated + currentBalance.annual.carriedForward - currentBalance.annual.used;
        console.log(`  New Remaining: ${newRemaining}`);
      } else {
        console.log(`\nYear ${currentBalance.year}: ✅ Already correct (${cappedCarryForward})`);
      }
    }
    
    // Show final balances
    console.log('\n📊 FINAL BALANCES (After 20-Day Cap)');
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
      console.log(`   Carry Forward: ${balance2024.annual.carriedForward} days (capped at 20)`);
      
      // Verify calculation
      const expectedRemaining = balance2024.annual.allocated + balance2024.annual.carriedForward - balance2024.annual.used;
      console.log(`\n✅ Verification:`);
      console.log(`   Expected Remaining: ${expectedRemaining}`);
      console.log(`   Actual Remaining: ${balance2024.annual.remaining}`);
      console.log(`   Match: ${balance2024.annual.remaining === expectedRemaining ? '✅ YES' : '❌ NO'}`);
    }
    
    console.log('\n🎉 Carry Forward Cap Applied Successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  applyCarryForwardCap()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = applyCarryForwardCap;

