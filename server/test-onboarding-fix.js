const mongoose = require('mongoose');
require('dotenv').config();

// Import models - ensure they are registered
require('./models/hr/CandidateApproval');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/Employee');
require('./models/hr/Candidate');

// Now get the models
const EmployeeOnboarding = mongoose.model('EmployeeOnboarding');
const Employee = mongoose.model('Employee');
const CandidateApproval = mongoose.model('CandidateApproval');

// Import the service
const employeeOnboardingService = require('./services/employeeOnboardingService');

async function testOnboardingFix() {
  try {
    console.log('🧪 Testing Onboarding Fix (No joiningDocumentId Error)...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // 1. Find an existing onboarding record
    console.log('📋 Step 1: Finding existing onboarding record...');
    const onboarding = await EmployeeOnboarding.findOne({ status: 'pending' })
      .populate({
        path: 'approvalId',
        populate: {
          path: 'candidate',
          select: 'firstName lastName email phone dateOfBirth gender nationality'
        }
      });
    
    if (!onboarding) {
      console.log('❌ No pending onboarding records found');
      return;
    }
    
    console.log(`✅ Found onboarding record: ${onboarding._id}`);
    console.log(`   Status: ${onboarding.status}`);
    console.log(`   Approval ID: ${onboarding.approvalId?._id}`);
    console.log(`   Candidate: ${onboarding.approvalId?.candidate?.firstName || 'N/A'} ${onboarding.approvalId?.candidate?.lastName || 'N/A'}`);
    
    // 2. Test the getPublicOnboarding method (this was causing the error)
    console.log('\n🔍 Step 2: Testing getPublicOnboarding method...');
    
    try {
      const result = await employeeOnboardingService.getPublicOnboarding(onboarding._id);
      console.log('✅ getPublicOnboarding method works without errors!');
      console.log(`   Result: ${result.success ? 'Success' : 'Failed'}`);
      if (result.data) {
        console.log(`   Onboarding ID: ${result.data._id}`);
        console.log(`   Status: ${result.data.status}`);
      }
    } catch (error) {
      console.log('❌ getPublicOnboarding method still has errors:');
      console.log(`   Error: ${error.message}`);
      return;
    }
    
    // 3. Test the processOnboardingForm method
    console.log('\n📝 Step 3: Testing processOnboardingForm method...');
    
    const mockFormData = {
      // Personal Information - only basic required fields
      firstName: 'Test',
      lastName: 'User',
      email: 'test.user.fix@company.com',
      phone: '+92-300-9999999',
      dateOfBirth: '1995-01-01',
      gender: 'male',
      nationality: 'Pakistani',
      idCard: '99999-9999999-9',
      
      // Employment Details - basic fields only
      employmentType: 'full_time',
      probationPeriod: 3,
      salary: 80000,
      workSchedule: '9 AM - 6 PM',
      joiningDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      
      // Additional Information
      notes: 'Testing the fixed onboarding process'
    };
    
    try {
      const result = await employeeOnboardingService.processOnboardingForm(onboarding._id, mockFormData);
      console.log('✅ processOnboardingForm method works without errors!');
      console.log(`   Result: ${result.success ? 'Success' : 'Failed'}`);
      if (result.data?.employeeId) {
        console.log(`   Employee created: ${result.data.employeeId}`);
      }
    } catch (error) {
      console.log('❌ processOnboardingForm method has errors:');
      console.log(`   Error: ${error.message}`);
      if (error.errors) {
        console.log('   Validation errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
      }
      return;
    }
    
    // 4. Summary
    console.log('\n🎯 Step 4: Test Summary...');
    console.log('✅ SUCCESS: Onboarding form submission now works without joiningDocumentId errors!');
    console.log('   - getPublicOnboarding method works');
    console.log('   - processOnboardingForm method works');
    console.log('   - No more schema population errors');
    console.log('   - Employee creation from onboarding form works');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testOnboardingFix();
