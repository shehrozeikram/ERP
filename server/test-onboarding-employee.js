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
const Candidate = mongoose.model('Candidate');

async function testOnboardingEmployeeCreation() {
  try {
    console.log('🔍 Testing Onboarding to Employee Creation...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // 1. Find the most recent onboarding record
    console.log('📋 Step 1: Finding most recent onboarding record...');
    const latestOnboarding = await EmployeeOnboarding.findOne()
      .sort({ createdAt: -1 })
      .populate({
        path: 'approvalId',
        populate: {
          path: 'candidate',
          select: 'firstName lastName email phone'
        }
      });
    
    if (!latestOnboarding) {
      console.log('❌ No onboarding records found');
      return;
    }
    
    console.log('✅ Latest onboarding record found:');
    console.log(`   - ID: ${latestOnboarding._id}`);
    console.log(`   - Status: ${latestOnboarding.status}`);
    console.log(`   - Created: ${latestOnboarding.createdAt}`);
    console.log(`   - Approval ID: ${latestOnboarding.approvalId?._id || 'Not populated'}`);
    console.log(`   - Candidate: ${latestOnboarding.approvalId?.candidate?.firstName || 'N/A'} ${latestOnboarding.approvalId?.candidate?.lastName || 'N/A'}`);
    console.log(`   - Candidate Email: ${latestOnboarding.approvalId?.candidate?.email || 'N/A'}`);
    console.log(`   - Joining Document ID: ${latestOnboarding.joiningDocumentId || 'Not set'}`);
    console.log(`   - Employee ID: ${latestOnboarding.employeeId || 'Not set'}`);
    
    // 2. Check if corresponding employee exists
    console.log('\n👤 Step 2: Checking for corresponding employee...');
    
    let employee = null;
    
    // Try to find by employeeId from onboarding
    if (latestOnboarding.employeeId) {
      employee = await Employee.findById(latestOnboarding.employeeId);
      if (employee) {
        console.log('✅ Employee found by onboarding.employeeId');
      }
    }
    
    // If not found by employeeId, try to find by email
    if (!employee && latestOnboarding.approvalId?.candidate?.email) {
      employee = await Employee.findOne({ email: latestOnboarding.approvalId.candidate.email });
      if (employee) {
        console.log('✅ Employee found by candidate email');
      }
    }
    
    // If still not found, try to find by approvalId
    if (!employee && latestOnboarding.approvalId?._id) {
      employee = await Employee.findOne({ approvalId: latestOnboarding.approvalId._id });
      if (employee) {
        console.log('✅ Employee found by approvalId');
      }
    }
    
    if (employee) {
      console.log('\n✅ Employee record found:');
      console.log(`   - ID: ${employee._id}`);
      console.log(`   - Employee ID: ${employee.employeeId}`);
      console.log(`   - Name: ${employee.firstName} ${employee.lastName}`);
      console.log(`   - Email: ${employee.email}`);
      console.log(`   - Status: ${employee.status}`);
      console.log(`   - Created: ${employee.createdAt}`);
      console.log(`   - Approval ID: ${employee.approvalId || 'Not set'}`);
      
      // Check if onboarding has the correct employeeId
      if (latestOnboarding.employeeId && latestOnboarding.employeeId.toString() === employee._id.toString()) {
        console.log('\n✅ Onboarding and Employee are properly linked!');
      } else {
        console.log('\n⚠️  Onboarding and Employee are NOT properly linked!');
        console.log(`   - Onboarding.employeeId: ${latestOnboarding.employeeId}`);
        console.log(`   - Employee._id: ${employee._id}`);
      }
    } else {
      console.log('\n❌ No corresponding employee record found!');
      
      // Show all employees to see what's in the table
      console.log('\n📊 Checking all employees in the system...');
      const allEmployees = await Employee.find().select('employeeId firstName lastName email status createdAt').sort({ createdAt: -1 }).limit(10);
      
      if (allEmployees.length > 0) {
        console.log(`Found ${allEmployees.length} employees (showing last 10):`);
        allEmployees.forEach((emp, index) => {
          console.log(`   ${index + 1}. ${emp.employeeId} - ${emp.firstName} ${emp.lastName} (${emp.email}) - ${emp.status}`);
        });
      } else {
        console.log('No employees found in the system');
      }
    }
    
    // 3. Check approval status
    console.log('\n📋 Step 3: Checking approval status...');
    if (latestOnboarding.approvalId) {
      const approval = await CandidateApproval.findById(latestOnboarding.approvalId._id);
      if (approval) {
        console.log('✅ Approval record found:');
        console.log(`   - Status: ${approval.status}`);
        console.log(`   - Current Level: ${approval.currentLevel}`);
        console.log(`   - All Levels Approved: ${approval.approvalLevels.every(level => level.status === 'approved')}`);
        
        // Show approval levels
        approval.approvalLevels.forEach((level, index) => {
          console.log(`   - Level ${index + 1} (${level.role}): ${level.status} by ${level.approverEmail}`);
        });
      }
    }
    
    // 4. Summary
    console.log('\n📋 Step 4: Summary...');
    if (employee) {
      console.log('✅ SUCCESS: Employee was properly created from onboarding');
      console.log(`   - Onboarding ID: ${latestOnboarding._id}`);
      console.log(`   - Employee ID: ${employee._id}`);
      console.log(`   - Status: ${employee.status}`);
    } else {
      console.log('❌ FAILURE: Employee was NOT created from onboarding');
      console.log('   Possible issues:');
      console.log('   - Employee creation failed during onboarding process');
      console.log('   - Employee was created but not linked properly');
      console.log('   - Employee was created but with different data');
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
testOnboardingEmployeeCreation();
