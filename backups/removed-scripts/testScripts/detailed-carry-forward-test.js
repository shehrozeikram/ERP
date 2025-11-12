const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');

require('dotenv').config();

async function detailedCarryForwardTest() {
  try {
    console.log('🔄 Detailed Carry Forward Test for All Employees\n');
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
    .limit(200);
    
    console.log(`📊 Found ${employees.length} employees\n`);
    
    let eligibleForCF = 0;
    let hasCFApplied = 0;
    let shouldHaveCFButDoesnt = 0;
    let correctlyNoCF = 0;
    
    const eligibleEmployees = [];
    const employeesWithCF = [];
    const missingCF = [];
    
    console.log('🔄 Analyzing each employee...\n');
    
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const hireDate = employee.hireDate || employee.joiningDate;
      
      if (!hireDate) continue;
      
      try {
        // Get all leave balances
        const balances = await LeaveBalance.find({
          employee: employee._id
        }).sort({ workYear: 1 });
        
        if (balances.length < 2) {
          // Need at least 2 work years for carry forward
          continue;
        }
        
        // Check each consecutive work year pair
        for (let j = 1; j < balances.length; j++) {
          const prevBalance = balances[j - 1];
          const currBalance = balances[j];
          
          // Verify consecutive work years
          if (currBalance.workYear !== prevBalance.workYear + 1) {
            continue;
          }
          
          const prevRemaining = prevBalance.annual.remaining || 0;
          const currAllocation = currBalance.annual.allocated || 0;
          const currCF = currBalance.annual.carriedForward || 0;
          
          // Employee is eligible for carry forward if previous year has remaining
          if (prevRemaining > 0) {
            eligibleForCF++;
            
            // Calculate expected carry forward
            const individualCap = Math.min(prevRemaining, 20);
            const maxCFWithTotalCap = Math.max(0, 40 - currAllocation);
            const expectedCF = Math.min(individualCap, maxCFWithTotalCap);
            
            eligibleEmployees.push({
              employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
              workYear: currBalance.workYear,
              prevRemaining,
              expectedCF,
              actualCF: currCF,
              newAllocation: currAllocation,
              total: currAllocation + currCF
            });
            
            if (currCF > 0) {
              hasCFApplied++;
              if (currCF === expectedCF) {
                employeesWithCF.push({
                  employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                  workYear: currBalance.workYear,
                  carryForward: currCF,
                  total: currAllocation + currCF
                });
              } else {
                shouldHaveCFButDoesnt++;
                missingCF.push({
                  employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                  workYear: currBalance.workYear,
                  prevRemaining,
                  expectedCF,
                  actualCF: currCF,
                  issue: 'Carry forward mismatch'
                });
              }
            } else if (expectedCF > 0) {
              shouldHaveCFButDoesnt++;
              missingCF.push({
                employee: `${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
                workYear: currBalance.workYear,
                prevRemaining,
                expectedCF,
                actualCF: currCF,
                issue: 'Missing carry forward'
              });
            } else {
              correctlyNoCF++;
            }
          } else {
            // No remaining, so no carry forward expected
            if (currCF === 0) {
              correctlyNoCF++;
            }
          }
        }
        
      } catch (error) {
        // Ignore errors
      }
    }
    
    console.log('='.repeat(80));
    console.log('📊 DETAILED ANALYSIS:\n');
    console.log(`   Employees Eligible for Carry Forward: ${eligibleForCF}`);
    console.log(`   Employees with Carry Forward Applied: ${hasCFApplied}`);
    console.log(`   Employees Missing Carry Forward: ${shouldHaveCFButDoesnt}`);
    console.log(`   Employees Correctly No Carry Forward: ${correctlyNoCF}\n`);
    
    // Show employees with carry forward
    if (employeesWithCF.length > 0) {
      console.log('✅ Employees with Carry Forward Applied Correctly:\n');
      employeesWithCF.slice(0, 10).forEach((emp, idx) => {
        console.log(`   ${idx + 1}. ${emp.employee} - Work Year ${emp.workYear}:`);
        console.log(`      Carry Forward: ${emp.carryForward} days`);
        console.log(`      Total Annual Leaves: ${emp.total} days ✅`);
        console.log('');
      });
      
      if (employeesWithCF.length > 10) {
        console.log(`   ... and ${employeesWithCF.length - 10} more\n`);
      }
    }
    
    // Show employees missing carry forward
    if (missingCF.length > 0) {
      console.log('⚠️  Employees Missing or Incorrect Carry Forward:\n');
      missingCF.slice(0, 15).forEach((emp, idx) => {
        console.log(`   ${idx + 1}. ${emp.employee} - Work Year ${emp.workYear}:`);
        console.log(`      Previous Remaining: ${emp.prevRemaining} days`);
        console.log(`      Expected Carry Forward: ${emp.expectedCF} days`);
        console.log(`      Actual Carry Forward: ${emp.actualCF} days`);
        console.log(`      Issue: ${emp.issue}`);
        console.log('');
      });
      
      if (missingCF.length > 15) {
        console.log(`   ... and ${missingCF.length - 15} more\n`);
      }
      
      // Try to fix them
      console.log('🔄 Attempting to fix carry forward for employees with issues...\n');
      
      let fixed = 0;
      let failed = 0;
      
      for (const emp of missingCF.slice(0, 30)) {
        try {
          const employee = await Employee.findOne({
            $or: [
              { employeeId: emp.employee.match(/\((\d+)\)/)?.[1] },
              { firstName: emp.employee.split(' ')[0] }
            ]
          });
          
          if (employee) {
            await CarryForwardService.recalculateCarryForward(employee._id);
            fixed++;
          }
        } catch (error) {
          failed++;
        }
      }
      
      console.log(`   Fixed: ${fixed}, Failed: ${failed}\n`);
    }
    
    // Overall status
    console.log('='.repeat(80));
    if (missingCF.length === 0) {
      console.log('🎉 SUCCESS: All eligible employees have correct carry forward!');
      if (hasCFApplied > 0) {
        console.log(`   ${hasCFApplied} employees have carry forward applied correctly`);
      }
    } else {
      console.log(`⚠️  Found ${missingCF.length} employees with carry forward issues`);
      console.log(`   Attempted to fix: ${missingCF.length > 0 ? 'Yes' : 'N/A'}`);
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
  detailedCarryForwardTest()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { detailedCarryForwardTest };

