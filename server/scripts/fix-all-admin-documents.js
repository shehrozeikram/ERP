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

async function fixAllAdminDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    const adminDeptId = '68bebffba7f2f0565a67eb50';
    const sgcProjectId = '689353b5a1028b3f932afa8a';
    
    // Find documents that need fixing (not_required status)
    const documents = await EvaluationDocument.find({
      status: 'submitted',
      'department': adminDeptId,
      'project': sgcProjectId,
      level0ApprovalStatus: 'not_required'
    })
      .populate('employee', 'placementProject placementDepartment')
      .populate('project', '_id name')
      .populate('department', '_id name');

    console.log(`📋 Found ${documents.length} documents that need fixing\n`);

    let fixedCount = 0;
    for (const doc of documents) {
      // Manually trigger the routing logic
      const projectId = doc.project?._id || doc.employee?.placementProject?._id || null;
      const departmentId = doc.department?._id || doc.employee?.placementDepartment?._id || null;
      
      if (projectId) {
        const EvaluationLevel0Authority = mongoose.model('EvaluationLevel0Authority');
        const level0Approvers = await EvaluationLevel0Authority.findApproversForDocument(
          projectId.toString(),
          departmentId ? departmentId.toString() : null
        );
        
        if (level0Approvers && level0Approvers.length > 0) {
          const projectIdStr = projectId.toString();
          const departmentIdStr = departmentId ? departmentId.toString() : null;
          
          doc.level0ApprovalStatus = 'pending';
          doc.level0Approvers = level0Approvers
            .filter(auth => auth.assignedUser && auth.assignedUser._id)
            .map(auth => {
              const approverName = auth.assignedUser 
                ? `${auth.assignedUser.firstName} ${auth.assignedUser.lastName}`
                : 'Unknown';
              
              let matchingAuth = null;
              for (const authScope of auth.authorities) {
                if (authScope.project) {
                  const authProjectId = authScope.project._id ? authScope.project._id.toString() : authScope.project.toString();
                  if (authProjectId === projectIdStr) {
                    if (!authScope.departments || authScope.departments.length === 0) {
                      matchingAuth = authScope;
                      break;
                    } else if (departmentIdStr) {
                      const authDeptIds = authScope.departments.map(d => {
                        if (d._id) return d._id.toString();
                        if (typeof d === 'string') return d;
                        return d.toString();
                      });
                      if (authDeptIds.includes(departmentIdStr)) {
                        matchingAuth = authScope;
                        break;
                      }
                    }
                  }
                }
              }
              
              return {
                assignedUser: auth.assignedUser._id,
                assignedEmployee: auth.assignedEmployee ? auth.assignedEmployee._id : null,
                approverName,
                status: 'pending',
                project: matchingAuth ? (matchingAuth.project._id || matchingAuth.project) : projectId,
                departments: matchingAuth && matchingAuth.departments ? matchingAuth.departments.map(d => d._id || d) : (departmentIdStr ? [departmentId] : [])
              };
            });
          
          if (doc.level0Approvers.length > 0) {
            doc.currentLevel0Approver = doc.level0Approvers[0].assignedUser;
            doc.currentApprovalLevel = 0;
            doc.approvalStatus = 'pending';
            doc.approvalLevels = [];
            
            await doc.save();
            fixedCount++;
            console.log(`✅ Fixed document for ${doc.employee?.firstName || 'Unknown'} ${doc.employee?.lastName || ''}`);
          }
        }
      }
    }

    console.log(`\n📊 Fixed ${fixedCount} out of ${documents.length} documents`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAllAdminDocuments();

