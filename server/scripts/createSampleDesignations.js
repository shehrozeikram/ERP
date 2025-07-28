const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Designation = require('../models/hr/Designation');
const Department = require('../models/hr/Department');
const Section = require('../models/hr/Section');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function createSampleDesignations() {
  try {
    console.log('\n📋 Creating Sample Designations...\n');

    // Get existing departments and sections
    const departments = await Department.find({ isActive: true });
    const sections = await Section.find({ isActive: true });
    
    if (departments.length === 0) {
      console.log('❌ No departments found. Please ensure departments exist.');
      return;
    }

    // Clear existing designations
    await Designation.deleteMany({});
    console.log('🧹 Cleared existing designations');

    const sampleDesignations = [
      // IT Department Designations
      {
        title: 'Software Engineer',
        code: 'SE001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Software Development')?._id,
        description: 'Core software development and programming',
        level: 'Mid',
        minSalary: 80000,
        maxSalary: 120000,
        requirements: ['Bachelor in Computer Science', '3+ years experience', 'JavaScript, Python, Java'],
        responsibilities: ['Develop software applications', 'Code review', 'Technical documentation']
      },
      {
        title: 'Senior Software Engineer',
        code: 'SSE001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Software Development')?._id,
        description: 'Senior level software development',
        level: 'Senior',
        minSalary: 120000,
        maxSalary: 180000,
        requirements: ['Bachelor in Computer Science', '5+ years experience', 'System design', 'Team leadership'],
        responsibilities: ['System architecture', 'Mentor junior developers', 'Technical decisions']
      },
      {
        title: 'QA Engineer',
        code: 'QA001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Quality Assurance')?._id,
        description: 'Quality assurance and testing',
        level: 'Mid',
        minSalary: 70000,
        maxSalary: 100000,
        requirements: ['Bachelor in Computer Science', '2+ years QA experience', 'Testing tools'],
        responsibilities: ['Test planning', 'Automated testing', 'Bug reporting']
      },
      {
        title: 'UI/UX Designer',
        code: 'UX001',
        department: departments.find(d => d.name === 'Information Technology')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'UI/UX Design')?._id,
        description: 'User interface and experience design',
        level: 'Mid',
        minSalary: 75000,
        maxSalary: 110000,
        requirements: ['Design degree', '3+ years experience', 'Figma, Sketch', 'User research'],
        responsibilities: ['Design interfaces', 'User research', 'Prototyping']
      },
      // HR Department Designations
      {
        title: 'HR Specialist',
        code: 'HRS001',
        department: departments.find(d => d.name === 'Human Resources')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Recruitment')?._id,
        description: 'Human resources and recruitment',
        level: 'Mid',
        minSalary: 60000,
        maxSalary: 90000,
        requirements: ['HR degree', '3+ years HR experience', 'Recruitment skills'],
        responsibilities: ['Recruitment', 'Employee relations', 'HR policies']
      },
      {
        title: 'HR Manager',
        code: 'HRM001',
        department: departments.find(d => d.name === 'Human Resources')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Training & Development')?._id,
        description: 'HR management and leadership',
        level: 'Manager',
        minSalary: 90000,
        maxSalary: 140000,
        requirements: ['HR degree', '5+ years HR experience', 'Management skills'],
        responsibilities: ['HR strategy', 'Team management', 'Policy development']
      },
      // Finance Department Designations
      {
        title: 'Financial Analyst',
        code: 'FA001',
        department: departments.find(d => d.name === 'Finance')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Financial Planning')?._id,
        description: 'Financial analysis and planning',
        level: 'Mid',
        minSalary: 70000,
        maxSalary: 100000,
        requirements: ['Finance degree', '3+ years experience', 'Excel, Financial modeling'],
        responsibilities: ['Financial analysis', 'Budgeting', 'Reporting']
      },
      {
        title: 'Accountant',
        code: 'ACC001',
        department: departments.find(d => d.name === 'Finance')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Accounting')?._id,
        description: 'General accounting and bookkeeping',
        level: 'Mid',
        minSalary: 55000,
        maxSalary: 80000,
        requirements: ['Accounting degree', '2+ years experience', 'QuickBooks, Excel'],
        responsibilities: ['Bookkeeping', 'Financial statements', 'Tax preparation']
      },
      // Sales Department Designations
      {
        title: 'Sales Representative',
        code: 'SR001',
        department: departments.find(d => d.name === 'Sales')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Sales Operations')?._id,
        description: 'Sales and business development',
        level: 'Entry',
        minSalary: 45000,
        maxSalary: 70000,
        requirements: ['Business degree', '1+ years sales experience', 'Communication skills'],
        responsibilities: ['Lead generation', 'Sales presentations', 'Customer relationship']
      },
      {
        title: 'Account Manager',
        code: 'AM001',
        department: departments.find(d => d.name === 'Sales')?._id || departments[0]._id,
        section: sections.find(s => s.name === 'Customer Success')?._id,
        description: 'Customer account management',
        level: 'Mid',
        minSalary: 65000,
        maxSalary: 95000,
        requirements: ['Business degree', '3+ years experience', 'Customer service'],
        responsibilities: ['Account management', 'Customer success', 'Revenue growth']
      }
    ];

    // Create new designations
    const createdDesignations = await Designation.insertMany(sampleDesignations);
    
    console.log(`✅ Created ${createdDesignations.length} designations:`);
    
    // Populate department and section info for display
    const populatedDesignations = await Designation.find({})
      .populate('department', 'name code')
      .populate('section', 'name code')
      .sort({ title: 1 });
    
    populatedDesignations.forEach(designation => {
      const sectionInfo = designation.section ? ` - ${designation.section.name}` : '';
      console.log(`   📋 ${designation.title} (${designation.code}) - ${designation.department.name}${sectionInfo} - ${designation.level}`);
    });

    console.log('\n🎉 Sample designations created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample designations:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleDesignations(); 