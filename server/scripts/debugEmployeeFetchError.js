// Debug script for employee fetch error on second edit
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const debugEmployeeFetchError = async () => {
  console.log('🔍 Debugging Employee Fetch Error on Second Edit...\n');

  try {
    // Step 1: Find an employee
    console.log('📋 Step 1: Finding test employee...');
    const employee = await Employee.findOne().populate('department position bankName address.city address.state address.country');
    
    if (!employee) {
      console.log('❌ No employees found');
      return;
    }
    
    console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`   ID: ${employee._id}`);
    console.log(`   Department: ${employee.department?.name || 'Not set'}`);
    console.log(`   Position: ${employee.position?.title || 'Not set'}`);
    console.log(`   Bank: ${employee.bankName?.name || 'Not set'}`);
    console.log(`   Address: ${employee.address?.street}, ${employee.address?.city?.name}, ${employee.address?.state?.name}, ${employee.address?.country?.name}`);
    console.log('');

    // Step 2: Simulate first edit (like frontend does)
    console.log('✏️  Step 2: Simulating first edit...');
    const firstEditData = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      dateOfBirth: employee.dateOfBirth,
      gender: employee.gender,
      idCard: employee.idCard,
      nationality: employee.nationality,
      religion: employee.religion,
      maritalStatus: employee.maritalStatus,
      department: employee.department?._id || employee.department,
      position: employee.position?._id || employee.position,
      qualification: employee.qualification,
      bankName: employee.bankName?._id || employee.bankName,
      hireDate: employee.hireDate,
      salary: employee.salary,
      address: employee.address,
      emergencyContact: employee.emergencyContact
    };

    console.log('   First edit data structure:');
    console.log(`   - department: ${firstEditData.department} (type: ${typeof firstEditData.department})`);
    console.log(`   - position: ${firstEditData.position} (type: ${typeof firstEditData.position})`);
    console.log(`   - bankName: ${firstEditData.bankName} (type: ${typeof firstEditData.bankName})`);
    console.log(`   - address.city: ${firstEditData.address?.city} (type: ${typeof firstEditData.address?.city})`);
    console.log(`   - address.state: ${firstEditData.address?.state} (type: ${typeof firstEditData.address?.state})`);
    console.log(`   - address.country: ${firstEditData.address?.country} (type: ${typeof firstEditData.address?.country})`);

    const updatedEmployee = await Employee.findByIdAndUpdate(
      employee._id,
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

    // Step 3: Check what was actually saved in the database
    console.log('\n💾 Step 3: Checking what was saved in database...');
    const savedEmployee = await Employee.findById(employee._id).lean();
    console.log('   Raw saved data:');
    console.log(`   - department: ${savedEmployee.department} (type: ${typeof savedEmployee.department})`);
    console.log(`   - position: ${savedEmployee.position} (type: ${typeof savedEmployee.position})`);
    console.log(`   - bankName: ${savedEmployee.bankName} (type: ${typeof savedEmployee.bankName})`);
    console.log(`   - address.city: ${savedEmployee.address?.city} (type: ${typeof savedEmployee.address?.city})`);
    console.log(`   - address.state: ${savedEmployee.address?.state} (type: ${typeof savedEmployee.address?.state})`);
    console.log(`   - address.country: ${savedEmployee.address?.country} (type: ${typeof savedEmployee.address?.country})`);

    // Step 4: Simulate the exact fetch that the frontend does
    console.log('\n📥 Step 4: Simulating frontend fetch (second edit)...');
    console.log('   Fetching with population (like frontend does)...');
    
    try {
      const fetchedEmployee = await Employee.findById(employee._id)
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
        
        // Check if any populated fields are null/undefined
        console.log('\n   🔍 Checking populated fields:');
        console.log(`   - department populated: ${!!fetchedEmployee.department}`);
        console.log(`   - position populated: ${!!fetchedEmployee.position}`);
        console.log(`   - bankName populated: ${!!fetchedEmployee.bankName}`);
        console.log(`   - address.city populated: ${!!fetchedEmployee.address?.city}`);
        console.log(`   - address.state populated: ${!!fetchedEmployee.address?.state}`);
        console.log(`   - address.country populated: ${!!fetchedEmployee.address?.country}`);
        
      } else {
        console.log('   ❌ Failed to fetch employee for second edit');
        return;
      }
    } catch (fetchError) {
      console.log('   ❌ Error during fetch:');
      console.log(`   Error Type: ${fetchError.name}`);
      console.log(`   Error Message: ${fetchError.message}`);
      console.log(`   Stack Trace: ${fetchError.stack}`);
    }

    // Step 5: Check if there are any invalid ObjectIds
    console.log('\n🔍 Step 5: Checking for invalid ObjectIds...');
    const invalidObjectIds = [];
    
    if (savedEmployee.department && !mongoose.Types.ObjectId.isValid(savedEmployee.department)) {
      invalidObjectIds.push('department');
    }
    if (savedEmployee.position && !mongoose.Types.ObjectId.isValid(savedEmployee.position)) {
      invalidObjectIds.push('position');
    }
    if (savedEmployee.bankName && !mongoose.Types.ObjectId.isValid(savedEmployee.bankName)) {
      invalidObjectIds.push('bankName');
    }
    if (savedEmployee.address?.city && !mongoose.Types.ObjectId.isValid(savedEmployee.address.city)) {
      invalidObjectIds.push('address.city');
    }
    if (savedEmployee.address?.state && !mongoose.Types.ObjectId.isValid(savedEmployee.address.state)) {
      invalidObjectIds.push('address.state');
    }
    if (savedEmployee.address?.country && !mongoose.Types.ObjectId.isValid(savedEmployee.address.country)) {
      invalidObjectIds.push('address.country');
    }

    if (invalidObjectIds.length > 0) {
      console.log(`   ⚠️  Found invalid ObjectIds: ${invalidObjectIds.join(', ')}`);
    } else {
      console.log('   ✅ All ObjectIds are valid');
    }

    // Step 6: Check if referenced documents exist
    console.log('\n🔍 Step 6: Checking if referenced documents exist...');
    
    if (savedEmployee.department) {
      const deptExists = await Department.findById(savedEmployee.department);
      console.log(`   Department ${savedEmployee.department} exists: ${!!deptExists}`);
    }
    
    if (savedEmployee.position) {
      const posExists = await Position.findById(savedEmployee.position);
      console.log(`   Position ${savedEmployee.position} exists: ${!!posExists}`);
    }
    
    if (savedEmployee.bankName) {
      const bankExists = await Bank.findById(savedEmployee.bankName);
      console.log(`   Bank ${savedEmployee.bankName} exists: ${!!bankExists}`);
    }
    
    if (savedEmployee.address?.city) {
      const cityExists = await City.findById(savedEmployee.address.city);
      console.log(`   City ${savedEmployee.address.city} exists: ${!!cityExists}`);
    }
    
    if (savedEmployee.address?.state) {
      const stateExists = await Province.findById(savedEmployee.address.state);
      console.log(`   State ${savedEmployee.address.state} exists: ${!!stateExists}`);
    }
    
    if (savedEmployee.address?.country) {
      const countryExists = await Country.findById(savedEmployee.address.country);
      console.log(`   Country ${savedEmployee.address.country} exists: ${!!countryExists}`);
    }

  } catch (error) {
    console.log('❌ Error during debug:');
    console.log(`   Error Type: ${error.name}`);
    console.log(`   Error Message: ${error.message}`);
    console.log(`   Stack Trace: ${error.stack}`);
  }

  console.log('\n🎯 Debug Summary:');
  console.log('✅ Employee fetch error debug completed');
  console.log('📝 Check the results above for the root cause');
  
  mongoose.connection.close();
};

debugEmployeeFetchError().catch(console.error); 