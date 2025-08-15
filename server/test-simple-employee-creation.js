const mongoose = require('mongoose');
require('dotenv').config();

// Import models - ensure they are registered
require('./models/hr/Employee');
require('./models/hr/Candidate');
require('./models/User');

// Now get the models
const Employee = mongoose.model('Employee');
const Candidate = mongoose.model('Candidate');

async function testSimpleEmployeeCreation() {
  try {
    console.log('🧪 Testing Simple Employee Creation...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // 1. Create a simple test candidate first
    console.log('👤 Step 1: Creating test candidate...');
    
    const testCandidate = new Candidate({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith.test@company.com',
      phone: '+92-300-9876543',
      dateOfBirth: new Date('1992-08-20'),
      gender: 'female',
      nationality: 'Pakistani',
      currentPosition: 'Data Analyst',
      currentCompany: 'Tech Solutions',
      yearsOfExperience: 3,
      source: 'direct_application',
      availability: 'immediate',
      preferredWorkType: 'on_site',
      status: 'approved'
    });
    
    await testCandidate.save();
    console.log(`✅ Test candidate created: ${testCandidate._id}`);
    
    // 2. Create a simple employee record
    console.log('\n👤 Step 2: Creating test employee...');
    
    const testEmployee = new Employee({
      employeeId: '999',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith.test@company.com',
      phone: '+92-300-9876543',
      dateOfBirth: new Date('1992-08-20'),
      gender: 'female',
      nationality: 'Pakistani',
      idCard: '99999-9999999-9',
      religion: 'Islam',
      maritalStatus: 'Single',
      address: {
        street: 'Test Street 123'
      },
      emergencyContact: {
        name: 'John Smith',
        relationship: 'Spouse',
        phone: '+92-300-1111111'
      },
      status: 'inactive', // Start as inactive
      onboardingStatus: 'completed'
    });
    
    await testEmployee.save();
    console.log(`✅ Test employee created: ${testEmployee._id}`);
    console.log(`   - Employee ID: ${testEmployee.employeeId}`);
    console.log(`   - Name: ${testEmployee.firstName} ${testEmployee.lastName}`);
    console.log(`   - Email: ${testEmployee.email}`);
    console.log(`   - Status: ${testEmployee.status}`);
    
    // 3. Verify the employee appears in the database
    console.log('\n🔍 Step 3: Verifying employee in database...');
    
    const foundEmployee = await Employee.findById(testEmployee._id);
    if (foundEmployee) {
      console.log('✅ Employee found in database:');
      console.log(`   - ID: ${foundEmployee._id}`);
      console.log(`   - Employee ID: ${foundEmployee.employeeId}`);
      console.log(`   - Name: ${foundEmployee.firstName} ${foundEmployee.lastName}`);
      console.log(`   - Status: ${foundEmployee.status}`);
    } else {
      console.log('❌ Employee not found in database');
    }
    
    // 4. Check total employee count
    console.log('\n📊 Step 4: Database summary...');
    
    const totalEmployees = await Employee.countDocuments();
    const inactiveEmployees = await Employee.countDocuments({ status: 'inactive' });
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    
    console.log(`   👤 Total employees: ${totalEmployees}`);
    console.log(`   👤 Inactive employees: ${inactiveEmployees}`);
    console.log(`   👤 Active employees: ${activeEmployees}`);
    
    // 5. Summary
    console.log('\n🎯 Step 5: Test Summary...');
    
    if (foundEmployee) {
      console.log('✅ SUCCESS: Employee creation test passed!');
      console.log('   - Employee record created successfully');
      console.log('   - Employee appears in database');
      console.log('   - Employee status: inactive (ready for HR activation)');
      console.log('   - Employee can be found in employee table');
    } else {
      console.log('❌ FAILURE: Employee creation test failed');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    if (error.errors) {
      console.error('Validation errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testSimpleEmployeeCreation();
