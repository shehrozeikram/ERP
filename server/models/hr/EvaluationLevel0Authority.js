const mongoose = require('mongoose');

const evaluationLevel0AuthoritySchema = new mongoose.Schema({
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false // Optional, can be linked if user has employee record
  },
  authorities: [{
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }] // Empty array means all departments in the project
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
evaluationLevel0AuthoritySchema.index({ assignedUser: 1, isActive: 1 });
evaluationLevel0AuthoritySchema.index({ 'authorities.project': 1 });
evaluationLevel0AuthoritySchema.index({ 'authorities.departments': 1 });

// Static method to find Level 0 approvers for a document
evaluationLevel0AuthoritySchema.statics.findApproversForDocument = async function(documentProject, documentDepartment) {
  if (!documentProject) {
    return []; // No project means no Level 0 match
  }

  // Find all active Level 0 authorities
  const authorities = await this.find({ isActive: true })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('authorities.project', 'name')
    .populate('authorities.departments', 'name');

  const matchingApprovers = [];

  // Convert documentProject to string for comparison
  const docProjectStr = documentProject ? documentProject.toString() : null;
  const docDeptStr = documentDepartment ? documentDepartment.toString() : null;

  for (const authority of authorities) {
    for (const auth of authority.authorities) {
      // Check if project matches
      if (auth.project) {
        const authProjectId = auth.project._id ? auth.project._id.toString() : auth.project.toString();
        
        if (authProjectId === docProjectStr) {
          // If departments array is empty, it means all departments
          if (!auth.departments || auth.departments.length === 0) {
            matchingApprovers.push(authority);
            break; // Found a match, no need to check other authorities for this approver
          } else if (docDeptStr) {
            // Check if document's department is in the allowed departments
            const departmentIds = auth.departments.map(d => {
              if (d._id) return d._id.toString();
              if (typeof d === 'string') return d;
              return d.toString();
            });
            if (departmentIds.includes(docDeptStr)) {
              matchingApprovers.push(authority);
              break; // Found a match
            }
          }
        }
      }
    }
  }

  return matchingApprovers;
};

// Static method to check if user has Level 0 authority for a document
evaluationLevel0AuthoritySchema.statics.hasAuthorityForDocument = async function(userId, documentProject, documentDepartment) {
  if (!documentProject) {
    return false;
  }

  const authorities = await this.find({
    assignedUser: userId,
    isActive: true
  })
    .populate('authorities.project', 'name')
    .populate('authorities.departments', 'name');

  for (const authority of authorities) {
    for (const auth of authority.authorities) {
      if (auth.project && auth.project._id.toString() === documentProject.toString()) {
        // If departments array is empty, it means all departments
        if (!auth.departments || auth.departments.length === 0) {
          return true;
        } else if (documentDepartment) {
          const departmentIds = auth.departments.map(d => d._id.toString());
          if (departmentIds.includes(documentDepartment.toString())) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

// Static method to get user's assigned projects and departments
evaluationLevel0AuthoritySchema.statics.getUserAuthorities = async function(userId) {
  const authorities = await this.find({
    assignedUser: userId,
    isActive: true
  })
    .populate('authorities.project', 'name')
    .populate('authorities.departments', 'name');

  const projects = [];
  const projectDepartments = {}; // projectId -> [departmentIds]

  for (const authority of authorities) {
    for (const auth of authority.authorities) {
      if (auth.project) {
        const projectId = auth.project._id.toString();
        if (!projects.includes(projectId)) {
          projects.push(projectId);
        }

        if (!projectDepartments[projectId]) {
          projectDepartments[projectId] = [];
        }

        // If departments array is empty, it means all departments (represented as null)
        if (!auth.departments || auth.departments.length === 0) {
          projectDepartments[projectId] = null; // null means all departments
        } else if (projectDepartments[projectId] !== null) {
          // Only add if not already set to "all departments"
          auth.departments.forEach(dept => {
            const deptId = dept._id.toString();
            if (!projectDepartments[projectId].includes(deptId)) {
              projectDepartments[projectId].push(deptId);
            }
          });
        }
      }
    }
  }

  return {
    projects,
    projectDepartments
  };
};

module.exports = mongoose.model('EvaluationLevel0Authority', evaluationLevel0AuthoritySchema);

