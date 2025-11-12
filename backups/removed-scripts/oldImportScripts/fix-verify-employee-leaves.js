const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

require('dotenv').config();

async function fixAndVerifyEmployee(employeeId) {
  try {
    console.log(`🔄 Fixing and Verifying Leave System for Employee ID: ${employeeId}\n`);
    console.log('='.repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find employee
    const employee = await Employee.findOne({ 
      $or: [
        { employeeId: employeeId },
        { _id: mongoose.Types.ObjectId.isValid(employeeId) ? employeeId : null }
      ]
    });
    
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }
    
    const hireDate = employee.hireDate || employee.joiningDate;
    if (!hireDate) {
      throw new Error(`Employee ${employee.employeeId} does not have a hire date`);
    }
    
    console.log(`👤 Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
    console.log(`📅 Date of Joining: ${new Date(hireDate).toLocaleDateString()}\n`);
    
    const hireDateObj = new Date(hireDate);
    const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);
    
    console.log(`📊 Current Work Year: ${currentWorkYear}\n`);
    
    // Step 1: Ensure all work year balances exist
    console.log('📋 Step 1: Ensuring all work year balances exist...\n');
    
    for (let wy = 0; wy <= currentWorkYear + 1; wy++) {
      try {
        await CarryForwardService.ensureWorkYearBalance(employee._id, wy);
        console.log(`   ✅ Work Year ${wy}: Balance ensured`);
      } catch (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('E11000')) {
          console.log(`   ⚠️  Work Year ${wy}: ${error.message}`);
        } else {
          console.log(`   ✅ Work Year ${wy}: Already exists`);
        }
      }
    }
    
    console.log('');
    
    // Step 2: Sync balances with leave usage
    console.log('📋 Step 2: Syncing balances with leave usage...\n');
    
    const balances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    }).populate('leaveType', 'code name');
    
    for (const balance of balances) {
      const workYearLeaves = leaveRequests.filter(l => l.workYear === balance.workYear);
      
      balance.annual.used = 0;
      balance.sick.used = 0;
      balance.casual.used = 0;
      
      for (const leave of workYearLeaves) {
        const typeMap = {
          'ANNUAL': 'annual',
          'AL': 'annual',
          'SICK': 'sick',
          'SL': 'sick',
          'CASUAL': 'casual',
          'CL': 'casual'
        };
        
        const balanceType = typeMap[leave.leaveType?.code] || 
                           typeMap[leave.leaveType?.name?.toUpperCase()] || 
                           'casual';
        
        if (balance[balanceType]) {
          balance[balanceType].used += leave.totalDays || 0;
        }
      }
      
      await balance.save();
      console.log(`   ✅ Work Year ${balance.workYear}: Synced (Annual: ${balance.annual.used}, Sick: ${balance.sick.used}, Casual: ${balance.casual.used})`);
    }
    
    console.log('');
    
    // Step 3: Recalculate carry forward
    console.log('📋 Step 3: Recalculating carry forward...\n');
    
    const updatedBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    for (let wy = 1; wy <= currentWorkYear + 1; wy++) {
      const currentBalance = updatedBalances.find(b => b.workYear === wy);
      const previousBalance = updatedBalances.find(b => b.workYear === wy - 1);
      
      if (currentBalance && previousBalance) {
        await previousBalance.save(); // Trigger pre-save middleware
        await currentBalance.save(); // Trigger pre-save middleware
        
        const previousRemaining = previousBalance.annual.remaining || 0;
        const newAllocation = currentBalance.annual.allocated || 0;
        
        const individualCap = Math.min(previousRemaining, 20);
        const maxCFWithTotalCap = Math.max(0, 40 - newAllocation);
        const expectedCF = Math.min(individualCap, maxCFWithTotalCap);
        
        if (currentBalance.annual.carriedForward !== expectedCF) {
          currentBalance.annual.carriedForward = expectedCF;
          currentBalance.isCarriedForward = expectedCF > 0;
          await currentBalance.save();
          
          console.log(`   ✅ Work Year ${wy}: Updated carry forward to ${expectedCF} days (from Work Year ${wy - 1} remaining: ${previousRemaining})`);
        } else {
          console.log(`   ✅ Work Year ${wy}: Carry forward correct (${expectedCF} days)`);
        }
      }
    }
    
    console.log('');
    
    // Step 4: Final verification
    console.log('📋 Step 4: Final Verification...\n');
    
    const finalBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    const hireYear = hireDateObj.getFullYear();
    const hireMonth = hireDateObj.getMonth();
    const hireDay = hireDateObj.getDate();
    
    for (const balance of finalBalances) {
      const workYearStart = new Date(hireYear + balance.workYear, hireMonth, hireDay);
      const workYearEnd = new Date(hireYear + balance.workYear + 1, hireMonth, hireDay);
      const total = balance.annual.allocated + balance.annual.carriedForward;
      
      console.log(`   Work Year ${balance.workYear} (${workYearStart.toLocaleDateString()} - ${workYearEnd.toLocaleDateString()}):`);
      console.log(`      Annual: Allocated=${balance.annual.allocated}, CF=${balance.annual.carriedForward}, Used=${balance.annual.used}, Remaining=${balance.annual.remaining}, Total=${total}`);
      console.log(`      Sick: Allocated=${balance.sick.allocated}, Used=${balance.sick.used}, Remaining=${balance.sick.remaining}`);
      console.log(`      Casual: Allocated=${balance.casual.allocated}, Used=${balance.casual.used}, Remaining=${balance.casual.remaining}`);
      
      // Verify rules
      if (balance.workYear === 0) {
        if (balance.annual.allocated === 0 && balance.annual.carriedForward === 0) {
          console.log(`      ✅ Work Year 0: Annual = 0 (CORRECT)`);
        } else {
          console.log(`      ⚠️  Work Year 0: Annual should be 0`);
        }
      } else if (balance.workYear >= 1) {
        if (balance.annual.allocated === 20) {
          console.log(`      ✅ Work Year ${balance.workYear}: Annual allocated = 20 (CORRECT)`);
        } else {
          console.log(`      ⚠️  Work Year ${balance.workYear}: Annual allocated should be 20`);
        }
        
        if (total <= 40) {
          console.log(`      ✅ Work Year ${balance.workYear}: Total annual (${total}) ≤ 40-day cap (CORRECT)`);
        } else {
          console.log(`      ⚠️  Work Year ${balance.workYear}: Total annual (${total}) exceeds 40-day cap`);
        }
      }
      
      console.log('');
    }
    
    console.log('='.repeat(80));
    console.log('✅ Fix and verification completed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Fix and verify Attique Ur Rehman (ID: 26)
if (require.main === module) {
  const employeeId = process.argv[2] || '26';
  fixAndVerifyEmployee(employeeId)
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAndVerifyEmployee };

