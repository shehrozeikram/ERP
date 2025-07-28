const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Employee = require('../models/hr/Employee');
const PlacementCompany = require('../models/hr/Company');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');
const Section = require('../models/hr/Section');
const Designation = require('../models/hr/Designation');
const Location = require('../models/hr/Location');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testCompletePlacement() {
  try {
    console.log('\n🧪 Testing Complete Placement Functionality...\n');

    // Get sample data
    const company = await PlacementCompany.findOne({ isActive: true });
    const project = await Project.findOne({ isActive: true });
    const department = await Department.findOne({ isActive: true });
    const section = await Section.findOne({ isActive: true });
    const designation = await Designation.findOne({ isActive: true });
    const location = await Location.findOne({ isActive: true });

    if (!company || !project || !department || !section || !designation || !location) {
      console.log('❌ Missing required data. Please run all sample data scripts first.');
      return;
    }

    console.log('📋 Using sample data:');
    console.log(`   Company: ${company.name}`);
    console.log(`   Project: ${project.name}`);
    console.log(`   Department: ${department.name}`);
    console.log(`   Section: ${section.name}`);
    console.log(`   Designation: ${designation.title}`);
    console.log(`   Location: ${location.name}`);

    // Create test employee with placement data
    const testEmployee = {
      firstName: 'Placement',
      lastName: 'Test',
      email: 'placement.test@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'PLACEMENT123',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: department._id,
      position: designation._id, // Using designation as position
      qualification: 'BSc Computer Science',
      bankName: designation._id, // Using designation as bank for test
      spouseName: 'Test Spouse',
      appointmentDate: new Date('2024-01-15'),
      probationPeriodMonths: 6,
      endOfProbationDate: new Date('2024-07-15'), // 6 months from appointment
      hireDate: new Date('2024-01-15'),
      salary: 80000,
      // Placement fields
      placementCompany: company._id,
      placementProject: project._id,
      placementDepartment: department._id,
      placementSection: section._id,
      placementDesignation: designation._id,
      oldDesignation: designation._id, // Same for test
      placementLocation: location._id,
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

    console.log('\n📝 Creating test employee with placement data...');
    const employee = new Employee(testEmployee);
    await employee.save();

    console.log('✅ Test employee created successfully!');
    console.log('Employee ID:', employee._id);
    console.log('Employee Name:', employee.firstName, employee.lastName);

    // Test populated employee data
    console.log('\n🔍 Testing populated placement data...');
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('placementCompany', 'name code type')
      .populate('placementProject', 'name code status')
      .populate('placementDepartment', 'name code')
      .populate('placementSection', 'name code')
      .populate('placementDesignation', 'title level')
      .populate('oldDesignation', 'title level')
      .populate('placementLocation', 'name type');

    console.log('✅ Placement data populated:');
    console.log(`   Company: ${populatedEmployee.placementCompany?.name} (${populatedEmployee.placementCompany?.type})`);
    console.log(`   Project: ${populatedEmployee.placementProject?.name} - ${populatedEmployee.placementProject?.status}`);
    console.log(`   Department: ${populatedEmployee.placementDepartment?.name}`);
    console.log(`   Section: ${populatedEmployee.placementSection?.name}`);
    console.log(`   Designation: ${populatedEmployee.placementDesignation?.title} - ${populatedEmployee.placementDesignation?.level}`);
    console.log(`   Old Designation: ${populatedEmployee.oldDesignation?.title} - ${populatedEmployee.oldDesignation?.level}`);
    console.log(`   Location: ${populatedEmployee.placementLocation?.name} (${populatedEmployee.placementLocation?.type})`);

    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    const searchResults = await Employee.find({
      $or: [
        { 'placementCompany.name': { $regex: company.name, $options: 'i' } },
        { 'placementProject.name': { $regex: project.name, $options: 'i' } },
        { 'placementDepartment.name': { $regex: department.name, $options: 'i' } },
        { 'placementSection.name': { $regex: section.name, $options: 'i' } },
        { 'placementDesignation.title': { $regex: designation.title, $options: 'i' } },
        { 'placementLocation.name': { $regex: location.name, $options: 'i' } }
      ]
    }).populate('placementCompany placementProject placementDepartment placementSection placementDesignation placementLocation');

    console.log(`✅ Search found ${searchResults.length} employees with placement data`);

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(employee._id);
    console.log('✅ Test employee cleaned up');

    console.log('\n🎉 Complete placement functionality test successful!');

  } catch (error) {
    console.error('❌ Error during complete placement test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testCompletePlacement(); 