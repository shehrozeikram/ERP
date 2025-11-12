const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function initializeBalancesForWorkYears() {
  try {
    console.log('🔄 Initializing Leave Balances for All Work Years...\n');
    
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
    
    // Get all leave requests for this employee
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    });
    
    // Find unique work years
    const workYears = [...new Set(leaveRequests.map(l => l.workYear))].sort((a, b) => a - b);
    
    console.log(`📋 Found leaves in work years: ${workYears.join(', ')}\n`);
    console.log(`🔄 Creating/Updating balances for work years...\n`);
    
    // Ensure balances exist for all work years
    for (const workYear of workYears) {
      try {
        console.log(`   Processing Work Year ${workYear}...`);
        const balance = await CarryForwardService.ensureWorkYearBalance(employee._id, workYear);
        console.log(`   ✅ Work Year ${workYear}: Allocated=${balance.annual.allocated}, Carry Forward=${balance.annual.carriedForward}, Remaining=${balance.annual.remaining}`);
      } catch (error) {
        console.error(`   ❌ Error creating balance for Work Year ${workYear}:`, error.message);
      }
    }
    
    // Now sync balances with actual leave usage
    console.log('\n🔄 Syncing balances with actual leave usage...\n');
    
    const balances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    for (const balance of balances) {
      // Get leaves for this work year
      const workYearLeaves = leaveRequests.filter(l => l.workYear === balance.workYear);
      
      // Reset used days
      balance.annual.used = 0;
      balance.sick.used = 0;
      balance.casual.used = 0;
      
      // Calculate used days from approved leaves
      for (const leave of workYearLeaves) {
        await leave.populate('leaveType', 'code name');
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
    
    // Recalculate carry forward for all work years
    console.log('🔄 Recalculating carry forward...\n');
    
    try {
      const recalcResult = await CarryForwardService.recalculateCarryForward(employee._id);
      console.log(`✅ Recalculated carry forward for ${recalcResult.results.length} work years:`);
      recalcResult.results.forEach(result => {
        console.log(`   Work Year ${result.workYear}: ${result.carryForward.annual} days carried forward`);
      });
    } catch (error) {
      console.error(`❌ Error recalculating carry forward:`, error.message);
    }
    
    console.log('\n✅ Balance Initialization Completed!');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the initialization
if (require.main === module) {
  initializeBalancesForWorkYears()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeBalancesForWorkYears };

