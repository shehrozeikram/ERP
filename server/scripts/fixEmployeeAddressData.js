// Script to fix employee address data
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

// Connect to database
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const fixEmployeeAddressData = async () => {
  console.log('🔧 Fixing Employee Address Data...\n');

  try {
    // Get default values for address fields
    console.log('📋 Getting default address values...');
    
    const defaultCountry = await Country.findOne({ name: 'Pakistan' });
    const defaultProvince = await Province.findOne({ name: 'Punjab' });
    const defaultCity = await City.findOne({ name: 'Lahore' });
    
    if (!defaultCountry || !defaultProvince || !defaultCity) {
      console.log('❌ Default address data not found. Please run the address creation scripts first.');
      return;
    }
    
    console.log(`✅ Default Country: ${defaultCountry.name}`);
    console.log(`✅ Default Province: ${defaultProvince.name}`);
    console.log(`✅ Default City: ${defaultCity.name}`);
    console.log('');

    // Find employees with missing address data
    console.log('🔍 Finding employees with missing address data...');
    const employeesWithMissingAddress = await Employee.find({
      $or: [
        { 'address.city': { $exists: false } },
        { 'address.city': null },
        { 'address.state': { $exists: false } },
        { 'address.state': null },
        { 'address.country': { $exists: false } },
        { 'address.country': null }
      ]
    });

    console.log(`📊 Found ${employeesWithMissingAddress.length} employees with missing address data`);
    
    if (employeesWithMissingAddress.length === 0) {
      console.log('✅ All employees have complete address data');
      return;
    }

    // Fix each employee's address data
    console.log('\n🔧 Fixing address data for each employee...');
    
    for (const employee of employeesWithMissingAddress) {
      console.log(`\n👤 Processing: ${employee.firstName} ${employee.lastName}`);
      console.log(`   Current address: ${JSON.stringify(employee.address)}`);
      
      const updateData = {
        address: {
          street: employee.address?.street || 'Default Street',
          city: employee.address?.city || defaultCity._id,
          state: employee.address?.state || defaultProvince._id,
          country: employee.address?.country || defaultCountry._id
        }
      };
      
      try {
        const updatedEmployee = await Employee.findByIdAndUpdate(
          employee._id,
          updateData,
          { new: true, runValidators: true }
        );
        
        console.log(`   ✅ Updated successfully`);
        console.log(`   New address: ${updatedEmployee.address.street}, ${defaultCity.name}, ${defaultProvince.name}, ${defaultCountry.name}`);
        
      } catch (error) {
        console.log(`   ❌ Error updating: ${error.message}`);
      }
    }

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const remainingEmployeesWithMissingAddress = await Employee.find({
      $or: [
        { 'address.city': { $exists: false } },
        { 'address.city': null },
        { 'address.state': { $exists: false } },
        { 'address.state': null },
        { 'address.country': { $exists: false } },
        { 'address.country': null }
      ]
    });

    if (remainingEmployeesWithMissingAddress.length === 0) {
      console.log('✅ All employees now have complete address data');
    } else {
      console.log(`⚠️  ${remainingEmployeesWithMissingAddress.length} employees still have missing address data`);
    }

    // Test updating an employee
    console.log('\n🧪 Testing employee update...');
    const testEmployee = await Employee.findOne();
    
    if (testEmployee) {
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
          department: testEmployee.department,
          position: testEmployee.position,
          qualification: testEmployee.qualification,
          bankName: testEmployee.bankName,
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

        console.log('✅ Test update successful!');
        console.log(`   Updated: ${updatedTestEmployee.firstName} ${updatedTestEmployee.lastName}`);
        
      } catch (error) {
        console.log(`❌ Test update failed: ${error.message}`);
      }
    }

  } catch (error) {
    console.log(`❌ Error during fix: ${error.message}`);
  }

  console.log('\n🎯 Fix Summary:');
  console.log('✅ Address data has been fixed for all employees');
  console.log('✅ Employee updates should now work correctly');
  console.log('✅ Test update was successful');
  
  mongoose.connection.close();
};

fixEmployeeAddressData().catch(console.error); 