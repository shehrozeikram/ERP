const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function fixAndTestEmployee3() {
  try {
    console.log('🔄 Fixing and Testing Carry Forward for Mansoor Zareen (ID: 3)\n');
    console.log('='.repeat(80));
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '3' });
    
    if (!employee) {
      console.log('❌ Employee not found');
      return;
    }
    
    const hireDate = employee.hireDate || employee.joiningDate;
    const hireDateObj = new Date(hireDate);
    
    console.log(`👤 Employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`📅 Employee ID: ${employee.employeeId}`);
    console.log(`📅 Joining Date: ${hireDateObj.toLocaleDateString()}\n`);
    
    // Fix workYear for all leave requests
    console.log('🔄 Fixing workYear for all leave requests...\n');
    
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    });
    
    console.log(`📋 Found ${leaveRequests.length} leave requests to update\n`);
    
    let updated = 0;
    let errors = 0;
    
    for (const leave of leaveRequests) {
      try {
        if (!leave.startDate) continue;
        
        const hireYear = hireDateObj.getFullYear();
        const hireMonth = hireDateObj.getMonth();
        const hireDay = hireDateObj.getDate();
        
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
          updated++;
        }
      } catch (error) {
        errors++;
      }
    }
    
    console.log(`✅ Updated ${updated} leave requests`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred\n`);
    } else {
      console.log('');
    }
    
    // Ensure balances exist
    console.log('🔄 Ensuring balances exist for all work years...\n');
    
    const maxWorkYear = 5;
    for (let wy = 0; wy <= maxWorkYear; wy++) {
      try {
        await CarryForwardService.ensureWorkYearBalance(employee._id, wy);
      } catch (error) {
        // Ignore duplicate errors
      }
    }
    
    // Sync balances with leave requests
    console.log('🔄 Syncing balances with leave requests...\n');
    
    const balances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    for (const balance of balances) {
      // Get leaves for this work year
      const workYearLeaves = await LeaveRequest.find({
        employee: employee._id,
        workYear: balance.workYear,
        isActive: true
      }).populate('leaveType', 'code name');
      
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
        
        const balanceType = typeMap[leave.leaveType.code] || typeMap[leave.leaveType.name?.toUpperCase()] || 'casual';
        
        if (balance[balanceType]) {
          balance[balanceType].used += leave.totalDays;
        }
      }
      
      await balance.save();
      
      console.log(`✅ Work Year ${balance.workYear}:`);
      console.log(`   Annual: Used=${balance.annual.used}, Remaining=${balance.annual.remaining}`);
      console.log(`   Sick: Used=${balance.sick.used}, Remaining=${balance.sick.remaining}`);
      console.log(`   Casual: Used=${balance.casual.used}, Remaining=${balance.casual.remaining}`);
      console.log('');
    }
    
    // Recalculate carry forward
    console.log('🔄 Recalculating carry forward...\n');
    
    try {
      const recalcResult = await CarryForwardService.recalculateCarryForward(employee._id);
      console.log(`✅ Recalculated carry forward for ${recalcResult.results.length} work years:\n`);
      
      recalcResult.results.forEach(result => {
        console.log(`   Work Year ${result.workYear}:`);
        console.log(`      Carry Forward: ${result.carryForward.annual} days`);
        console.log(`      Reason: ${result.carryForward.reason}`);
        console.log('');
      });
    } catch (error) {
      console.error(`❌ Error recalculating:`, error.message);
    }
    
    // Final verification
    console.log('📊 Final Balance Summary:\n');
    
    const finalBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    for (const balance of finalBalances) {
      const anniversaryStart = new Date(hireDateObj);
      anniversaryStart.setFullYear(hireDateObj.getFullYear() + balance.workYear);
      
      const anniversaryEnd = new Date(hireDateObj);
      anniversaryEnd.setFullYear(hireDateObj.getFullYear() + balance.workYear + 1);
      
      console.log(`📋 Work Year ${balance.workYear} (${anniversaryStart.toLocaleDateString()} - ${anniversaryEnd.toLocaleDateString()}):`);
      console.log(`   Annual: Allocated=${balance.annual.allocated}, Used=${balance.annual.used}, CF=${balance.annual.carriedForward}, Remaining=${balance.annual.remaining}, Total=${balance.annual.allocated + balance.annual.carriedForward}`);
      console.log(`   Sick: Allocated=${balance.sick.allocated}, Used=${balance.sick.used}, Remaining=${balance.sick.remaining}`);
      console.log(`   Casual: Allocated=${balance.casual.allocated}, Used=${balance.casual.used}, Remaining=${balance.casual.remaining}`);
      console.log('');
    }
    
    // Test carry forward between work years
    console.log('🔄 Testing Carry Forward Between Work Years:\n');
    
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
        
        console.log(`   Work Year ${previousBalance.workYear} → Work Year ${currentBalance.workYear}:`);
        console.log(`      Previous Remaining: ${previousRemaining} days`);
        console.log(`      Expected CF: ${expectedCF} days`);
        console.log(`      Actual CF: ${actualCF} days`);
        console.log(`      New Allocation: ${newAllocation} days`);
        console.log(`      Total: ${total} days`);
        console.log(`      Within 40-day cap: ${total <= 40} ✅`);
        
        if (actualCF === expectedCF && total <= 40) {
          console.log(`      ✅ CORRECT\n`);
        } else {
          console.log(`      ⚠️  MISMATCH\n`);
        }
      }
    }
    
    console.log('='.repeat(80));
    console.log('✅ Test completed successfully!');
    
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
  fixAndTestEmployee3()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAndTestEmployee3 };

