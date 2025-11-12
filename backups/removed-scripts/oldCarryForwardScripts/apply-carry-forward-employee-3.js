const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function applyCarryForwardLogicToEmployee(employeeId, verbose = false) {
  try {
    if (verbose) {
      console.log(`🔄 Applying Carry Forward Logic to Employee ID: ${employeeId}\n`);
    }
    
    // Find employee
    let employee;
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      employee = await Employee.findOne({ 
        $or: [
          { employeeId: employeeId },
          { _id: employeeId }
        ]
      });
    } else {
      employee = await Employee.findOne({ employeeId: employeeId });
    }
    
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }
    
    const hireDate = employee.hireDate || employee.joiningDate;
    if (!hireDate) {
      throw new Error(`Employee ${employee.employeeId} does not have a hire date`);
    }
    
    if (verbose) {
      console.log(`👤 Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
      console.log(`📅 Joining Date: ${new Date(hireDate).toLocaleDateString()}\n`);
    }
    
    // Step 1: Fix workYear for all leave requests
    if (verbose) {
      console.log('📋 Step 1: Fixing workYear for all leave requests...\n');
    }
    
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    });
    
    let updatedLeaves = 0;
    const hireDateObj = new Date(hireDate);
    const hireYear = hireDateObj.getFullYear();
    const hireMonth = hireDateObj.getMonth();
    const hireDay = hireDateObj.getDate();
    
    for (const leave of leaveRequests) {
      if (!leave.startDate) continue;
      
      const leaveStartYear = leave.startDate.getFullYear();
      const leaveStartMonth = leave.startDate.getMonth();
      const leaveStartDay = leave.startDate.getDate();
      
      // Calculate work year
      let yearsDiff = leaveStartYear - hireYear;
      
      if (leaveStartMonth < hireMonth || 
          (leaveStartMonth === hireMonth && leaveStartDay < hireDay)) {
        yearsDiff = yearsDiff - 1;
      }
      
      const workYear = Math.max(0, yearsDiff);
      
      // Calculate leaveYear
      const leaveYear = hireYear + workYear + 1;
      const finalLeaveYear = Math.max(leaveYear, hireYear + 1);
      
      // Update if different
      if (leave.workYear !== workYear || leave.leaveYear !== finalLeaveYear) {
        leave.workYear = workYear;
        leave.leaveYear = finalLeaveYear;
        await leave.save();
        updatedLeaves++;
      }
    }
    
    if (verbose) {
      console.log(`✅ Updated ${updatedLeaves} leave requests\n`);
    }
    
    // Step 2: Ensure all work year balances exist
    if (verbose) {
      console.log('📋 Step 2: Ensuring all work year balances exist...\n');
    }
    
    // Calculate current work year
    const today = new Date();
    const yearsSinceHire = today.getFullYear() - hireYear;
    const monthsSinceHire = today.getMonth() - hireMonth;
    const daysSinceHire = today.getDate() - hireDay;
    
    let currentWorkYear = yearsSinceHire;
    if (monthsSinceHire > 0 || (monthsSinceHire === 0 && daysSinceHire >= 0)) {
      currentWorkYear = yearsSinceHire + 1;
    }
    currentWorkYear = Math.max(0, currentWorkYear);
    
    // Ensure balances for work years 0 through currentWorkYear + 1
    const maxWorkYear = Math.max(currentWorkYear + 1, 5);
    
    for (let wy = 0; wy <= maxWorkYear; wy++) {
      try {
        await CarryForwardService.ensureWorkYearBalance(employee._id, wy);
      } catch (error) {
        // Ignore duplicate errors
        if (!error.message.includes('duplicate') && !error.message.includes('E11000')) {
          console.log(`   ⚠️  Error ensuring balance for work year ${wy}: ${error.message}`);
        }
      }
    }
    
    if (verbose) {
      console.log(`✅ Ensured balances for work years 0-${maxWorkYear}\n`);
    }
    
    // Step 3: Sync balances with leave usage
    if (verbose) {
      console.log('📋 Step 3: Syncing balances with leave usage...\n');
    }
    
    const balances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    // Get all leave requests grouped by work year
    const allLeaves = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    }).populate('leaveType', 'code name');
    
    for (const balance of balances) {
      // Get leaves for this work year
      const workYearLeaves = allLeaves.filter(l => l.workYear === balance.workYear);
      
      // Reset used days
      balance.annual.used = 0;
      balance.sick.used = 0;
      balance.casual.used = 0;
      
      // Calculate used days from approved leaves
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
    }
    
    if (verbose) {
      console.log(`✅ Synced ${balances.length} balances with leave usage\n`);
    }
    
    // Step 4: Recalculate carry forward for all work years
    // IMPORTANT: Re-fetch balances after syncing to get updated remaining values
    const updatedBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    if (verbose) {
      console.log('📋 Step 4: Recalculating carry forward...\n');
    }
    
    // Recalculate carry forward for each work year based on updated remaining values
    for (let wy = 1; wy <= maxWorkYear; wy++) {
      const currentBalance = updatedBalances.find(b => b.workYear === wy);
      const previousBalance = updatedBalances.find(b => b.workYear === wy - 1);
      
      if (currentBalance && previousBalance) {
        // Re-fetch to ensure we have the latest remaining value
        await previousBalance.save(); // Trigger pre-save middleware to recalculate remaining
        await currentBalance.save(); // Trigger pre-save middleware
        
        const previousRemaining = previousBalance.annual.remaining || 0;
        const newAllocation = currentBalance.annual.allocated || 0;
        
        // Calculate expected carry forward
        const individualCap = Math.min(previousRemaining, 20);
        const maxCFWithTotalCap = Math.max(0, 40 - newAllocation);
        const expectedCF = Math.min(individualCap, maxCFWithTotalCap);
        
        // Update carry forward if different
        if (currentBalance.annual.carriedForward !== expectedCF) {
          currentBalance.annual.carriedForward = expectedCF;
          currentBalance.isCarriedForward = expectedCF > 0;
          await currentBalance.save();
          
          if (verbose) {
            console.log(`   ✅ Work Year ${wy}: Updated carry forward to ${expectedCF} days (from Work Year ${wy - 1} remaining: ${previousRemaining})`);
          }
        }
      }
    }
    
    if (verbose) {
      console.log('\n✅ Carry forward recalculation completed\n');
    }
    
    // Step 5: Final verification
    if (verbose) {
      console.log('📋 Step 5: Final Verification...\n');
    }
    
    // Re-fetch final balances to ensure we have the latest values
    const finalBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    let allCorrect = true;
    
    for (let i = 1; i < finalBalances.length; i++) {
      const currentBalance = finalBalances[i];
      const previousBalance = finalBalances[i - 1];
      
      if (currentBalance.workYear === previousBalance.workYear + 1) {
        const previousRemaining = previousBalance.annual.remaining || 0;
        const newAllocation = currentBalance.annual.allocated || 0;
        const actualCF = currentBalance.annual.carriedForward || 0;
        
        const individualCap = Math.min(previousRemaining, 20);
        const maxCFWithTotalCap = Math.max(0, 40 - newAllocation);
        const expectedCF = Math.min(individualCap, maxCFWithTotalCap);
        const total = newAllocation + actualCF;
        
        if (actualCF !== expectedCF || total > 40) {
          allCorrect = false;
        }
      }
    }
    
    if (verbose) {
      if (allCorrect) {
        console.log('✅ All carry forward calculations are CORRECT!\n');
      } else {
        console.log('⚠️  Some carry forward calculations need review\n');
      }
      
      // Display final balances
      console.log('📊 Final Balance Summary:\n');
      for (const balance of finalBalances) {
        const anniversaryStart = new Date(hireDateObj);
        anniversaryStart.setFullYear(hireDateObj.getFullYear() + balance.workYear);
        
        const anniversaryEnd = new Date(hireDateObj);
        anniversaryEnd.setFullYear(hireDateObj.getFullYear() + balance.workYear + 1);
        
        const total = balance.annual.allocated + balance.annual.carriedForward;
        
        console.log(`   Work Year ${balance.workYear} (${anniversaryStart.toLocaleDateString()} - ${anniversaryEnd.toLocaleDateString()}):`);
        console.log(`      Annual: Allocated=${balance.annual.allocated}, Used=${balance.annual.used}, CF=${balance.annual.carriedForward}, Remaining=${balance.annual.remaining}, Total=${total}`);
        console.log(`      Sick: Allocated=${balance.sick.allocated}, Used=${balance.sick.used}, Remaining=${balance.sick.remaining}`);
        console.log(`      Casual: Allocated=${balance.casual.allocated}, Used=${balance.casual.used}, Remaining=${balance.casual.remaining}`);
        console.log('');
      }
    }
    
    return {
      success: true,
      employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
      balancesProcessed: finalBalances.length,
      carryForwardCorrect: allCorrect
    };
    
  } catch (error) {
    console.error(`❌ Error processing employee ${employeeId}:`, error.message);
    return {
      success: false,
      employee: employeeId,
      error: error.message
    };
  }
}

async function applyToMansoorZareen() {
  try {
    console.log('🔄 Applying Carry Forward Logic to Mansoor Zareen (ID: 3)\n');
    console.log('='.repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const result = await applyCarryForwardLogicToEmployee('3', true); // verbose = true
    
    console.log('='.repeat(80));
    if (result.success) {
      console.log(`✅ Successfully applied carry forward logic to ${result.employee}`);
      console.log(`   Processed ${result.balancesProcessed} work year balances`);
      console.log(`   Carry forward correct: ${result.carryForwardCorrect ? 'YES ✅' : 'NEEDS REVIEW ⚠️'}`);
    } else {
      console.log(`❌ Failed to apply carry forward logic: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run for Mansoor Zareen
if (require.main === module) {
  applyToMansoorZareen()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { applyCarryForwardLogicToEmployee, applyToMansoorZareen };

