const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/hr/EvaluationDocument');
require('../models/hr/Department');
require('../models/hr/Project');
require('../models/hr/Employee');
const User = mongoose.model('User');
const EvaluationDocument = mongoose.model('EvaluationDocument');

async function checkRizwanDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Find Rizwan Haider
    const rizwan = await User.findOne({ 
      $or: [
        { email: { $regex: /rizwan/i } },
        { firstName: { $regex: /rizwan/i } }
      ]
    })
      .select('_id firstName lastName email');

    if (!rizwan) {
      console.log('❌ Rizwan Haider not found');
      await mongoose.connection.close();
      return;
    }

    console.log('👤 Rizwan Haider:');
    console.log(`   ID: ${rizwan._id}`);
    console.log(`   Name: ${rizwan.firstName} ${rizwan.lastName}`);
    console.log(`   Email: ${rizwan.email}\n`);

    // Find Ejaz
    const ejaz = await User.findOne({ email: 'ejazahmed@tovus.net' })
      .select('_id firstName lastName email');

    console.log('👤 Ejaz Ahmed:');
    console.log(`   ID: ${ejaz._id}`);
    console.log(`   Name: ${ejaz.firstName} ${ejaz.lastName}\n`);

    // Find documents submitted by Rizwan
    const documents = await EvaluationDocument.find({
      status: 'submitted',
      evaluator: rizwan._id
    })
      .populate('employee', 'firstName lastName employeeId placementProject placementDepartment')
      .populate('department', 'name code')
      .populate('project', 'name')
      .populate('evaluator', 'firstName lastName email')
      .populate('level0Approvers.assignedUser', 'firstName lastName email')
      .limit(10)
      .lean();

    console.log(`📋 Found ${documents.length} documents submitted by Rizwan Haider:\n`);

    documents.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}:`);
      console.log(`   ID: ${doc._id}`);
      console.log(`   Employee: ${doc.employee?.firstName} ${doc.employee?.lastName} (ID: ${doc.employee?.employeeId})`);
      console.log(`   Department: ${doc.department?.name || 'N/A'} (${doc.department?.code || 'N/A'})`);
      console.log(`   Project (direct): ${doc.project?.name || 'N/A'} (ID: ${doc.project?._id || 'N/A'})`);
      console.log(`   Project (from employee): ${doc.employee?.placementProject?.name || 'N/A'}`);
      console.log(`   Department (from employee): ${doc.employee?.placementDepartment?.name || 'N/A'}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Approval Status: ${doc.approvalStatus}`);
      console.log(`   Current Approval Level: ${doc.currentApprovalLevel}`);
      console.log(`   Level 0 Approval Status: ${doc.level0ApprovalStatus}`);
      
      if (doc.level0Approvers && doc.level0Approvers.length > 0) {
        console.log(`   Level 0 Approvers (${doc.level0Approvers.length}):`);
        doc.level0Approvers.forEach((approver, idx) => {
          const approverUserId = approver.assignedUser?._id?.toString() || approver.assignedUser?.toString() || 'N/A';
          const approverName = approver.assignedUser 
            ? `${approver.assignedUser.firstName} ${approver.assignedUser.lastName} (${approver.assignedUser.email})`
            : approver.approverName || 'Unknown';
          const isEjaz = approverUserId === ejaz._id.toString();
          const isAftab = approverName.toLowerCase().includes('aftab');
          console.log(`      ${idx + 1}. ${approverName} ${isEjaz ? '✅ (EJAZ)' : ''} ${isAftab ? '✅ (AFTAB)' : ''}`);
          console.log(`         User ID: ${approverUserId}`);
          console.log(`         Status: ${approver.status || 'pending'}`);
        });
        
        const ejazInArray = doc.level0Approvers.some(approver => {
          const approverUserId = approver.assignedUser?._id?.toString() || approver.assignedUser?.toString();
          return approverUserId === ejaz._id.toString();
        });
        console.log(`   ✅ Ejaz in level0Approvers: ${ejazInArray ? 'YES' : 'NO'}`);
      } else {
        console.log(`   ⚠️  No level0Approvers array (empty or not set)`);
      }
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRizwanDocuments();

