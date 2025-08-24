const mongoose = require('mongoose');
require('./models/hr/Candidate');
require('./models/hr/Employee');
require('./models/hr/CandidateApproval');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/JoiningDocument');
require('./models/hr/JobPosting');
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/User');

async function completeCandidateWorkflow() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Candidate = mongoose.model('Candidate');
    const Employee = mongoose.model('Employee');
    const CandidateApproval = mongoose.model('CandidateApproval');
    const EmployeeOnboarding = mongoose.model('EmployeeOnboarding');
    const JoiningDocument = mongoose.model('JoiningDocument');
    const JobPosting = mongoose.model('JobPosting');
    const Department = mongoose.model('Department');
    const Position = mongoose.model('Position');
    
    console.log('\n🚀 COMPLETING CANDIDATE WORKFLOW');
    console.log('=' .repeat(80));
    
    // Step 1: Find an approved candidate
    console.log('\n📋 STEP 1: Finding Approved Candidate...');
    const approvedCandidate = await Candidate.findOne({ status: 'approved' });
    
    if (!approvedCandidate) {
      console.log('❌ No approved candidates found');
      return;
    }
    
    console.log(`✅ Found approved candidate: ${approvedCandidate.firstName} ${approvedCandidate.lastName}`);
    console.log(`   📧 Email: ${approvedCandidate.email}`);
    console.log(`   🆔 MongoDB ID: ${approvedCandidate._id}`);
    
    // Step 2: Find or create candidate approval
    console.log('\n📋 STEP 2: Finding/Creating Candidate Approval...');
    let approval = await CandidateApproval.findOne({ 
      candidate: approvedCandidate._id 
    });
    
    if (!approval) {
      console.log('⚠️ No approval found, creating one...');
      
      // Find a job posting or create one
      let jobPosting = await JobPosting.findOne();
      if (!jobPosting) {
        console.log('⚠️ No job posting found, creating one...');
        
        // Find or create department
        let department = await Department.findOne();
        if (!department) {
          department = new Department({
            name: 'General Department',
            code: 'GEN',
            description: 'General Department for Testing',
            isActive: true
          });
          await department.save();
          console.log(`   ✅ Created department: ${department._id}`);
        }
        
        // Find or create position
        let position = await Position.findOne();
        if (!position) {
          position = new Position({
            title: 'General Position',
            code: 'GP',
            department: department._id,
            description: 'General Position for Testing',
            isActive: true
          });
          await position.save();
          console.log(`   ✅ Created position: ${position._id}`);
        }
        
        jobPosting = new JobPosting({
          title: 'Test Position',
          description: 'Test job posting for workflow completion',
          department: department._id,
          position: position._id,
          location: null,
          employmentType: 'full_time',
          experienceLevel: 'entry',
          educationLevel: 'bachelors',
          requirements: 'General requirements for the position',
          responsibilities: 'General responsibilities for the position',
          qualifications: 'Bachelor degree or equivalent',
          salaryRange: {
            min: 50000,
            max: 100000,
            currency: 'PKR'
          },
          benefits: ['Health Insurance', 'Paid Leave', 'Professional Development'],
          applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          positionsAvailable: 1,
          status: 'published',
          createdBy: new mongoose.Types.ObjectId() // Create a dummy ObjectId
        });
        await jobPosting.save();
        console.log(`   ✅ Created job posting: ${jobPosting._id}`);
      }
      
      approval = new CandidateApproval({
        candidate: approvedCandidate._id,
        jobPosting: jobPosting._id,
        status: 'approved',
        approvedBy: null, // No user reference for now
        approvedAt: new Date(),
        notes: 'Auto-approved for workflow completion'
      });
      await approval.save();
      console.log(`   ✅ Created approval: ${approval._id}`);
    } else {
      console.log(`✅ Found existing approval: ${approval._id}`);
      console.log(`   📊 Status: ${approval.status}`);
      
      // Check if approval has job posting, if not create one
      if (!approval.jobPosting) {
        console.log('⚠️ Approval has no job posting, creating one...');
        
        // Find or create department
        let department = await Department.findOne();
        if (!department) {
          department = new Department({
            name: 'General Department',
            code: 'GEN',
            description: 'General Department for Testing',
            isActive: true
          });
          await department.save();
          console.log(`   ✅ Created department: ${department._id}`);
        }
        
        // Find or create position
        let position = await Position.findOne();
        if (!position) {
          position = new Position({
            title: 'General Position',
            code: 'GP',
            department: department._id,
            description: 'General Position for Testing',
            isActive: true
          });
          await position.save();
          console.log(`   ✅ Created position: ${position._id}`);
        }
        
        const jobPosting = new JobPosting({
          title: 'Test Position',
          description: 'Test job posting for workflow completion',
          department: department._id,
          position: position._id,
          location: null,
          employmentType: 'full_time',
          experienceLevel: 'entry',
          educationLevel: 'bachelors',
          requirements: 'General requirements for the position',
          responsibilities: 'General responsibilities for the position',
          qualifications: 'Bachelor degree or equivalent',
          salaryRange: {
            min: 50000,
            max: 100000,
            currency: 'PKR'
          },
          benefits: ['Health Insurance', 'Paid Leave', 'Professional Development'],
          applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          positionsAvailable: 1,
          status: 'published',
          createdBy: null // Will be set to null for now
        });
        await jobPosting.save();
        console.log(`   ✅ Created job posting: ${jobPosting._id}`);
        
        // Update approval with job posting
        approval.jobPosting = jobPosting._id;
        await approval.save();
        console.log(`   ✅ Updated approval with job posting`);
      } else {
        // Check if the referenced job posting actually exists
        const jobPostingExists = await JobPosting.findById(approval.jobPosting);
        if (!jobPostingExists) {
          console.log('⚠️ Referenced job posting does not exist, creating new one...');
          
          // Find or create department
          let department = await Department.findOne();
          if (!department) {
            department = new Department({
              name: 'General Department',
              code: 'GEN',
              description: 'General Department for Testing',
              isActive: true
            });
            await department.save();
            console.log(`   ✅ Created department: ${department._id}`);
          }
          
          // Find or create position
          let position = await Position.findOne();
          if (!position) {
            position = new Position({
              title: 'General Position',
              code: 'GP',
              department: department._id,
              description: 'General Position for Testing',
              isActive: true
            });
            await position.save();
            console.log(`   ✅ Created position: ${position._id}`);
          }
          
          const newJobPosting = new JobPosting({
            title: 'Test Position',
            description: 'Test job posting for workflow completion',
            department: department._id,
            position: position._id,
            location: null,
            employmentType: 'full_time',
            experienceLevel: 'entry',
            educationLevel: 'bachelors',
            requirements: 'General requirements for the position',
            responsibilities: 'General responsibilities for the position',
            qualifications: 'Bachelor degree or equivalent',
            salaryRange: {
              min: 50000,
              max: 100000,
              currency: 'PKR'
            },
            benefits: ['Health Insurance', 'Paid Leave', 'Professional Development'],
            applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            positionsAvailable: 1,
            status: 'published',
            createdBy: new mongoose.Types.ObjectId() // Create a dummy ObjectId
          });
          await newJobPosting.save();
          console.log(`   ✅ Created new job posting: ${newJobPosting._id}`);
          
          // Update approval with new job posting
          approval.jobPosting = newJobPosting._id;
          await approval.save();
          console.log(`   ✅ Updated approval with new job posting`);
        }
      }
    }
    
    // Step 3: Create joining document
    console.log('\n📋 STEP 3: Creating Joining Document...');
    let joiningDocument = await JoiningDocument.findOne({ 
      approvalId: approval._id 
    });
    
    if (!joiningDocument) {
      console.log('⚠️ No joining document found, creating one...');
      
      // Get job posting from approval
      const approvalWithJob = await CandidateApproval.findById(approval._id).populate('jobPosting');
      if (!approvalWithJob?.jobPosting) {
        throw new Error('No job posting found in approval');
      }
      
      console.log(`   📋 Using job posting: ${approvalWithJob.jobPosting.title}`);
      
      joiningDocument = new JoiningDocument({
        approvalId: approval._id,
        candidateId: approvedCandidate._id,
        jobPostingId: approvalWithJob.jobPosting._id, // Required field
        employeeName: `${approvedCandidate.firstName} ${approvedCandidate.lastName}`,
        guardianRelation: 'Self',
        guardianName: approvedCandidate.firstName,
        cnic: '12345-1234567-1',
        contactNo: approvedCandidate.phone,
        dutyLocation: 'Main Office',
        dutyDate: new Date(),
        dutyTime: '9:00 AM',
        department: 'General Department',
        hodName: 'Department Head',
        joiningRemarks: 'Auto-generated for workflow completion',
        status: 'submitted', // Valid enum value
        formData: {
          personalInfo: {
            firstName: approvedCandidate.firstName,
            lastName: approvedCandidate.lastName,
            email: approvedCandidate.email,
            phone: approvedCandidate.phone,
            dateOfBirth: approvedCandidate.dateOfBirth,
            gender: approvedCandidate.gender,
            nationality: approvedCandidate.nationality
          },
          employmentDetails: {
            joiningDate: new Date(),
            employmentType: 'Full-time',
            probationPeriod: 3,
            expectedSalary: approvedCandidate.expectedSalary || 75000,
            workSchedule: '9 AM - 6 PM'
          }
        }
      });
      
      await joiningDocument.save();
      console.log(`   ✅ Created joining document: ${joiningDocument._id}`);
    } else {
      console.log(`✅ Found existing joining document: ${joiningDocument._id}`);
      console.log(`   📊 Status: ${joiningDocument.status}`);
    }
    
    // Step 4: Create or update employee onboarding
    console.log('\n📋 STEP 4: Creating/Updating Employee Onboarding...');
    let onboarding = await EmployeeOnboarding.findOne({ 
      approvalId: approval._id 
    });
    
    if (!onboarding) {
      console.log('⚠️ No onboarding found, creating one...');
      
      onboarding = new EmployeeOnboarding({
        approvalId: approval._id,
        joiningDocumentId: joiningDocument._id,
        status: 'pending',
        createdBy: null
      });
      await onboarding.save();
      console.log(`   ✅ Created onboarding: ${onboarding._id}`);
    } else {
      console.log(`✅ Found existing onboarding: ${onboarding._id}`);
      console.log(`   📊 Status: ${onboarding.status}`);
    }
    
    // Step 5: Create employee record
    console.log('\n📋 STEP 5: Creating Employee Record...');
    
    // Check if employee already exists
    const existingEmployee = await Employee.findOne({ 
      email: approvedCandidate.email 
    });
    
    if (existingEmployee) {
      console.log(`⚠️ Employee already exists: ${existingEmployee._id}`);
      console.log(`   👤 Name: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
      console.log(`   🆔 Employee ID: ${existingEmployee.employeeId}`);
    } else {
      console.log('⚠️ No employee found, creating one...');
      
      // Generate unique employee ID
      const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });
      const nextEmployeeId = lastEmployee ? 
        (parseInt(lastEmployee.employeeId) + 1).toString() : 
        '7000'; // Start from 7000 to avoid conflicts
      
      const employee = new Employee({
        employeeId: nextEmployeeId,
        firstName: approvedCandidate.firstName,
        lastName: approvedCandidate.lastName,
        email: approvedCandidate.email,
        phone: approvedCandidate.phone,
        dateOfBirth: approvedCandidate.dateOfBirth,
        gender: approvedCandidate.gender,
        nationality: approvedCandidate.nationality,
        idCard: joiningDocument.cnic || '12345-1234567-1', // Use cnic from joining document
        religion: 'Islam', // Default value
        maritalStatus: 'Single', // Default value
        address: {
          street: 'Test Street Address' // Default address
        },
        emergencyContact: {
          name: joiningDocument.guardianName || 'Emergency Contact',
          relationship: joiningDocument.guardianRelation || 'Spouse',
          phone: '+92-300-1111111',
          address: 'Emergency Address'
        },
        status: 'inactive', // Start as inactive
        candidateId: approvedCandidate._id, // Link to candidate
        approvalId: approval._id,
        onboardingId: onboarding._id,
        hireDate: joiningDocument.dutyDate || new Date(),
        employmentDetails: {
          employmentType: 'Full-time',
          probationPeriod: 3,
          workSchedule: '9 AM - 6 PM'
        },
        salary: {
          gross: 75000, // Default salary
          basic: Math.round(75000 * 0.6666),
          houseRent: Math.round(75000 * 0.3),
          medical: Math.round(75000 * 0.1)
        }
      });
      
      await employee.save();
      console.log(`   ✅ Created employee: ${employee._id}`);
      console.log(`   👤 Name: ${employee.firstName} ${employee.lastName}`);
      console.log(`   🆔 Employee ID: ${employee.employeeId}`);
      console.log(`   📧 Email: ${employee.email}`);
      console.log(`   💰 Salary: ${employee.salary.gross} PKR`);
      
      // Update onboarding with employee ID
      onboarding.employeeId = employee._id;
      onboarding.status = 'completed';
      await onboarding.save();
      console.log(`   ✅ Updated onboarding with employee ID`);
      
      // Update candidate status
      await Candidate.findByIdAndUpdate(approvedCandidate._id, {
        status: 'onboarding_completed',
        'hiringDetails.onboardingStatus': 'completed',
        'hiringDetails.employeeId': employee._id
      });
      console.log(`   ✅ Updated candidate status to onboarding_completed`);
      
      // Update approval status
      await CandidateApproval.findByIdAndUpdate(approval._id, {
        status: 'completed'
      });
      console.log(`   ✅ Updated approval status to completed`);
      
      console.log('\n🎉 WORKFLOW COMPLETED SUCCESSFULLY!');
      console.log(`   👤 Candidate: ${approvedCandidate.firstName} ${approvedCandidate.lastName}`);
      console.log(`   👔 Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
      console.log(`   📊 Status: ${employee.status}`);
      console.log(`   💰 Salary: ${employee.salary.gross} PKR`);
      console.log(`   📅 Hire Date: ${employee.hireDate.toLocaleDateString()}`);
    }
    
    // Final verification
    console.log('\n📋 FINAL VERIFICATION:');
    console.log('-'.repeat(40));
    
    const finalCandidate = await Candidate.findById(approvedCandidate._id);
    const finalEmployee = await Employee.findOne({ email: approvedCandidate.email });
    const finalOnboarding = await EmployeeOnboarding.findById(onboarding._id);
    const finalApproval = await CandidateApproval.findById(approval._id);
    const finalJoiningDoc = await JoiningDocument.findById(joiningDocument._id);
    
    console.log(`📊 Final Status:`);
    console.log(`   👤 Candidate: ${finalCandidate?.status || 'N/A'}`);
    console.log(`   👔 Employee: ${finalEmployee ? 'Created' : 'Not Created'}`);
    console.log(`   🚀 Onboarding: ${finalOnboarding?.status || 'N/A'}`);
    console.log(`   ✅ Approval: ${finalApproval?.status || 'N/A'}`);
    console.log(`   📄 Joining Doc: ${finalJoiningDoc?.status || 'N/A'}`);
    
    if (finalEmployee) {
      console.log(`\n🎯 Employee Details:`);
      console.log(`   🆔 Employee ID: ${finalEmployee.employeeId}`);
      console.log(`   📧 Email: ${finalEmployee.email}`);
      console.log(`   📊 Status: ${finalEmployee.status}`);
      console.log(`   🎯 Candidate ID: ${finalEmployee.candidateId}`);
      console.log(`   💰 Salary: ${finalEmployee.salary?.gross || 'N/A'} PKR`);
    }
    
  } catch (error) {
    console.error('❌ Error completing workflow:', error);
    if (error.errors) {
      console.error('Validation errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

completeCandidateWorkflow();
