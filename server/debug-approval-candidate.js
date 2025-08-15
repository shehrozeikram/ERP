const mongoose = require('mongoose');
require('dotenv').config();

// Import models - ensure they are registered
require('./models/hr/CandidateApproval');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/Employee');
require('./models/hr/Candidate');
require('./models/hr/JobPosting');

// Now get the models
const EmployeeOnboarding = mongoose.model('EmployeeOnboarding');
const Employee = mongoose.model('Employee');
const CandidateApproval = mongoose.model('CandidateApproval');
const Candidate = mongoose.model('Candidate');
const JobPosting = mongoose.model('JobPosting');

async function debugApprovalCandidate() {
  try {
    console.log('🔍 Debugging Approval Candidate Link...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // 1. Check the specific approval that's missing candidate info
    console.log('📋 Step 1: Checking approval record...');
    const approvalId = '688b8b4b4ff5ba987b3b9b60';
    const approval = await CandidateApproval.findById(approvalId);
    
    if (!approval) {
      console.log('❌ Approval not found');
      return;
    }
    
    console.log('✅ Approval found:');
    console.log(`   - ID: ${approval._id}`);
    console.log(`   - Status: ${approval.status}`);
    console.log(`   - Candidate ID: ${approval.candidate}`);
    console.log(`   - Job Posting ID: ${approval.jobPosting}`);
    console.log(`   - Application ID: ${approval.application}`);
    console.log(`   - Created: ${approval.createdAt}`);
    
    // 2. Check if candidate exists
    if (approval.candidate) {
      console.log('\n👤 Step 2: Checking candidate record...');
      const candidate = await Candidate.findById(approval.candidate);
      
      if (candidate) {
        console.log('✅ Candidate found:');
        console.log(`   - ID: ${candidate._id}`);
        console.log(`   - Name: ${candidate.firstName} ${candidate.lastName}`);
        console.log(`   - Email: ${candidate.email}`);
        console.log(`   - Status: ${candidate.status}`);
      } else {
        console.log('❌ Candidate not found - this is the problem!');
      }
    } else {
      console.log('\n❌ Step 2: No candidate ID in approval - this is the problem!');
    }
    
    // 3. Check if we can find the candidate by other means
    console.log('\n🔍 Step 3: Trying to find candidate by other means...');
    
    // Check if there are any candidates in the system
    const allCandidates = await Candidate.find().limit(5);
    console.log(`Found ${allCandidates.length} candidates in the system`);
    
    if (allCandidates.length > 0) {
      allCandidates.forEach((candidate, index) => {
        console.log(`   ${index + 1}. ID: ${candidate._id}`);
        console.log(`      Name: ${candidate.firstName} ${candidate.lastName}`);
        console.log(`      Email: ${candidate.email}`);
        console.log(`      Status: ${candidate.status}`);
      });
    }
    
    // 4. Check if we can find the candidate by application
    if (approval.application) {
      console.log('\n📄 Step 4: Checking application record...');
      // You might need to import the Application model here
      console.log(`Application ID: ${approval.application}`);
      console.log('Note: Application model not imported, but this could help find the candidate');
    }
    
    // 5. Check if we can find the candidate by job posting
    if (approval.jobPosting) {
      console.log('\n💼 Step 5: Checking job posting...');
      const jobPosting = await JobPosting.findById(approval.jobPosting);
      
      if (jobPosting) {
        console.log('✅ Job posting found:');
        console.log(`   - ID: ${jobPosting._id}`);
        console.log(`   - Title: ${jobPosting.title}`);
        console.log(`   - Department: ${jobPosting.department}`);
      } else {
        console.log('❌ Job posting not found');
      }
    }
    
    // 6. Summary and suggestions
    console.log('\n📊 Step 6: Summary and Suggestions...');
    
    if (!approval.candidate) {
      console.log('❌ PROBLEM IDENTIFIED: Approval record is missing candidate ID');
      console.log('   This means the approval was created without properly linking the candidate');
      console.log('   Possible causes:');
      console.log('   1. Candidate record was deleted after approval creation');
      console.log('   2. Approval creation process had a bug');
      console.log('   3. Database corruption or migration issue');
      console.log('');
      console.log('   SOLUTIONS:');
      console.log('   1. Recreate the approval with proper candidate link');
      console.log('   2. Fix the approval creation process');
      console.log('   3. Manually link an existing candidate to this approval');
    } else if (approval.candidate) {
      const candidate = await Candidate.findById(approval.candidate);
      if (!candidate) {
        console.log('❌ PROBLEM IDENTIFIED: Candidate ID exists but candidate record is missing');
        console.log('   This means the candidate was deleted after approval creation');
        console.log('   SOLUTION: Recreate the candidate record or fix the approval');
      } else {
        console.log('✅ Everything looks good - candidate is properly linked');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the debug
debugApprovalCandidate();
