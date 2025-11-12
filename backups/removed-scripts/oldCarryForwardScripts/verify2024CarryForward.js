const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

async function verify2024CarryForward() {
  try {
    console.log('🚀 Verifying Carry Forward for Employee 06387 - Year 2024\n');
    
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '06387' });
    if (!employee) {
      throw new Error('Employee 06387 not found');
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}\n`);
    
    // Get all balances
    const balances = await LeaveBalance.find({ employee: employee._id }).sort({ year: 1 });
    
    console.log('📊 ALL LEAVE BALANCE RECORDS');
    console.log('=' .repeat(60));
    balances.forEach(b => {
      console.log(`\nYear ${b.year} (Work Year ${b.workYear}):`);
      console.log(`  Allocated: ${b.annual.allocated}`);
      console.log(`  Used: ${b.annual.used}`);
      console.log(`  Remaining: ${b.annual.remaining}`);
      console.log(`  Carry Forward: ${b.annual.carriedForward}`);
    });
    
    // Analyze 2024 carry forward
    console.log('\n📅 YEAR 2024 CARRY FORWARD ANALYSIS');
    console.log('=' .repeat(60));
    
    const balance2023 = balances.find(b => b.year === 2023);
    const balance2024 = balances.find(b => b.year === 2024);
    
    if (balance2023 && balance2024) {
      console.log(`\n2023 Balance:`);
      console.log(`  Remaining: ${balance2023.annual.remaining}`);
      
      console.log(`\n2024 Balance:`);
      console.log(`  Current Carry Forward: ${balance2024.annual.carriedForward}`);
      console.log(`  Expected Carry Forward: ${balance2023.annual.remaining}`);
      
      const isCorrect = balance2024.annual.carriedForward === balance2023.annual.remaining;
      console.log(`\n✅ Match: ${isCorrect ? 'YES - Correct!' : 'NO - Incorrect!'}`);
      
      if (!isCorrect) {
        console.log(`\n⚠️  Carry forward mismatch detected!`);
        console.log(`   Difference: ${Math.abs(balance2024.annual.carriedForward - balance2023.annual.remaining)} days`);
        
        // Recalculate carry forward for 2024
        console.log(`\n🔄 Recalculating carry forward for 2024...`);
        const correctCarryForward = balance2023.annual.remaining;
        
        balance2024.annual.carriedForward = correctCarryForward;
        await balance2024.save();
        
        console.log(`✅ Updated 2024 carry forward to: ${correctCarryForward}`);
        
        // Recalculate remaining
        const newRemaining = balance2024.annual.allocated + balance2024.annual.carriedForward - balance2024.annual.used;
        console.log(`   New Remaining: ${newRemaining}`);
        
        // Show updated balance
        console.log(`\n📊 UPDATED 2024 BALANCE:`);
        console.log(`  Allocated: ${balance2024.annual.allocated}`);
        console.log(`  Used: ${balance2024.annual.used}`);
        console.log(`  Remaining: ${balance2024.annual.remaining}`);
        console.log(`  Carry Forward: ${balance2024.annual.carriedForward}`);
      }
    }
    
    // Frontend Display Preview
    console.log('\n🖥️  FRONTEND DISPLAY PREVIEW (2024)');
    console.log('=' .repeat(60));
    
    if (balance2024) {
      console.log(`\nEmployee: ${employee.firstName} ${employee.lastName}`);
      console.log(`Employee ID: ${employee.employeeId}`);
      console.log(`\nLeave Balance Summary (2024):`);
      console.log(`Annual Leave:`);
      console.log(`   ${balance2024.annual.remaining} / ${balance2024.annual.allocated + balance2024.annual.carriedForward}`);
      console.log(`   Used: ${balance2024.annual.used}`);
      if (balance2024.annual.carriedForward > 0) {
        console.log(`   Carry Forward: ${balance2024.annual.carriedForward} days`);
      }
    }
    
    console.log('\n🎉 Verification Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  verify2024CarryForward()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = verify2024CarryForward;

