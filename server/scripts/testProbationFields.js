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

async function testProbationFields() {
  try {
    console.log('\n🧪 Testing Probation Fields...\n');

    // Get required data
    const department = await Department.findOne({ isActive: true });
    const position = await Position.findOne({ isActive: true });
    const bank = await Bank.findOne({ isActive: true });

    if (!department || !position || !bank) {
      console.log('❌ Missing required data. Please ensure departments, positions, and banks exist.');
      return;
    }

    console.log(`📋 Using department: ${department.name}`);
    console.log(`📋 Using position: ${position.title}`);
    console.log(`📋 Using bank: ${bank.name}`);

    // Test employee data with probation fields
    const appointmentDate = new Date('2024-01-15');
    const probationPeriodMonths = 6;
    const endOfProbationDate = new Date(appointmentDate);
    endOfProbationDate.setMonth(endOfProbationDate.getMonth() + probationPeriodMonths);

    const testEmployee = {
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test.employee@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'TEST123456',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: department._id,
      position: position._id,
      qualification: 'BSc',
      bankName: bank._id,
      spouseName: 'Test Spouse',
      appointmentDate: appointmentDate,
      probationPeriodMonths: probationPeriodMonths,
      endOfProbationDate: endOfProbationDate,
      hireDate: new Date('2024-01-15'),
      salary: 50000,
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Pakistan'
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567890'
      }
    };

    console.log('📝 Creating test employee with probation fields...');
    console.log('Appointment Date:', appointmentDate.toDateString());
    console.log('Probation Period:', probationPeriodMonths, 'months');
    console.log('End of Probation:', endOfProbationDate.toDateString());

    // Create the employee
    const employee = new Employee(testEmployee);
    await employee.save();

    console.log('✅ Test employee created successfully!');
    console.log('Employee ID:', employee._id);
    console.log('Employee Name:', employee.firstName, employee.lastName);
    console.log('Appointment Date:', employee.appointmentDate.toDateString());
    console.log('Probation Period:', employee.probationPeriodMonths, 'months');
    console.log('End of Probation:', employee.endOfProbationDate.toDateString());

    // Test the auto-calculation by updating probation period
    console.log('\n🔄 Testing auto-calculation...');
    employee.probationPeriodMonths = 3;
    await employee.save();

    console.log('Updated Probation Period:', employee.probationPeriodMonths, 'months');
    console.log('Recalculated End of Probation:', employee.endOfProbationDate.toDateString());

    // Clean up - delete the test employee
    await Employee.findByIdAndDelete(employee._id);
    console.log('🧹 Test employee cleaned up');

    console.log('\n🎉 Probation fields test completed successfully!');

  } catch (error) {
    console.error('❌ Error during probation fields test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testProbationFields(); 