const mongoose = require('mongoose');
require('./models/hr/CandidateApproval');

async function checkApproval() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const CandidateApproval = mongoose.model('CandidateApproval');
    
    const approval = await CandidateApproval.findById('688b8b4b4ff5ba987b3b9b60');
    
    if (approval) {
      console.log('Approval found:');
      console.log('ID:', approval._id);
      console.log('Status:', approval.status);
      console.log('Candidate:', approval.candidate);
      console.log('Job Posting:', approval.jobPosting);
      console.log('Full approval object:', JSON.stringify(approval, null, 2));
    } else {
      console.log('Approval not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkApproval();
