const mongoose = require('mongoose');
require('./models/hr/Candidate');
require('./models/hr/Employee');
require('./models/hr/CandidateApproval');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/JoiningDocument');

async function checkCandidateWorkflow() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Candidate = mongoose.model('Candidate');
    const Employee = mongoose.model('Employee');
    const CandidateApproval = mongoose.model('CandidateApproval');
    const EmployeeOnboarding = mongoose.model('EmployeeOnboarding');
    const JoiningDocument = mongoose.model('JoiningDocument');
    
    console.log('\n🔍 CHECKING CANDIDATE WORKFLOW STATUS');
    console.log('=' .repeat(80));
    
    // 1. Check all candidates and their statuses
    console.log('\n📋 1. ALL CANDIDATES STATUS');
    console.log('-'.repeat(40));
    
    const allCandidates = await Candidate.find().sort({ createdAt: -1 });
    console.log(`Total candidates found: ${allCandidates.length}`);
    
    if (allCandidates.length > 0) {
      allCandidates.forEach((candidate, index) => {
        console.log(`\n${index + 1}. ${candidate.firstName} ${candidate.lastName}`);
        console.log(`   📧 Email: ${candidate.email}`);
        console.log(`   📱 Phone: ${candidate.phone}`);
        console.log(`   📊 Status: ${candidate.status}`);
        console.log(`   📅 Created: ${candidate.createdAt.toLocaleDateString()}`);
        console.log(`   🆔 MongoDB ID: ${candidate._id}`);
        
        if (candidate.offer) {
          console.log(`   💼 Offered Position: ${candidate.offer.offeredPosition || 'N/A'}`);
          console.log(`   💰 Offered Salary: ${candidate.offer.offeredSalary || 'N/A'}`);
        }
        
        if (candidate.hiringDetails) {
          console.log(`   🎯 Hiring Status: ${candidate.hiringDetails.onboardingStatus || 'N/A'}`);
          console.log(`   📅 Start Date: ${candidate.hiringDetails.startDate ? candidate.hiringDetails.startDate.toLocaleDateString() : 'N/A'}`);
        }
      });
    }
    
    // 2. Check candidates with specific statuses
    console.log('\n📋 2. CANDIDATES BY STATUS');
    console.log('-'.repeat(40));
    
    const statusCounts = {};
    allCandidates.forEach(candidate => {
      statusCounts[candidate.status] = (statusCounts[candidate.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} candidate(s)`);
    });
    
    // 3. Check candidates who have been hired
    console.log('\n📋 3. HIRED CANDIDATES');
    console.log('-'.repeat(40));
    
    const hiredCandidates = allCandidates.filter(c => 
      c.status === 'hired' || 
      c.status === 'joining_documents_filled' || 
      c.status === 'onboarding_completed'
    );
    
    if (hiredCandidates.length > 0) {
      console.log(`Found ${hiredCandidates.length} hired candidate(s):`);
      hiredCandidates.forEach((candidate, index) => {
        console.log(`\n   ${index + 1}. ${candidate.firstName} ${candidate.lastName}`);
        console.log(`      📧 Email: ${candidate.email}`);
        console.log(`      📊 Status: ${candidate.status}`);
        console.log(`      🆔 MongoDB ID: ${candidate._id}`);
      });
    } else {
      console.log('❌ No hired candidates found');
    }
    
    // 4. Check all employees and see if they have candidateId
    console.log('\n📋 4. EMPLOYEES WITH CANDIDATE REFERENCES');
    console.log('-'.repeat(40));
    
    const employeesWithCandidate = await Employee.find({ candidateId: { $exists: true, $ne: null } });
    console.log(`Employees with candidateId: ${employeesWithCandidate.length}`);
    
    if (employeesWithCandidate.length > 0) {
      employeesWithCandidate.forEach((employee, index) => {
        console.log(`\n   ${index + 1}. ${employee.firstName} ${employee.lastName}`);
        console.log(`      📧 Email: ${employee.email}`);
        console.log(`      🆔 Employee ID: ${employee.employeeId}`);
        console.log(`      📊 Status: ${employee.status}`);
        console.log(`      🎯 Candidate ID: ${employee.candidateId}`);
        console.log(`      🆔 MongoDB ID: ${employee._id}`);
      });
    } else {
      console.log('❌ No employees with candidateId found');
    }
    
    // 5. Check all employees (to see total count)
    console.log('\n📋 5. ALL EMPLOYEES');
    console.log('-'.repeat(40));
    
    const allEmployees = await Employee.find().sort({ createdAt: -1 });
    console.log(`Total employees found: ${allEmployees.length}`);
    
    if (allEmployees.length > 0) {
      console.log('\nRecent employees:');
      allEmployees.slice(0, 5).forEach((employee, index) => {
        console.log(`\n   ${index + 1}. ${employee.firstName} ${employee.lastName}`);
        console.log(`      📧 Email: ${employee.email}`);
        console.log(`      🆔 Employee ID: ${employee.employeeId}`);
        console.log(`      📊 Status: ${employee.status}`);
        console.log(`      📅 Created: ${employee.createdAt.toLocaleDateString()}`);
        console.log(`      🆔 MongoDB ID: ${employee._id}`);
        
        if (employee.candidateId) {
          console.log(`      🎯 Has candidateId: ${employee.candidateId}`);
        } else {
          console.log(`      ❌ No candidateId (manually created)`);
        }
      });
      
      if (allEmployees.length > 5) {
        console.log(`\n   ... and ${allEmployees.length - 5} more employees`);
      }
    }
    
    // 6. Check candidate approvals
    console.log('\n📋 6. CANDIDATE APPROVALS');
    console.log('-'.repeat(40));
    
    const allApprovals = await CandidateApproval.find().populate('candidate', 'firstName lastName email');
    console.log(`Total approvals found: ${allApprovals.length}`);
    
    if (allApprovals.length > 0) {
      allApprovals.forEach((approval, index) => {
        const candidateName = approval.candidate ? `${approval.candidate.firstName} ${approval.candidate.lastName}` : 'Unknown';
        console.log(`\n   ${index + 1}. ${candidateName}`);
        console.log(`      📧 Email: ${approval.candidate?.email || 'N/A'}`);
        console.log(`      📊 Status: ${approval.status}`);
        console.log(`      📅 Created: ${approval.createdAt.toLocaleDateString()}`);
        console.log(`      🆔 MongoDB ID: ${approval._id}`);
      });
    }
    
    // 7. Check joining documents
    console.log('\n📋 7. JOINING DOCUMENTS');
    console.log('-'.repeat(40));
    
    const allJoiningDocs = await JoiningDocument.find().populate('approvalId');
    console.log(`Total joining documents found: ${allJoiningDocs.length}`);
    
    if (allJoiningDocs.length > 0) {
      allJoiningDocs.forEach((doc, index) => {
        console.log(`\n   ${index + 1}. Joining Document`);
        console.log(`      📊 Status: ${doc.status}`);
        console.log(`      📅 Created: ${doc.createdAt.toLocaleDateString()}`);
        console.log(`      🆔 MongoDB ID: ${doc._id}`);
        console.log(`      🎯 Approval ID: ${doc.approvalId?._id || 'N/A'}`);
      });
    }
    
    // 8. Check employee onboarding
    console.log('\n📋 8. EMPLOYEE ONBOARDING');
    console.log('-'.repeat(40));
    
    const allOnboarding = await EmployeeOnboarding.find().populate('approvalId');
    console.log(`Total onboarding records found: ${allOnboarding.length}`);
    
    if (allOnboarding.length > 0) {
      allOnboarding.forEach((onboarding, index) => {
        console.log(`\n   ${index + 1}. Onboarding Record`);
        console.log(`      📊 Status: ${onboarding.status}`);
        console.log(`      📅 Created: ${onboarding.createdAt.toLocaleDateString()}`);
        console.log(`      🆔 MongoDB ID: ${onboarding._id}`);
        console.log(`      🎯 Approval ID: ${onboarding.approvalId?._id || 'N/A'}`);
        if (onboarding.employeeId) {
          console.log(`      👤 Employee ID: ${onboarding.employeeId}`);
        }
      });
    }
    
    // 9. Summary and workflow status
    console.log('\n📋 9. WORKFLOW SUMMARY');
    console.log('-'.repeat(40));
    
    const candidatesInWorkflow = allCandidates.filter(c => 
      c.status !== 'active' && c.status !== 'rejected' && c.status !== 'withdrawn'
    );
    
    console.log(`📊 Workflow Summary:`);
    console.log(`   👤 Total Candidates: ${allCandidates.length}`);
    console.log(`   🔄 In Workflow: ${candidatesInWorkflow.length}`);
    console.log(`   👔 Total Employees: ${allEmployees.length}`);
    console.log(`   🔗 Employees from Candidates: ${employeesWithCandidate.length}`);
    console.log(`   📋 Total Approvals: ${allApprovals.length}`);
    console.log(`   📄 Total Joining Documents: ${allJoiningDocs.length}`);
    console.log(`   🚀 Total Onboarding: ${allOnboarding.length}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 WORKFLOW CHECK COMPLETED');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkCandidateWorkflow();
