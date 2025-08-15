const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
require('./models/hr/Employee');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/CandidateApproval');
require('./models/hr/Candidate');
require('./models/hr/JobPosting');
require('./models/hr/Application');
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/User');

// Import the service
const EmployeeOnboardingService = require('./services/employeeOnboardingService');

async function testNewOnboarding() {
  try {
    console.log('🚀 Testing new onboarding service with Employee model...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Get the service instance
    const onboardingService = new EmployeeOnboardingService();
    
    // Test 1: Check if we can get public onboarding
    console.log('\n📋 Test 1: Getting public onboarding...');
    try {
      const onboarding = await onboardingService.getPublicOnboarding('689c6476671a43e61eedb805');
      console.log('✅ Public onboarding retrieved:', {
        id: onboarding._id,
        status: onboarding.status,
        approvalId: onboarding.approvalId
      });
      
      // Test 2: Process onboarding form
      console.log('\n📝 Test 2: Processing onboarding form...');
      const mockFormData = {
        firstName: 'Shehroze',
        lastName: 'Ikram',
        email: 'shehroze.ikram@test.com',
        phone: '+92-300-1234567',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        idCard: '35202-1234567-1',
        nationality: 'Pakistani',
        religion: 'Islam',
        maritalStatus: 'Single',
        address: {
          street: '123 Test Street',
          city: null,
          state: null,
          country: null
        },
        emergencyContact: {
          name: 'Test Contact',
          relationship: 'Father',
          phone: '+92-300-1234568',
          email: 'contact@test.com'
        },
        department: null,
        position: null,
        joiningDate: '2024-01-15',
        employmentType: 'Full-time',
        probationPeriod: 3,
        salary: 50000,
        notes: 'Test onboarding form submission'
      };
      
      const result = await onboardingService.processOnboardingForm(onboarding._id, mockFormData);
      console.log('✅ Onboarding form processed successfully:', {
        success: result.success,
        message: result.message,
        employeeId: result.data.employeeId,
        employee: result.data.employee
      });
      
      // Test 3: Verify employee was created
      console.log('\n👤 Test 3: Verifying employee creation...');
      const Employee = require('./models/hr/Employee');
      const employee = await Employee.findById(result.data.employeeId);
      
      if (employee) {
        console.log('✅ Employee created successfully:', {
          id: employee._id,
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          status: employee.status,
          employmentStatus: employee.employmentStatus,
          onboardingStatus: employee.onboardingStatus
        });
        
        // Test 4: Activate employee
        console.log('\n🚀 Test 4: Activating employee...');
        const activatedEmployee = await onboardingService.activateEmployee(employee._id, 'test-admin');
        console.log('✅ Employee activated:', {
          id: activatedEmployee._id,
          status: activatedEmployee.status,
          employmentStatus: activatedEmployee.employmentStatus,
          activatedAt: activatedEmployee.activatedAt
        });
        
      } else {
        console.log('❌ Employee not found after onboarding');
      }
      
    } catch (error) {
      console.log('❌ Error during onboarding test:', error.message);
      console.log('Stack trace:', error.stack);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testNewOnboarding();
