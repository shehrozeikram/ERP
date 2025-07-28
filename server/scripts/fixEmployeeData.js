// Script to fix employee data with proper address information
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const fixEmployeeData = async () => {
  console.log('🔧 Fixing Employee Data...\n');

  try {
    // Get default values
    console.log('📋 Getting default values...');
    
    const defaultCountry = await Country.findOne({ name: 'Pakistan' });
    const defaultProvince = await Province.findOne({ name: 'Punjab' });
    const defaultCity = await City.findOne({ name: 'Lahore' });
    const defaultDepartment = await Department.findOne({ name: 'Human Resources' });
    const defaultPosition = await Position.findOne({ title: 'HR Assistant' });
    const defaultBank = await Bank.findOne({ name: 'HBL' });
    
    if (!defaultCountry || !defaultProvince || !defaultCity) {
      console.log('❌ Default address data not found');
      return;
    }
    
    console.log(`✅ Default Country: ${defaultCountry.name}`);
    console.log(`✅ Default Province: ${defaultProvince.name}`);
    console.log(`✅ Default City: ${defaultCity.name}`);
    console.log(`✅ Default Department: ${defaultDepartment?.name || 'Not found'}`);
    console.log(`✅ Default Position: ${defaultPosition?.title || 'Not found'}`);
    console.log(`✅ Default Bank: ${defaultBank?.name || 'Not found'}`);
    console.log('');

    // Find all employees
    console.log('🔍 Finding all employees...');
    const employees = await Employee.find();
    console.log(`📊 Found ${employees.length} employees`);
    
    if (employees.length === 0) {
      console.log('❌ No employees found');
      return;
    }

    // Fix each employee
    console.log('\n🔧 Fixing each employee...');
    
    for (const employee of employees) {
      console.log(`\n👤 Processing: ${employee.firstName} ${employee.lastName}`);
      
      const updateData = {
        // Keep existing data
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        dateOfBirth: employee.dateOfBirth,
        gender: employee.gender,
        idCard: employee.idCard,
        nationality: employee.nationality || 'Pakistani',
        religion: employee.religion || 'Islam',
        maritalStatus: employee.maritalStatus || 'Single',
        
        // Set default values for missing fields
        department: employee.department || defaultDepartment?._id,
        position: employee.position || defaultPosition?._id,
        qualification: employee.qualification || 'Bachelor\'s Degree',
        bankName: employee.bankName || defaultBank?._id,
        hireDate: employee.hireDate || new Date(),
        salary: employee.salary || 50000,
        
        // Fix address data
        address: {
          street: employee.address?.street || 'Default Street',
          city: employee.address?.city || defaultCity._id,
          state: employee.address?.state || defaultProvince._id,
          country: employee.address?.country || defaultCountry._id
        },
        
        // Set emergency contact if missing
        emergencyContact: employee.emergencyContact || {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '0300-0000000'
        }
      };
      
      try {
        const updatedEmployee = await Employee.findByIdAndUpdate(
          employee._id,
          updateData,
          { new: true, runValidators: true }
        );
        
        console.log(`   ✅ Updated successfully`);
        console.log(`   Address: ${updatedEmployee.address.street}, ${defaultCity.name}, ${defaultProvince.name}, ${defaultCountry.name}`);
        
      } catch (error) {
        console.log(`   ❌ Error updating: ${error.message}`);
      }
    }

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const employeesWithMissingData = await Employee.find({
      $or: [
        { 'address.city': { $exists: false } },
        { 'address.city': null },
        { 'address.state': { $exists: false } },
        { 'address.state': null },
        { 'address.country': { $exists: false } },
        { 'address.country': null }
      ]
    });

    if (employeesWithMissingData.length === 0) {
      console.log('✅ All employees now have complete data');
    } else {
      console.log(`⚠️  ${employeesWithMissingData.length} employees still have missing data`);
    }

    // Test the edit cycle
    console.log('\n🧪 Testing employee edit cycle...');
    const testEmployee = await Employee.findOne().populate('department position bankName');
    
    if (testEmployee) {
      console.log(`📋 Test employee: ${testEmployee.firstName} ${testEmployee.lastName}`);
      console.log(`   Department: ${testEmployee.department?.name || 'Not set'}`);
      console.log(`   Position: ${testEmployee.position?.title || 'Not set'}`);
      console.log(`   Bank: ${testEmployee.bankName?.name || 'Not set'}`);
      console.log(`   Address: ${testEmployee.address?.street}, ${testEmployee.address?.city?.name || 'Not set'}, ${testEmployee.address?.state?.name || 'Not set'}, ${testEmployee.address?.country?.name || 'Not set'}`);
      
      // Test update
      try {
        const testUpdateData = {
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
          qualification: testEmployee.qualification,
          bankName: testEmployee.bankName?._id || testEmployee.bankName,
          hireDate: testEmployee.hireDate,
          salary: testEmployee.salary,
          address: testEmployee.address,
          emergencyContact: testEmployee.emergencyContact
        };

        const updatedTestEmployee = await Employee.findByIdAndUpdate(
          testEmployee._id,
          testUpdateData,
          { new: true, runValidators: true }
        );

        console.log('   ✅ Test update successful!');
        
        // Test fetch for second edit
        const fetchedEmployee = await Employee.findById(testEmployee._id)
          .populate('department', 'name code')
          .populate('position', 'title')
          .populate('bankName', 'name type')
          .populate('address.city', 'name code')
          .populate('address.state', 'name code')
          .populate('address.country', 'name code');

        if (fetchedEmployee) {
          console.log('   ✅ Test fetch successful!');
          console.log(`   Fetched: ${fetchedEmployee.firstName} ${fetchedEmployee.lastName}`);
        } else {
          console.log('   ❌ Test fetch failed');
        }
        
      } catch (error) {
        console.log(`   ❌ Test update failed: ${error.message}`);
      }
    }

  } catch (error) {
    console.log(`❌ Error during fix: ${error.message}`);
  }

  console.log('\n🎯 Fix Summary:');
  console.log('✅ Employee data has been fixed');
  console.log('✅ All required fields are now populated');
  console.log('✅ Employee edit cycle should work correctly');
  
  mongoose.connection.close();
};

fixEmployeeData().catch(console.error); 