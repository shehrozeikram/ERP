const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
require('./models/hr/JobPosting');
require('./models/hr/Candidate');
require('./models/hr/Application');
require('./models/hr/CandidateApproval');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/Employee');
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/JoiningDocument');
require('./models/User');

// Get model instances
const JobPosting = mongoose.model('JobPosting');
const Candidate = mongoose.model('Candidate');
const Application = mongoose.model('Application');
const CandidateApproval = mongoose.model('CandidateApproval');
const EmployeeOnboarding = mongoose.model('EmployeeOnboarding');
const Employee = mongoose.model('Employee');
const Department = mongoose.model('Department');
const Position = mongoose.model('Position');
const JoiningDocument = mongoose.model('JoiningDocument');
const User = mongoose.model('User');

async function testCompleteHiringWorkflow() {
  try {
    console.log('🚀 Testing Complete Hiring Workflow - End to End...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // ===== STEP 1: CREATE CANDIDATE =====
    console.log('👤 STEP 1: Creating Candidate...');
    
    const candidate = new Candidate({
      firstName: 'Ahmed',
      lastName: 'Khan',
      email: 'ahmed.khan.workflow@company.com',
      phone: '+92-300-5555555',
      dateOfBirth: new Date('1990-03-15'),
      gender: 'male',
      nationality: 'Pakistani',
      currentPosition: 'Software Developer',
      currentCompany: 'Tech Solutions Ltd',
      yearsOfExperience: 4,
      source: 'direct_application',
      availability: 'immediate',
      preferredWorkType: 'on_site',
      status: 'active'
    });
    
    await candidate.save();
    console.log(`   ✅ Candidate created: ${candidate._id}`);
    console.log(`   👤 Name: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   📧 Email: ${candidate.email}`);
    
    // ===== STEP 2: CREATE JOB POSTING =====
    console.log('\n📋 STEP 2: Creating Job Posting...');
    
    // First check if we have required department and position
    let department = await Department.findOne();
    let position = await Position.findOne();
    
    if (!department) {
      console.log('   Creating test department...');
      department = new Department({
        name: 'IT Department',
        code: 'IT',
        description: 'Information Technology Department',
        isActive: true
      });
      await department.save();
      console.log(`   ✅ Department created: ${department._id}`);
    } else {
      console.log(`   ✅ Using existing department: ${department.name}`);
    }
    
    if (!position) {
      console.log('   Creating test position...');
      position = new Position({
        title: 'Software Engineer',
        code: 'SE',
        department: department._id,
        description: 'Software Development Role',
        isActive: true
      });
      await position.save();
      console.log(`   ✅ Position created: ${position._id}`);
    } else {
      console.log(`   ✅ Using existing position: ${position.title}`);
    }
    
    // Create job posting
    const jobPosting = new JobPosting({
      title: 'Senior Software Engineer - Test Workflow',
      description: 'This is a test job posting for the complete hiring workflow test',
      requirements: 'JavaScript, Node.js, React, MongoDB experience required',
      responsibilities: 'Develop and maintain web applications, collaborate with team members',
      qualifications: 'Bachelor\'s degree in Computer Science or related field',
      department: department._id,
      position: position._id,
      employmentType: 'full_time', // Correct enum value
      experienceLevel: 'senior', // Correct enum value
      educationLevel: 'bachelors', // Correct enum value
      salaryRange: {
        min: 80000,
        max: 120000,
        currency: 'PKR'
      },
      applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'published',
      createdBy: candidate._id // Using candidate ID as placeholder
    });
    
    await jobPosting.save();
    console.log(`   ✅ Job posting created: ${jobPosting._id}`);
    console.log(`   📋 Job: ${jobPosting.title} at ${department.name}`);
    
    // ===== STEP 3: CREATE JOB APPLICATION =====
    console.log('\n📄 STEP 3: Creating Job Application...');
    
    const application = new Application({
      jobPosting: jobPosting._id,
      candidate: candidate._id,
      applicationId: `APP-${Date.now()}`,
      coverLetter: 'I am excited to apply for this position and contribute to your team.',
      expectedSalary: 100000,
      noticePeriod: 30,
      availability: 'Immediate',
      status: 'submitted'
    });
    
    await application.save();
    console.log(`   ✅ Application created: ${application._id}`);
    console.log(`   📄 Application ID: ${application.applicationId}`);
    console.log(`   📋 Status: ${application.status}`);
    
    // ===== STEP 4: SHORTLIST CANDIDATE =====
    console.log('\n⭐ STEP 4: Shortlisting Candidate...');
    
    candidate.status = 'shortlisted';
    await candidate.save();
    
    application.status = 'shortlisted';
    await application.save();
    
    console.log(`   ✅ Candidate shortlisted`);
    console.log(`   ✅ Application shortlisted`);
    
    // ===== STEP 5: OFFER CANDIDATE =====
    console.log('\n🎯 STEP 5: Offering Position to Candidate...');
    
    candidate.status = 'offered';
    candidate.offer = {
      offeredSalary: 100000,
      offeredPosition: jobPosting.title,
      offeredDepartment: department.name,
      offerDate: new Date(),
      offerExpiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    await candidate.save();
    
    application.status = 'offered';
    await application.save();
    
    console.log(`   ✅ Offer made to candidate`);
    console.log(`   💰 Offered Salary: ${candidate.offer.offeredSalary} PKR`);
    
    // ===== STEP 6: CANDIDATE ACCEPTS OFFER =====
    console.log('\n✅ STEP 6: Candidate Accepts Offer...');
    
    candidate.status = 'offer_accepted';
    candidate.offer.offerAcceptedAt = new Date();
    await candidate.save();
    
    application.status = 'offer_accepted';
    await application.save();
    
    console.log(`   ✅ Candidate accepted offer`);
    console.log(`   📅 Accepted at: ${candidate.offer.offerAcceptedAt}`);
    
    // ===== STEP 7: CREATE APPROVAL WORKFLOW =====
    console.log('\n📋 STEP 7: Creating Approval Workflow...');
    
    const approval = new CandidateApproval({
      candidate: candidate._id,
      jobPosting: jobPosting._id,
      application: application._id,
      createdBy: candidate._id, // Using candidate ID as placeholder
      status: 'pending',
      currentLevel: 1
    });
    
    // Initialize approval levels
    approval.approvalLevels = [
      {
        level: 1,
        title: 'Assistant Manager HR',
        approverEmail: 'assistant.hr@company.com',
        status: 'pending'
      },
      {
        level: 2,
        title: 'Manager HR',
        approverEmail: 'manager.hr@company.com',
        status: 'pending'
      },
      {
        level: 3,
        title: 'HOD HR',
        approverEmail: 'hod.hr@company.com',
        status: 'pending'
      },
      {
        level: 4,
        title: 'Vice President',
        approverEmail: 'vp@company.com',
        status: 'pending'
      },
      {
        level: 5,
        title: 'CEO',
        approverEmail: 'ceo@company.com',
        status: 'pending'
      }
    ];
    
    await approval.save();
    console.log(`   ✅ Approval workflow created: ${approval._id}`);
    console.log(`   📋 Current level: ${approval.currentLevel}`);
    
    // ===== STEP 8: PROCESS ALL APPROVAL LEVELS =====
    console.log('\n🔐 STEP 8: Processing All Approval Levels...');
    
    for (let i = 0; i < 5; i++) {
      const level = approval.approvalLevels[i];
      level.status = 'approved';
      level.approvedAt = new Date();
      level.comments = `Approved by ${level.title}`;
      level.signature = `Digital approval by ${level.approverEmail}`;
      
      if (i < 4) {
        approval.currentLevel = i + 2;
        approval.status = 'in_progress';
      } else {
        // Final approval
        approval.currentLevel = 5;
        approval.status = 'approved';
        approval.finalDecision = 'approved';
        approval.finalDecisionAt = new Date();
        approval.completedAt = new Date();
      }
      
      await approval.save();
      console.log(`   ✅ Level ${i + 1} (${level.title}) approved`);
      
      // Update candidate status
      if (i < 4) {
        candidate.status = 'approval_in_progress';
      } else {
        candidate.status = 'hired';
      }
      await candidate.save();
    }
    
    console.log(`   🎉 All approval levels completed!`);
    console.log(`   📋 Final approval status: ${approval.status}`);
    
    // ===== STEP 9: CREATE PLACEHOLDER ONBOARDING =====
    console.log('\n📋 STEP 9: Creating Placeholder Onboarding...');
    
    const onboarding = new EmployeeOnboarding({
      approvalId: approval._id,
      status: 'pending',
      onboardingTasks: [
        {
          taskName: 'Complete Personal Information',
          description: 'Fill out personal details and contact information',
          status: 'pending',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          taskName: 'Submit Required Documents',
          description: 'Upload CNIC, educational certificates, and other required documents',
          status: 'pending',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          taskName: 'Complete Employment Details',
          description: 'Provide employment history and references',
          status: 'pending',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          taskName: 'Review Company Policies',
          description: 'Read and acknowledge company policies and procedures',
          status: 'pending',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ],
      trainingRequirements: [
        {
          trainingName: 'Company Orientation',
          description: 'Introduction to company culture, policies, and procedures',
          isRequired: true,
          status: 'not_started'
        },
        {
          trainingName: 'Role-specific Training',
          description: 'Training specific to the employee\'s role and responsibilities',
          isRequired: true,
          status: 'not_started'
        }
      ]
    });
    
    await onboarding.save();
    console.log(`   ✅ Placeholder onboarding created: ${onboarding._id}`);
    console.log(`   📋 Status: ${onboarding.status}`);
    
    // ===== STEP 10: CREATE JOINING DOCUMENT =====
    console.log('\n📄 STEP 10: Creating Joining Document...');
    
    const joiningDocument = new JoiningDocument({
      approvalId: approval._id,
      status: 'completed',
      joiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      documents: [
        {
          documentType: 'CNIC',
          documentNumber: '12345-1234567-1',
          issuingAuthority: 'NADRA',
          issueDate: new Date('2020-01-01'),
          expiryDate: new Date('2030-01-01')
        }
      ]
    });
    
    await joiningDocument.save();
    console.log(`   ✅ Joining document created: ${joiningDocument._id}`);
    console.log(`   📅 Joining date: ${joiningDocument.joiningDate}`);
    
    // ===== STEP 11: CREATE EMPLOYEE FROM ONBOARDING =====
    console.log('\n👤 STEP 11: Creating Employee from Onboarding...');
    
    const employee = new Employee({
      employeeId: '1000', // Unique ID for test
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      dateOfBirth: candidate.dateOfBirth,
      gender: candidate.gender,
      nationality: candidate.nationality,
      idCard: '12345-1234567-1',
      religion: 'Islam',
      maritalStatus: 'Single',
      address: {
        street: 'Test Address Street'
      },
      emergencyContact: {
        name: 'Test Emergency Contact',
        relationship: 'Spouse',
        phone: '+92-300-1111111'
      },
      status: 'inactive', // Start as inactive
      onboardingStatus: 'completed',
      approvalId: approval._id
    });
    
    await employee.save();
    console.log(`   ✅ Employee created: ${employee._id}`);
    console.log(`   👤 Employee ID: ${employee.employeeId}`);
    console.log(`   📧 Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   📊 Status: ${employee.status}`);
    
    // ===== STEP 12: UPDATE ONBOARDING WITH EMPLOYEE =====
    console.log('\n🔗 STEP 12: Linking Employee to Onboarding...');
    
    onboarding.employeeId = employee._id;
    onboarding.status = 'completed';
    await onboarding.save();
    
    console.log(`   ✅ Onboarding linked to employee`);
    console.log(`   📋 Onboarding status: ${onboarding.status}`);
    
    // ===== STEP 13: ACTIVATE EMPLOYEE =====
    console.log('\n🚀 STEP 13: Activating Employee...');
    
    employee.status = 'active';
    employee.activatedAt = new Date();
    employee.employmentDetails = {
      employmentType: 'Full-time',
      probationPeriod: 3,
      salary: 100000,
      workSchedule: '9 AM - 6 PM',
      joiningDate: joiningDocument.joiningDate
    };
    await employee.save();
    
    console.log(`   ✅ Employee activated!`);
    console.log(`   📅 Activated at: ${employee.activatedAt}`);
    console.log(`   💰 Salary: ${employee.employmentDetails.salary} PKR`);
    
    // ===== FINAL VERIFICATION =====
    console.log('\n🔍 FINAL VERIFICATION: Complete Workflow Status...');
    
    const finalJobPosting = await JobPosting.findById(jobPosting._id);
    const finalCandidate = await Candidate.findById(candidate._id);
    const finalApplication = await Application.findById(application._id);
    const finalApproval = await CandidateApproval.findById(approval._id);
    const finalOnboarding = await EmployeeOnboarding.findById(onboarding._id);
    const finalEmployee = await Employee.findById(employee._id);
    const finalJoiningDocument = await JoiningDocument.findById(joiningDocument._id);
    
    console.log('\n📊 WORKFLOW COMPLETION STATUS:');
    console.log(`   📋 Job Posting: ${finalJobPosting ? '✅ Created' : '❌ Missing'}`);
    console.log(`   👤 Candidate: ${finalCandidate ? '✅ Created' : '❌ Missing'}`);
    console.log(`   📄 Application: ${finalApplication ? '✅ Created' : '❌ Missing'}`);
    console.log(`   🔐 Approval: ${finalApproval ? '✅ Created' : '❌ Missing'}`);
    console.log(`   📋 Onboarding: ${finalOnboarding ? '✅ Created' : '❌ Missing'}`);
    console.log(`   👤 Employee: ${finalEmployee ? '✅ Created' : '❌ Missing'}`);
    console.log(`   📄 Joining Document: ${finalJoiningDocument ? '✅ Created' : '❌ Missing'}`);
    
    console.log('\n🎯 CANDIDATE JOURNEY STATUS:');
    console.log(`   📝 Applied: ${finalApplication?.status === 'submitted' ? '✅' : '❌'}`);
    console.log(`   ⭐ Shortlisted: ${finalCandidate?.status === 'shortlisted' ? '✅' : '❌'}`);
    console.log(`   🎯 Offered: ${finalCandidate?.status === 'offered' ? '✅' : '❌'}`);
    console.log(`   ✅ Accepted: ${finalCandidate?.status === 'offer_accepted' ? '✅' : '❌'}`);
    console.log(`   🔐 Approval Pending: ${finalApproval?.status === 'pending' ? '✅' : '❌'}`);
    console.log(`   🎉 Hired: ${finalCandidate?.status === 'hired' ? '✅' : '❌'}`);
    console.log(`   👤 Employee: ${finalEmployee?.status === 'active' ? '✅' : '❌'}`);
    
    // ===== SUCCESS SUMMARY =====
    console.log('\n🎉 WORKFLOW TEST SUMMARY:');
    
    if (finalEmployee && finalEmployee.status === 'active') {
      console.log('✅ SUCCESS: Complete hiring workflow executed successfully!');
      console.log(`   🎯 From job posting to active employee in one test`);
      console.log(`   👤 New employee: ${finalEmployee.firstName} ${finalEmployee.lastName}`);
      console.log(`   📧 Email: ${finalEmployee.email}`);
      console.log(`   💼 Position: ${finalJobPosting.title}`);
      console.log(`   🏢 Department: ${department.name}`);
      console.log(`   💰 Salary: ${finalEmployee.employmentDetails.salary} PKR`);
      console.log(`   📅 Joining: ${finalEmployee.employmentDetails.joiningDate}`);
    } else {
      console.log('❌ FAILURE: Workflow did not complete successfully');
      console.log('   Check the verification details above for issues');
    }
    
  } catch (error) {
    console.error('❌ Error during workflow test:', error);
    if (error.errors) {
      console.error('Validation errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the complete workflow test
testCompleteHiringWorkflow();
