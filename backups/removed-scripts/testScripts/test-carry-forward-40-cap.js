const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function testCarryForwardWith40DayCap() {
  try {
    console.log('🔄 Testing Carry Forward with 40-Day Cap for Abdul Qayyum (ID: 2120)\n');
    console.log('='.repeat(80));
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '2120' });
    
    if (!employee) {
      console.log('❌ Employee not found');
      return;
    }
    
    const hireDate = employee.hireDate || employee.joiningDate;
    const hireDateObj = new Date(hireDate);
    
    console.log(`👤 Employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`📅 Employee ID: ${employee.employeeId}`);
    console.log(`📅 Joining Date: ${hireDateObj.toLocaleDateString()}\n`);
    
    // Scenario: Work Year 1 (Nov 01, 2024 - Nov 01, 2025)
    // - Gets 20 annual leaves on Nov 01, 2024
    // - Uses 5 days
    // - Remaining: 15 days
    // - On Nov 01, 2025 (Work Year 2):
    //   - New allocation: 20 days
    //   - Carry forward: 15 days
    //   - Total: 35 days (within 40-day cap)
    
    console.log('📊 Testing Scenario:\n');
    console.log('   Work Year 1 (Nov 01, 2024 - Nov 01, 2025):');
    console.log('      - Gets 20 annual leaves on Nov 01, 2024');
    console.log('      - Uses 5 days');
    console.log('      - Remaining: 15 days\n');
    console.log('   Work Year 2 (Nov 01, 2025 - Nov 01, 2026):');
    console.log('      - Expected: New allocation 20 + Carry forward 15 = 35 days');
    console.log('      - Total should be ≤ 40 days ✅\n');
    
    // Ensure balances exist
    console.log('🔄 Ensuring balances exist...\n');
    
    const workYear1Balance = await CarryForwardService.ensureWorkYearBalance(employee._id, 1);
    const workYear2Balance = await CarryForwardService.ensureWorkYearBalance(employee._id, 2);
    
    console.log('📊 Current Work Year 1 Balance:');
    console.log(`   Allocated: ${workYear1Balance.annual.allocated} days`);
    console.log(`   Used: ${workYear1Balance.annual.used} days`);
    console.log(`   Remaining: ${workYear1Balance.annual.remaining} days`);
    console.log(`   Carried Forward: ${workYear1Balance.annual.carriedForward} days\n`);
    
    // Update Work Year 1 to simulate the scenario: 20 allocated, 5 used, 15 remaining
    workYear1Balance.annual.allocated = 20;
    workYear1Balance.annual.used = 5;
    workYear1Balance.annual.carriedForward = 0;
    await workYear1Balance.save();
    
    console.log('✅ Updated Work Year 1:');
    console.log(`   Allocated: ${workYear1Balance.annual.allocated} days`);
    console.log(`   Used: ${workYear1Balance.annual.used} days`);
    console.log(`   Remaining: ${workYear1Balance.annual.remaining} days\n`);
    
    // Recalculate carry forward for Work Year 2
    console.log('🔄 Recalculating carry forward for Work Year 2...\n');
    
    const carryForwardResult = await CarryForwardService.calculateCarryForward(employee._id, 2);
    
    console.log('📊 Calculate Carry Forward Result:');
    console.log(`   Carry Forward: ${carryForwardResult.annual} days`);
    console.log(`   Reason: ${carryForwardResult.reason}\n`);
    
    // Update Work Year 2 balance
    workYear2Balance.annual.carriedForward = carryForwardResult.annual;
    workYear2Balance.isCarriedForward = carryForwardResult.annual > 0;
    await workYear2Balance.save();
    
    console.log('📊 Updated Work Year 2 Balance:');
    console.log(`   Allocated: ${workYear2Balance.annual.allocated} days`);
    console.log(`   Carried Forward: ${workYear2Balance.annual.carriedForward} days`);
    console.log(`   Total Available: ${workYear2Balance.annual.allocated + workYear2Balance.annual.carriedForward} days`);
    console.log(`   Remaining: ${workYear2Balance.annual.remaining} days\n`);
    
    // Verify the calculation
    const total = workYear2Balance.annual.allocated + workYear2Balance.annual.carriedForward;
    const expectedCF = Math.min(15, 20, 40 - 20); // min(remaining, 20 cap, 40 - new allocation)
    
    console.log('✅ Verification:');
    console.log(`   Expected Carry Forward: ${expectedCF} days`);
    console.log(`   Actual Carry Forward: ${workYear2Balance.annual.carriedForward} days`);
    console.log(`   Expected Total: ${expectedCF + 20} days`);
    console.log(`   Actual Total: ${total} days`);
    console.log(`   Within 40-day cap: ${total <= 40} ✅\n`);
    
    if (total === 35 && workYear2Balance.annual.carriedForward === 15) {
      console.log('🎉 SUCCESS: Carry forward calculation is CORRECT!');
      console.log('   - Work Year 1 remaining: 15 days');
      console.log('   - Work Year 2 new allocation: 20 days');
      console.log('   - Work Year 2 carry forward: 15 days');
      console.log('   - Work Year 2 total: 35 days (within 40-day cap) ✅');
    } else {
      console.log('⚠️  Result does not match expected values');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testCarryForwardWith40DayCap()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCarryForwardWith40DayCap };

