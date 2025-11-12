const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function testCarryForwardForAllEmployees() {
  try {
    console.log('🔄 Testing Carry Forward for All Employees\n');
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
    .limit(100); // Limit to first 100 employees for testing
    
    console.log(`📊 Found ${employees.length} employees to test\n`);
    
    if (employees.length === 0) {
      console.log('⚠️  No employees found with hire dates');
      return;
    }
    
    let totalTested = 0;
    let totalWithCarryForward = 0;
    let totalWithoutCarryForward = 0;
    let totalErrors = 0;
    const issues = [];
    const successCases = [];
    
    console.log('🔄 Testing each employee...\n');
    
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const hireDate = employee.hireDate || employee.joiningDate;
      
      if (!hireDate) {
        continue;
      }
      
      try {
        // Get all leave balances for this employee
        const balances = await LeaveBalance.find({
          employee: employee._id
        }).sort({ workYear: 1 });
        
        if (balances.length === 0) {
          // No balances yet, skip
          continue;
        }
        
        totalTested++;
        
        // Check each work year for carry forward
        for (let j = 1; j < balances.length; j++) {
          const currentBalance = balances[j];
          const previousBalance = balances[j - 1];
          
          // Only check if current work year is > 0 (carry forward only applies from work year 1+)
          if (currentBalance.workYear > 0 && previousBalance.workYear === currentBalance.workYear - 1) {
            // Calculate expected carry forward
            const previousRemaining = previousBalance.annual.remaining || 0;
            const newAllocation = currentBalance.annual.allocated || 0;
            const individualCap = Math.min(previousRemaining, 20);
            const maxCarryForwardWithTotalCap = Math.max(0, 40 - newAllocation);
            const expectedCF = Math.min(individualCap, maxCarryForwardWithTotalCap);
            const actualCF = currentBalance.annual.carriedForward || 0;
            
            // Check if carry forward is correct
            const isCorrect = actualCF === expectedCF;
            const totalAnnual = newAllocation + actualCF;
            const withinCap = totalAnnual <= 40;
            
            if (actualCF > 0) {
              totalWithCarryForward++;
            } else if (previousRemaining > 0 && actualCF === 0) {
              // Should have carry forward but doesn't
              issues.push({
                employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                workYear: currentBalance.workYear,
                issue: `Should have carry forward: Previous remaining=${previousRemaining}, Expected CF=${expectedCF}, Actual CF=${actualCF}`,
                previousRemaining,
                expectedCF,
                actualCF
              });
            } else {
              totalWithoutCarryForward++;
            }
            
            if (isCorrect && withinCap) {
              successCases.push({
                employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                workYear: currentBalance.workYear,
                previousRemaining,
                carryForward: actualCF,
                newAllocation,
                total: totalAnnual
              });
            } else if (!isCorrect) {
              issues.push({
                employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                workYear: currentBalance.workYear,
                issue: `Carry forward mismatch: Expected=${expectedCF}, Actual=${actualCF}`,
                previousRemaining,
                expectedCF,
                actualCF,
                newAllocation,
                totalAnnual
              });
            } else if (!withinCap) {
              issues.push({
                employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                workYear: currentBalance.workYear,
                issue: `Total exceeds 40-day cap: Total=${totalAnnual}`,
                newAllocation,
                carryForward: actualCF,
                totalAnnual
              });
            }
          }
        }
        
        // Show progress every 10 employees
        if ((i + 1) % 10 === 0) {
          console.log(`   ✅ Processed ${i + 1}/${employees.length} employees...`);
        }
        
      } catch (error) {
        totalErrors++;
        issues.push({
          employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
          issue: `Error: ${error.message}`
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY:\n');
    console.log(`   Total Employees Tested: ${totalTested}`);
    console.log(`   Employees with Carry Forward: ${totalWithCarryForward}`);
    console.log(`   Employees without Carry Forward: ${totalWithoutCarryForward}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Issues Found: ${issues.length}`);
    console.log(`   Success Cases: ${successCases.length}\n`);
    
    // Show sample success cases
    if (successCases.length > 0) {
      console.log('✅ Sample Success Cases (First 5):\n');
      successCases.slice(0, 5).forEach((success, idx) => {
        console.log(`   ${idx + 1}. ${success.employee} - Work Year ${success.workYear}:`);
        console.log(`      Previous Remaining: ${success.previousRemaining} days`);
        console.log(`      Carry Forward: ${success.carryForward} days`);
        console.log(`      New Allocation: ${success.newAllocation} days`);
        console.log(`      Total: ${success.total} days (within 40-day cap) ✅`);
        console.log('');
      });
    }
    
    // Show issues
    if (issues.length > 0) {
      console.log('⚠️  Issues Found:\n');
      issues.slice(0, 10).forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue.employee}`);
        if (issue.workYear !== undefined) {
          console.log(`      Work Year: ${issue.workYear}`);
        }
        console.log(`      Issue: ${issue.issue}`);
        if (issue.previousRemaining !== undefined) {
          console.log(`      Previous Remaining: ${issue.previousRemaining}`);
        }
        if (issue.expectedCF !== undefined) {
          console.log(`      Expected CF: ${issue.expectedCF}`);
        }
        if (issue.actualCF !== undefined) {
          console.log(`      Actual CF: ${issue.actualCF}`);
        }
        if (issue.totalAnnual !== undefined) {
          console.log(`      Total: ${issue.totalAnnual}`);
        }
        console.log('');
      });
      
      if (issues.length > 10) {
        console.log(`   ... and ${issues.length - 10} more issues\n`);
      }
    }
    
    // Test fixing carry forward for employees with issues
    if (issues.length > 0) {
      console.log('🔄 Attempting to fix carry forward for employees with issues...\n');
      
      let fixed = 0;
      let failed = 0;
      
      for (const issue of issues.slice(0, 20)) { // Fix first 20 issues
        try {
          const emp = await Employee.findOne({
            $or: [
              { employeeId: issue.employee.match(/\((\d+)\)/)?.[1] },
              { firstName: issue.employee.split(' ')[0] }
            ]
          });
          
          if (emp) {
            const result = await CarryForwardService.recalculateCarryForward(emp._id);
            fixed++;
            console.log(`   ✅ Fixed carry forward for ${issue.employee}`);
          }
        } catch (error) {
          failed++;
          console.log(`   ❌ Failed to fix ${issue.employee}: ${error.message}`);
        }
      }
      
      console.log(`\n   Fixed: ${fixed}, Failed: ${failed}\n`);
    }
    
    // Overall status
    console.log('='.repeat(80));
    if (issues.length === 0 && totalErrors === 0) {
      console.log('🎉 SUCCESS: All employees have correct carry forward!');
    } else if (issues.length > 0) {
      console.log(`⚠️  WARNING: Found ${issues.length} issues with carry forward`);
      console.log('   Some employees may need carry forward recalculation');
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
  testCarryForwardForAllEmployees()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCarryForwardForAllEmployees };

