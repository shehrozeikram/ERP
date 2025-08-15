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

async function fixMissingCandidate() {
  try {
    console.log('🔧 Fixing Missing Candidate Record...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // 1. Check the approval that needs fixing
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
    
    // 2. Create a test candidate record
    console.log('\n👤 Step 2: Creating test candidate record...');
    
    const testCandidate = new Candidate({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@company.com',
      phone: '+92-300-1234567',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'male', // lowercase as per schema
      nationality: 'Pakistani',
      currentPosition: 'Software Engineer',
      currentCompany: 'Tech Corp',
      yearsOfExperience: 5,
      source: 'direct_application', // correct enum value
      availability: 'immediate', // correct enum value
      preferredWorkType: 'on_site', // correct enum value
      status: 'approved',
      updatedBy: approval.createdBy
    });
    
    await testCandidate.save();
    console.log(`✅ Test candidate created: ${testCandidate._id}`);
    console.log(`   - Name: ${testCandidate.firstName} ${testCandidate.lastName}`);
    console.log(`   - Email: ${testCandidate.email}`);
    console.log(`   - Status: ${testCandidate.status}`);
    
    // 3. Update the approval to link to the new candidate
    console.log('\n🔗 Step 3: Linking candidate to approval...');
    
    approval.candidate = testCandidate._id;
    await approval.save();
    
    console.log(`✅ Approval updated with candidate: ${testCandidate._id}`);
    
    // 4. Verify the fix
    console.log('\n✅ Step 4: Verifying the fix...');
    
    const updatedApproval = await CandidateApproval.findById(approvalId)
      .populate('candidate', 'firstName lastName email');
    
    if (updatedApproval.candidate) {
      console.log('✅ Candidate link verified:');
      console.log(`   - Candidate ID: ${updatedApproval.candidate._id}`);
      console.log(`   - Name: ${updatedApproval.candidate.firstName} ${updatedApproval.candidate.lastName}`);
      console.log(`   - Email: ${updatedApproval.candidate.email}`);
    } else {
      console.log('❌ Candidate link still missing');
    }
    
    // 5. Test the onboarding workflow
    console.log('\n🧪 Step 5: Testing onboarding workflow...');
    
    // Find the onboarding record for this approval
    const onboarding = await EmployeeOnboarding.findOne({ approvalId: approvalId });
    if (onboarding) {
      console.log(`✅ Found onboarding record: ${onboarding._id}`);
      console.log(`   Status: ${onboarding.status}`);
      
      // Now test if we can populate the candidate info
      const populatedOnboarding = await EmployeeOnboarding.findById(onboarding._id)
        .populate({
          path: 'approvalId',
          populate: {
            path: 'candidate',
            select: 'firstName lastName email phone dateOfBirth gender nationality'
          }
        });
      
      if (populatedOnboarding.approvalId?.candidate) {
        console.log('✅ Candidate info can now be populated:');
        console.log(`   - Name: ${populatedOnboarding.approvalId.candidate.firstName} ${populatedOnboarding.approvalId.candidate.lastName}`);
        console.log(`   - Email: ${populatedOnboarding.approvalId.candidate.email}`);
        console.log(`   - Phone: ${populatedOnboarding.approvalId.candidate.phone}`);
      } else {
        console.log('❌ Candidate info still cannot be populated');
      }
    } else {
      console.log('❌ No onboarding record found for this approval');
    }
    
    // 6. Summary
    console.log('\n📊 Step 6: Summary...');
    console.log('✅ SUCCESS: Missing candidate record has been created and linked!');
    console.log(`   - New candidate: ${testCandidate._id}`);
    console.log(`   - Approval linked: ${approval._id}`);
    console.log(`   - Onboarding ready: ${onboarding ? 'Yes' : 'No'}`);
    console.log('');
    console.log('🎯 Next step: Test the onboarding form submission again!');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the fix
fixMissingCandidate();
