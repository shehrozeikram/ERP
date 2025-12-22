const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/hr/EvaluationDocument');
require('../models/hr/Department');
require('../models/hr/Employee');
const User = mongoose.model('User');
const EvaluationDocument = mongoose.model('EvaluationDocument');

async function checkEjazDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Find user by email
    const user = await User.findOne({ email: 'ejazahmed@tovus.net' })
      .select('_id firstName lastName email');

    if (!user) {
      console.log('❌ User not found: ejazahmed@tovus.net');
      await mongoose.connection.close();
      return;
    }

    console.log('👤 User:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}\n`);

    // Find documents from Administration department that are submitted
    const adminDeptId = '68bebffba7f2f0565a67eb50'; // Administration department ID from previous check
    
    // Check for documents at Level 0 (pending)
    const documents = await EvaluationDocument.find({
      status: 'submitted',
      'department': adminDeptId,
      $or: [
        { currentApprovalLevel: 0 },
        { level0ApprovalStatus: 'pending' }
      ]
    })
      .populate('employee', 'firstName lastName employeeId')
      .populate('department', 'name code')
      .populate('level0Approvers.assignedUser', 'firstName lastName email')
      .limit(5)
      .lean();

    console.log(`📋 Found ${documents.length} submitted documents from Administration department:\n`);

    documents.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}:`);
      console.log(`   ID: ${doc._id}`);
      console.log(`   Employee: ${doc.employee?.firstName} ${doc.employee?.lastName} (ID: ${doc.employee?.employeeId})`);
      console.log(`   Department: ${doc.department?.name} (${doc.department?.code})`);
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
          const isEjaz = approverUserId === user._id.toString();
          console.log(`      ${idx + 1}. ${approverName} ${isEjaz ? '✅ (THIS IS EJAZ)' : ''}`);
          console.log(`         User ID: ${approverUserId}`);
          console.log(`         Status: ${approver.status || 'pending'}`);
          console.log(`         Approved At: ${approver.approvedAt || 'Not approved'}`);
        });
        
        // Check if Ejaz is in the array
        const ejazInArray = doc.level0Approvers.some(approver => {
          const approverUserId = approver.assignedUser?._id?.toString() || approver.assignedUser?.toString();
          return approverUserId === user._id.toString();
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

checkEjazDocuments();

