const mongoose = require('mongoose');
require('dotenv').config();

// Register models
require('../models/User');
require('../models/hr/Employee');
require('../models/hr/EvaluationDocument');
require('../models/hr/EvaluationLevel0Authority');
require('../models/hr/ApprovalLevelConfiguration');
require('../models/hr/Department');
require('../models/hr/Project');

async function fixEjazDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Find Ejaz Ahmed user
    const user = await mongoose.model('User').findOne({
      email: { $regex: /ejazahmed@tovus\.net/i }
    });

    if (!user) {
      console.log('❌ Ejaz Ahmed user not found');
      await mongoose.connection.close();
      return;
    }

    console.log(`👤 User: ${user.firstName} ${user.lastName} (${user._id})\n`);

    // Get user's Level 0 authority
    const EvaluationLevel0Authority = mongoose.model('EvaluationLevel0Authority');
    const level0Auth = await EvaluationLevel0Authority.findOne({
      assignedUser: user._id,
      isActive: true
    })
      .populate('authorities.project', 'name _id')
      .populate('authorities.departments', 'name _id');

    if (!level0Auth) {
      console.log('❌ No Level 0 authority found');
      await mongoose.connection.close();
      return;
    }

    console.log('✅ Level 0 Authority Found\n');

    // Get user's authority scope
    const userAuthorities = await EvaluationLevel0Authority.getUserAuthorities(user._id);
    
    // Find documents that should be at Level 0
    const EvaluationDocument = mongoose.model('EvaluationDocument');
    
    const docsToFix = await EvaluationDocument.find({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] },
      currentApprovalLevel: { $ne: 0 },
      level0ApprovalStatus: { $in: ['not_required', null] }
    })
      .populate('employee', 'placementProject placementDepartment')
      .populate('project', '_id')
      .populate('department', '_id');

    console.log(`📄 Found ${docsToFix.length} submitted documents to check\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const doc of docsToFix) {
      // Get document's project and department
      let docProjectId = null;
      let docDeptId = null;
      
      if (doc.project) {
        docProjectId = doc.project._id ? doc.project._id.toString() : doc.project.toString();
      } else if (doc.employee?.placementProject) {
        docProjectId = doc.employee.placementProject._id 
          ? doc.employee.placementProject._id.toString() 
          : doc.employee.placementProject.toString();
      }
      
      if (doc.department) {
        docDeptId = doc.department._id ? doc.department._id.toString() : doc.department.toString();
      } else if (doc.employee?.placementDepartment) {
        docDeptId = doc.employee.placementDepartment._id 
          ? doc.employee.placementDepartment._id.toString() 
          : doc.employee.placementDepartment.toString();
      }
      
      // Check if document matches user's authority
      if (docProjectId && userAuthorities.projects.includes(docProjectId)) {
        const projectDepts = userAuthorities.projectDepartments[docProjectId];
        const deptMatches = projectDepts === null || 
                            !docDeptId || 
                            (projectDepts && projectDepts.includes(docDeptId));
        
        if (deptMatches) {
          // This document should be at Level 0 - fix it
          console.log(`\n🔧 Fixing document: ${doc.name || doc._id}`);
          console.log(`   Project: ${docProjectId}`);
          console.log(`   Department: ${docDeptId}`);
          console.log(`   Current Level: ${doc.currentApprovalLevel}`);
          console.log(`   Level 0 Status: ${doc.level0ApprovalStatus || 'null'}`);
          
          // Set project if not set
          if (!doc.project && docProjectId) {
            doc.project = docProjectId;
          }
          
          // Find matching Level 0 approvers
          const matchingApprovers = await EvaluationLevel0Authority.findApproversForDocument(
            docProjectId,
            docDeptId
          );
          
          if (matchingApprovers.length > 0) {
            // Set Level 0 approvers
            doc.level0Approvers = matchingApprovers.map(auth => {
              const approverUser = auth.assignedUser;
              return {
                assignedUser: approverUser._id,
                assignedEmployee: auth.assignedEmployee?._id || null,
                approverName: approverUser.firstName && approverUser.lastName
                  ? `${approverUser.firstName} ${approverUser.lastName}`
                  : approverUser.email || 'Unknown',
                status: 'pending',
                project: docProjectId,
                departments: docDeptId ? [docDeptId] : []
              };
            });
            
            // Set Level 0 status
            doc.level0ApprovalStatus = 'pending';
            doc.currentApprovalLevel = 0;
            doc.approvalStatus = 'pending';
            
            // Save document
            await doc.save();
            fixedCount++;
            console.log(`   ✅ Fixed - Set to Level 0 with ${matchingApprovers.length} approver(s)`);
          } else {
            console.log(`   ⚠️  No matching Level 0 approvers found - skipping`);
            skippedCount++;
          }
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount} documents`);
    console.log(`   ⏭️  Skipped: ${skippedCount} documents`);

    await mongoose.connection.close();
    console.log('\n✅ Fix completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixEjazDocuments();

