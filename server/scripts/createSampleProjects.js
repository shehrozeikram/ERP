const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Project = require('../models/hr/Project');
const PlacementCompany = require('../models/hr/Company');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function createSampleProjects() {
  try {
    console.log('\n📋 Creating Sample Projects...\n');

    // Get existing companies
    const companies = await PlacementCompany.find({ isActive: true });
    if (companies.length === 0) {
      console.log('❌ No companies found. Please run createSampleCompanies.js first.');
      return;
    }

    // Clear existing projects
    await Project.deleteMany({});
    console.log('🧹 Cleared existing projects');

    const sampleProjects = [
      {
        name: 'ERP System Development',
        code: 'ERP001',
        company: companies[0]._id, // TechCorp Solutions
        description: 'Complete ERP system development for enterprise management',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-12-31'),
        status: 'Active',
        budget: 5000000
      },
      {
        name: 'Mobile App Development',
        code: 'MOB002',
        company: companies[2]._id, // Digital Innovations
        description: 'Cross-platform mobile application development',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-08-31'),
        status: 'Active',
        budget: 2500000
      },
      {
        name: 'Cloud Migration',
        code: 'CLOUD003',
        company: companies[1]._id, // Global Industries Ltd
        description: 'Legacy system migration to cloud infrastructure',
        startDate: new Date('2024-02-01'),
        status: 'Planning',
        budget: 3000000
      },
      {
        name: 'Data Analytics Platform',
        code: 'DATA004',
        company: companies[4]._id, // Future Systems
        description: 'Big data analytics and reporting platform',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-10-31'),
        status: 'Active',
        budget: 1800000
      },
      {
        name: 'Security Audit',
        code: 'SEC005',
        company: companies[3]._id, // SGC Enterprise
        description: 'Comprehensive security audit and compliance review',
        startDate: new Date('2024-05-01'),
        endDate: new Date('2024-07-31'),
        status: 'On Hold',
        budget: 800000
      }
    ];

    // Create new projects
    const createdProjects = await Project.insertMany(sampleProjects);
    
    console.log(`✅ Created ${createdProjects.length} projects:`);
    
    // Populate company info for display
    const populatedProjects = await Project.find({})
      .populate('company', 'name code')
      .sort({ name: 1 });
    
    populatedProjects.forEach(project => {
      console.log(`   📋 ${project.name} (${project.code}) - ${project.company.name} - ${project.status}`);
    });

    console.log('\n🎉 Sample projects created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample projects:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleProjects(); 