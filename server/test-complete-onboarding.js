const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

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
const employeeOnboardingService = require('./services/employeeOnboardingService');

async function testCompleteOnboarding() {
  try {
    console.log('🚀 Testing complete onboarding workflow with Employee model...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Get the service instance
    // const onboardingService = new EmployeeOnboardingService();
    
    // Test 1: Create Department and Position
    console.log('\n🏢 Test 1: Creating Department and Position...');
    const Department = require('./models/hr/Department');
    const Position = require('./models/hr/Position');
    
    let department = await Department.findOne({ code: 'IT' });
    if (!department) {
      department = new Department({
        name: 'IT Department',
        code: 'IT',
        description: 'Information Technology Department',
        head: null,
        isActive: true
      });
      await department.save();
      console.log(`✅ Department created: ${department._id}`);
    } else {
      console.log(`✅ Department found: ${department._id}`);
    }
    
    let position = await Position.findOne({ code: 'DEV' });
    if (!position) {
      position = new Position({
        title: 'Software Developer',
        code: 'DEV',
        department: department._id,
        description: 'Software development position',
        requirements: 'JavaScript, Node.js, React',
        responsibilities: 'Develop and maintain software applications',
        isActive: true
      });
      await position.save();
      console.log(`✅ Position created: ${position._id}`);
    } else {
      console.log(`✅ Position found: ${position._id}`);
    }
    
    // Test 2: Create Candidate
    console.log('\n👤 Test 2: Creating Candidate...');
    const Candidate = require('./models/hr/Candidate');
    
    const candidate = new Candidate({
      firstName: 'John',
      lastName: 'Doe',
      email: `john.doe.${Date.now()}@example.com`,
      phone: '+92-300-1234567',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      nationality: 'Pakistani',
      source: 'website',
      availability: 'immediate',
      preferredWorkType: 'on_site',
      yearsOfExperience: 3,
      education: [{
        degree: 'Bachelor of Science',
        institution: 'Test University',
        field: 'Computer Science',
        graduationYear: 2015,
        gpa: 3.5
      }],
      skills: [
        {
          name: 'JavaScript',
          level: 'advanced',
          yearsOfExperience: 3
        },
        {
          name: 'Node.js',
          level: 'intermediate',
          yearsOfExperience: 2
        },
        {
          name: 'React',
          level: 'intermediate',
          yearsOfExperience: 2
        }
      ],
      resume: {
        filename: 'resume.pdf',
        path: '/uploads/resume.pdf',
        uploadedAt: new Date()
      },
      coverLetter: {
        filename: 'cover_letter.pdf',
        path: '/uploads/cover_letter.pdf',
        uploadedAt: new Date()
      },
      status: 'shortlisted'
    });
    
    await candidate.save();
    console.log(`✅ Candidate created: ${candidate._id}`);
    
    // Test 3: Create Job Posting
    console.log('\n💼 Test 3: Creating Job Posting...');
    const JobPosting = require('./models/hr/JobPosting');
    
    const jobPosting = new JobPosting({
      title: 'Software Developer',
      description: 'We are looking for a skilled software developer...',
      requirements: 'JavaScript, Node.js, React, MongoDB',
      responsibilities: 'Develop and maintain web applications',
      qualifications: 'Bachelor\'s degree in Computer Science',
      employmentType: 'full_time',
      experienceLevel: 'mid',
      educationLevel: 'bachelors',
      salaryRange: {
        min: 50000,
        max: 80000
      },
      applicationDeadline: new Date('2024-12-31'),
      status: 'published',
      department: department._id,
      position: position._id,
      createdBy: candidate._id // Use candidate as creator for now
    });
    
    await jobPosting.save();
    console.log(`✅ Job Posting created: ${jobPosting._id}`);
    
    // Test 4: Create Application
    console.log('\n📝 Test 4: Creating Application...');
    const Application = require('./models/hr/Application');
    
    const application = new Application({
      candidate: candidate._id,
      jobPosting: jobPosting._id,
      status: 'shortlisted',
      appliedAt: new Date(),
      coverLetter: 'I am excited to apply for this position...',
      resume: 'resume.pdf',
      affiliateCode: 'TEST001'
    });
    
    await application.save();
    console.log(`✅ Application created: ${application._id}`);
    
    // Test 5: Create Candidate Approval
    console.log('\n✅ Test 5: Creating Candidate Approval...');
    const CandidateApproval = require('./models/hr/CandidateApproval');
    
    const approval = new CandidateApproval({
      candidate: candidate._id,
      jobPosting: jobPosting._id,
      application: application._id,
      status: 'approved',
      currentLevel: 5,
      finalDecision: 'approved',
      finalDecisionAt: new Date(),
      completedAt: new Date(),
      createdBy: candidate._id, // Use candidate as creator for now
      approvalLevels: [
        {
          level: 1,
          title: 'Assistant Manager HR',
          approverEmail: 'shehrozeikram2@gmail.com',
          status: 'approved',
          signature: 'AM HR',
          emailStatus: 'delivered',
          emailSentAt: new Date(),
          emailDeliveredAt: new Date(),
          approvedAt: new Date(),
          comments: 'Approved'
        },
        {
          level: 2,
          title: 'Manager HR',
          approverEmail: 'shehrozeikram2@gmail.com',
          status: 'approved',
          signature: 'M HR',
          emailStatus: 'delivered',
          emailSentAt: new Date(),
          emailDeliveredAt: new Date(),
          approvedAt: new Date(),
          comments: 'Approved'
        },
        {
          level: 3,
          title: 'HOD HR',
          approverEmail: 'shehrozeikram2@gmail.com',
          status: 'approved',
          signature: 'HOD HR',
          emailStatus: 'delivered',
          emailSentAt: new Date(),
          emailDeliveredAt: new Date(),
          approvedAt: new Date(),
          comments: 'Approved'
        },
        {
          level: 4,
          title: 'Vice President',
          approverEmail: 'shehrozeikram2@gmail.com',
          status: 'approved',
          signature: 'VP',
          emailStatus: 'delivered',
          emailSentAt: new Date(),
          emailDeliveredAt: new Date(),
          approvedAt: new Date(),
          comments: 'Approved'
        },
        {
          level: 5,
          title: 'CEO',
          approverEmail: 'shehrozeikram2@gmail.com',
          status: 'approved',
          signature: 'CEO',
          emailStatus: 'delivered',
          emailSentAt: new Date(),
          emailDeliveredAt: new Date(),
          approvedAt: new Date(),
          comments: 'Final approval'
        }
      ],
      emailNotifications: [
        {
          type: 'joining_document_request',
          sentTo: candidate.email,
          sentAt: new Date(),
          deliveredAt: new Date(),
          status: 'delivered'
        }
      ]
    });
    
    await approval.save();
    console.log(`✅ Candidate Approval created: ${approval._id}`);
    
    // Test 6: Create Employee Onboarding
    console.log('\n📋 Test 6: Creating Employee Onboarding...');
    const EmployeeOnboarding = require('./models/hr/EmployeeOnboarding');
    
    const onboarding = new EmployeeOnboarding({
      approvalId: approval._id,
      status: 'pending',
      onboardingTasks: [
        {
          taskName: 'Complete Personal Information',
          description: 'Fill out personal details form',
          status: 'pending'
        },
        {
          taskName: 'Submit Documents',
          description: 'Upload required documents',
          status: 'pending'
        },
        {
          taskName: 'System Access Setup',
          description: 'Setup email and system access',
          status: 'pending'
        }
      ]
    });
    
    await onboarding.save();
    console.log(`✅ Employee Onboarding created: ${onboarding._id}`);
    
    // Test 7: Test getPublicOnboarding
    console.log('\n🔍 Test 7: Testing getPublicOnboarding...');
    try {
      const onboardingResult = await employeeOnboardingService.getPublicOnboarding(onboarding._id);
      console.log('✅ getPublicOnboarding works:', {
        success: onboardingResult.success,
        onboardingId: onboardingResult.data._id,
        hasCandidate: !!onboardingResult.data.approvalId?.candidate,
        candidateName: onboardingResult.data.approvalId?.candidate ? 
          `${onboardingResult.data.approvalId.candidate.firstName} ${onboardingResult.data.approvalId.candidate.lastName}` : 'No candidate'
      });
      
      // Test 8: Test onboarding form submission
      console.log('\n📝 Test 8: Testing onboarding form submission...');
      const mockFormData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
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
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+92-300-1234568',
          email: 'jane.doe@test.com'
        },
        department: department._id,
        position: position._id,
        joiningDate: '2024-01-15',
        employmentType: 'Full-time',
        probationPeriod: 3,
        salary: 60000,
        notes: 'Test onboarding form submission'
      };
      
      const result = await employeeOnboardingService.processOnboardingForm(onboarding._id, mockFormData);
      console.log('✅ Onboarding form processed successfully:', {
        success: result.success,
        message: result.message,
        employeeId: result.data.employeeId,
        employee: result.data.employee
      });
      
      // Test 9: Verify employee was created
      console.log('\n👤 Test 9: Verifying employee creation...');
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
        
        // Test 10: Activate employee
        console.log('\n🚀 Test 10: Activating employee...');
        const activatedEmployee = await employeeOnboardingService.activateEmployee(employee._id, 'test-admin');
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
testCompleteOnboarding();
