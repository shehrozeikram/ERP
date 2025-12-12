const mongoose = require('mongoose');

const level0ApproverAssignmentSchema = new mongoose.Schema({
  // User/Employee who is assigned as Level 0 approver
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
  // Projects assigned to this Level 0 approver (for project-level assignments)
  assignedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  }],
  // Department-Project combinations assigned to this Level 0 approver
  // This allows assigning approvers to specific department within a project
  departmentProjectAssignments: [{
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true
    }
  }],
  // Departments assigned (for department-level assignments across all projects)
  assignedDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false
  }],
  // Assignment type: 'project', 'department', or 'department_project'
  assignmentType: {
    type: String,
    enum: ['project', 'department', 'department_project'],
    default: 'department_project'
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Metadata
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
level0ApproverAssignmentSchema.index({ assignedUser: 1, isActive: 1 });
level0ApproverAssignmentSchema.index({ assignedProjects: 1 });
level0ApproverAssignmentSchema.index({ 'departmentProjectAssignments.project': 1, 'departmentProjectAssignments.department': 1 });
level0ApproverAssignmentSchema.index({ assignedDepartments: 1 });
level0ApproverAssignmentSchema.index({ assignmentType: 1, isActive: 1 });
level0ApproverAssignmentSchema.index({ isActive: 1 });

// Static method to get active assignments for a user
level0ApproverAssignmentSchema.statics.getActiveForUser = function(userId) {
  return this.find({ assignedUser: userId, isActive: true })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('assignedProjects', 'name projectId code status')
    .populate('assignedDepartments', 'name code')
    .populate('departmentProjectAssignments.project', 'name projectId code status')
    .populate('departmentProjectAssignments.department', 'name code');
};

// Static method to get all Level 0 approvers for a project
level0ApproverAssignmentSchema.statics.getApproversForProject = function(projectId) {
  return this.find({ 
    $or: [
      { assignedProjects: projectId, assignmentType: 'project', isActive: true },
      { 'departmentProjectAssignments.project': projectId, assignmentType: 'department_project', isActive: true }
    ]
  })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('assignedProjects', 'name projectId code status')
    .populate('departmentProjectAssignments.project', 'name projectId code status')
    .populate('departmentProjectAssignments.department', 'name code');
};

// Static method to check if user is Level 0 approver for a project
level0ApproverAssignmentSchema.statics.isUserLevel0Approver = async function(userId, projectId) {
  const assignment = await this.findOne({ 
    assignedUser: userId,
    $or: [
      { assignedProjects: projectId, assignmentType: 'project', isActive: true },
      { 'departmentProjectAssignments.project': projectId, assignmentType: 'department_project', isActive: true }
    ]
  });
  return !!assignment;
};

// Static method to get Level 0 approvers for a specific department-project combination
level0ApproverAssignmentSchema.statics.getApproversForDepartmentProject = async function(departmentId, projectId) {
  // First, try to find exact department-project match
  const exactMatches = await this.find({
    assignmentType: 'department_project',
    'departmentProjectAssignments': {
      $elemMatch: {
        department: departmentId,
        project: projectId
      }
    },
    isActive: true
  })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('departmentProjectAssignments.project', 'name projectId code status')
    .populate('departmentProjectAssignments.department', 'name code');

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // If no exact match, check for project-level assignments
  const projectAssignments = await this.find({
    assignmentType: 'project',
    assignedProjects: projectId,
    isActive: true
  })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('assignedProjects', 'name projectId code status');

  // Also check for department-level assignments (across all projects)
  const departmentAssignments = await this.find({
    assignmentType: 'department',
    assignedDepartments: departmentId,
    isActive: true
  })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('assignedDepartments', 'name code');

  return [...exactMatches, ...projectAssignments, ...departmentAssignments];
};

// Static method to get all projects for a Level 0 approver
level0ApproverAssignmentSchema.statics.getProjectsForApprover = async function(userId) {
  const assignments = await this.find({
    assignedUser: userId,
    isActive: true
  })
    .populate('assignedProjects', 'name projectId code status')
    .populate('departmentProjectAssignments.project', 'name projectId code status');

  const projects = new Set();
  
  assignments.forEach(assignment => {
    if (assignment.assignmentType === 'project' && assignment.assignedProjects) {
      assignment.assignedProjects.forEach(project => {
        if (project && project._id) {
          projects.add(project._id.toString());
        }
      });
    } else if (assignment.assignmentType === 'department_project' && assignment.departmentProjectAssignments) {
      assignment.departmentProjectAssignments.forEach(dp => {
        if (dp.project && dp.project._id) {
          projects.add(dp.project._id.toString());
        }
      });
    }
  });

  return Array.from(projects);
};

// Static method to get all active Level 0 approvers
level0ApproverAssignmentSchema.statics.getAllActive = function() {
  return this.find({ isActive: true })
    .populate('assignedUser', 'firstName lastName email role')
    .populate('assignedEmployee', 'firstName lastName employeeId')
    .populate('assignedProjects', 'name projectId code status')
    .populate('assignedDepartments', 'name code')
    .populate('departmentProjectAssignments.project', 'name projectId code status')
    .populate('departmentProjectAssignments.department', 'name code')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Level0ApproverAssignment', level0ApproverAssignmentSchema);

