const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
require('../models/hr/EvaluationLevel0Authority');
require('../models/hr/Project');
require('../models/hr/Department');
const User = mongoose.model('User');
const EvaluationLevel0Authority = mongoose.model('EvaluationLevel0Authority');

async function checkEjazAuthority() {
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

    console.log('👤 User Found:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}\n`);

    // Check Level 0 authorities
    const authorities = await EvaluationLevel0Authority.find({
      assignedUser: user._id,
      isActive: true
    })
      .populate('assignedUser', 'firstName lastName email')
      .populate('authorities.project', 'name')
      .populate('authorities.departments', 'name code')
      .lean();

    if (authorities.length === 0) {
      console.log('❌ No Level 0 authority found for this user');
      console.log('   The user is NOT a Level 0 approver.\n');
    } else {
      console.log(`✅ Found ${authorities.length} Level 0 authority record(s):\n`);

      authorities.forEach((authority, index) => {
        console.log(`📋 Authority Record ${index + 1}:`);
        console.log(`   Active: ${authority.isActive}`);
        console.log(`   Created: ${authority.createdAt}`);
        console.log(`   Updated: ${authority.updatedAt}`);
        console.log(`   Projects & Departments:`);

        if (authority.authorities && authority.authorities.length > 0) {
          authority.authorities.forEach((auth, authIndex) => {
            const projectName = auth.project?.name || 'Unknown Project';
            const projectId = auth.project?._id || auth.project || 'N/A';
            
            console.log(`\n   ${authIndex + 1}. Project: ${projectName} (ID: ${projectId})`);
            
            if (!auth.departments || auth.departments.length === 0) {
              console.log(`      Departments: ALL DEPARTMENTS in this project`);
            } else {
              console.log(`      Departments (${auth.departments.length}):`);
              auth.departments.forEach((dept, deptIndex) => {
                const deptName = dept?.name || 'Unknown';
                const deptCode = dept?.code || '';
                const deptId = dept?._id || dept || 'N/A';
                console.log(`         ${deptIndex + 1}. ${deptName}${deptCode ? ` (${deptCode})` : ''} (ID: ${deptId})`);
              });
            }
          });
        } else {
          console.log(`      No projects/departments assigned`);
        }
        console.log('');
      });

      // Get summary using the getUserAuthorities method
      const summary = await EvaluationLevel0Authority.getUserAuthorities(user._id);
      console.log('📊 Summary:');
      console.log(`   Total Projects: ${summary.projects.length}`);
      if (summary.projects.length > 0) {
        console.log(`   Project IDs: ${summary.projects.join(', ')}`);
        console.log(`   Project-Department Mapping:`);
        Object.keys(summary.projectDepartments).forEach(projectId => {
          const depts = summary.projectDepartments[projectId];
          if (depts === null) {
            console.log(`      Project ${projectId}: ALL DEPARTMENTS`);
          } else {
            console.log(`      Project ${projectId}: ${depts.length} department(s) - ${depts.join(', ')}`);
          }
        });
      }
      console.log('');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEjazAuthority();

