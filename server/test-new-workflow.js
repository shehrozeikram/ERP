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

async function testNewWorkflow() {
  try {
    console.log('🧪 Testing New Simplified Onboarding Workflow...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // 1. Check existing onboarding records
    console.log('📋 Step 1: Checking existing onboarding records...');
    const onboardings = await EmployeeOnboarding.find().populate('approvalId');
    console.log(`Found ${onboardings.length} onboarding records`);
    
    if (onboardings.length > 0) {
      onboardings.forEach((onboarding, index) => {
        console.log(`   ${index + 1}. ID: ${onboarding._id}`);
        console.log(`      Status: ${onboarding.status}`);
        console.log(`      Approval ID: ${onboarding.approvalId?._id || 'Not populated'}`);
        console.log(`      Employee ID: ${onboarding.employeeId || 'Not set'}`);
        console.log(`      Tasks: ${onboarding.onboardingTasks?.length || 0}`);
        console.log('');
      });
    }
    
    // 2. Check existing employees
    console.log('👤 Step 2: Checking existing employees...');
    const employees = await Employee.find().sort({ createdAt: -1 }).limit(5);
    console.log(`Found ${employees.length} employee records`);
    
    if (employees.length > 0) {
      employees.forEach((employee, index) => {
        console.log(`   ${index + 1}. ID: ${employee._id}`);
        console.log(`      Employee ID: ${employee.employeeId}`);
        console.log(`      Name: ${employee.firstName} ${employee.lastName}`);
        console.log(`      Email: ${employee.email}`);
        console.log(`      Status: ${employee.status}`);
        console.log(`      Approval ID: ${employee.approvalId || 'Not set'}`);
        console.log(`      Onboarding Status: ${employee.onboardingStatus || 'Not set'}`);
        console.log('');
      });
    }
    
    // 3. Check approval records
    console.log('📋 Step 3: Checking approval records...');
    const approvals = await CandidateApproval.find({ status: 'approved' }).populate('candidate');
    console.log(`Found ${approvals.length} approved approvals`);
    
    if (approvals.length > 0) {
      approvals.forEach((approval, index) => {
        console.log(`   ${index + 1}. ID: ${approval._id}`);
        console.log(`      Status: ${approval.status}`);
        console.log(`      Candidate: ${approval.candidate?.firstName || 'N/A'} ${approval.candidate?.lastName || 'N/A'}`);
        console.log(`      Candidate Email: ${approval.candidate?.email || 'N/A'}`);
        console.log('');
      });
    }
    
    // 4. Summary of workflow status
    console.log('📊 Step 4: Workflow Status Summary...');
    
    const pendingOnboardings = onboardings.filter(o => o.status === 'pending').length;
    const completedOnboardings = onboardings.filter(o => o.status === 'completed').length;
    const inactiveEmployees = employees.filter(e => e.status === 'inactive').length;
    const activeEmployees = employees.filter(e => e.status === 'active').length;
    
    console.log(`   📋 Onboarding Records:`);
    console.log(`      - Pending: ${pendingOnboardings}`);
    console.log(`      - Completed: ${completedOnboardings}`);
    console.log(`      - Total: ${onboardings.length}`);
    
    console.log(`   👤 Employee Records:`);
    console.log(`      - Inactive: ${inactiveEmployees}`);
    console.log(`      - Active: ${activeEmployees}`);
    console.log(`      - Total: ${employees.length}`);
    
    console.log(`   📋 Approval Records:`);
    console.log(`      - Approved: ${approvals.length}`);
    
    // 5. Check for workflow completeness
    console.log('\n🔍 Step 5: Workflow Completeness Check...');
    
    let completeWorkflows = 0;
    let incompleteWorkflows = 0;
    
    for (const approval of approvals) {
      const onboarding = onboardings.find(o => o.approvalId?._id?.toString() === approval._id.toString());
      const employee = employees.find(e => e.approvalId?.toString() === approval._id.toString());
      
      if (onboarding && employee) {
        console.log(`   ✅ Complete workflow for approval ${approval._id}:`);
        console.log(`      - Onboarding: ${onboarding._id} (${onboarding.status})`);
        console.log(`      - Employee: ${employee._id} (${employee.status})`);
        completeWorkflows++;
      } else {
        console.log(`   ⚠️  Incomplete workflow for approval ${approval._id}:`);
        console.log(`      - Onboarding: ${onboarding ? '✅' : '❌'}`);
        console.log(`      - Employee: ${employee ? '✅' : '❌'}`);
        incompleteWorkflows++;
      }
    }
    
    console.log(`\n📊 Workflow Summary:`);
    console.log(`   - Complete workflows: ${completeWorkflows}`);
    console.log(`   - Incomplete workflows: ${incompleteWorkflows}`);
    console.log(`   - Total approved approvals: ${approvals.length}`);
    
    if (completeWorkflows === approvals.length) {
      console.log('\n🎉 SUCCESS: All workflows are complete!');
    } else {
      console.log('\n⚠️  Some workflows are incomplete. Check the details above.');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testNewWorkflow();
