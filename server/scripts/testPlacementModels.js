const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const PlacementCompany = require('../models/hr/Company');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');
const Section = require('../models/hr/Section');
const Designation = require('../models/hr/Designation');
const Location = require('../models/hr/Location');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testPlacementModels() {
  try {
    console.log('\n🧪 Testing Placement Models...\n');

    // Test 1: Create a company
    console.log('📋 Creating test company...');
    const company = new PlacementCompany({
      name: 'Test Company',
      code: 'TEST001',
      type: 'Client',
      industry: 'Technology',
      website: 'https://testcompany.com',
      contactInfo: {
        phone: '+92-21-1234567',
        email: 'info@testcompany.com',
        address: 'Karachi, Pakistan'
      }
    });
    await company.save();
    console.log('✅ Company created:', company.name);

    // Test 2: Create a department
    console.log('📋 Creating test department...');
    const department = new Department({
      name: 'Test Department',
      code: 'TD001',
      description: 'Test department for placement testing'
    });
    await department.save();
    console.log('✅ Department created:', department.name);

    // Test 3: Create a project
    console.log('📋 Creating test project...');
    const project = new Project({
      name: 'Test Project',
      code: 'TP001',
      company: company._id,
      description: 'Test project for placement testing',
      startDate: new Date(),
      status: 'Active'
    });
    await project.save();
    console.log('✅ Project created:', project.name);

    // Test 4: Create a section
    console.log('📋 Creating test section...');
    const section = new Section({
      name: 'Test Section',
      code: 'TS001',
      department: department._id,
      description: 'Test section for placement testing'
    });
    await section.save();
    console.log('✅ Section created:', section.name);

    // Test 5: Create a designation
    console.log('📋 Creating test designation...');
    const designation = new Designation({
      title: 'Test Designation',
      code: 'TDES001',
      department: department._id,
      section: section._id,
      description: 'Test designation for placement testing',
      level: 'Mid'
    });
    await designation.save();
    console.log('✅ Designation created:', designation.title);

    // Test 6: Create a location
    console.log('📋 Creating test location...');
    const location = new Location({
      name: 'Test Location',
      code: 'TL001',
      type: 'Office',
      address: {
        street: '123 Test Street',
        city: 'Karachi',
        state: 'Sindh',
        zipCode: '75000',
        country: 'Pakistan'
      }
    });
    await location.save();
    console.log('✅ Location created:', location.name);

    // Test 7: Verify relationships
    console.log('\n🔍 Testing relationships...');
    
    const populatedProject = await Project.findById(project._id).populate('company');
    console.log('✅ Project with company:', populatedProject.name, '-', populatedProject.company.name);

    const populatedSection = await Section.findById(section._id).populate('department');
    console.log('✅ Section with department:', populatedSection.name, '-', populatedSection.department.name);

    const populatedDesignation = await Designation.findById(designation._id)
      .populate('department')
      .populate('section');
    console.log('✅ Designation with dept & section:', populatedDesignation.title, '-', populatedDesignation.department.name, '-', populatedDesignation.section.name);

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await PlacementCompany.findByIdAndDelete(company._id);
    await Department.findByIdAndDelete(department._id);
    await Project.findByIdAndDelete(project._id);
    await Section.findByIdAndDelete(section._id);
    await Designation.findByIdAndDelete(designation._id);
    await Location.findByIdAndDelete(location._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All placement models working correctly!');

  } catch (error) {
    console.error('❌ Error testing placement models:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testPlacementModels(); 