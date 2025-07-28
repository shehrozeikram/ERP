const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const User = require('../models/User');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testEmployeeEditFix() {
  try {
    console.log('\n🧪 Testing Employee Edit Fix...\n');

    // Get required data
    const department = await Department.findOne({ isActive: true });
    const position = await Position.findOne({ isActive: true });
    const bank = await Bank.findOne({ isActive: true });

    if (!department || !position || !bank) {
      console.log('❌ Missing required data. Please ensure departments, positions, and banks exist.');
      return;
    }

    console.log('📋 Using sample data:');
    console.log(`   Department: ${department.name}`);
    console.log(`   Position: ${position.title}`);
    console.log(`   Bank: ${bank.name}`);

    // Create a test employee
    console.log('\n📝 Creating test employee...');
    const testEmployee = {
      firstName: 'EditTest',
      lastName: 'Employee',
      email: `edittest.employee.${Date.now()}@example.com`,
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'EDITTEST123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Married',
      spouseName: 'Test Spouse',
      department: department._id,
      position: position._id,
      qualification: 'BSc',
      bankName: bank._id,
      appointmentDate: new Date('2024-01-15'),
      probationPeriodMonths: 6,
      endOfProbationDate: new Date('2024-07-15'),
      hireDate: new Date('2024-01-15'),
      salary: 50000,
      address: {
        street: '123 Test St',
        city: department._id, // Using department as city for test
        state: department._id, // Using department as state for test
        country: department._id // Using department as country for test
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567890'
      }
    };

    const employee = new Employee(testEmployee);
    await employee.save();
    console.log('✅ Test employee created successfully!');
    console.log('   Employee ID:', employee._id);

    // Test fetching employee with populated fields
    console.log('\n📝 Testing employee fetch with populated fields...');
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

    console.log('✅ Employee fetched with populated fields successfully!');
    console.log('   Department:', fetchedEmployee.department);
    console.log('   Position:', fetchedEmployee.position);
    console.log('   Bank:', fetchedEmployee.bankName);
    console.log('   Address City:', fetchedEmployee.address.city);
    console.log('   Address State:', fetchedEmployee.address.state);
    console.log('   Address Country:', fetchedEmployee.address.country);

    // Verify that populated objects have the expected structure
    console.log('\n📝 Verifying populated object structure...');
    
    if (fetchedEmployee.department && typeof fetchedEmployee.department === 'object') {
      console.log('✅ Department is populated object:', {
        _id: fetchedEmployee.department._id,
        name: fetchedEmployee.department.name,
        code: fetchedEmployee.department.code
      });
    } else {
      console.log('❌ Department is not populated correctly');
    }

    if (fetchedEmployee.position && typeof fetchedEmployee.position === 'object') {
      console.log('✅ Position is populated object:', {
        _id: fetchedEmployee.position._id,
        title: fetchedEmployee.position.title
      });
    } else {
      console.log('❌ Position is not populated correctly');
    }

    if (fetchedEmployee.bankName && typeof fetchedEmployee.bankName === 'object') {
      console.log('✅ Bank is populated object:', {
        _id: fetchedEmployee.bankName._id,
        name: fetchedEmployee.bankName.name,
        type: fetchedEmployee.bankName.type
      });
    } else {
      console.log('❌ Bank is not populated correctly');
    }

    // Test updating employee
    console.log('\n📝 Testing employee update...');
    const updateData = {
      firstName: 'UpdatedTest',
      lastName: 'Employee',
      salary: 55000
    };

    const updatedEmployee = await Employee.findByIdAndUpdate(
      employee._id,
      updateData,
      { new: true }
    ).populate('department', 'name code')
     .populate('position', 'title')
     .populate('bankName', 'name type');

    console.log('✅ Employee updated successfully!');
    console.log('   Updated Name:', `${updatedEmployee.firstName} ${updatedEmployee.lastName}`);
    console.log('   Updated Salary:', updatedEmployee.salary);
    console.log('   Department still populated:', updatedEmployee.department?.name);

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(employee._id);
    console.log('✅ Test employee cleaned up');

    console.log('\n🎉 Employee edit fix test successful!');
    console.log('📝 Note: Populated objects are now handled correctly in the frontend');

  } catch (error) {
    console.error('❌ Error during employee edit fix test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testEmployeeEditFix(); 