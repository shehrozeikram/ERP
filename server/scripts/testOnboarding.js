const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Import required models
require('../models/hr/Candidate');
require('../models/hr/CandidateApproval');
require('../models/hr/JoiningDocument');
require('../models/hr/EmployeeOnboarding');
require('../models/hr/Employee');

async function testOnboarding() {
  try {
    console.log('🚀 Testing Employee Onboarding System...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if we have any onboarding records
    const EmployeeOnboarding = mongoose.model('EmployeeOnboarding');
    const onboardingCount = await EmployeeOnboarding.countDocuments();
    console.log(`📊 Total onboarding records: ${onboardingCount}`);

    if (onboardingCount > 0) {
      const recentOnboarding = await EmployeeOnboarding.findOne()
        .populate('candidateId')
        .populate('approvalId')
        .populate('joiningDocumentId')
        .sort({ createdAt: -1 });

      console.log('\n📋 Recent Onboarding Record:');
      console.log('ID:', recentOnboarding._id);
      console.log('Status:', recentOnboarding.status);
      console.log('Candidate:', recentOnboarding.candidateId?.firstName, recentOnboarding.candidateId?.lastName);
      console.log('Approval ID:', recentOnboarding.approvalId?._id);
      console.log('Joining Document ID:', recentOnboarding.joiningDocumentId?._id);
      console.log('Onboarding Email Sent:', recentOnboarding.onboardingEmailSent);
      console.log('Onboarding Email Sent At:', recentOnboarding.onboardingEmailSentAt);
      console.log('Created At:', recentOnboarding.createdAt);

      // Test the public endpoint
      console.log('\n🔗 Testing Public Endpoint:');
      console.log(`URL: http://localhost:5001/api/employee-onboarding/public/${recentOnboarding._id}`);

      // Test with curl
      const { exec } = require('child_process');
      exec(`curl -s "http://localhost:5001/api/employee-onboarding/public/${recentOnboarding._id}"`, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Curl error:', error.message);
          return;
        }

        try {
          const response = JSON.parse(stdout);
          if (response.success) {
            console.log('✅ API Response Success:', response.message || 'Onboarding data retrieved');
            if (response.data) {
              console.log('Data received:', Object.keys(response.data));
            }
          } else {
            console.log('❌ API Response Error:', response.message);
          }
        } catch (parseError) {
          console.log('❌ Response parse error:', parseError.message);
          console.log('Raw response:', stdout);
        }
      });

    } else {
      console.log('❌ No onboarding records found. You need to complete a joining document first.');
      
      // Check for joining documents
      const JoiningDocument = mongoose.model('JoiningDocument');
      const joiningDocCount = await JoiningDocument.countDocuments();
      console.log(`📊 Total joining documents: ${joiningDocCount}`);
      
      if (joiningDocCount > 0) {
        console.log('✅ Joining documents exist. Check if onboarding process is triggered.');
      } else {
        console.log('❌ No joining documents found. Complete the joining document process first.');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Don't disconnect immediately to allow curl to complete
    setTimeout(async () => {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }, 2000);
  }
}

// Run the test
testOnboarding();
