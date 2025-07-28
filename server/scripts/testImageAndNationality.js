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

async function testImageAndNationality() {
  try {
    console.log('\n🧪 Testing Image and Nationality Fields...\n');

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

    // Test employee with new fields
    const testEmployee = {
      firstName: 'ImageTest',
      lastName: 'User',
      email: 'imagetest.user@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'IMAGETEST123',
      nationality: 'Pakistani',
      profileImage: '/uploads/profile-images/test-profile.jpg',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: department._id,
      position: position._id,
      qualification: 'BSc',
      bankName: bank._id,
      spouseName: 'Test Spouse',
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

    console.log('\n📝 Creating test employee with new fields...');
    const employee = new Employee(testEmployee);
    await employee.save();

    console.log('✅ Test employee created successfully!');
    console.log('Employee ID:', employee.employeeId);
    console.log('Employee Name:', employee.firstName, employee.lastName);
    console.log('Nationality:', employee.nationality);
    console.log('Profile Image:', employee.profileImage);

    // Verify the fields were saved correctly
    const savedEmployee = await Employee.findById(employee._id);
    console.log('\n🔍 Verifying saved data:');
    console.log('   Nationality:', savedEmployee.nationality);
    console.log('   Profile Image:', savedEmployee.profileImage);

    // Test updating the fields
    console.log('\n📝 Testing field updates...');
    await Employee.findByIdAndUpdate(employee._id, {
      nationality: 'American',
      profileImage: '/uploads/profile-images/updated-profile.jpg'
    });

    const updatedEmployee = await Employee.findById(employee._id);
    console.log('✅ Fields updated successfully!');
    console.log('   Updated Nationality:', updatedEmployee.nationality);
    console.log('   Updated Profile Image:', updatedEmployee.profileImage);

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(employee._id);
    console.log('✅ Test employee cleaned up');

    console.log('\n🎉 Image and Nationality fields test successful!');

  } catch (error) {
    console.error('❌ Error during image and nationality test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testImageAndNationality(); 