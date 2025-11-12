const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function fixCarryForwardEmployee3() {
  try {
    console.log('🔄 Fixing Carry Forward for Mansoor Zareen (ID: 3)\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const employee = await Employee.findOne({ employeeId: '3' });
    if (!employee) {
      console.log('❌ Employee not found');
      return;
    }
    
    console.log(`👤 Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})\n`);
    
    // Get all balances
    const balances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    console.log('📊 Current Balances:\n');
    balances.forEach(b => {
      console.log(`   Work Year ${b.workYear}: Annual Remaining=${b.annual.remaining}, CF=${b.annual.carriedForward}`);
    });
    console.log('');
    
    // Fix carry forward for Work Year 4
    const wy3 = balances.find(b => b.workYear === 3);
    const wy4 = balances.find(b => b.workYear === 4);
    
    if (wy3 && wy4) {
      const prevRemaining = wy3.annual.remaining || 0;
      const newAllocation = wy4.annual.allocated || 0;
      const individualCap = Math.min(prevRemaining, 20);
      const maxCFWithTotalCap = Math.max(0, 40 - newAllocation);
      const expectedCF = Math.min(individualCap, maxCFWithTotalCap);
      
      console.log(`🔄 Fixing Work Year 4 Carry Forward:`);
      console.log(`   Work Year 3 Remaining: ${prevRemaining} days`);
      console.log(`   Work Year 4 Allocation: ${newAllocation} days`);
      console.log(`   Expected Carry Forward: ${expectedCF} days`);
      console.log(`   Current Carry Forward: ${wy4.annual.carriedForward} days\n`);
      
      if (wy4.annual.carriedForward !== expectedCF) {
        wy4.annual.carriedForward = expectedCF;
        wy4.isCarriedForward = expectedCF > 0;
        await wy4.save();
        console.log(`✅ Updated Work Year 4 carry forward to ${expectedCF} days\n`);
      }
    }
    
    // Recalculate all carry forward
    console.log('🔄 Recalculating all carry forward...\n');
    
    try {
      const result = await CarryForwardService.recalculateCarryForward(employee._id);
      console.log(`✅ Recalculated ${result.results.length} work years:\n`);
      result.results.forEach(r => {
        console.log(`   Work Year ${r.workYear}: ${r.carryForward.annual} days`);
      });
    } catch (error) {
      console.log(`⚠️  Recalculation error (may be due to advance leaves): ${error.message}\n`);
    }
    
    // Final summary
    const finalBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    console.log('📊 Final Balances:\n');
    finalBalances.forEach(b => {
      const total = b.annual.allocated + b.annual.carriedForward;
      console.log(`   Work Year ${b.workYear}:`);
      console.log(`      Allocated: ${b.annual.allocated}, CF: ${b.annual.carriedForward}, Total: ${total}, Remaining: ${b.annual.remaining}`);
    });
    
    console.log('\n✅ Fix completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  fixCarryForwardEmployee3()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { fixCarryForwardEmployee3 };

