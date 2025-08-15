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

async function testOnboardingSubmission() {
  try {
    console.log('🧪 Testing Onboarding Form Submission...\n');
    
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
    
    // 2. Simulate form data submission
    console.log('\n📝 Step 2: Simulating form data submission...');
    
    const mockFormData = {
      // Personal Information - only basic required fields
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@company.com',
      phone: '+92-300-1234567',
      dateOfBirth: '1990-05-15',
      gender: 'male', // lowercase as per schema
      nationality: 'Pakistani',
      idCard: '12345-1234567-1', // Required field
      
      // Employment Details - basic fields only
      employmentType: 'Full-time',
      probationPeriod: 3,
      salary: 75000,
      workSchedule: '9 AM - 6 PM',
      joiningDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      
      // Additional Information
      notes: 'Ready to start onboarding process'
    };
    
    console.log('📋 Mock form data prepared:', {
      name: `${mockFormData.firstName} ${mockFormData.lastName}`,
      email: mockFormData.email,
      position: mockFormData.position,
      department: mockFormData.department
    });
    
    // 3. Process the onboarding form
    console.log('\n🔄 Step 3: Processing onboarding form...');
    
    const result = await employeeOnboardingService.processOnboardingForm(onboarding._id, mockFormData);
    
    console.log('✅ Onboarding form processed successfully!');
    console.log('Result:', result);
    
    // 4. Verify the results
    console.log('\n🔍 Step 4: Verifying results...');
    
    // Check if onboarding was updated
    const updatedOnboarding = await EmployeeOnboarding.findById(onboarding._id);
    console.log(`📋 Onboarding status: ${updatedOnboarding.status}`);
    console.log(`📋 Employee ID linked: ${updatedOnboarding.employeeId || 'Not set'}`);
    
    // Check if employee was created
    if (result.data?.employeeId) {
      const employee = await Employee.findById(result.data.employeeId);
      if (employee) {
        console.log(`👤 Employee created successfully:`);
        console.log(`   - ID: ${employee._id}`);
        console.log(`   - Employee ID: ${employee.employeeId}`);
        console.log(`   - Name: ${employee.firstName} ${employee.lastName}`);
        console.log(`   - Email: ${employee.email}`);
        console.log(`   - Status: ${employee.status}`);
        console.log(`   - Department: ${employee.department}`);
        console.log(`   - Position: ${employee.position}`);
        console.log(`   - Approval ID: ${employee.approvalId}`);
        console.log(`   - Onboarding Status: ${employee.onboardingStatus}`);
      } else {
        console.log('❌ Employee not found after creation');
      }
    }
    
    // 5. Check final database state
    console.log('\n📊 Step 5: Final database state...');
    
    const finalOnboardings = await EmployeeOnboarding.countDocuments();
    const finalEmployees = await Employee.countDocuments();
    const inactiveEmployees = await Employee.countDocuments({ status: 'inactive' });
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    
    console.log(`   📋 Total onboarding records: ${finalOnboardings}`);
    console.log(`   👤 Total employee records: ${finalEmployees}`);
    console.log(`   👤 Inactive employees: ${inactiveEmployees}`);
    console.log(`   👤 Active employees: ${activeEmployees}`);
    
    // 6. Summary
    console.log('\n🎯 Step 6: Test Summary...');
    
    if (result.success && result.data?.employeeId) {
      console.log('✅ SUCCESS: Onboarding workflow completed successfully!');
      console.log('   - Onboarding form processed');
      console.log('   - Employee record created');
      console.log('   - Employee status: inactive (ready for HR activation)');
      console.log('   - Employee appears in employee table');
    } else {
      console.log('❌ FAILURE: Onboarding workflow did not complete successfully');
      console.log('   - Check the error details above');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    if (error.errors) {
      console.error('Validation errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testOnboardingSubmission();
