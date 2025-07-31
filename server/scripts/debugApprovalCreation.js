const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function debugApprovalCreation() {
  try {
    console.log('🔍 Finding a candidate to test approval creation...');
    
    // Find a candidate
    const candidate = await Candidate.findOne({ 
      status: { $in: ['passed', 'interviewed', 'active'] } 
    });
    
    if (!candidate) {
      console.log('❌ No suitable candidate found.');
      return;
    }
    
    console.log(`✅ Found candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   ID: ${candidate._id}`);
    console.log(`   Status: ${candidate.status}`);
    
    // Test data for approval creation
    const testApprovalData = {
      candidateId: candidate._id.toString(),
      jobPostingId: '507f1f77bcf86cd799439011', // Test ObjectId
      applicationId: '507f1f77bcf86cd799439012', // Test ObjectId
      approverEmails: [
        'assistant.hr@company.com',
        'manager.hr@company.com',
        'hod.hr@company.com',
        'vp@company.com',
        'ceo@company.com'
      ]
    };
    
    console.log('\n📋 Test approval data:');
    console.log(JSON.stringify(testApprovalData, null, 2));
    
    // Check if approval already exists
    console.log('\n🔍 Checking for existing approval...');
    const existingApproval = await CandidateApproval.findOne({ candidate: candidate._id });
    if (existingApproval) {
      console.log('⚠️  Approval already exists for this candidate');
      console.log(`   Approval ID: ${existingApproval._id}`);
      console.log(`   Status: ${existingApproval.status}`);
      return;
    }
    
    // Try to create approval
    console.log('\n🔄 Creating approval workflow...');
    const approval = new CandidateApproval({
      candidate: testApprovalData.candidateId,
      jobPosting: testApprovalData.jobPostingId,
      application: testApprovalData.applicationId,
      status: 'pending',
      createdBy: '507f1f77bcf86cd799439013' // Test user ID
    });
    
    console.log('\n📋 Approval object before save:');
    console.log('approvalLevels:', approval.approvalLevels);
    
    // Save the approval (this will trigger the pre-save middleware)
    await approval.save();
    
    console.log('\n📋 Approval object after save:');
    console.log('approvalLevels:', approval.approvalLevels);
    
    // Now update the approver emails if needed
    if (approval.approvalLevels && approval.approvalLevels.length > 0) {
      approval.approvalLevels[0].approverEmail = testApprovalData.approverEmails[0];
      approval.approvalLevels[1].approverEmail = testApprovalData.approverEmails[1];
      approval.approvalLevels[2].approverEmail = testApprovalData.approverEmails[2];
      approval.approvalLevels[3].approverEmail = testApprovalData.approverEmails[3];
      approval.approvalLevels[4].approverEmail = testApprovalData.approverEmails[4];
      
      await approval.save();
    }
    

    
    console.log('✅ Approval created successfully!');
    console.log(`   Approval ID: ${approval._id}`);
    console.log(`   Status: ${approval.status}`);
    console.log(`   Current Level: ${approval.currentLevel}`);
    
    // Update candidate status
    console.log('\n🔄 Updating candidate status...');
    await Candidate.findByIdAndUpdate(candidate._id, {
      status: 'approval_pending'
    });
    
    console.log('✅ Candidate status updated to approval_pending');
    
    console.log('\n🎉 Debug test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during debug test:', error);
    console.error('Error details:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the debug test
debugApprovalCreation(); 