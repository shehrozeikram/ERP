const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/hr/EvaluationDocument');
require('../models/hr/Department');
require('../models/hr/Project');
require('../models/hr/Employee');
require('../models/hr/EvaluationLevel0Authority');
require('../models/hr/ApprovalLevelConfiguration');
const EvaluationDocument = mongoose.model('EvaluationDocument');

async function fixEjazDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Run the checkAndFixLevel0Routing method
    console.log('🔧 Running checkAndFixLevel0Routing...\n');
    
    const result = await EvaluationDocument.checkAndFixLevel0Routing();
    
    console.log('📊 Fix Results:');
    console.log(`   Documents checked: ${result.checkedCount || 0}`);
    console.log(`   Documents fixed: ${result.fixedCount || 0}\n`);

    // Now check specific documents from Administration in SGC-Head Office
    const adminDeptId = '68bebffba7f2f0565a67eb50';
    const sgcProjectId = '689353b5a1028b3f932afa8a';
    
    const documents = await EvaluationDocument.find({
      status: 'submitted',
      'department': adminDeptId,
      'project': sgcProjectId
    })
      .populate('employee', 'firstName lastName employeeId')
      .populate('level0Approvers.assignedUser', 'firstName lastName email')
      .limit(10)
      .lean();

    console.log(`📋 Checking ${documents.length} Administration documents from SGC-Head Office:\n`);

    let ejazCount = 0;
    documents.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}: ${doc.employee?.firstName} ${doc.employee?.lastName}`);
      console.log(`   Current Level: ${doc.currentApprovalLevel}`);
      console.log(`   Level 0 Status: ${doc.level0ApprovalStatus}`);
      
      if (doc.level0Approvers && doc.level0Approvers.length > 0) {
        console.log(`   Level 0 Approvers:`);
        doc.level0Approvers.forEach((approver, idx) => {
          const approverName = approver.assignedUser 
            ? `${approver.assignedUser.firstName} ${approver.assignedUser.lastName} (${approver.assignedUser.email})`
            : approver.approverName || 'Unknown';
          const isEjaz = approver.assignedUser?.email === 'ejazahmed@tovus.net';
          if (isEjaz) ejazCount++;
          console.log(`      ${idx + 1}. ${approverName} ${isEjaz ? '✅ EJAZ' : ''}`);
        });
      } else {
        console.log(`   ⚠️  No approvers assigned`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Documents with Ejaz: ${ejazCount} out of ${documents.length}`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixEjazDocuments();

