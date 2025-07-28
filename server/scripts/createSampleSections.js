const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Section = require('../models/hr/Section');
const Department = require('../models/hr/Department');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function createSampleSections() {
  try {
    console.log('\n📋 Creating Sample Sections...\n');

    // Get existing departments
    const departments = await Department.find({ isActive: true });
    if (departments.length === 0) {
      console.log('❌ No departments found. Please ensure departments exist.');
      return;
    }

    // Clear existing sections
    await Section.deleteMany({});
    console.log('🧹 Cleared existing sections');

    const sampleSections = [
      {
        name: 'Software Development',
        code: 'SD001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        description: 'Core software development and programming section'
      },
      {
        name: 'Quality Assurance',
        code: 'QA001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        description: 'Testing and quality assurance section'
      },
      {
        name: 'UI/UX Design',
        code: 'UX001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        description: 'User interface and user experience design section'
      },
      {
        name: 'Recruitment',
        code: 'REC001',
        department: departments.find(d => d.name === 'Human Resources')?._id || departments[0]._id,
        description: 'Employee recruitment and hiring section'
      },
      {
        name: 'Training & Development',
        code: 'TD001',
        department: departments.find(d => d.name === 'Human Resources')?._id || departments[0]._id,
        description: 'Employee training and professional development section'
      },
      {
        name: 'Payroll',
        code: 'PAY001',
        department: departments.find(d => d.name === 'Human Resources')?._id || departments[0]._id,
        description: 'Payroll processing and compensation section'
      },
      {
        name: 'Financial Planning',
        code: 'FP001',
        department: departments.find(d => d.name === 'Finance')?._id || departments[0]._id,
        description: 'Financial planning and analysis section'
      },
      {
        name: 'Accounting',
        code: 'ACC001',
        department: departments.find(d => d.name === 'Finance')?._id || departments[0]._id,
        description: 'General accounting and bookkeeping section'
      },
      {
        name: 'Sales Operations',
        code: 'SO001',
        department: departments.find(d => d.name === 'Sales')?._id || departments[0]._id,
        description: 'Sales operations and support section'
      },
      {
        name: 'Customer Success',
        code: 'CS001',
        department: departments.find(d => d.name === 'Sales')?._id || departments[0]._id,
        description: 'Customer success and account management section'
      }
    ];

    // Create new sections
    const createdSections = await Section.insertMany(sampleSections);
    
    console.log(`✅ Created ${createdSections.length} sections:`);
    
    // Populate department info for display
    const populatedSections = await Section.find({})
      .populate('department', 'name code')
      .sort({ name: 1 });
    
    populatedSections.forEach(section => {
      console.log(`   📋 ${section.name} (${section.code}) - ${section.department.name}`);
    });

    console.log('\n🎉 Sample sections created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample sections:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleSections(); 