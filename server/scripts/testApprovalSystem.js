const mongoose = require('mongoose');
const CandidateApproval = require('../models/hr/CandidateApproval');
const Candidate = require('../models/hr/Candidate');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
const EmailService = require('../services/emailService');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected for testing'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const testApprovalSystem = async () => {
  try {
    console.log('\n🚀 Testing Candidate Approval System...\n');

    // 1. Find a candidate with 'passed' status
    console.log('1. Finding candidates with "passed" status...');
    const passedCandidates = await Candidate.find({ status: 'passed' }).limit(1);
    
    if (passedCandidates.length === 0) {
      console.log('❌ No candidates with "passed" status found. Please update a candidate status to "passed" first.');
      return;
    }

    const candidate = passedCandidates[0];
    console.log(`✅ Found candidate: ${candidate.firstName} ${candidate.lastName}`);

    // 2. Find a job posting
    console.log('\n2. Finding job postings...');
    const jobPostings = await JobPosting.find().limit(1);
    
    if (jobPostings.length === 0) {
      console.log('❌ No job postings found. Please create a job posting first.');
      return;
    }

    const jobPosting = jobPostings[0];
    console.log(`✅ Found job posting: ${jobPosting.title}`);

    // 3. Find an application
    console.log('\n3. Finding applications...');
    const applications = await Application.find().limit(1);
    
    if (applications.length === 0) {
      console.log('❌ No applications found. Please create an application first.');
      return;
    }

    const application = applications[0];
    console.log(`✅ Found application: ${application.applicationId || application._id}`);

    // 4. Create approval workflow
    console.log('\n4. Creating approval workflow...');
    
    const approval = new CandidateApproval({
      candidate: candidate._id,
      jobPosting: jobPosting._id,
      application: application._id,
      createdBy: candidate.createdBy || candidate._id // Use candidate creator or candidate ID as fallback
    });

    await approval.save();
    console.log(`✅ Created approval workflow: ${approval._id}`);

    // 5. Test email sending (commented out to avoid spam)
    console.log('\n5. Testing email service...');
    console.log('📧 Email service test skipped to avoid spam. Uncomment the following lines to test:');
    console.log('// const emailService = new EmailService();');
    console.log('// await emailService.sendApprovalRequest(approval, 1);');

    // 6. Display approval details
    console.log('\n6. Approval workflow details:');
    console.log(`   - Candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   - Position: ${jobPosting.title}`);
    console.log(`   - Status: ${approval.status}`);
    console.log(`   - Current Level: ${approval.currentLevel}`);
    console.log(`   - Progress: ${approval.progress}%`);

    console.log('\n   Approval Levels:');
    approval.approvalLevels.forEach((level, index) => {
      console.log(`   ${index + 1}. ${level.title} (${level.approverEmail}) - ${level.status}`);
    });

    // 7. Test approval progression
    console.log('\n7. Testing approval progression...');
    
    // Simulate first level approval
    console.log('   Simulating Level 1 approval...');
    approval.approvalLevels[0].status = 'approved';
    approval.approvalLevels[0].approvedAt = new Date();
    approval.approvalLevels[0].comments = 'Test approval from Assistant Manager HR';
    approval.approvalLevels[0].signature = 'Digital signature: Assistant Manager HR';
    approval.currentLevel = 2;
    approval.status = 'in_progress';
    
    await approval.save();
    console.log(`   ✅ Level 1 approved. Current level: ${approval.currentLevel}`);

    // Simulate second level approval
    console.log('   Simulating Level 2 approval...');
    approval.approvalLevels[1].status = 'approved';
    approval.approvalLevels[1].approvedAt = new Date();
    approval.approvalLevels[1].comments = 'Test approval from Manager HR';
    approval.approvalLevels[1].signature = 'Digital signature: Manager HR';
    approval.currentLevel = 3;
    
    await approval.save();
    console.log(`   ✅ Level 2 approved. Current level: ${approval.currentLevel}`);

    // Simulate third level approval
    console.log('   Simulating Level 3 approval...');
    approval.approvalLevels[2].status = 'approved';
    approval.approvalLevels[2].approvedAt = new Date();
    approval.approvalLevels[2].comments = 'Test approval from HOD HR';
    approval.approvalLevels[2].signature = 'Digital signature: HOD HR';
    approval.currentLevel = 4;
    
    await approval.save();
    console.log(`   ✅ Level 3 approved. Current level: ${approval.currentLevel}`);

    // Simulate fourth level approval
    console.log('   Simulating Level 4 approval...');
    approval.approvalLevels[3].status = 'approved';
    approval.approvalLevels[3].approvedAt = new Date();
    approval.approvalLevels[3].comments = 'Test approval from Vice President';
    approval.approvalLevels[3].signature = 'Digital signature: Vice President';
    approval.currentLevel = 5;
    
    await approval.save();
    console.log(`   ✅ Level 4 approved. Current level: ${approval.currentLevel}`);

    // Simulate final level approval
    console.log('   Simulating Level 5 approval...');
    approval.approvalLevels[4].status = 'approved';
    approval.approvalLevels[4].approvedAt = new Date();
    approval.approvalLevels[4].comments = 'Test approval from CEO';
    approval.approvalLevels[4].signature = 'Digital signature: CEO';
    approval.status = 'approved';
    approval.finalDecision = 'approved';
    approval.finalDecisionAt = new Date();
    approval.completedAt = new Date();
    
    await approval.save();
    console.log(`   ✅ Level 5 approved. Final status: ${approval.status}`);

    // 8. Update candidate status
    console.log('\n8. Updating candidate status...');
    candidate.status = 'approved';
    candidate.updatedBy = candidate.createdBy || candidate._id;
    await candidate.save();
    console.log(`✅ Candidate status updated to: ${candidate.status}`);

    // 9. Test appointment letter (commented out to avoid spam)
    console.log('\n9. Testing appointment letter...');
    console.log('📧 Appointment letter test skipped to avoid spam. Uncomment the following lines to test:');
    console.log('// await emailService.sendAppointmentLetter(approval);');

    console.log('\n🎉 Approval system test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Approval ID: ${approval._id}`);
    console.log(`   - Candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   - Position: ${jobPosting.title}`);
    console.log(`   - Final Status: ${approval.status}`);
    console.log(`   - Progress: ${approval.progress}%`);

  } catch (error) {
    console.error('❌ Error testing approval system:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
};

// Run the test
testApprovalSystem(); 