// Test script for employee edit cycle
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const testEmployeeEditCycle = async () => {
  console.log('🔄 Testing Employee Edit Cycle...\n');

  try {
    // Step 1: Find an employee to test with
    console.log('📋 Step 1: Finding test employee...');
    const testEmployee = await Employee.findOne().populate('department position bankName');
    
    if (!testEmployee) {
      console.log('❌ No employees found for testing');
      return;
    }
    
    console.log(`✅ Found employee: ${testEmployee.firstName} ${testEmployee.lastName}`);
    console.log(`   ID: ${testEmployee._id}`);
    console.log(`   Department: ${testEmployee.department?.name || 'Not set'}`);
    console.log(`   Position: ${testEmployee.position?.title || 'Not set'}`);
    console.log(`   Bank: ${testEmployee.bankName?.name || 'Not set'}`);
    console.log('');

    // Step 2: Simulate first edit (update employee)
    console.log('✏️  Step 2: Simulating first edit...');
    const firstEditData = {
      firstName: testEmployee.firstName,
      lastName: testEmployee.lastName,
      email: testEmployee.email,
      phone: testEmployee.phone,
      dateOfBirth: testEmployee.dateOfBirth,
      gender: testEmployee.gender,
      idCard: testEmployee.idCard,
      nationality: testEmployee.nationality,
      religion: testEmployee.religion,
      maritalStatus: testEmployee.maritalStatus,
      department: testEmployee.department?._id || testEmployee.department,
      position: testEmployee.position?._id || testEmployee.position,
      qualification: testEmployee.qualification || 'Bachelor\'s Degree',
      bankName: testEmployee.bankName?._id || testEmployee.bankName,
      hireDate: testEmployee.hireDate,
      salary: testEmployee.salary || 50000,
      address: testEmployee.address,
      emergencyContact: testEmployee.emergencyContact
    };

    console.log('   Updating employee with data...');
    const updatedEmployee = await Employee.findByIdAndUpdate(
      testEmployee._id,
      firstEditData,
      { new: true, runValidators: true }
    );

    if (updatedEmployee) {
      console.log('   ✅ First edit successful!');
      console.log(`   Updated: ${updatedEmployee.firstName} ${updatedEmployee.lastName}`);
    } else {
      console.log('   ❌ First edit failed');
      return;
    }

    // Step 3: Simulate fetching employee for second edit
    console.log('\n📥 Step 3: Simulating fetch for second edit...');
    console.log('   Fetching employee data...');
    
    const fetchedEmployee = await Employee.findById(testEmployee._id)
      .populate('department', 'name code')
      .populate('position', 'title')
      .populate('bankName', 'name type')
      .populate('placementCompany', 'name type')
      .populate('placementProject', 'name company')
      .populate('placementDepartment', 'name code')
      .populate('placementSection', 'name department')
      .populate('placementDesignation', 'title level')
      .populate('oldDesignation', 'title level')
      .populate('placementLocation', 'name type')
      .populate('address.city', 'name code')
      .populate('address.state', 'name code')
      .populate('address.country', 'name code')
      .populate('manager', 'firstName lastName employeeId');

    if (fetchedEmployee) {
      console.log('   ✅ Employee fetched successfully for second edit');
      console.log(`   Name: ${fetchedEmployee.firstName} ${fetchedEmployee.lastName}`);
      console.log(`   Department: ${fetchedEmployee.department?.name || 'Not set'}`);
      console.log(`   Position: ${fetchedEmployee.position?.title || 'Not set'}`);
      console.log(`   Bank: ${fetchedEmployee.bankName?.name || 'Not set'}`);
      console.log(`   Address: ${fetchedEmployee.address?.street}, ${fetchedEmployee.address?.city?.name}, ${fetchedEmployee.address?.state?.name}, ${fetchedEmployee.address?.country?.name}`);
    } else {
      console.log('   ❌ Failed to fetch employee for second edit');
      return;
    }

    // Step 4: Simulate second edit
    console.log('\n✏️  Step 4: Simulating second edit...');
    const secondEditData = {
      firstName: fetchedEmployee.firstName,
      lastName: fetchedEmployee.lastName,
      email: fetchedEmployee.email,
      phone: fetchedEmployee.phone,
      dateOfBirth: fetchedEmployee.dateOfBirth,
      gender: fetchedEmployee.gender,
      idCard: fetchedEmployee.idCard,
      nationality: fetchedEmployee.nationality,
      religion: fetchedEmployee.religion,
      maritalStatus: fetchedEmployee.maritalStatus,
      department: fetchedEmployee.department?._id || fetchedEmployee.department,
      position: fetchedEmployee.position?._id || fetchedEmployee.position,
      qualification: fetchedEmployee.qualification,
      bankName: fetchedEmployee.bankName?._id || fetchedEmployee.bankName,
      hireDate: fetchedEmployee.hireDate,
      salary: fetchedEmployee.salary,
      address: fetchedEmployee.address,
      emergencyContact: fetchedEmployee.emergencyContact
    };

    console.log('   Updating employee with data from fetched employee...');
    const secondUpdatedEmployee = await Employee.findByIdAndUpdate(
      testEmployee._id,
      secondEditData,
      { new: true, runValidators: true }
    );

    if (secondUpdatedEmployee) {
      console.log('   ✅ Second edit successful!');
      console.log(`   Updated: ${secondUpdatedEmployee.firstName} ${secondUpdatedEmployee.lastName}`);
    } else {
      console.log('   ❌ Second edit failed');
    }

    // Step 5: Check for potential issues
    console.log('\n🔍 Step 5: Checking for potential issues...');
    
    // Check if there are any circular references or invalid ObjectIds
    const rawEmployee = await Employee.findById(testEmployee._id).lean();
    console.log('   Raw employee data structure:');
    console.log(`   - _id: ${rawEmployee._id}`);
    console.log(`   - department: ${rawEmployee.department} (type: ${typeof rawEmployee.department})`);
    console.log(`   - position: ${rawEmployee.position} (type: ${typeof rawEmployee.position})`);
    console.log(`   - bankName: ${rawEmployee.bankName} (type: ${typeof rawEmployee.bankName})`);
    console.log(`   - address.city: ${rawEmployee.address?.city} (type: ${typeof rawEmployee.address?.city})`);
    console.log(`   - address.state: ${rawEmployee.address?.state} (type: ${typeof rawEmployee.address?.state})`);
    console.log(`   - address.country: ${rawEmployee.address?.country} (type: ${typeof rawEmployee.address?.country})`);

    // Check if any ObjectIds are invalid
    const invalidObjectIds = [];
    if (rawEmployee.department && !mongoose.Types.ObjectId.isValid(rawEmployee.department)) {
      invalidObjectIds.push('department');
    }
    if (rawEmployee.position && !mongoose.Types.ObjectId.isValid(rawEmployee.position)) {
      invalidObjectIds.push('position');
    }
    if (rawEmployee.bankName && !mongoose.Types.ObjectId.isValid(rawEmployee.bankName)) {
      invalidObjectIds.push('bankName');
    }
    if (rawEmployee.address?.city && !mongoose.Types.ObjectId.isValid(rawEmployee.address.city)) {
      invalidObjectIds.push('address.city');
    }
    if (rawEmployee.address?.state && !mongoose.Types.ObjectId.isValid(rawEmployee.address.state)) {
      invalidObjectIds.push('address.state');
    }
    if (rawEmployee.address?.country && !mongoose.Types.ObjectId.isValid(rawEmployee.address.country)) {
      invalidObjectIds.push('address.country');
    }

    if (invalidObjectIds.length > 0) {
      console.log(`   ⚠️  Found invalid ObjectIds: ${invalidObjectIds.join(', ')}`);
    } else {
      console.log('   ✅ All ObjectIds are valid');
    }

  } catch (error) {
    console.log('❌ Error during test:');
    console.log(`   Error Type: ${error.name}`);
    console.log(`   Error Message: ${error.message}`);
    console.log(`   Stack Trace: ${error.stack}`);
  }

  console.log('\n🎯 Test Summary:');
  console.log('✅ Employee edit cycle test completed');
  console.log('📝 Check the results above for any issues');
  
  mongoose.connection.close();
};

testEmployeeEditCycle().catch(console.error); 