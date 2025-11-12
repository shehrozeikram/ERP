const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

require('dotenv').config();

async function fixAndVerifyAllEmployees() {
  try {
    console.log('🔄 Fixing and Verifying Leave System for All Employees\n');
    console.log('='.repeat(80));
    
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
    .limit(1000); // Process up to 1000 employees
    
    console.log(`📊 Found ${employees.length} employees to process\n`);
    
    if (employees.length === 0) {
      console.log('⚠️  No employees found');
      return;
    }
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    const errors = [];
    const successes = [];
    
    console.log('🔄 Processing employees...\n');
    
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      
      try {
        const result = await fixAndVerifyEmployee(employee._id, employee.employeeId, false); // verbose = false
        
        if (result.success) {
          totalSuccess++;
          successes.push({
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            workYearsProcessed: result.workYearsProcessed,
            carryForwardFixed: result.carryForwardFixed
          });
        } else {
          totalErrors++;
          errors.push({
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            error: result.error
          });
        }
        
        totalProcessed++;
        
        // Show progress every 50 employees
        if ((i + 1) % 50 === 0) {
          console.log(`\n📊 Progress: ${i + 1}/${employees.length} employees processed...`);
          console.log(`   Success: ${totalSuccess}, Errors: ${totalErrors}\n`);
        }
        
      } catch (error) {
        totalErrors++;
        errors.push({
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          error: error.message
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY:\n');
    console.log(`   Total Employees Processed: ${totalProcessed}`);
    console.log(`   Successfully Processed: ${totalSuccess}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Success Rate: ${((totalSuccess / totalProcessed) * 100).toFixed(1)}%\n`);
    
    // Show sample successes
    if (successes.length > 0) {
      console.log('✅ Sample Successfully Processed Employees (First 10):\n');
      successes.slice(0, 10).forEach((emp, idx) => {
        console.log(`   ${idx + 1}. ${emp.name} (ID: ${emp.employeeId}) - ${emp.workYearsProcessed} work years, ${emp.carryForwardFixed} carry forwards fixed`);
      });
      if (successes.length > 10) {
        console.log(`   ... and ${successes.length - 10} more\n`);
      }
    }
    
    // Show errors
    if (errors.length > 0) {
      console.log('⚠️  Employees with Errors:\n');
      errors.slice(0, 20).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.name} (ID: ${err.employeeId}): ${err.error}`);
      });
      if (errors.length > 20) {
        console.log(`   ... and ${errors.length - 20} more errors\n`);
      }
    }
    
    console.log('='.repeat(80));
    if (totalErrors === 0) {
      console.log('🎉 SUCCESS: All employees processed successfully!');
    } else {
      console.log(`⚠️  Processed ${totalSuccess} employees successfully, ${totalErrors} had errors`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

async function fixAndVerifyEmployee(employeeId, employeeIdStr, verbose = false) {
  try {
    if (verbose) {
      console.log(`🔄 Fixing and Verifying Leave System for Employee ID: ${employeeIdStr}\n`);
    }
    
    // Find employee
    const employee = await Employee.findById(employeeId);
    
    if (!employee) {
      throw new Error(`Employee not found: ${employeeIdStr}`);
    }
    
    const hireDate = employee.hireDate || employee.joiningDate;
    if (!hireDate) {
      throw new Error(`Employee ${employeeIdStr} does not have a hire date`);
    }
    
    const hireDateObj = new Date(hireDate);
    const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);
    
    if (verbose) {
      console.log(`👤 Employee: ${employee.firstName} ${employee.lastName} (ID: ${employeeIdStr})`);
      console.log(`📅 Date of Joining: ${hireDateObj.toLocaleDateString()}`);
      console.log(`📊 Current Work Year: ${currentWorkYear}\n`);
    }
    
    // Step 1: Ensure all work year balances exist
    if (verbose) {
      console.log('📋 Step 1: Ensuring all work year balances exist...\n');
    }
    
    for (let wy = 0; wy <= currentWorkYear + 1; wy++) {
      try {
        await CarryForwardService.ensureWorkYearBalance(employee._id, wy);
      } catch (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('E11000')) {
          if (verbose) {
            console.log(`   ⚠️  Work Year ${wy}: ${error.message}`);
          }
        }
      }
    }
    
    // Step 2: Sync balances with leave usage
    if (verbose) {
      console.log('📋 Step 2: Syncing balances with leave usage...\n');
    }
    
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
    }
    
    // Step 3: Recalculate carry forward
    if (verbose) {
      console.log('📋 Step 3: Recalculating carry forward...\n');
    }
    
    const updatedBalances = await LeaveBalance.find({
      employee: employee._id
    }).sort({ workYear: 1 });
    
    let carryForwardFixed = 0;
    
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
          carryForwardFixed++;
          
          if (verbose) {
            console.log(`   ✅ Work Year ${wy}: Updated carry forward to ${expectedCF} days (from Work Year ${wy - 1} remaining: ${previousRemaining})`);
          }
        }
      }
    }
    
    return {
      success: true,
      employeeId: employeeIdStr,
      workYearsProcessed: updatedBalances.length,
      carryForwardFixed: carryForwardFixed
    };
    
  } catch (error) {
    return {
      success: false,
      employeeId: employeeIdStr,
      error: error.message
    };
  }
}

// Run for all employees
if (require.main === module) {
  fixAndVerifyAllEmployees()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAndVerifyAllEmployees, fixAndVerifyEmployee };

