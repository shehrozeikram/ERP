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

async function testNextEmployeeId() {
  try {
    console.log('\n🧪 Testing Next Employee ID Functionality...\n');

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

    // Check current employees
    const currentEmployees = await Employee.find({}, { employeeId: 1 }).sort({ employeeId: -1 });
    console.log(`\n📊 Current employees in database: ${currentEmployees.length}`);
    
    if (currentEmployees.length > 0) {
      console.log('📋 Existing Employee IDs:');
      currentEmployees.slice(0, 5).forEach(emp => {
        console.log(`   - ${emp.employeeId}`);
      });
    }

    // Simulate the next ID calculation
    let nextId = '1';
    if (currentEmployees.length > 0) {
      const lastEmployee = currentEmployees[0];
      if (lastEmployee.employeeId) {
        const lastNumber = parseInt(lastEmployee.employeeId);
        const nextNumber = lastNumber + 1;
        nextId = nextNumber.toString();
      }
    }

    console.log(`\n🔢 Next Employee ID would be: ${nextId}`);

    // Create a test employee to verify the auto-generation
    const testEmployee = {
      firstName: 'NextID',
      lastName: 'Test',
      email: 'nextid.test@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'NEXTID123',
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

    console.log('\n📝 Creating test employee...');
    const employee = new Employee(testEmployee);
    await employee.save();

    console.log('✅ Test employee created successfully!');
    console.log('Employee ID:', employee.employeeId);
    console.log('Employee Name:', employee.firstName, employee.lastName);

    // Check what the next ID would be after creating this employee
    const updatedEmployees = await Employee.find({}, { employeeId: 1 }).sort({ employeeId: -1 });
    const lastEmployeeAfter = updatedEmployees[0];
    
    if (lastEmployeeAfter.employeeId) {
      const lastNumberAfter = parseInt(lastEmployeeAfter.employeeId);
      const nextNumberAfter = lastNumberAfter + 1;
      const nextIdAfter = nextNumberAfter.toString();
      
      console.log(`\n🔢 Next Employee ID after creation: ${nextIdAfter}`);
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(employee._id);
    console.log('✅ Test employee cleaned up');

    console.log('\n🎉 Next Employee ID functionality test successful!');

  } catch (error) {
    console.error('❌ Error during next employee ID test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testNextEmployeeId(); 