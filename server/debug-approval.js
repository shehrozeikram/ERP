const mongoose = require('mongoose');
require('./models/hr/CandidateApproval');
require('./models/hr/JobPosting');

async function debugApproval() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const CandidateApproval = mongoose.model('CandidateApproval');
    const JobPosting = mongoose.model('JobPosting');
    
    console.log('1. Raw approval without populate:');
    const rawApproval = await CandidateApproval.findById('688b8b4b4ff5ba987b3b9b60');
    console.log('Raw approval jobPosting field:', rawApproval.jobPosting);
    console.log('Type:', typeof rawApproval.jobPosting);
    
    console.log('\n2. Approval with populate:');
    const approvalWithJob = await CandidateApproval.findById('688b8b4b4ff5ba987b3b9b60').populate('jobPosting');
    console.log('Populated approval jobPosting field:', approvalWithJob.jobPosting);
    console.log('Type:', typeof approvalWithJob.jobPosting);
    
    if (approvalWithJob.jobPosting) {
      console.log('Job posting title:', approvalWithJob.jobPosting.title);
      console.log('Job posting ID:', approvalWithJob.jobPosting._id);
    } else {
      console.log('❌ Job posting is null/undefined after populate');
    }
    
    console.log('\n3. Check if job posting exists:');
    const jobPosting = await JobPosting.findById('688a0e15e1a3b69572795558');
    if (jobPosting) {
      console.log('✅ Job posting found:', jobPosting.title);
    } else {
      console.log('❌ Job posting not found');
    }
    
    console.log('\n4. Check approval schema:');
    console.log('Approval schema fields:', Object.keys(CandidateApproval.schema.paths));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

debugApproval();
