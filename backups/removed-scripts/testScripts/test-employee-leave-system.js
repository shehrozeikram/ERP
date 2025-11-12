const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

require('dotenv').config();

async function testEmployeeLeaveSystem(employeeId) {
  try {
    console.log(`🔄 Testing Leave System for Employee ID: ${employeeId}\n`);
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
    const hireYear = hireDateObj.getFullYear();
    const hireMonth = hireDateObj.getMonth();
    const hireDay = hireDateObj.getDate();
    
    // Calculate current work year
    const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);
    
    console.log(`📊 Current Work Year: ${currentWorkYear}\n`);
    console.log('📋 Work Year Periods:\n');
    
    // Check each work year from 0 to current + 1
    for (let wy = 0; wy <= Math.min(currentWorkYear + 1, 5); wy++) {
      const workYearStart = new Date(hireYear + wy, hireMonth, hireDay);
      const workYearEnd = new Date(hireYear + wy + 1, hireMonth, hireDay);
      const anniversaryYear = hireYear + wy + 1;
      
      console.log(`   Work Year ${wy} (${workYearStart.toLocaleDateString()} - ${workYearEnd.toLocaleDateString()}):`);
      console.log(`      Anniversary Year: ${anniversaryYear}`);
      
      // Get balance for this work year
      const balance = await LeaveBalance.findOne({
        employee: employee._id,
        workYear: wy
      });
      
      if (balance) {
        const totalAnnual = balance.annual.allocated + balance.annual.carriedForward;
        const totalSick = balance.sick.allocated + balance.sick.carriedForward;
        const totalCasual = balance.casual.allocated + balance.casual.carriedForward;
        
        console.log(`      ✅ Balance Found:`);
        console.log(`         Annual: Allocated=${balance.annual.allocated}, CF=${balance.annual.carriedForward}, Used=${balance.annual.used}, Remaining=${balance.annual.remaining}, Total=${totalAnnual}`);
        console.log(`         Sick: Allocated=${balance.sick.allocated}, CF=${balance.sick.carriedForward}, Used=${balance.sick.used}, Remaining=${balance.sick.remaining}, Total=${totalSick}`);
        console.log(`         Casual: Allocated=${balance.casual.allocated}, CF=${balance.casual.carriedForward}, Used=${balance.casual.used}, Remaining=${balance.casual.remaining}, Total=${totalCasual}`);
        
        // Verify allocation rules
        let allocationCorrect = true;
        let issues = [];
        
        // Work Year 0: Annual = 0, Sick/Casual = 10 each
        if (wy === 0) {
          if (balance.annual.allocated !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year 0 should have 0 annual leaves allocated, but has ${balance.annual.allocated}`);
          }
          if (balance.annual.carriedForward !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year 0 should have 0 carry forward, but has ${balance.annual.carriedForward}`);
          }
          if (balance.sick.allocated !== 10 && balance.sick.allocated !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year 0 should have 10 sick leaves allocated, but has ${balance.sick.allocated}`);
          }
          if (balance.casual.allocated !== 10 && balance.casual.allocated !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year 0 should have 10 casual leaves allocated, but has ${balance.casual.allocated}`);
          }
        }
        
        // Work Year 1+: Annual = 20, Sick/Casual = 10 each
        if (wy >= 1) {
          if (balance.annual.allocated !== 20 && balance.annual.allocated !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year ${wy} should have 20 annual leaves allocated, but has ${balance.annual.allocated}`);
          }
          if (balance.sick.allocated !== 10 && balance.sick.allocated !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year ${wy} should have 10 sick leaves allocated, but has ${balance.sick.allocated}`);
          }
          if (balance.casual.allocated !== 10 && balance.casual.allocated !== 0) {
            allocationCorrect = false;
            issues.push(`Work Year ${wy} should have 10 casual leaves allocated, but has ${balance.casual.allocated}`);
          }
          
          // Check carry forward rules
          if (wy >= 2) {
            const previousBalance = await LeaveBalance.findOne({
              employee: employee._id,
              workYear: wy - 1
            });
            
            if (previousBalance) {
              const previousRemaining = previousBalance.annual.remaining || 0;
              const expectedCF = Math.min(Math.min(previousRemaining, 20), Math.max(0, 40 - balance.annual.allocated));
              
              if (balance.annual.carriedForward !== expectedCF) {
                allocationCorrect = false;
                issues.push(`Work Year ${wy} carry forward should be ${expectedCF} (from Work Year ${wy - 1} remaining: ${previousRemaining}), but is ${balance.annual.carriedForward}`);
              }
              
              // Check 40-day cap
              const total = balance.annual.allocated + balance.annual.carriedForward;
              if (total > 40) {
                allocationCorrect = false;
                issues.push(`Work Year ${wy} total annual leaves (${total}) exceeds 40-day cap`);
              }
              
              // Sick and Casual should have 0 carry forward
              if (balance.sick.carriedForward !== 0) {
                allocationCorrect = false;
                issues.push(`Work Year ${wy} sick leave carry forward should be 0, but is ${balance.sick.carriedForward}`);
              }
              if (balance.casual.carriedForward !== 0) {
                allocationCorrect = false;
                issues.push(`Work Year ${wy} casual leave carry forward should be 0, but is ${balance.casual.carriedForward}`);
              }
            }
          }
        }
        
        if (allocationCorrect) {
          console.log(`      ✅ Allocation Rules: CORRECT`);
        } else {
          console.log(`      ⚠️  Allocation Rules: ISSUES FOUND`);
          issues.forEach(issue => console.log(`         - ${issue}`));
        }
      } else {
        console.log(`      ⚠️  No balance found for Work Year ${wy}`);
      }
      
      console.log('');
    }
    
    // Get leave requests summary
    const leaveRequests = await LeaveRequest.find({
      employee: employee._id,
      isActive: true
    }).populate('leaveType', 'name code');
    
    console.log('📋 Leave Requests Summary:\n');
    const requestsByWorkYear = {};
    leaveRequests.forEach(leave => {
      const wy = leave.workYear !== undefined ? leave.workYear : 'unknown';
      if (!requestsByWorkYear[wy]) {
        requestsByWorkYear[wy] = { annual: 0, sick: 0, casual: 0, total: 0 };
      }
      const type = leave.leaveType?.code?.toUpperCase() || '';
      if (type === 'ANNUAL' || type === 'AL') {
        requestsByWorkYear[wy].annual += leave.totalDays || 0;
      } else if (type === 'SICK' || type === 'SL') {
        requestsByWorkYear[wy].sick += leave.totalDays || 0;
      } else {
        requestsByWorkYear[wy].casual += leave.totalDays || 0;
      }
      requestsByWorkYear[wy].total += leave.totalDays || 0;
    });
    
    Object.keys(requestsByWorkYear).sort().forEach(wy => {
      const stats = requestsByWorkYear[wy];
      console.log(`   Work Year ${wy}:`);
      console.log(`      Annual: ${stats.annual} days, Sick: ${stats.sick} days, Casual: ${stats.casual} days, Total: ${stats.total} days`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Test Attique Ur Rehman (ID: 26)
if (require.main === module) {
  const employeeId = process.argv[2] || '26';
  testEmployeeLeaveSystem(employeeId)
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { testEmployeeLeaveSystem };

