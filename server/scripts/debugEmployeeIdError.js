// Debug script for employee ID format issues
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const debugEmployeeIdError = async () => {
  console.log('🔍 Debugging Employee ID Format Issues...\n');

  try {
    // Check all employees for ID format issues
    console.log('📋 Checking all employees for ID format issues...');
    const employees = await Employee.find({}).lean();
    
    console.log(`Total employees found: ${employees.length}`);
    
    const issues = [];
    
    employees.forEach((emp, index) => {
      console.log(`\nEmployee ${index + 1}:`);
      console.log(`  _id: ${emp._id} (type: ${typeof emp._id})`);
      console.log(`  employeeId: ${emp.employeeId} (type: ${typeof emp.employeeId})`);
      
      // Check if _id is valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(emp._id)) {
        issues.push({
          type: 'Invalid _id',
          employee: emp,
          value: emp._id
        });
        console.log(`  ❌ Invalid _id format`);
      } else {
        console.log(`  ✅ Valid _id format`);
      }
      
      // Check if employeeId is valid
      if (emp.employeeId && !/^\d+$/.test(emp.employeeId.toString())) {
        issues.push({
          type: 'Invalid employeeId',
          employee: emp,
          value: emp.employeeId
        });
        console.log(`  ❌ Invalid employeeId format (should be numeric)`);
      } else {
        console.log(`  ✅ Valid employeeId format`);
      }
    });

    // Check for duplicate employeeIds
    console.log('\n🔍 Checking for duplicate employeeIds...');
    const employeeIds = employees.map(emp => emp.employeeId).filter(id => id);
    const duplicates = employeeIds.filter((id, index) => employeeIds.indexOf(id) !== index);
    
    if (duplicates.length > 0) {
      console.log(`  ❌ Found duplicate employeeIds: ${duplicates.join(', ')}`);
      issues.push({
        type: 'Duplicate employeeId',
        value: duplicates
      });
    } else {
      console.log(`  ✅ No duplicate employeeIds found`);
    }

    // Check for missing employeeIds
    console.log('\n🔍 Checking for missing employeeIds...');
    const missingIds = employees.filter(emp => !emp.employeeId);
    
    if (missingIds.length > 0) {
      console.log(`  ❌ Found ${missingIds.length} employees with missing employeeId`);
      missingIds.forEach(emp => {
        console.log(`    - ${emp.firstName} ${emp.lastName} (_id: ${emp._id})`);
      });
      issues.push({
        type: 'Missing employeeId',
        count: missingIds.length,
        employees: missingIds
      });
    } else {
      console.log(`  ✅ All employees have employeeId`);
    }

    // Summary
    console.log('\n🎯 Summary:');
    if (issues.length === 0) {
      console.log('✅ No employee ID format issues found');
    } else {
      console.log(`❌ Found ${issues.length} issues:`);
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.type}: ${issue.value || issue.count || 'See details above'}`);
      });
    }

    // Suggest fixes
    if (issues.length > 0) {
      console.log('\n🔧 Suggested Fixes:');
      
      issues.forEach(issue => {
        if (issue.type === 'Missing employeeId') {
          console.log(`  - Generate employeeIds for ${issue.count} employees`);
        } else if (issue.type === 'Duplicate employeeId') {
          console.log(`  - Fix duplicate employeeIds: ${issue.value.join(', ')}`);
        } else if (issue.type === 'Invalid employeeId') {
          console.log(`  - Fix employeeId format for employee: ${issue.employee.firstName} ${issue.employee.lastName}`);
        }
      });
    }

  } catch (error) {
    console.log('❌ Error during debug:');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n📝 Debug completed');
  mongoose.connection.close();
};

debugEmployeeIdError().catch(console.error); 