const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function testLeaveTypesReset() {
  try {
    console.log('🔄 Testing Leave Types Reset Behavior (Anniversary-Based)\n');
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
    
    console.log('📊 LEAVE TYPE BEHAVIOR ON ANNIVERSARY:\n');
    console.log('   ANNUAL LEAVES:');
    console.log('      ✅ Carry forward with 40-day cap');
    console.log('      ✅ Year based on anniversary periods (joining date to next year joining date)');
    console.log('      ✅ Only after completing 1 year (workYear >= 1)\n');
    
    console.log('   SICK LEAVES:');
    console.log('      ❌ NO CARRY FORWARD - resets completely on anniversary');
    console.log('      ✅ Year based on anniversary periods');
    console.log('      ✅ Available from first year (workYear >= 0)\n');
    
    console.log('   CASUAL LEAVES:');
    console.log('      ❌ NO CARRY FORWARD - resets completely on anniversary');
    console.log('      ✅ Year based on anniversary periods');
    console.log('      ✅ Available from first year (workYear >= 0)\n');
    
    // Test ensureWorkYearBalance to verify behavior
    console.log('🔄 Testing Work Year Balance Creation:\n');
    
    // Work Year 1
    const wy1 = await CarryForwardService.ensureWorkYearBalance(employee._id, 1);
    console.log('📋 Work Year 1:');
    console.log(`   Annual: Allocated=${wy1.annual.allocated}, Carry Forward=${wy1.annual.carriedForward}, Remaining=${wy1.annual.remaining}`);
    console.log(`   Sick: Allocated=${wy1.sick.allocated}, Carry Forward=${wy1.sick.carriedForward}, Remaining=${wy1.sick.remaining}`);
    console.log(`   Casual: Allocated=${wy1.casual.allocated}, Carry Forward=${wy1.casual.carriedForward}, Remaining=${wy1.casual.remaining}`);
    console.log('');
    
    // Simulate using some leaves
    wy1.annual.used = 5;
    wy1.sick.used = 3;
    wy1.casual.used = 7;
    await wy1.save();
    
    console.log('📊 After Using Leaves:');
    console.log(`   Annual: Used=5, Remaining=${wy1.annual.remaining}`);
    console.log(`   Sick: Used=3, Remaining=${wy1.sick.remaining}`);
    console.log(`   Casual: Used=7, Remaining=${wy1.casual.remaining}`);
    console.log('');
    
    // Create Work Year 2 to see carry forward behavior
    const wy2 = await CarryForwardService.ensureWorkYearBalance(employee._id, 2);
    console.log('📋 Work Year 2 (After Anniversary):');
    console.log(`   Annual: Allocated=${wy2.annual.allocated}, Carry Forward=${wy2.annual.carriedForward}, Remaining=${wy2.annual.remaining}`);
    console.log(`      ✅ Annual leaves carry forward: ${wy2.annual.carriedForward > 0 ? 'YES' : 'NO'}`);
    console.log(`   Sick: Allocated=${wy2.sick.allocated}, Carry Forward=${wy2.sick.carriedForward}, Remaining=${wy2.sick.remaining}`);
    console.log(`      ✅ Sick leaves reset: ${wy2.sick.carriedForward === 0 ? 'YES (no carry forward)' : 'NO'}`);
    console.log(`   Casual: Allocated=${wy2.casual.allocated}, Carry Forward=${wy2.casual.carriedForward}, Remaining=${wy2.casual.remaining}`);
    console.log(`      ✅ Casual leaves reset: ${wy2.casual.carriedForward === 0 ? 'YES (no carry forward)' : 'NO'}`);
    console.log('');
    
    // Verify
    console.log('✅ Verification:');
    const annualHasCF = wy2.annual.carriedForward > 0;
    const sickHasCF = wy2.sick.carriedForward === 0;
    const casualHasCF = wy2.casual.carriedForward === 0;
    const withinCap = (wy2.annual.allocated + wy2.annual.carriedForward) <= 40;
    
    if (annualHasCF && sickHasCF && casualHasCF && withinCap) {
      console.log('   ✅ Annual leaves: Has carry forward (with 40-day cap)');
      console.log('   ✅ Sick leaves: NO carry forward (resets on anniversary)');
      console.log('   ✅ Casual leaves: NO carry forward (resets on anniversary)');
      console.log('   ✅ Total annual leaves within 40-day cap');
      console.log('\n🎉 SUCCESS: All leave types behave correctly!');
    } else {
      console.log('   ⚠️  Some leave types may not be behaving correctly');
      console.log(`   Annual CF: ${annualHasCF}, Sick CF: ${sickHasCF}, Casual CF: ${casualHasCF}, Within Cap: ${withinCap}`);
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
  testLeaveTypesReset()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testLeaveTypesReset };

