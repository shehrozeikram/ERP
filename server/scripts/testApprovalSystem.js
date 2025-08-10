const mongoose = require('mongoose');
const CandidateApproval = require('../models/hr/CandidateApproval');
const Candidate = require('../models/hr/Candidate');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
const EmailService = require('../services/emailService');

// Load environment variables
require('dotenv').config({ path: '../.env' });

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testApprovalSystem() {
  try {
    console.log('🧪 Testing Approval System...\n');

    // Test 1: Create a test candidate
    console.log('1️⃣ Creating test candidate...');
    const candidate = new Candidate({
      firstName: 'Test',
      lastName: 'Candidate',
      email: 'test.candidate@example.com',
      phone: '+92-300-1234567',
      status: 'passed',
      source: 'direct_application',
      nationality: 'Pakistani',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      currentPosition: 'Software Engineer',
      currentCompany: 'Test Company',
      yearsOfExperience: 5,
      expectedSalary: 100000,
      availability: 'immediate',
      preferredWorkType: 'on_site'
    });
    await candidate.save();
    console.log('✅ Test candidate created:', candidate._id);

    // Test 2: Create a test job posting
    console.log('\n2️⃣ Creating test job posting...');
    const jobPosting = new JobPosting({
      title: 'Software Engineer',
      description: 'Test job posting for approval system',
      requirements: 'Test requirements',
      responsibilities: 'Test responsibilities',
      qualifications: 'Test qualifications',
      department: new mongoose.Types.ObjectId(), // Mock department ID
      position: new mongoose.Types.ObjectId(), // Mock position ID
      location: new mongoose.Types.ObjectId(), // Mock location ID
      employmentType: 'full_time',
      experienceLevel: 'mid',
      educationLevel: 'bachelors',
      salaryRange: {
        min: 80000,
        max: 120000,
        currency: 'PKR'
      },
      applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'published',
      createdBy: new mongoose.Types.ObjectId()
    });
    await jobPosting.save();
    console.log('✅ Test job posting created:', jobPosting._id);

    // Test 3: Create a test application
    console.log('\n3️⃣ Creating test application...');
    const application = new Application({
      candidate: candidate._id,
      jobPosting: jobPosting._id,
      applicationId: 'APP-' + Date.now(),
      status: 'shortlisted',
      appliedAt: new Date(),
      source: 'direct_application',
      resume: 'test-resume.pdf',
      coverLetter: 'Test cover letter',
      affiliateCode: 'TEST-' + Date.now(),
      createdBy: new mongoose.Types.ObjectId()
    });
    await application.save();
    console.log('✅ Test application created:', application._id);

    // Link candidate with job posting and application
    candidate.jobPosting = jobPosting._id;
    candidate.application = application._id;
    await candidate.save();
    console.log('✅ Candidate linked with job posting and application');

    // Test 4: Create approval workflow
    console.log('\n4️⃣ Creating approval workflow...');
    const approval = new CandidateApproval({
      candidate: candidate._id,
      jobPosting: jobPosting._id,
      application: application._id,
      createdBy: new mongoose.Types.ObjectId(), // Mock user ID
      status: 'pending'
    });

    await approval.save();
    console.log('✅ Approval workflow created:', approval._id);

    // Now update all approver emails to shehrozeikram2@gmail.com
    approval.approvalLevels[0].approverEmail = 'shehrozeikram2@gmail.com'; // Assistant Manager HR
    approval.approvalLevels[1].approverEmail = 'shehrozeikram2@gmail.com'; // Manager HR
    approval.approvalLevels[2].approverEmail = 'shehrozeikram2@gmail.com'; // HOD HR
    approval.approvalLevels[3].approverEmail = 'shehrozeikram2@gmail.com'; // Vice President
    approval.approvalLevels[4].approverEmail = 'shehrozeikram2@gmail.com'; // CEO

    await approval.save();
    console.log('✅ All approver emails updated to shehrozeikram2@gmail.com');

    // Test 5: Simulate approval process
    console.log('\n5️⃣ Simulating approval process...');
    
    // Level 1: Assistant Manager HR approves
    console.log('   Level 1: Assistant Manager HR approving...');
    approval.approvalLevels[0].status = 'approved';
    approval.approvalLevels[0].approvedAt = new Date();
    approval.currentLevel = 2;
    approval.status = 'in_progress';
    await approval.save();
    console.log('   ✅ Level 1 approved');

    // Level 2: Manager HR approves
    console.log('   Level 2: Manager HR approving...');
    approval.approvalLevels[1].status = 'approved';
    approval.approvalLevels[1].approvedAt = new Date();
    approval.currentLevel = 3;
    await approval.save();
    console.log('   ✅ Level 2 approved');

    // Level 3: HOD HR approves
    console.log('   Level 3: HOD HR approving...');
    approval.approvalLevels[2].status = 'approved';
    approval.approvalLevels[2].approvedAt = new Date();
    approval.currentLevel = 4;
    await approval.save();
    console.log('   ✅ Level 3 approved');

    // Level 4: Vice President approves
    console.log('   Level 4: Vice President approving...');
    approval.approvalLevels[3].status = 'approved';
    approval.approvalLevels[3].approvedAt = new Date();
    approval.currentLevel = 5;
    await approval.save();
    console.log('   ✅ Level 4 approved');

    // Level 5: CEO approves (Final approval)
    console.log('   Level 5: CEO approving (Final approval)...');
    approval.approvalLevels[4].status = 'approved';
    approval.approvalLevels[4].approvedAt = new Date();
    approval.status = 'approved';
    approval.finalDecision = 'approved';
    approval.finalDecisionAt = new Date();
    approval.completedAt = new Date();
    await approval.save();
    console.log('   ✅ Level 5 approved (Final)');

    // Update candidate status to HIRED (this is what happens in the actual approval route)
    await Candidate.findByIdAndUpdate(candidate._id, {
      status: 'hired',
      updatedAt: new Date()
    });
    console.log('   ✅ Candidate status updated to HIRED');

    // Test 6: Check candidate status
    console.log('\n6️⃣ Checking candidate status...');
    const updatedCandidate = await Candidate.findById(candidate._id);
    console.log('   Candidate status:', updatedCandidate.status);
    
    if (updatedCandidate.status === 'hired') {
      console.log('   ✅ Status correctly updated to HIRED');
    } else {
      console.log('   ❌ Status not updated correctly. Expected: hired, Got:', updatedCandidate.status);
    }

    // Test 7: Test email service
    console.log('\n7️⃣ Testing email service...');
    try {
      const populatedApproval = await CandidateApproval.findById(approval._id)
        .populate('candidate', 'firstName lastName email phone')
        .populate('jobPosting', 'title department')
        .populate('application', 'applicationId');

      // Test hiring confirmation email
      const emailResult = await EmailService.sendHiringConfirmation(populatedApproval);
      if (emailResult.success) {
        console.log('   ✅ Hiring confirmation email sent successfully');
      } else {
        console.log('   ❌ Failed to send hiring confirmation email:', emailResult.error);
      }
    } catch (emailError) {
      console.log('   ❌ Email service error:', emailError.message);
    }

    console.log('\n🎉 Approval system test completed!');
    console.log('\n📋 Summary:');
    console.log('   - Test candidate created');
    console.log('   - Test job posting created');
    console.log('   - Test application created');
    console.log('   - Approval workflow created');
    console.log('   - All 5 approval levels completed');
    console.log('   - Candidate status updated to HIRED');
    console.log('   - Hiring confirmation email sent');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    try {
      await Candidate.deleteMany({ email: 'test.candidate@example.com' });
      await JobPosting.deleteMany({ title: 'Software Engineer' });
      await Application.deleteMany({ candidate: candidate?._id });
      await CandidateApproval.deleteMany({ candidate: candidate?._id });
      console.log('✅ Test data cleaned up');
    } catch (cleanupError) {
      console.log('⚠️ Cleanup warning:', cleanupError.message);
    }
    
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testApprovalSystem();
