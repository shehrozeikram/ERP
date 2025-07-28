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

async function testOldDesignationFix() {
  try {
    console.log('\n🧪 Testing Old Designation Field Fix...\n');

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

    // Test 1: Employee without oldDesignation (empty string)
    console.log('\n📝 Test 1: Creating employee without oldDesignation...');
    const employeeWithoutOldDesignation = {
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test.employee@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'TEST123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: department._id,
      position: position._id,
      qualification: 'BSc',
      bankName: bank._id,
      appointmentDate: new Date('2024-01-15'),
      probationPeriodMonths: 6,
      endOfProbationDate: new Date('2024-07-15'),
      hireDate: new Date('2024-01-15'),
      salary: 50000,
      // oldDesignation: '' // This should be handled properly
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
    };

    const emp1 = new Employee(employeeWithoutOldDesignation);
    await emp1.save();
    console.log('✅ Employee without oldDesignation created successfully!');
    console.log('   Old Designation:', emp1.oldDesignation || 'Not set');

    // Test 2: Employee with oldDesignation
    console.log('\n📝 Test 2: Creating employee with oldDesignation...');
    const employeeWithOldDesignation = {
      firstName: 'Test2',
      lastName: 'Employee',
      email: 'test2.employee@example.com',
      phone: '+1234567891',
      dateOfBirth: new Date('1985-01-01'),
      gender: 'female',
      idCard: 'TEST2123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Married',
      spouseName: 'Spouse Name',
      department: department._id,
      position: position._id,
      qualification: 'MBA',
      bankName: bank._id,
      appointmentDate: new Date('2024-02-15'),
      probationPeriodMonths: 3,
      endOfProbationDate: new Date('2024-05-15'),
      hireDate: new Date('2024-02-15'),
      salary: 60000,
      oldDesignation: position._id, // Set oldDesignation
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
    };

    const emp2 = new Employee(employeeWithOldDesignation);
    await emp2.save();
    console.log('✅ Employee with oldDesignation created successfully!');
    console.log('   Old Designation:', emp2.oldDesignation);

    // Test 3: Employee with undefined oldDesignation
    console.log('\n📝 Test 3: Creating employee with undefined oldDesignation...');
    const employeeWithUndefinedOldDesignation = {
      firstName: 'Test3',
      lastName: 'Employee',
      email: 'test3.employee@example.com',
      phone: '+1234567892',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'male',
      idCard: 'TEST3123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Divorced',
      department: department._id,
      position: position._id,
      qualification: 'PhD',
      bankName: bank._id,
      appointmentDate: new Date('2024-03-15'),
      probationPeriodMonths: 0,
      endOfProbationDate: new Date('2024-03-15'),
      hireDate: new Date('2024-03-15'),
      salary: 70000,
      oldDesignation: undefined, // Explicitly undefined
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

    const emp3 = new Employee(employeeWithUndefinedOldDesignation);
    await emp3.save();
    console.log('✅ Employee with undefined oldDesignation created successfully!');
    console.log('   Old Designation:', emp3.oldDesignation || 'Not set');

    // Test 4: Update employee to add oldDesignation
    console.log('\n📝 Test 4: Testing update to add oldDesignation...');
    await Employee.findByIdAndUpdate(emp1._id, {
      oldDesignation: position._id
    });
    
    const updatedEmp1 = await Employee.findById(emp1._id);
    console.log('✅ Employee updated with oldDesignation successfully!');
    console.log('   Old Designation:', updatedEmp1.oldDesignation);

    // Test 5: Update employee to remove oldDesignation
    console.log('\n📝 Test 5: Testing update to remove oldDesignation...');
    await Employee.findByIdAndUpdate(emp2._id, {
      $unset: { oldDesignation: 1 }
    });
    
    const updatedEmp2 = await Employee.findById(emp2._id);
    console.log('✅ Employee updated to remove oldDesignation successfully!');
    console.log('   Old Designation:', updatedEmp2.oldDesignation || 'Removed');

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(emp1._id);
    await Employee.findByIdAndDelete(emp2._id);
    await Employee.findByIdAndDelete(emp3._id);
    console.log('✅ Test employees cleaned up');

    console.log('\n🎉 Old designation field fix test successful!');
    console.log('📝 Note: Empty string and undefined oldDesignation values are now handled properly');

  } catch (error) {
    console.error('❌ Error during old designation fix test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testOldDesignationFix(); 