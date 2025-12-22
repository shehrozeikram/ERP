const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/hr/EvaluationDocument');
require('../models/hr/Department');
require('../models/hr/Project');
require('../models/hr/Employee');
const User = mongoose.model('User');
const EvaluationDocument = mongoose.model('EvaluationDocument');

async function checkAdminDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Find Ejaz and Aftab
    const ejaz = await User.findOne({ email: 'ejazahmed@tovus.net' })
      .select('_id firstName lastName email');
    const aftab = await User.findOne({ email: 'aftabahmed@tovus.net' })
      .select('_id firstName lastName email');

    console.log('👤 Ejaz Ahmed:');
    console.log(`   ID: ${ejaz._id}\n`);
    console.log('👤 Aftab Ahmed:');
    console.log(`   ID: ${aftab._id}\n`);

    // Administration department ID
    const adminDeptId = '68bebffba7f2f0565a67eb50';
    
    // Find all submitted documents from Administration
    const documents = await EvaluationDocument.find({
      status: 'submitted',
      'department': adminDeptId
    })
      .populate('employee', 'firstName lastName employeeId placementProject placementDepartment')
      .populate('department', 'name code')
      .populate('project', 'name')
      .populate('evaluator', 'firstName lastName email')
      .populate('level0Approvers.assignedUser', 'firstName lastName email')
      .sort({ submittedAt: -1 })
      .limit(20)
      .lean();

    console.log(`📋 Found ${documents.length} submitted documents from Administration department:\n`);

    let ejazCount = 0;
    let aftabCount = 0;
    let noApproverCount = 0;
    let sgcHeadOfficeCount = 0;
    let tajResidenciaCount = 0;

    documents.forEach((doc, index) => {
      const projectName = doc.project?.name || doc.employee?.placementProject?.name || 'No Project';
      const isSGC = projectName.toLowerCase().includes('sgc') || projectName.toLowerCase().includes('head');
      const isTaj = projectName.toLowerCase().includes('taj');
      
      if (isSGC) sgcHeadOfficeCount++;
      if (isTaj) tajResidenciaCount++;

      console.log(`\n📄 Document ${index + 1}:`);
      console.log(`   Employee: ${doc.employee?.firstName} ${doc.employee?.lastName}`);
      console.log(`   Project: ${projectName}`);
      console.log(`   Project ID: ${doc.project?._id || doc.employee?.placementProject?._id || 'N/A'}`);
      console.log(`   Current Level: ${doc.currentApprovalLevel}`);
      console.log(`   Level 0 Status: ${doc.level0ApprovalStatus}`);
      
      if (doc.level0Approvers && doc.level0Approvers.length > 0) {
        doc.level0Approvers.forEach((approver, idx) => {
          const approverName = approver.assignedUser 
            ? `${approver.assignedUser.firstName} ${approver.assignedUser.lastName} (${approver.assignedUser.email})`
            : approver.approverName || 'Unknown';
          const isEjaz = approver.assignedUser?._id?.toString() === ejaz._id.toString();
          const isAftab = approver.assignedUser?._id?.toString() === aftab._id.toString();
          
          if (isEjaz) ejazCount++;
          if (isAftab) aftabCount++;
          
          console.log(`   Approver ${idx + 1}: ${approverName} ${isEjaz ? '✅ EJAZ' : ''} ${isAftab ? '✅ AFTAB' : ''}`);
        });
      } else {
        noApproverCount++;
        console.log(`   ⚠️  No approvers assigned`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Total documents: ${documents.length}`);
    console.log(`   SGC Head Office: ${sgcHeadOfficeCount}`);
    console.log(`   Taj Residencia: ${tajResidenciaCount}`);
    console.log(`   Documents with Ejaz: ${ejazCount}`);
    console.log(`   Documents with Aftab: ${aftabCount}`);
    console.log(`   Documents with no approver: ${noApproverCount}`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAdminDocuments();

