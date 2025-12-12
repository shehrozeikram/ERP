const mongoose = require('mongoose');

const evaluationDocumentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  evaluator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  formType: {
    type: String,
    enum: ['blue_collar', 'white_collar'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'in_progress', 'submitted', 'completed', 'archived'],
    default: 'draft'
  },
  // Employee Information
  code: String,
  date: Date,
  name: String,
  reviewPeriodFrom: Date,
  reviewPeriodTo: Date,
  designation: String,
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false // Optional, linked via employee's project assignment
  },
  immediateBoss: String,
  appraisalHistory: String,
  
  // Evaluation Data
  evaluationScores: mongoose.Schema.Types.Mixed, // For Blue Collar
  whiteCollarProfessionalScores: mongoose.Schema.Types.Mixed, // For White Collar
  whiteCollarPersonalScores: mongoose.Schema.Types.Mixed, // For White Collar
  
  // Overall Result
  overallResult: String,
  totalScore: Number,
  percentage: Number,
  
  // Comments
  strength: String,
  weakness: String,
  otherComments: String,
  
  // White Collar specific fields
  reportingOfficerComments: String,
  reportingOfficerName: String,
  reportingOfficerDate: Date,
  counterSigningOfficerComments: String,
  counterSigningOfficerName: String,
  counterSigningOfficerDate: Date,
  developmentPlan: String,
  recommendedByHOD: String,
  recommendedByHR: String,
  developmentPlanObjectives: [{
    objective: String,
    who: String,
    when: String,
    where: String
  }],
  developmentPlanResult: String,
  employeeSignature: String,
  employeeSignatureDate: Date,
  headOfHRSignature: String,
  headOfHRDate: Date,
  
  // Metadata
  sentAt: Date,
  submittedAt: Date,
  completedAt: Date,
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  accessToken: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Approval System
  approvalStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected'],
    default: 'pending'
  },
  currentApprovalLevel: {
    type: Number,
    min: 0,
    max: 4,
    default: null
  },
  approvalLevels: [{
    level: {
      type: Number,
      required: true,
      min: 0,
      max: 4
    },
    title: {
      type: String,
      required: true
    },
    approverName: {
      type: String,
      required: true
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    rejectedAt: Date,
    comments: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Edit History - Track who edited what and when
  editHistory: [{
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    editedByName: {
      type: String,
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: String, // Description of changes made
      required: false
    },
    level: {
      type: Number, // Approval level at which edit was made
      required: false
    },
    previousData: mongoose.Schema.Types.Mixed, // Snapshot of previous data (optional)
    newData: mongoose.Schema.Types.Mixed // Snapshot of new data (optional)
  }]
}, {
  timestamps: true
});

// Pre-save middleware to initialize approval levels when status changes to 'submitted'
evaluationDocumentSchema.pre('save', async function(next) {
  const Employee = mongoose.model('Employee');
  const ApprovalLevelConfiguration = mongoose.model('ApprovalLevelConfiguration');
  const Level0ApproverAssignment = mongoose.model('Level0ApproverAssignment');
  
  // Only initialize approval if status is being changed to 'submitted' and approval levels don't exist
  if (this.isModified('status') && this.status === 'submitted' && (!this.approvalLevels || this.approvalLevels.length === 0)) {
    // Build approval levels array
    const approvalLevels = [];
    
    // Get employee to find their project/department
    const employeeDoc = await Employee.findById(this.employee)
      .populate('placementProject placementDepartment');
    
    // Use employee's placement fields as primary source, fall back to document fields
    const projectId = employeeDoc?.placementProject?._id || this.project;
    const departmentId = employeeDoc?.placementDepartment?._id || this.department;
    
    // Find Level 0 approver dynamically based on department/project
    let level0Approver = null;
    let level0Title = 'Department/Project Approver';
    let level0Employee = null;
    
    if (projectId && departmentId) {
      // Try to find department-project specific assignment
      const deptProjectAssignments = await Level0ApproverAssignment.find({
        assignmentType: 'department_project',
        'departmentProjectAssignments': {
          $elemMatch: {
            department: departmentId,
            project: projectId
          }
        },
        isActive: true
      })
        .populate('assignedUser', 'firstName lastName email')
        .populate('assignedEmployee', 'firstName lastName employeeId')
        .limit(1);
      
      if (deptProjectAssignments.length > 0) {
        const assignment = deptProjectAssignments[0];
        level0Approver = assignment.assignedUser;
        level0Employee = assignment.assignedEmployee;
        level0Title = 'Department/Project Approver';
      } else if (projectId) {
        // Try project-level assignment
        const projectAssignments = await Level0ApproverAssignment.find({
          assignmentType: 'project',
          assignedProjects: projectId,
          isActive: true
        })
          .populate('assignedUser', 'firstName lastName email')
          .populate('assignedEmployee', 'firstName lastName employeeId')
          .limit(1);
        
        if (projectAssignments.length > 0) {
          const assignment = projectAssignments[0];
          level0Approver = assignment.assignedUser;
          level0Employee = assignment.assignedEmployee;
          level0Title = 'Project Approver';
        }
      }
    }
    
    // If no dynamic assignment found, check static Level 0 from configuration
    if (!level0Approver) {
      const levelConfigs = await ApprovalLevelConfiguration.getActiveForModule('evaluation_appraisal');
      const level0Config = levelConfigs.find(c => c.level === 0);
      if (level0Config && level0Config.assignedUser) {
        level0Approver = level0Config.assignedUser;
        level0Title = level0Config.title || 'Department/Project Approver';
        level0Employee = await Employee.findOne({ user: level0Approver._id });
      }
    }
    
    // Add Level 0 if approver found
    if (level0Approver) {
      approvalLevels.push({
        level: 0,
        title: level0Title,
        approverName: `${level0Approver.firstName} ${level0Approver.lastName}`,
        approver: level0Employee ? level0Employee._id : null,
        assignedUserId: level0Approver._id,
        status: 'pending'
      });
    }
    
    // Get Level 1-4 from ApprovalLevelConfiguration
    const levelConfigs = await ApprovalLevelConfiguration.getActiveForModule('evaluation_appraisal');
    
    // Add levels 1-4 from configuration (skip Level 0 if we already added it dynamically)
    levelConfigs.forEach(config => {
      if (config.level === 0) return; // Skip Level 0 as we handle it dynamically above
      
      approvalLevels.push({
        level: config.level,
        title: config.title,
        approverName: config.assignedUser 
          ? `${config.assignedUser.firstName} ${config.assignedUser.lastName}`
          : 'Unknown',
        approver: null, // Will be populated below
        assignedUserId: config.assignedUser ? config.assignedUser._id : null,
        status: 'pending'
      });
    });
    
    // Sort by level
    approvalLevels.sort((a, b) => a.level - b.level);
    
    this.approvalLevels = approvalLevels;
    this.approvalStatus = 'pending';
    // Start at Level 0 if it exists, otherwise Level 1
    this.currentApprovalLevel = approvalLevels.length > 0 && approvalLevels[0].level === 0 ? 0 : (approvalLevels.length > 0 ? 1 : null);
    
    // Try to find and link approvers for all levels by finding their Employee records
    for (let i = 0; i < approvalLevels.length; i++) {
      if (approvalLevels[i].assignedUserId && !approvalLevels[i].approver) {
        const approver = await Employee.findOne({ user: approvalLevels[i].assignedUserId });
        if (approver) {
          this.approvalLevels[i].approver = approver._id;
        }
      }
    }
  }
  
  // Update approval status based on levels
  if (this.approvalLevels && this.approvalLevels.length > 0) {
    const allApproved = this.approvalLevels.every(level => level.status === 'approved');
    const anyRejected = this.approvalLevels.some(level => level.status === 'rejected');
    
    if (anyRejected) {
      this.approvalStatus = 'rejected';
    } else if (allApproved) {
      this.approvalStatus = 'approved';
      this.status = 'completed';
      this.completedAt = new Date();
    } else {
      this.approvalStatus = 'in_progress';
    }
  }
  
  next();
});

// Indexes for better query performance
evaluationDocumentSchema.index({ employee: 1, status: 1 });
evaluationDocumentSchema.index({ evaluator: 1, status: 1 });
evaluationDocumentSchema.index({ department: 1, status: 1 });
evaluationDocumentSchema.index({ formType: 1, status: 1 });
evaluationDocumentSchema.index({ accessToken: 1 });
evaluationDocumentSchema.index({ approvalStatus: 1, currentApprovalLevel: 1 });
evaluationDocumentSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model('EvaluationDocument', evaluationDocumentSchema);

