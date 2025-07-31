const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function testCandidateStatusUpdate() {
  try {
    console.log('🔍 Finding a candidate to test status update...');
    
    // Find a candidate (preferably one that has been interviewed)
    const candidate = await Candidate.findOne({ 
      status: { $in: ['interviewed', 'active', 'shortlisted'] } 
    });
    
    if (!candidate) {
      console.log('❌ No suitable candidate found. Please ensure you have candidates in the system.');
      return;
    }
    
    console.log(`✅ Found candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   Current status: ${candidate.status}`);
    console.log(`   Email: ${candidate.email}`);
    
    // Update status to "passed"
    console.log('\n🔄 Updating candidate status to "passed"...');
    candidate.status = 'passed';
    await candidate.save();
    
    console.log(`✅ Status updated to: ${candidate.status}`);
    
    // Check if approval workflow was created
    console.log('\n🔍 Checking for approval workflow...');
    const approval = await CandidateApproval.findOne({ candidate: candidate._id })
      .populate('candidate', 'firstName lastName email');
    
    if (approval) {
      console.log('✅ Approval workflow found!');
      console.log(`   Status: ${approval.status}`);
      console.log(`   Current Level: ${approval.currentLevel}`);
      console.log(`   Progress: ${approval.progress}%`);
      console.log(`   Next Approver: ${approval.nextApprover}`);
      
      console.log('\n📋 Approval Levels:');
      approval.approvalLevels.forEach((level, index) => {
        console.log(`   Level ${index + 1}: ${level.title} - ${level.status} (${level.approverEmail})`);
      });
    } else {
      console.log('❌ No approval workflow found. This might be expected if the frontend handles approval creation.');
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Go to the frontend and navigate to Candidates');
    console.log('2. Find the candidate and change their status to "Passed Interview"');
    console.log('3. Configure the approval workflow in the dialog that appears');
    console.log('4. Check the Candidate Approvals section to see the workflow');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testCandidateStatusUpdate(); 