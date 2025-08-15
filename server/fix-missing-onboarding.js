const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const CandidateApproval = require('./models/hr/CandidateApproval');
const EmployeeOnboarding = require('./models/hr/EmployeeOnboarding');
const Candidate = require('./models/hr/Candidate');

async function fixMissingOnboarding() {
  try {
    console.log('🔧 Fixing Missing Onboarding Records...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // Find approved approvals that don't have onboarding records
    console.log('📋 Step 1: Finding approved approvals without onboarding records...');
    
    const approvedApprovals = await CandidateApproval.find({ status: 'approved' })
      .populate('candidate', 'firstName lastName email');
    
    console.log(`Found ${approvedApprovals.length} approved approvals`);
    
    for (const approval of approvedApprovals) {
      console.log(`\n🔍 Checking approval: ${approval._id}`);
      console.log(`   Candidate: ${approval.candidate?.firstName} ${approval.candidate?.lastName}`);
      console.log(`   Status: ${approval.status}`);
      
      // Check if onboarding exists
      const existingOnboarding = await EmployeeOnboarding.findOne({ approvalId: approval._id });
      
      if (existingOnboarding) {
        console.log(`   ✅ Onboarding already exists: ${existingOnboarding._id}`);
      } else {
        console.log(`   ❌ No onboarding found - creating one...`);
        
        try {
          // Create placeholder onboarding with correct schema
          const placeholderOnboarding = new EmployeeOnboarding({
            approvalId: approval._id,
            status: 'pending',
            // Onboarding tasks with correct field names
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
            // Training requirements with correct enum values
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
          
          await placeholderOnboarding.save();
          console.log(`   ✅ Created onboarding record: ${placeholderOnboarding._id}`);
        } catch (error) {
          console.error(`   ❌ Failed to create onboarding: ${error.message}`);
          if (error.errors) {
            console.error(`   Validation errors:`, Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
          }
        }
      }
    }
    
    // Summary
    console.log('\n📊 Step 2: Summary...');
    const totalOnboardings = await EmployeeOnboarding.countDocuments();
    console.log(`Total onboarding records: ${totalOnboardings}`);
    
    if (totalOnboardings > 0) {
      console.log('\n✅ SUCCESS: Missing onboarding records have been created!');
      console.log('Now candidates can access the onboarding form.');
    } else {
      console.log('\n❌ FAILURE: No onboarding records were created.');
    }
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the fix
fixMissingOnboarding();
