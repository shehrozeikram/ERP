const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const EmployeeOnboarding = require('./models/hr/EmployeeOnboarding');
const Employee = require('./models/hr/Employee');
const CandidateApproval = require('./models/hr/CandidateApproval');
const Candidate = require('./models/hr/Candidate');
const JoiningDocument = require('./models/hr/JoiningDocument');

async function debugDatabase() {
  try {
    console.log('🔍 Debugging Database Contents...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database\n');
    
    // Check all collections
    console.log('📊 Checking all collections...\n');
    
    // 1. Candidate Approvals
    console.log('1️⃣  CANDIDATE APPROVALS:');
    const approvals = await CandidateApproval.find().sort({ createdAt: -1 }).limit(5);
    console.log(`   Found ${approvals.length} approval records`);
    if (approvals.length > 0) {
      approvals.forEach((approval, index) => {
        console.log(`   ${index + 1}. ID: ${approval._id}`);
        console.log(`      Status: ${approval.status}`);
        console.log(`      Current Level: ${approval.currentLevel}`);
        console.log(`      Created: ${approval.createdAt}`);
        console.log(`      Candidate: ${approval.candidate}`);
        console.log(`      Job Posting: ${approval.jobPosting}`);
        console.log('');
      });
    }
    
    // 2. Candidates
    console.log('2️⃣  CANDIDATES:');
    const candidates = await Candidate.find().sort({ createdAt: -1 }).limit(5);
    console.log(`   Found ${candidates.length} candidate records`);
    if (candidates.length > 0) {
      candidates.forEach((candidate, index) => {
        console.log(`   ${index + 1}. ID: ${candidate._id}`);
        console.log(`      Name: ${candidate.firstName} ${candidate.lastName}`);
        console.log(`      Email: ${candidate.email}`);
        console.log(`      Status: ${candidate.status}`);
        console.log(`      Created: ${candidate.createdAt}`);
        console.log('');
      });
    }
    
    // 3. Employee Onboarding
    console.log('3️⃣  EMPLOYEE ONBOARDING:');
    const onboardings = await EmployeeOnboarding.find().sort({ createdAt: -1 }).limit(5);
    console.log(`   Found ${onboardings.length} onboarding records`);
    if (onboardings.length > 0) {
      onboardings.forEach((onboarding, index) => {
        console.log(`   ${index + 1}. ID: ${onboarding._id}`);
        console.log(`      Status: ${onboarding.status}`);
        console.log(`      Approval ID: ${onboarding.approvalId}`);
        console.log(`      Employee ID: ${onboarding.employeeId}`);
        console.log(`      Joining Document ID: ${onboarding.joiningDocumentId}`);
        console.log(`      Created: ${onboarding.createdAt}`);
        console.log('');
      });
    }
    
    // 4. Employees
    console.log('4️⃣  EMPLOYEES:');
    const employees = await Employee.find().sort({ createdAt: -1 }).limit(5);
    console.log(`   Found ${employees.length} employee records`);
    if (employees.length > 0) {
      employees.forEach((employee, index) => {
        console.log(`   ${index + 1}. ID: ${employee._id}`);
        console.log(`      Employee ID: ${employee.employeeId}`);
        console.log(`      Name: ${employee.firstName} ${employee.lastName}`);
        console.log(`      Email: ${employee.email}`);
        console.log(`      Status: ${employee.status}`);
        console.log(`      Created: ${employee.createdAt}`);
        console.log('');
      });
    }
    
    // 5. Joining Documents
    console.log('5️⃣  JOINING DOCUMENTS:');
    const joiningDocs = await JoiningDocument.find().sort({ createdAt: -1 }).limit(5);
    console.log(`   Found ${joiningDocs.length} joining document records`);
    if (joiningDocs.length > 0) {
      joiningDocs.forEach((doc, index) => {
        console.log(`   ${index + 1}. ID: ${doc._id}`);
        console.log(`      Status: ${doc.status}`);
        console.log(`      Approval ID: ${doc.approvalId}`);
        console.log(`      Created: ${doc.createdAt}`);
        console.log('');
      });
    }
    
    // 6. Check for any records with recent timestamps
    console.log('6️⃣  RECENT RECORDS (Last 24 hours):');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentApprovals = await CandidateApproval.countDocuments({ createdAt: { $gte: oneDayAgo } });
    const recentOnboardings = await EmployeeOnboarding.countDocuments({ createdAt: { $gte: oneDayAgo } });
    const recentEmployees = await Employee.countDocuments({ createdAt: { $gte: oneDayAgo } });
    const recentJoiningDocs = await JoiningDocument.countDocuments({ createdAt: { $gte: oneDayAgo } });
    
    console.log(`   Recent Approvals: ${recentApprovals}`);
    console.log(`   Recent Onboardings: ${recentOnboardings}`);
    console.log(`   Recent Employees: ${recentEmployees}`);
    console.log(`   Recent Joining Docs: ${recentJoiningDocs}`);
    
    // 7. Check database stats
    console.log('\n7️⃣  DATABASE STATS:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   Total Collections: ${collections.length}`);
    collections.forEach(collection => {
      console.log(`      - ${collection.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error during database debug:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the debug
debugDatabase();
