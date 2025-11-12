const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

require('dotenv').config();

async function testCarryForwardLogic() {
  try {
    console.log('🔄 Testing Carry Forward Logic with Anniversary-Based System...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find employee Abdul Qayyum (ID: 2120)
    const employee = await Employee.findOne({ employeeId: '2120' });
    
    if (!employee) {
      console.log('❌ Employee not found');
      return;
    }
    
    console.log(`👤 Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
    const hireDate = employee.hireDate || employee.joiningDate;
    console.log(`📅 Joining Date: ${new Date(hireDate).toLocaleDateString()}\n`);
    
    // Get all leave balances for this employee
    const balances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    console.log(`📊 Found ${balances.length} leave balance records:\n`);
    
    if (balances.length === 0) {
      console.log('⚠️  No leave balances found. Creating balances for work years...\n');
      
      // Create balances for work years 0 and 1 if they don't exist
      const workYear0 = await CarryForwardService.ensureWorkYearBalance(employee._id, 0);
      console.log(`✅ Created Work Year 0 balance`);
      
      const workYear1 = await CarryForwardService.ensureWorkYearBalance(employee._id, 1);
      console.log(`✅ Created Work Year 1 balance\n`);
      
      // Re-fetch balances
      const updatedBalances = await LeaveBalance.find({
        employee: employee._id
      }).sort({ workYear: 1 });
      
      for (const balance of updatedBalances) {
        console.log(`📋 Work Year ${balance.workYear} (Year ${balance.year}):`);
        console.log(`   Annual - Allocated: ${balance.annual.allocated}, Used: ${balance.annual.used}, Remaining: ${balance.annual.remaining}, Carried Forward: ${balance.annual.carriedForward}`);
        console.log(`   Sick - Allocated: ${balance.sick.allocated}, Used: ${balance.sick.used}, Remaining: ${balance.sick.remaining}`);
        console.log(`   Casual - Allocated: ${balance.casual.allocated}, Used: ${balance.casual.used}, Remaining: ${balance.casual.remaining}`);
        console.log('');
      }
    } else {
      // Display existing balances
      for (const balance of balances) {
        console.log(`📋 Work Year ${balance.workYear} (Year ${balance.year}):`);
        console.log(`   Annual - Allocated: ${balance.annual.allocated}, Used: ${balance.annual.used}, Remaining: ${balance.annual.remaining}, Carried Forward: ${balance.annual.carriedForward}`);
        console.log(`   Sick - Allocated: ${balance.sick.allocated}, Used: ${balance.sick.used}, Remaining: ${balance.sick.remaining}`);
        console.log(`   Casual - Allocated: ${balance.casual.allocated}, Used: ${balance.casual.used}, Remaining: ${balance.casual.remaining}`);
        console.log('');
      }
    }
    
    // Get all leave requests for this employee
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    })
    .populate('leaveType', 'name code')
    .sort({ startDate: 1 });
    
    console.log(`📋 Found ${leaveRequests.length} leave requests:\n`);
    
    // Group leaves by workYear
    const leavesByWorkYear = {};
    leaveRequests.forEach(leave => {
      if (!leavesByWorkYear[leave.workYear]) {
        leavesByWorkYear[leave.workYear] = [];
      }
      leavesByWorkYear[leave.workYear].push(leave);
    });
    
    console.log('📊 Leave Requests by Work Year:');
    Object.keys(leavesByWorkYear).sort().forEach(workYear => {
      const leaves = leavesByWorkYear[workYear];
      const annualLeaves = leaves.filter(l => l.leaveType.code === 'ANNUAL' || l.leaveType.name === 'Annual');
      const annualDays = annualLeaves.reduce((sum, l) => sum + l.totalDays, 0);
      
      console.log(`\n   Work Year ${workYear}:`);
      console.log(`   - Total leaves: ${leaves.length}`);
      console.log(`   - Annual leaves: ${annualLeaves.length} (${annualDays} days)`);
      
      if (annualLeaves.length > 0) {
        console.log(`   - Annual leave details:`);
        annualLeaves.forEach(leave => {
          console.log(`     * ${leave.startDate.toLocaleDateString()} - ${leave.endDate.toLocaleDateString()}: ${leave.totalDays} days (Leave Year: ${leave.leaveYear})`);
        });
      }
    });
    
    // Test carry forward calculation
    console.log('\n🔄 Testing Carry Forward Calculation:\n');
    
    // Test carry forward for Work Year 1 (should carry forward from Work Year 0)
    if (balances.length >= 1) {
      const workYear0Balance = balances.find(b => b.workYear === 0);
      const workYear1Balance = balances.find(b => b.workYear === 1);
      
      if (workYear0Balance && workYear1Balance) {
        console.log(`📊 Work Year 0 Annual Remaining: ${workYear0Balance.annual.remaining}`);
        console.log(`📊 Work Year 1 Annual Carried Forward: ${workYear1Balance.annual.carriedForward}`);
        console.log(`📊 Work Year 1 Annual Allocated: ${workYear1Balance.annual.allocated}`);
        console.log(`📊 Work Year 1 Annual Total Available: ${workYear1Balance.annual.allocated + workYear1Balance.annual.carriedForward}`);
        console.log(`📊 Work Year 1 Annual Remaining: ${workYear1Balance.annual.remaining}`);
        
        // Verify carry forward is correct
        const expectedCarryForward = Math.min(workYear0Balance.annual.remaining, 20);
        if (workYear1Balance.annual.carriedForward === expectedCarryForward) {
          console.log(`\n✅ Carry Forward is CORRECT!`);
          console.log(`   Expected: ${expectedCarryForward} days`);
          console.log(`   Actual: ${workYear1Balance.annual.carriedForward} days`);
        } else {
          console.log(`\n⚠️  Carry Forward MISMATCH:`);
          console.log(`   Expected: ${expectedCarryForward} days`);
          console.log(`   Actual: ${workYear1Balance.annual.carriedForward} days`);
        }
      }
    }
    
    // Test manual carry forward recalculation
    console.log('\n🔄 Testing Manual Carry Forward Recalculation:\n');
    try {
      const recalcResult = await CarryForwardService.recalculateCarryForward(employee._id);
      console.log(`✅ Recalculation completed for ${recalcResult.results.length} work years:`);
      recalcResult.results.forEach(result => {
        console.log(`   Work Year ${result.workYear}: ${result.carryForward.annual} days carried forward (${result.carryForward.reason})`);
      });
    } catch (error) {
      console.error(`❌ Error recalculating carry forward:`, error.message);
    }
    
    console.log('\n✅ Carry Forward Test Completed!');
    
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
  testCarryForwardLogic()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCarryForwardLogic };

