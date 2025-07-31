const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function testFrontendApproval() {
  try {
    console.log('🔍 Finding a candidate and user for testing...');
    
    // Find a candidate
    const candidate = await Candidate.findOne({ 
      status: { $in: ['passed', 'interviewed', 'active'] } 
    });
    
    // Find a user (admin or hr_manager)
    const user = await User.findOne({ 
      role: { $in: ['admin', 'hr_manager'] } 
    });
    
    if (!candidate) {
      console.log('❌ No suitable candidate found.');
      return;
    }
    
    if (!user) {
      console.log('❌ No suitable user found.');
      return;
    }
    
    console.log(`✅ Found candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.role})`);
    
    // Simulate frontend request data
    const frontendRequestData = {
      candidateId: candidate._id.toString(),
      jobPostingId: '507f1f77bcf86cd799439011', // Test ObjectId
      applicationId: '507f1f77bcf86cd799439012', // Test ObjectId
      approverEmails: [
        'assistant.hr@company.com',
        'manager.hr@company.com',
        'hod.hr@company.com',
        'vp@company.com',
        'ceo@company.com'
      ],
      createdBy: user._id.toString()
    };
    
    console.log('\n📋 Frontend request data:');
    console.log(JSON.stringify(frontendRequestData, null, 2));
    
    // Check if approval already exists
    console.log('\n🔍 Checking for existing approval...');
    const existingApproval = await CandidateApproval.findOne({ candidate: candidate._id });
    if (existingApproval) {
      console.log('⚠️  Approval already exists for this candidate');
      console.log(`   Approval ID: ${existingApproval._id}`);
      console.log(`   Status: ${existingApproval.status}`);
      return;
    }
    
    // Simulate the backend approval creation process
    console.log('\n🔄 Creating approval workflow (simulating backend)...');
    
    // Validate required fields
    if (!frontendRequestData.candidateId || !frontendRequestData.jobPostingId || 
        !frontendRequestData.applicationId || !frontendRequestData.approverEmails) {
      throw new Error('Candidate ID, Job Posting ID, Application ID, and approver emails are required');
    }
    
    // Validate approver emails (should be 5)
    if (!Array.isArray(frontendRequestData.approverEmails) || frontendRequestData.approverEmails.length !== 5) {
      throw new Error('Exactly 5 approver emails are required');
    }
    
    // Create approval workflow
    const approval = new CandidateApproval({
      candidate: frontendRequestData.candidateId,
      jobPosting: frontendRequestData.jobPostingId,
      application: frontendRequestData.applicationId,
      createdBy: frontendRequestData.createdBy,
      status: 'pending'
    });
    
    console.log('\n📋 Approval object before save:');
    console.log('approvalLevels:', approval.approvalLevels);
    
    await approval.save();
    
    console.log('\n📋 Approval object after save:');
    console.log('approvalLevels:', approval.approvalLevels);
    
    // Update the approver emails
    approval.approvalLevels[0].approverEmail = frontendRequestData.approverEmails[0];
    approval.approvalLevels[1].approverEmail = frontendRequestData.approverEmails[1];
    approval.approvalLevels[2].approverEmail = frontendRequestData.approverEmails[2];
    approval.approvalLevels[3].approverEmail = frontendRequestData.approverEmails[3];
    approval.approvalLevels[4].approverEmail = frontendRequestData.approverEmails[4];
    
    await approval.save();
    
    // Update candidate status
    console.log('\n🔄 Updating candidate status...');
    await Candidate.findByIdAndUpdate(frontendRequestData.candidateId, {
      status: 'approval_pending',
      updatedBy: frontendRequestData.createdBy
    });
    
    console.log('✅ Approval workflow created successfully!');
    console.log(`   Approval ID: ${approval._id}`);
    console.log(`   Status: ${approval.status}`);
    console.log(`   Current Level: ${approval.currentLevel}`);
    console.log(`   Progress: ${approval.progress}%`);
    
    console.log('\n📋 Approval Levels:');
    approval.approvalLevels.forEach((level, index) => {
      console.log(`   Level ${index + 1}: ${level.title} - ${level.status} (${level.approverEmail})`);
    });
    
    console.log('\n🎉 Frontend approval test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Go to the frontend and test the approval workflow creation');
    console.log('2. Check that the approval appears in the Candidate Approvals section');
    console.log('3. Verify that the first approver receives an email notification');
    
  } catch (error) {
    console.error('❌ Error during frontend approval test:', error);
    console.error('Error details:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testFrontendApproval(); 