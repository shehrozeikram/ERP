const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');

// Load environment variables
require('dotenv').config({ path: '../.env' });

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testStatusChange() {
  try {
    console.log('🧪 Testing Status Change to Approval Pending...\n');

    // Find an existing candidate
    const candidate = await Candidate.findOne().limit(1);
    
    if (!candidate) {
      console.log('❌ No candidates found in database');
      return;
    }

    console.log('👤 Found candidate:', candidate.firstName, candidate.lastName);
    console.log('📧 Email:', candidate.email);
    console.log('🔍 Current status:', candidate.status);
    console.log('📋 Job Posting ID:', candidate.jobPosting);
    console.log('📄 Application ID:', candidate.application);

    // Check if approval workflow already exists
    const existingApproval = await CandidateApproval.findOne({ candidate: candidate._id });
    
    if (existingApproval) {
      console.log('ℹ️ Approval workflow already exists for this candidate');
      console.log('📊 Approval status:', existingApproval.status);
      console.log('📈 Current level:', existingApproval.currentLevel);
      console.log('📧 Approval levels:', existingApproval.approvalLevels.length);
      
      // Show approver emails
      existingApproval.approvalLevels.forEach((level, index) => {
        console.log(`   Level ${index + 1} (${level.title}): ${level.approverEmail}`);
      });
    } else {
      console.log('✅ No existing approval workflow found');
    }

    // Simulate the status change logic
    console.log('\n🔄 Simulating status change to approval_pending...');
    
    if (status === 'approval_pending') {
      console.log('🔄 Status changed to approval_pending - creating approval workflow...');
      try {
        // Check if approval workflow already exists
        const existingApproval = await CandidateApproval.findOne({ candidate: candidate._id });
        
        if (!existingApproval) {
          console.log('📝 Creating new approval workflow...');
          // Create approval workflow automatically
          const approval = new CandidateApproval({
            candidate: candidate._id,
            jobPosting: candidate.jobPosting?._id || '688a0e15e1a3b69572795558', // Default job posting ID
            application: candidate.application || '688b459a5961257b92c0202f', // Default application ID
            createdBy: new mongoose.Types.ObjectId(), // Mock user ID
            status: 'pending'
          });

          await approval.save();
          console.log('✅ Approval workflow saved with ID:', approval._id);
          console.log('📧 Approval levels created:', approval.approvalLevels.length);

          // Now update all approver emails to shehrozeikram2@gmail.com
          console.log('🔄 Updating approver emails to shehrozeikram2@gmail.com...');
          approval.approvalLevels[0].approverEmail = 'shehrozeikram2@gmail.com'; // Assistant Manager HR
          approval.approvalLevels[1].approverEmail = 'shehrozeikram2@gmail.com'; // Manager HR
          approval.approvalLevels[2].approverEmail = 'shehrozeikram2@gmail.com'; // HOD HR
          approval.approvalLevels[3].approverEmail = 'shehrozeikram2@gmail.com'; // Vice President
          approval.approvalLevels[4].approverEmail = 'shehrozeikram2@gmail.com'; // CEO

          await approval.save();
          console.log('✅ Approver emails updated successfully');

          // Populate approval object before sending emails
          console.log('🔄 Populating approval object for email...');
          const populatedApproval = await CandidateApproval.findById(approval._id)
            .populate('candidate', 'firstName lastName email phone')
            .populate('jobPosting', 'title department')
            .populate('application', 'applicationId')
            .populate('createdBy', 'firstName lastName');

          console.log('📧 Sending approval request email to Level 1...');
          // Send email to Level 1 (Assistant Manager HR)
          const EmailService = require('../services/emailService');
          const emailResult = await EmailService.sendApprovalRequest(populatedApproval, 1);
          
          if (emailResult.success) {
            console.log(`✅ Approval request email sent to Assistant Manager HR (shehrozeikram2@gmail.com)`);
          } else {
            console.error(`❌ Failed to send approval request email:`, emailResult.error);
          }
        } else {
          console.log(`ℹ️ Approval workflow already exists for candidate ${candidate._id}`);
        }
      } catch (approvalError) {
        console.error('❌ Error creating approval workflow:', approvalError);
        console.error('❌ Error details:', approvalError.stack);
      }
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Error details:', error.stack);
  } finally {
    // Clean up
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testStatusChange();
