// Debug script for employee save functionality
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const debugEmployeeSave = async () => {
  console.log('🔍 Debugging Employee Save Functionality...\n');

  try {
    // Test 1: Check if we can find an existing employee
    console.log('📋 Test 1: Finding existing employee...');
    const existingEmployee = await Employee.findOne().populate('department position bankName');
    
    if (!existingEmployee) {
      console.log('❌ No employees found in database');
      return;
    }
    
    console.log(`✅ Found employee: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
    console.log(`   ID: ${existingEmployee._id}`);
    console.log(`   Email: ${existingEmployee.email}`);
    console.log(`   Employee ID: ${existingEmployee.employeeId}`);
    console.log('');

    // Test 2: Prepare update data
    console.log('📝 Test 2: Preparing update data...');
    const updateData = {
      firstName: existingEmployee.firstName,
      lastName: existingEmployee.lastName,
      email: existingEmployee.email,
      phone: existingEmployee.phone,
      dateOfBirth: existingEmployee.dateOfBirth,
      gender: existingEmployee.gender,
      idCard: existingEmployee.idCard,
      nationality: existingEmployee.nationality,
      religion: existingEmployee.religion,
      maritalStatus: existingEmployee.maritalStatus,
      department: existingEmployee.department?._id || existingEmployee.department,
      position: existingEmployee.position?._id || existingEmployee.position,
      qualification: existingEmployee.qualification,
      bankName: existingEmployee.bankName?._id || existingEmployee.bankName,
      hireDate: existingEmployee.hireDate,
      salary: existingEmployee.salary,
      address: {
        street: existingEmployee.address?.street,
        city: existingEmployee.address?.city?._id || existingEmployee.address?.city,
        state: existingEmployee.address?.state?._id || existingEmployee.address?.state,
        country: existingEmployee.address?.country?._id || existingEmployee.address?.country
      },
      emergencyContact: existingEmployee.emergencyContact
    };

    console.log('✅ Update data prepared');
    console.log(`   Department: ${updateData.department}`);
    console.log(`   Position: ${updateData.position}`);
    console.log(`   Bank: ${updateData.bankName}`);
    console.log('');

    // Test 3: Try to update the employee
    console.log('🔄 Test 3: Attempting to update employee...');
    
    const updatedEmployee = await Employee.findByIdAndUpdate(
      existingEmployee._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (updatedEmployee) {
      console.log('✅ Employee updated successfully!');
      console.log(`   Updated: ${updatedEmployee.firstName} ${updatedEmployee.lastName}`);
    } else {
      console.log('❌ Employee update failed - employee not found');
    }

  } catch (error) {
    console.log('❌ Error during update:');
    console.log(`   Error Type: ${error.name}`);
    console.log(`   Error Message: ${error.message}`);
    
    if (error.code === 11000) {
      console.log('   🔍 This is a duplicate key error');
      console.log('   📋 Check for unique constraints on:');
      console.log('      - email');
      console.log('      - idCard');
      console.log('      - employeeId');
    }
    
    if (error.errors) {
      console.log('   🔍 Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.log(`      ${key}: ${error.errors[key].message}`);
      });
    }
  }

  // Test 4: Check for potential issues
  console.log('\n🔍 Test 4: Checking for potential issues...');
  
  try {
    // Check if there are any employees with duplicate emails
    const emailCounts = await Employee.aggregate([
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (emailCounts.length > 0) {
      console.log('⚠️  Found duplicate emails:');
      emailCounts.forEach(item => {
        console.log(`   ${item._id}: ${item.count} occurrences`);
      });
    } else {
      console.log('✅ No duplicate emails found');
    }

    // Check if there are any employees with duplicate ID cards
    const idCardCounts = await Employee.aggregate([
      { $group: { _id: '$idCard', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (idCardCounts.length > 0) {
      console.log('⚠️  Found duplicate ID cards:');
      idCardCounts.forEach(item => {
        console.log(`   ${item._id}: ${item.count} occurrences`);
      });
    } else {
      console.log('✅ No duplicate ID cards found');
    }

  } catch (error) {
    console.log(`❌ Error checking duplicates: ${error.message}`);
  }

  console.log('\n🎯 Debug Summary:');
  console.log('✅ Database connection successful');
  console.log('✅ Employee found and data prepared');
  console.log('✅ Update operation attempted');
  console.log('📝 Check the error details above for specific issues');
  
  mongoose.connection.close();
};

debugEmployeeSave().catch(console.error); 