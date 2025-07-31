const mongoose = require('mongoose');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function findValidIds() {
  try {
    console.log('🔍 Finding valid Job Postings...');
    
    const jobPostings = await JobPosting.find().limit(5);
    
    if (jobPostings.length === 0) {
      console.log('❌ No job postings found. Creating a sample job posting...');
      
      // Create a sample job posting
      const sampleJobPosting = new JobPosting({
        title: 'Software Developer',
        department: 'IT',
        description: 'We are looking for a skilled software developer...',
        requirements: ['JavaScript', 'Node.js', 'React'],
        salary: 50000,
        location: 'Karachi',
        type: 'Full-time',
        status: 'active',
        createdBy: '6884f7fc1010ce455f3797e0'
      });
      
      await sampleJobPosting.save();
      console.log('✅ Created sample job posting');
      
      jobPostings.push(sampleJobPosting);
    }
    
    console.log(`✅ Found ${jobPostings.length} job posting(s):`);
    jobPostings.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.title} (ID: ${job._id})`);
    });
    
    console.log('\n🔍 Finding valid Applications...');
    
    const applications = await Application.find().limit(5);
    
    if (applications.length === 0) {
      console.log('❌ No applications found. Creating a sample application...');
      
      // Create a sample application
      const sampleApplication = new Application({
        candidate: '688b50564f6b7396ff24352f', // Sarah Ahmed's ID
        jobPosting: jobPostings[0]._id,
        applicationId: 'APP-2024-001',
        status: 'active',
        coverLetter: 'I am excited to apply for this position...',
        resume: 'resume.pdf',
        createdBy: '6884f7fc1010ce455f3797e0'
      });
      
      await sampleApplication.save();
      console.log('✅ Created sample application');
      
      applications.push(sampleApplication);
    }
    
    console.log(`✅ Found ${applications.length} application(s):`);
    applications.forEach((app, index) => {
      console.log(`   ${index + 1}. ${app.applicationId} (ID: ${app._id})`);
    });
    
    console.log('\n📝 Valid IDs for frontend:');
    console.log(`   Job Posting ID: ${jobPostings[0]._id}`);
    console.log(`   Application ID: ${applications[0]._id}`);
    
    console.log('\n🔧 Update the frontend Candidates.js file with these IDs:');
    console.log(`   Replace 'default-job-posting-id' with: '${jobPostings[0]._id}'`);
    console.log(`   Replace 'default-application-id' with: '${applications[0]._id}'`);
    
  } catch (error) {
    console.error('❌ Error finding valid IDs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
findValidIds(); 