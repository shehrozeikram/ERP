const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createTestEmployee = async () => {
  try {
    console.log('👤 Creating test employee...');

    // Check if test employee already exists
    const existingEmployee = await Employee.findOne({ email: 'test@sgc.com' });
    if (existingEmployee) {
      console.log('✅ Test employee already exists:', existingEmployee.employeeId);
      return existingEmployee;
    }

    const testEmployee = new Employee({
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test@sgc.com',
      phone: '1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: '12345-1234567-1',
      joiningDate: new Date('2024-01-01'),
      appointmentDate: new Date('2024-01-01'),
      probationPeriodMonths: 3,
      employmentStatus: 'Active',
      nationality: 'Pakistani',
      qualification: 'Bachelor',
      department: null, // Will be set later
      position: null, // Will be set later
      salary: {
        gross: 50000,
        basic: 33333,
        houseRent: 11667,
        medical: 5000
      },
      bankName: 'Test Bank',
      bankAccountNumber: '1234567890',
      address: {
        street: '123 Test Street',
        city: 'Karachi',
        state: 'Sindh',
        country: 'Pakistan'
      },
      emergencyContact: {
        name: 'Test Contact',
        phone: '0987654321',
        relationship: 'Father'
      },
      leaveBalance: {
        annual: {
          allocated: 14,
          used: 0,
          remaining: 14,
          carriedForward: 0
        },
        casual: {
          allocated: 10,
          used: 0,
          remaining: 10,
          carriedForward: 0
        },
        medical: {
          allocated: 8,
          used: 0,
          remaining: 8,
          carriedForward: 0
        },
        maternity: {
          allocated: 0,
          used: 0,
          remaining: 0
        },
        paternity: {
          allocated: 0,
          used: 0,
          remaining: 0
        }
      },
      isActive: true,
      isDeleted: false
    });

    await testEmployee.save();
    console.log('✅ Test employee created successfully:', testEmployee.employeeId);
    console.log('Employee ID:', testEmployee._id);
    
    return testEmployee;

  } catch (error) {
    console.error('❌ Error creating test employee:', error);
  } finally {
    mongoose.connection.close();
  }
};

createTestEmployee();