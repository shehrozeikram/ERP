const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
const User = require('../models/User');
const EmailService = require('../services/emailService');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function testCompleteWorkflow() {
  try {
    console.log('🔍 Finding Sarah Ahmed...');
    
    const sarah = await Candidate.findOne({ 
      email: 'sarah.ahmed.nodejs@example.com' 
    });
    
    if (!sarah) {
      console.log('❌ Sarah Ahmed not found.');
      return;
    }
    
    console.log(`✅ Found Sarah Ahmed: ${sarah.firstName} ${sarah.lastName}`);
    console.log(`   Status: ${sarah.status}`);
    
    // Check if approval already exists
    const existingApproval = await CandidateApproval.findOne({ candidate: sarah._id });
    if (existingApproval) {
      console.log('⚠️  Approval already exists for Sarah. Deleting...');
      await CandidateApproval.deleteMany({ candidate: sarah._id });
    }
    
    console.log('\n🔄 Creating approval workflow...');
    
    // Create approval workflow
    const approval = new CandidateApproval({
      candidate: sarah._id,
      jobPosting: '688a0e15e1a3b69572795558', // Valid Job Posting ID
      application: '688b459a5961257b92c0202f', // Valid Application ID
      createdBy: '6884f7fc1010ce455f3797e0', // Admin user ID
      status: 'pending'
    });
    
    // Save first to trigger pre-save middleware
    await approval.save();
    
    // Set approver emails
    approval.approvalLevels[0].approverEmail = 'assistant.hr@company.com';
    approval.approvalLevels[1].approverEmail = 'manager.hr@company.com';
    approval.approvalLevels[2].approverEmail = 'hod.hr@company.com';
    approval.approvalLevels[3].approverEmail = 'vp@company.com';
    approval.approvalLevels[4].approverEmail = 'ceo@company.com';
    
    await approval.save();
    
    console.log('✅ Approval workflow created successfully!');
    console.log(`   Approval ID: ${approval._id}`);
    console.log(`   Status: ${approval.status}`);
    
    // Update candidate status
    await Candidate.findByIdAndUpdate(sarah._id, {
      status: 'approval_pending'
    });
    
    console.log('✅ Candidate status updated to approval_pending');
    
    // Populate approval object before sending emails
    console.log('\n📧 Populating approval data...');
    const populatedApproval = await CandidateApproval.findById(approval._id)
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department')
      .populate('application', 'applicationId')
      .populate('createdBy', 'firstName lastName');
    
    console.log('✅ Approval data populated');
    console.log(`   Candidate: ${populatedApproval.candidate.firstName} ${populatedApproval.candidate.lastName}`);
    console.log(`   Job: ${populatedApproval.jobPosting.title}`);
    console.log(`   Application: ${populatedApproval.application.applicationId}`);
    
    // Send email only to Level 1 (Assistant Manager HR) initially
    console.log('\n📧 Sending email to Level 1 (Assistant Manager HR)...');
    
    try {
      await EmailService.sendApprovalRequest(populatedApproval, 1);
      console.log('   ✅ Email sent to Level 1 approver (Assistant Manager HR)');
    } catch (error) {
      console.error('   ❌ Failed to send email to Level 1 approver:', error.message);
    }
    
    console.log('\n🎉 Complete workflow test finished!');
    console.log('\n📝 Check Mailtrap for the 5 approval emails:');
    console.log('   - assistant.hr@company.com (Level 1)');
    console.log('   - manager.hr@company.com (Level 2)');
    console.log('   - hod.hr@company.com (Level 3)');
    console.log('   - vp@company.com (Level 4)');
    console.log('   - ceo@company.com (Level 5)');
    
    console.log('\n📋 Each email should contain:');
    console.log('   - Sarah Ahmed\'s candidate information');
    console.log('   - Job posting details');
    console.log('   - Approval/reject buttons');
    console.log('   - Hierarchical approval process explanation');
    
  } catch (error) {
    console.error('❌ Error during complete workflow test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testCompleteWorkflow(); 