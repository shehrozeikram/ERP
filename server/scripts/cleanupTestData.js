require('dotenv').config();
const mongoose = require('mongoose');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
const Candidate = require('../models/hr/Candidate');

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');

    // Clean up test job postings
    const testJobPostings = await JobPosting.find({ title: { $regex: /Test$/ } });
    console.log(`📝 Found ${testJobPostings.length} test job postings to delete`);
    
    for (const jobPosting of testJobPostings) {
      // Delete related applications
      await Application.deleteMany({ jobPosting: jobPosting._id });
      console.log(`🗑️ Deleted applications for job: ${jobPosting.title}`);
    }
    
    await JobPosting.deleteMany({ title: { $regex: /Test$/ } });
    console.log('🗑️ Deleted test job postings');

    // Clean up test applications
    const testApplications = await Application.find({ 
      'personalInfo.email': 'john.doe@example.com' 
    });
    console.log(`📄 Found ${testApplications.length} test applications to delete`);
    await Application.deleteMany({ 'personalInfo.email': 'john.doe@example.com' });
    console.log('🗑️ Deleted test applications');

    // Clean up test candidates
    const testCandidates = await Candidate.find({ email: 'john.doe@example.com' });
    console.log(`👤 Found ${testCandidates.length} test candidates to delete`);
    await Candidate.deleteMany({ email: 'john.doe@example.com' });
    console.log('🗑️ Deleted test candidates');

    console.log('\n✅ Test data cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run cleanup
cleanupTestData(); 