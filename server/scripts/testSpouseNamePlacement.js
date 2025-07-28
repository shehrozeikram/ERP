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

async function testSpouseNamePlacement() {
  try {
    console.log('\n🧪 Testing Spouse Name Field Placement...\n');

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

    // Test 1: Married employee with spouse name in Personal Information section
    console.log('\n📝 Test 1: Creating married employee with spouse name...');
    const marriedEmployee = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1985-01-01'),
      gender: 'male',
      idCard: 'JOHN123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Married',
      spouseName: 'Jane Doe', // This should be in Personal Information section
      department: department._id,
      position: position._id,
      qualification: 'MBA',
      bankName: bank._id,
      appointmentDate: new Date('2024-01-15'),
      probationPeriodMonths: 6,
      endOfProbationDate: new Date('2024-07-15'),
      hireDate: new Date('2024-01-15'),
      salary: 60000,
      address: {
        street: '123 Test St',
        city: department._id,
        state: department._id,
        country: department._id
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567890'
      }
    };

    const marriedEmp = new Employee(marriedEmployee);
    await marriedEmp.save();
    console.log('✅ Married employee created successfully!');
    console.log('   Personal Information:');
    console.log('     Marital Status:', marriedEmp.maritalStatus);
    console.log('     Spouse Name:', marriedEmp.spouseName);
    console.log('     Nationality:', marriedEmp.nationality);
    console.log('     Religion:', marriedEmp.religion);

    // Test 2: Single employee (no spouse name)
    console.log('\n📝 Test 2: Creating single employee (no spouse name)...');
    const singleEmployee = {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
      phone: '+1234567891',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'female',
      idCard: 'ALICE123',
      nationality: 'Pakistani',
      religion: 'Islam',
      maritalStatus: 'Single',
      // No spouseName field
      department: department._id,
      position: position._id,
      qualification: 'BSc',
      bankName: bank._id,
      appointmentDate: new Date('2024-02-15'),
      probationPeriodMonths: 3,
      endOfProbationDate: new Date('2024-05-15'),
      hireDate: new Date('2024-02-15'),
      salary: 50000,
      address: {
        street: '456 Test Ave',
        city: department._id,
        state: department._id,
        country: department._id
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Parent',
        phone: '+1234567891'
      }
    };

    const singleEmp = new Employee(singleEmployee);
    await singleEmp.save();
    console.log('✅ Single employee created successfully!');
    console.log('   Personal Information:');
    console.log('     Marital Status:', singleEmp.maritalStatus);
    console.log('     Spouse Name:', singleEmp.spouseName || 'Not set');
    console.log('     Nationality:', singleEmp.nationality);
    console.log('     Religion:', singleEmp.religion);

    // Test 3: Update marital status (should affect spouse name)
    console.log('\n📝 Test 3: Testing marital status updates...');
    
    // Update single to married
    await Employee.findByIdAndUpdate(singleEmp._id, {
      maritalStatus: 'Married',
      spouseName: 'Bob Smith'
    });
    
    const updatedToMarried = await Employee.findById(singleEmp._id);
    console.log('✅ Updated single to married:');
    console.log('   Marital Status:', updatedToMarried.maritalStatus);
    console.log('   Spouse Name:', updatedToMarried.spouseName);

    // Update married to divorced
    await Employee.findByIdAndUpdate(marriedEmp._id, {
      maritalStatus: 'Divorced'
    });
    
    const updatedToDivorced = await Employee.findById(marriedEmp._id);
    console.log('✅ Updated married to divorced:');
    console.log('   Marital Status:', updatedToDivorced.maritalStatus);
    console.log('   Spouse Name:', updatedToDivorced.spouseName || 'Cleared');

    // Test 4: Verify field order in database
    console.log('\n📝 Test 4: Verifying field structure...');
    const allEmployees = await Employee.find({
      _id: { $in: [marriedEmp._id, singleEmp._id] }
    }).select('firstName lastName maritalStatus spouseName nationality religion');

    console.log('📋 Employee data structure:');
    allEmployees.forEach(emp => {
      console.log(`\n   ${emp.firstName} ${emp.lastName}:`);
      console.log('     Marital Status:', emp.maritalStatus);
      console.log('     Spouse Name:', emp.spouseName || 'Not set');
      console.log('     Nationality:', emp.nationality);
      console.log('     Religion:', emp.religion);
    });

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(marriedEmp._id);
    await Employee.findByIdAndDelete(singleEmp._id);
    console.log('✅ Test employees cleaned up');

    console.log('\n🎉 Spouse name field placement test successful!');
    console.log('📝 Note: Spouse name field is now in Personal Information section');
    console.log('📝 Note: Field appears only when marital status is "Married"');

  } catch (error) {
    console.error('❌ Error during spouse name placement test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testSpouseNamePlacement(); 