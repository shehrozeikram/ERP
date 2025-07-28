const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testConditionalFields() {
  try {
    console.log('\n🧪 Testing Conditional Fields (Spouse Name & Old Designation)...\n');

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

    // Test 1: Single employee (no spouse name required)
    console.log('\n📝 Test 1: Creating single employee (no spouse name)...');
    const singleEmployee = {
      firstName: 'Single',
      lastName: 'Employee',
      email: 'single.employee@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'SINGLE123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: department._id,
      position: position._id,
      qualification: 'BSc',
      bankName: bank._id,
      // No spouseName field
      appointmentDate: new Date('2024-01-15'),
      probationPeriodMonths: 6,
      endOfProbationDate: new Date('2024-07-15'),
      hireDate: new Date('2024-01-15'),
      salary: 50000,
      address: {
        street: '123 Test St',
        city: department._id,
        state: department._id,
        country: department._id
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Parent',
        phone: '+1234567890'
      }
      // No oldDesignation field (optional)
    };

    const singleEmp = new Employee(singleEmployee);
    await singleEmp.save();
    console.log('✅ Single employee created successfully!');
    console.log('   Marital Status:', singleEmp.maritalStatus);
    console.log('   Spouse Name:', singleEmp.spouseName || 'Not set');
    console.log('   Old Designation:', singleEmp.oldDesignation || 'Not set');

    // Test 2: Married employee (spouse name required)
    console.log('\n📝 Test 2: Creating married employee (with spouse name)...');
    const marriedEmployee = {
      firstName: 'Married',
      lastName: 'Employee',
      email: 'married.employee@example.com',
      phone: '+1234567891',
      dateOfBirth: new Date('1985-01-01'),
      gender: 'female',
      idCard: 'MARRIED123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Married',
      department: department._id,
      position: position._id,
      qualification: 'MBA',
      bankName: bank._id,
      spouseName: 'John Doe', // Required for married
      appointmentDate: new Date('2024-02-15'),
      probationPeriodMonths: 3,
      endOfProbationDate: new Date('2024-05-15'),
      hireDate: new Date('2024-02-15'),
      salary: 60000,
      address: {
        street: '456 Test Ave',
        city: department._id,
        state: department._id,
        country: department._id
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567891'
      }
      // No oldDesignation field (optional)
    };

    const marriedEmp = new Employee(marriedEmployee);
    await marriedEmp.save();
    console.log('✅ Married employee created successfully!');
    console.log('   Marital Status:', marriedEmp.maritalStatus);
    console.log('   Spouse Name:', marriedEmp.spouseName);
    console.log('   Old Designation:', marriedEmp.oldDesignation || 'Not set');

    // Test 3: Employee with old designation (optional field)
    console.log('\n📝 Test 3: Creating employee with old designation...');
    const employeeWithOldDesignation = {
      firstName: 'OldDesignation',
      lastName: 'Employee',
      email: 'olddesignation.employee@example.com',
      phone: '+1234567892',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'male',
      idCard: 'OLD123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Divorced',
      department: department._id,
      position: position._id,
      qualification: 'PhD',
      bankName: bank._id,
      // No spouseName field (not married)
      appointmentDate: new Date('2024-03-15'),
      probationPeriodMonths: 0,
      endOfProbationDate: new Date('2024-03-15'),
      hireDate: new Date('2024-03-15'),
      salary: 70000,
      oldDesignation: position._id, // Optional field set
      address: {
        street: '789 Test Blvd',
        city: department._id,
        state: department._id,
        country: department._id
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Sibling',
        phone: '+1234567892'
      }
    };

    const oldDesignationEmp = new Employee(employeeWithOldDesignation);
    await oldDesignationEmp.save();
    console.log('✅ Employee with old designation created successfully!');
    console.log('   Marital Status:', oldDesignationEmp.maritalStatus);
    console.log('   Spouse Name:', oldDesignationEmp.spouseName || 'Not set');
    console.log('   Old Designation:', oldDesignationEmp.oldDesignation);

    // Test 4: Update marital status (should clear spouse name)
    console.log('\n📝 Test 4: Testing marital status change...');
    await Employee.findByIdAndUpdate(marriedEmp._id, {
      maritalStatus: 'Divorced'
    });

    const updatedEmployee = await Employee.findById(marriedEmp._id);
    console.log('✅ Marital status updated successfully!');
    console.log('   New Marital Status:', updatedEmployee.maritalStatus);
    console.log('   Spouse Name (should be cleared):', updatedEmployee.spouseName || 'Cleared');

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(singleEmp._id);
    await Employee.findByIdAndDelete(marriedEmp._id);
    await Employee.findByIdAndDelete(oldDesignationEmp._id);
    console.log('✅ Test employees cleaned up');

    console.log('\n🎉 Conditional fields test successful!');

  } catch (error) {
    console.error('❌ Error during conditional fields test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testConditionalFields(); 