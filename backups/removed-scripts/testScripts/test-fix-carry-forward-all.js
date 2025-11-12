const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function testAndFixCarryForwardForAllEmployees() {
  try {
    console.log('🔄 Testing and Fixing Carry Forward for All Employees\n');
    console.log('='.repeat(80));
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all active employees with hire dates
    const employees = await Employee.find({
      isActive: true,
      $or: [
        { hireDate: { $exists: true, $ne: null } },
        { joiningDate: { $exists: true, $ne: null } }
      ]
    })
    .select('_id firstName lastName employeeId hireDate joiningDate')
    .limit(200); // Test up to 200 employees
    
    console.log(`📊 Found ${employees.length} employees to test\n`);
    
    if (employees.length === 0) {
      console.log('⚠️  No employees found with hire dates');
      return;
    }
    
    let totalProcessed = 0;
    let totalWithBalances = 0;
    let totalWithCarryForward = 0;
    let totalNeedsFix = 0;
    let totalFixed = 0;
    let totalErrors = 0;
    
    const employeesWithIssues = [];
    const employeesWithCarryForward = [];
    
    console.log('🔄 Processing each employee...\n');
    
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const hireDate = employee.hireDate || employee.joiningDate;
      
      if (!hireDate) {
        continue;
      }
      
      try {
        // Calculate current work year
        const today = new Date();
        const hireDateObj = new Date(hireDate);
        const yearsDiff = today.getFullYear() - hireDateObj.getFullYear();
        const monthsDiff = today.getMonth() - hireDateObj.getMonth();
        const daysDiff = today.getDate() - hireDateObj.getDate();
        
        let currentWorkYear = yearsDiff;
        if (monthsDiff > 0 || (monthsDiff === 0 && daysDiff >= 0)) {
          currentWorkYear = yearsDiff + 1;
        }
        currentWorkYear = Math.max(0, currentWorkYear);
        
        // Get all leave balances for this employee
        let balances = await LeaveBalance.find({
          employee: employee._id
        }).sort({ workYear: 1 });
        
        // Ensure balances exist for work years 0, 1, and current work year
        const workYearsToEnsure = [];
        for (let wy = 0; wy <= Math.min(currentWorkYear, 3); wy++) {
          workYearsToEnsure.push(wy);
        }
        
        for (const wy of workYearsToEnsure) {
          try {
            await CarryForwardService.ensureWorkYearBalance(employee._id, wy);
          } catch (error) {
            // Ignore duplicate errors
            if (!error.message.includes('duplicate') && !error.message.includes('E11000')) {
              console.log(`   ⚠️  Error ensuring balance for ${employee.employeeId} work year ${wy}: ${error.message}`);
            }
          }
        }
        
        // Re-fetch balances
        balances = await LeaveBalance.find({
          employee: employee._id
        }).sort({ workYear: 1 });
        
        if (balances.length === 0) {
          continue;
        }
        
        totalProcessed++;
        totalWithBalances++;
        
        // Check carry forward for each work year > 0
        let hasCarryForward = false;
        let needsFix = false;
        
        for (let j = 1; j < balances.length; j++) {
          const currentBalance = balances[j];
          const previousBalance = balances[j - 1];
          
          // Only check consecutive work years
          if (currentBalance.workYear === previousBalance.workYear + 1) {
            const previousRemaining = previousBalance.annual.remaining || 0;
            const newAllocation = currentBalance.annual.allocated || 0;
            const actualCF = currentBalance.annual.carriedForward || 0;
            
            // Calculate expected carry forward
            if (previousRemaining > 0) {
              const individualCap = Math.min(previousRemaining, 20);
              const maxCarryForwardWithTotalCap = Math.max(0, 40 - newAllocation);
              const expectedCF = Math.min(individualCap, maxCarryForwardWithTotalCap);
              
              if (actualCF !== expectedCF) {
                needsFix = true;
                employeesWithIssues.push({
                  employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                  workYear: currentBalance.workYear,
                  previousRemaining,
                  expectedCF,
                  actualCF,
                  newAllocation
                });
              } else if (actualCF > 0) {
                hasCarryForward = true;
                employeesWithCarryForward.push({
                  employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                  workYear: currentBalance.workYear,
                  carryForward: actualCF,
                  total: newAllocation + actualCF
                });
              }
            }
          }
        }
        
        if (hasCarryForward) {
          totalWithCarryForward++;
        }
        
        if (needsFix) {
          totalNeedsFix++;
          // Try to fix it
          try {
            await CarryForwardService.recalculateCarryForward(employee._id);
            totalFixed++;
          } catch (error) {
            // Ignore errors
          }
        }
        
        // Show progress every 20 employees
        if ((i + 1) % 20 === 0) {
          console.log(`   ✅ Processed ${i + 1}/${employees.length} employees...`);
        }
        
      } catch (error) {
        totalErrors++;
        if (error.message && !error.message.includes('duplicate') && !error.message.includes('E11000')) {
          console.log(`   ❌ Error processing ${employee.employeeId}: ${error.message}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY:\n');
    console.log(`   Total Employees Processed: ${totalProcessed}`);
    console.log(`   Employees with Balances: ${totalWithBalances}`);
    console.log(`   Employees with Carry Forward: ${totalWithCarryForward}`);
    console.log(`   Employees Needing Fix: ${totalNeedsFix}`);
    console.log(`   Employees Fixed: ${totalFixed}`);
    console.log(`   Errors: ${totalErrors}\n`);
    
    // Show employees with carry forward
    if (employeesWithCarryForward.length > 0) {
      console.log('✅ Employees with Carry Forward Applied:\n');
      employeesWithCarryForward.slice(0, 10).forEach((emp, idx) => {
        console.log(`   ${idx + 1}. ${emp.employee} - Work Year ${emp.workYear}:`);
        console.log(`      Carry Forward: ${emp.carryForward} days`);
        console.log(`      Total Annual Leaves: ${emp.total} days ✅`);
        console.log('');
      });
      
      if (employeesWithCarryForward.length > 10) {
        console.log(`   ... and ${employeesWithCarryForward.length - 10} more employees with carry forward\n`);
      }
    }
    
    // Show employees with issues
    if (employeesWithIssues.length > 0) {
      console.log('⚠️  Employees with Carry Forward Issues:\n');
      employeesWithIssues.slice(0, 10).forEach((emp, idx) => {
        console.log(`   ${idx + 1}. ${emp.employee} - Work Year ${emp.workYear}:`);
        console.log(`      Previous Remaining: ${emp.previousRemaining} days`);
        console.log(`      Expected Carry Forward: ${emp.expectedCF} days`);
        console.log(`      Actual Carry Forward: ${emp.actualCF} days`);
        console.log(`      New Allocation: ${emp.newAllocation} days`);
        console.log('');
      });
      
      if (employeesWithIssues.length > 10) {
        console.log(`   ... and ${employeesWithIssues.length - 10} more employees with issues\n`);
      }
    }
    
    // Overall status
    console.log('='.repeat(80));
    if (employeesWithIssues.length === 0 && totalErrors === 0) {
      console.log('🎉 SUCCESS: All employees have correct carry forward!');
      if (totalWithCarryForward > 0) {
        console.log(`   ${totalWithCarryForward} employees have carry forward applied correctly`);
      } else {
        console.log('   Note: Most employees may not have carry forward yet because:');
        console.log('   - They are in their first work year (workYear 0)');
        console.log('   - They used all their annual leaves in previous work year');
        console.log('   - They don\'t have multiple work year balances yet');
      }
    } else if (employeesWithIssues.length > 0) {
      console.log(`⚠️  WARNING: Found ${employeesWithIssues.length} employees with carry forward issues`);
      console.log(`   Fixed: ${totalFixed} employees`);
      if (totalFixed < employeesWithIssues.length) {
        console.log('   Some employees may need manual review');
      }
    } else {
      console.log('✅ All tested employees have correct carry forward!');
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
  testAndFixCarryForwardForAllEmployees()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAndFixCarryForwardForAllEmployees };

