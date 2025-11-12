const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');
const Employee = require('../models/hr/Employee');
const CarryForwardService = require('../services/carryForwardService');
const { applyCarryForwardLogicToEmployee } = require('./apply-carry-forward-employee-3');

require('dotenv').config();

async function applyCarryForwardToAllEmployees() {
  try {
    console.log('🔄 Applying Carry Forward Logic to All Employees\n');
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
    .limit(500); // Process up to 500 employees
    
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
        const result = await applyCarryForwardLogicToEmployee(employee.employeeId, false); // verbose = false for batch processing
        
        if (result.success) {
          totalSuccess++;
          if (result.carryForwardCorrect) {
            successes.push(result.employee);
          }
        } else {
          totalErrors++;
          errors.push({
            employee: employee.employeeId,
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
          employee: employee.employeeId,
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
        console.log(`   ${idx + 1}. ${emp}`);
      });
      if (successes.length > 10) {
        console.log(`   ... and ${successes.length - 10} more\n`);
      }
    }
    
    // Show errors
    if (errors.length > 0) {
      console.log('⚠️  Employees with Errors:\n');
      errors.slice(0, 20).forEach((err, idx) => {
        console.log(`   ${idx + 1}. Employee ID ${err.employee}: ${err.error}`);
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

// Run for all employees
if (require.main === module) {
  applyCarryForwardToAllEmployees()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { applyCarryForwardToAllEmployees };

