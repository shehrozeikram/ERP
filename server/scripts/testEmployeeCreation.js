const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');
require('dotenv').config();

const testEmployeeCreation = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create a test employee data
    const testEmployeeData = {
      firstName: 'Test',
      lastName: 'Employee',
      email: `test.employee.${Date.now()}@example.com`,
      phone: '+923001234567',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: '35202-1234567-1',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: '65f8a1b2c3d4e5f6a7b8c9d0', // You'll need to replace with actual department ID
      position: '65f8a1b2c3d4e5f6a7b8c9d1', // You'll need to replace with actual position ID
      qualification: 'Bachelor\'s Degree',
      bankName: '65f8a1b2c3d4e5f6a7b8c9d2', // You'll need to replace with actual bank ID
      appointmentDate: new Date('2024-01-01'),
      probationPeriodMonths: 3,
      hireDate: new Date('2024-01-01'),
      salary: {
        gross: 50000
      },
      address: {
        street: '123 Test Street',
        city: '65f8a1b2c3d4e5f6a7b8c9d3', // You'll need to replace with actual city ID
        state: '65f8a1b2c3d4e5f6a7b8c9d4', // You'll need to replace with actual state ID
        country: '65f8a1b2c3d4e5f6a7b8c9d5' // You'll need to replace with actual country ID
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Father',
        phone: '+923001234568'
      }
    };

    console.log('🧪 Test employee data:', testEmployeeData);

    // Try to create the employee
    const employee = new Employee(testEmployeeData);
    await employee.save();

    console.log('✅ Employee created successfully:', employee);

    // Clean up - delete the test employee
    await Employee.findByIdAndDelete(employee._id);
    console.log('🧹 Test employee deleted');

  } catch (error) {
    console.error('❌ Error creating test employee:', error);
    
    if (error.name === 'ValidationError') {
      console.error('📋 Validation errors:', error.errors);
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run test if called directly
if (require.main === module) {
  testEmployeeCreation();
}

module.exports = testEmployeeCreation; 