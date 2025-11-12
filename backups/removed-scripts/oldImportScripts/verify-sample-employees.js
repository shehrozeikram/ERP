const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

require('dotenv').config();

async function verifySampleEmployees() {
  try {
    console.log('🔍 Verifying Leave System for Sample Employees\n');
    console.log('='.repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get a sample of employees with different hire dates
    const employees = await Employee.find({
      isActive: true,
      $or: [
        { hireDate: { $exists: true, $ne: null } },
        { joiningDate: { $exists: true, $ne: null } }
      ]
    })
    .select('_id firstName lastName employeeId hireDate joiningDate')
    .limit(10);
    
    console.log(`📊 Testing ${employees.length} sample employees\n`);
    
    let allCorrect = true;
    
    for (const employee of employees) {
      const hireDate = employee.hireDate || employee.joiningDate;
      if (!hireDate) continue;
      
      const hireDateObj = new Date(hireDate);
      const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);
      
      console.log(`👤 ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
      console.log(`   Date of Joining: ${hireDateObj.toLocaleDateString()}`);
      console.log(`   Current Work Year: ${currentWorkYear}`);
      
      const balances = await LeaveBalance.find({
        employee: employee._id
      }).sort({ workYear: 1 });
      
      let employeeCorrect = true;
      const issues = [];
      
      // Verify each work year
      for (let i = 0; i < balances.length; i++) {
        const balance = balances[i];
        const wy = balance.workYear;
        
        // Verify Work Year 0 rules
        if (wy === 0) {
          if (balance.annual.allocated !== 0) {
            employeeCorrect = false;
            issues.push(`Work Year 0: Annual allocated should be 0, but is ${balance.annual.allocated}`);
          }
          if (balance.annual.carriedForward !== 0) {
            employeeCorrect = false;
            issues.push(`Work Year 0: Carry forward should be 0, but is ${balance.annual.carriedForward}`);
          }
        }
        
        // Verify Work Year 1+ rules
        if (wy >= 1) {
          if (balance.annual.allocated !== 20 && balance.annual.allocated !== 0) {
            employeeCorrect = false;
            issues.push(`Work Year ${wy}: Annual allocated should be 20, but is ${balance.annual.allocated}`);
          }
          
          // Verify carry forward
          if (i > 0) {
            const previousBalance = balances[i - 1];
            if (previousBalance.workYear === wy - 1) {
              const previousRemaining = previousBalance.annual.remaining || 0;
              const newAllocation = balance.annual.allocated || 0;
              
              const individualCap = Math.min(previousRemaining, 20);
              const maxCFWithTotalCap = Math.max(0, 40 - newAllocation);
              const expectedCF = Math.min(individualCap, maxCFWithTotalCap);
              
              if (balance.annual.carriedForward !== expectedCF) {
                employeeCorrect = false;
                issues.push(`Work Year ${wy}: Carry forward should be ${expectedCF} (from Work Year ${wy - 1} remaining: ${previousRemaining}), but is ${balance.annual.carriedForward}`);
              }
              
              // Verify 40-day cap
              const total = balance.annual.allocated + balance.annual.carriedForward;
              if (total > 40) {
                employeeCorrect = false;
                issues.push(`Work Year ${wy}: Total annual leaves (${total}) exceeds 40-day cap`);
              }
              
              // Verify sick/casual carry forward is 0
              if (balance.sick.carriedForward !== 0) {
                employeeCorrect = false;
                issues.push(`Work Year ${wy}: Sick leave carry forward should be 0, but is ${balance.sick.carriedForward}`);
              }
              if (balance.casual.carriedForward !== 0) {
                employeeCorrect = false;
                issues.push(`Work Year ${wy}: Casual leave carry forward should be 0, but is ${balance.casual.carriedForward}`);
              }
            }
          }
        }
      }
      
      if (employeeCorrect) {
        console.log(`   ✅ All rules verified correctly`);
        console.log(`   📊 Work Years: ${balances.length}, Annual Leaves: ${balances.filter(b => b.annual.allocated > 0).length} with allocation`);
      } else {
        console.log(`   ⚠️  Issues found:`);
        issues.forEach(issue => console.log(`      - ${issue}`));
        allCorrect = false;
      }
      
      console.log('');
    }
    
    console.log('='.repeat(80));
    if (allCorrect) {
      console.log('✅ All sample employees verified correctly!\n');
    } else {
      console.log('⚠️  Some issues found in sample employees\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run verification
if (require.main === module) {
  verifySampleEmployees()
    .then(() => {
      console.log('\n✨ Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifySampleEmployees };

