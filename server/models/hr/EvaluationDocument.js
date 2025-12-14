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
  // Level 0 Approval System
  level0ApprovalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_required'],
    default: 'not_required'
  },
  level0Approvers: [{
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    approverName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    rejectedAt: Date,
    comments: String,
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }]
  }],
  currentLevel0Approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalLevels: [{
    level: {
      type: Number,
      required: true,
      min: 1,
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
  const EvaluationLevel0Authority = mongoose.model('EvaluationLevel0Authority');
  
  // Only initialize approval if status is being changed to 'submitted'
  if (this.isModified('status') && this.status === 'submitted') {
    // STEP 1: Check for Level 0 approvers
    // Check if Level 0 is not set up or if document is at Level 1 but should be at Level 0
    const shouldCheckLevel0 = this.level0ApprovalStatus === 'not_required' || 
                             !this.level0Approvers || 
                             this.level0Approvers.length === 0 ||
                             (this.currentApprovalLevel === 1 && 
                              this.level0ApprovalStatus === 'not_required' && 
                              this.approvalStatus !== 'approved');
    
    if (shouldCheckLevel0) {
      // Get document's project and department
      // First try direct fields, then try from employee if populated
      let projectId = null;
      let departmentId = null;
      
      // Check if project is directly set on document
      if (this.project) {
        projectId = this.project._id ? this.project._id : this.project;
      }
      
      // Check if department is directly set on document
      if (this.department) {
        departmentId = this.department._id ? this.department._id : this.department;
      }
      
      // If project/department not set, try to get from employee
      if (!projectId || !departmentId) {
        // Populate employee if it's an ObjectId (not already populated)
        const needsPopulate = this.employee && 
          (typeof this.employee === 'object' && this.employee.constructor.name === 'ObjectId' || 
           typeof this.employee === 'object' && !this.employee.placementProject);
        
        if (needsPopulate) {
          try {
            await this.populate({
              path: 'employee',
              select: 'placementProject placementDepartment',
              populate: [
                { path: 'placementProject', select: '_id name' },
                { path: 'placementDepartment', select: '_id name' }
              ]
            });
          } catch (err) {
            // If populate fails, employee might not exist - continue
          }
        }
        
        // Now try to get from populated employee
        if (this.employee && typeof this.employee === 'object' && this.employee.placementProject) {
          if (!projectId && this.employee.placementProject) {
            projectId = this.employee.placementProject._id ? this.employee.placementProject._id : this.employee.placementProject;
          }
          if (!departmentId && this.employee.placementDepartment) {
            departmentId = this.employee.placementDepartment._id ? this.employee.placementDepartment._id : this.employee.placementDepartment;
          }
        }
      }
      
      // Find Level 0 approvers for this document
      let level0Approvers = [];
      if (projectId) {
        // Convert to string for comparison
        const projectIdStr = projectId.toString();
        const departmentIdStr = departmentId ? departmentId.toString() : null;
        
        level0Approvers = await EvaluationLevel0Authority.findApproversForDocument(projectIdStr, departmentIdStr);
      }
      
      if (level0Approvers && level0Approvers.length > 0) {
        // Level 0 approvers found - initialize Level 0
        this.level0ApprovalStatus = 'pending';
        const projectIdStr = projectId ? (projectId._id ? projectId._id.toString() : projectId.toString()) : null;
        const departmentIdStr = departmentId ? (departmentId._id ? departmentId._id.toString() : departmentId.toString()) : null;
        
        this.level0Approvers = level0Approvers.map(auth => {
          const approverName = auth.assignedUser 
            ? `${auth.assignedUser.firstName} ${auth.assignedUser.lastName}`
            : 'Unknown';
          
          // Get the matching authority scope for this approver
          let matchingAuth = null;
          for (const authScope of auth.authorities) {
            if (authScope.project) {
              const authProjectId = authScope.project._id ? authScope.project._id.toString() : authScope.project.toString();
              
              if (authProjectId === projectIdStr) {
                // Check departments
                if (!authScope.departments || authScope.departments.length === 0) {
                  // All departments in this project
                  matchingAuth = authScope;
                  break;
                } else if (departmentIdStr) {
                  // Specific departments
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
        
        // Set current Level 0 approver to first one (if multiple, they can all see it)
        this.currentLevel0Approver = this.level0Approvers[0].assignedUser;
        this.currentApprovalLevel = 0;
        this.approvalStatus = 'pending';
      } else {
        // No Level 0 approvers - skip to Level 1
        this.level0ApprovalStatus = 'not_required';
        this.level0Approvers = [];
        this.currentLevel0Approver = null;
      }
    }
    
    // STEP 2: Initialize Level 1-4 only if Level 0 is not pending or not required
    if ((this.level0ApprovalStatus === 'not_required' || this.level0ApprovalStatus === 'approved') && 
        (!this.approvalLevels || this.approvalLevels.length === 0)) {
      // Build approval levels array
      const approvalLevels = [];
      
      // Get Level 1-4 from ApprovalLevelConfiguration
      const levelConfigs = await ApprovalLevelConfiguration.find({
        module: 'evaluation_appraisal',
        level: { $gte: 1, $lte: 4 },
        isActive: true
      })
        .populate('assignedUser', 'firstName lastName email role')
        .sort({ level: 1 });
      
      // Add levels 1-4 from configuration
      levelConfigs.forEach(config => {
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
      // Start at Level 1
      this.currentApprovalLevel = approvalLevels.length > 0 ? 1 : null;
      
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
  
  // Update Level 0 approval status
  if (this.level0Approvers && this.level0Approvers.length > 0) {
    const allLevel0Approved = this.level0Approvers.every(approver => approver.status === 'approved');
    const anyLevel0Rejected = this.level0Approvers.some(approver => approver.status === 'rejected');
    
    if (anyLevel0Rejected) {
      this.level0ApprovalStatus = 'rejected';
      this.approvalStatus = 'rejected';
    } else if (allLevel0Approved) {
      this.level0ApprovalStatus = 'approved';
      // After Level 0 approval, move to Level 1
      if (this.currentApprovalLevel === 0) {
        this.currentApprovalLevel = 1;
      }
    }
  }
  
  next();
});

// Static method to check and fix documents that should be at Level 0 but aren't
evaluationDocumentSchema.statics.checkAndFixLevel0Routing = async function() {
  const EvaluationLevel0Authority = mongoose.model('EvaluationLevel0Authority');
  const Employee = mongoose.model('Employee');
  
  // Find all submitted documents that might need Level 0 routing
  // Documents that are:
  // 1. Submitted
  // 2. At Level 1 or have level0ApprovalStatus = 'not_required'
  // 3. Have approvalStatus = 'pending' or 'in_progress' (not yet completed)
  // 4. NOT already approved at Level 0 (level0ApprovalStatus !== 'approved')
  const documents = await this.find({
    status: 'submitted',
    $or: [
      { currentApprovalLevel: 1 },
      { level0ApprovalStatus: 'not_required' }
    ],
    approvalStatus: { $in: ['pending', 'in_progress'] },
    level0ApprovalStatus: { $ne: 'approved' } // Skip documents already approved at Level 0
  })
    .populate('employee', 'placementProject placementDepartment')
    .populate('project', '_id name')
    .populate('department', '_id name');
  
  let fixedCount = 0;
  let checkedCount = 0;
  
  for (const doc of documents) {
    checkedCount++;
    
    // Get document's project and department
    let projectId = null;
    let departmentId = null;
    
    if (doc.project) {
      projectId = doc.project._id ? doc.project._id.toString() : doc.project.toString();
    } else if (doc.employee?.placementProject) {
      projectId = doc.employee.placementProject._id 
        ? doc.employee.placementProject._id.toString() 
        : doc.employee.placementProject.toString();
    }
    
    if (doc.department) {
      departmentId = doc.department._id ? doc.department._id.toString() : doc.department.toString();
    } else if (doc.employee?.placementDepartment) {
      departmentId = doc.employee.placementDepartment._id 
        ? doc.employee.placementDepartment._id.toString() 
        : doc.employee.placementDepartment.toString();
    }
    
    // Check if there are Level 0 approvers for this document
    if (projectId) {
      const level0Approvers = await EvaluationLevel0Authority.findApproversForDocument(
        projectId,
        departmentId
      );
      
      // If Level 0 approvers exist but document is not at Level 0, fix it
      // BUT skip if document has already been approved at Level 0
      if (level0Approvers && level0Approvers.length > 0 && doc.level0ApprovalStatus !== 'approved') {
        // Document should be at Level 0 but isn't - fix it
        const projectIdStr = projectId.toString();
        const departmentIdStr = departmentId ? departmentId.toString() : null;
        
        doc.level0ApprovalStatus = 'pending';
        doc.level0Approvers = level0Approvers.map(auth => {
          const approverName = auth.assignedUser 
            ? `${auth.assignedUser.firstName} ${auth.assignedUser.lastName}`
            : 'Unknown';
          
          // Get the matching authority scope for this approver
          let matchingAuth = null;
          for (const authScope of auth.authorities) {
            if (authScope.project) {
              const authProjectId = authScope.project._id ? authScope.project._id.toString() : authScope.project.toString();
              
              if (authProjectId === projectIdStr) {
                // Check departments
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
        
        doc.currentLevel0Approver = doc.level0Approvers[0].assignedUser;
        doc.currentApprovalLevel = 0;
        doc.approvalStatus = 'pending';
        
        // Clear Level 1-4 approval levels since we're moving back to Level 0
        // They will be initialized when Level 0 is approved
        doc.approvalLevels = [];
        
        await doc.save();
        fixedCount++;
      }
    }
  }
  
  return { checked: checkedCount, fixed: fixedCount };
};

// Indexes for better query performance
evaluationDocumentSchema.index({ employee: 1, status: 1 });
evaluationDocumentSchema.index({ evaluator: 1, status: 1 });
evaluationDocumentSchema.index({ department: 1, status: 1 });
evaluationDocumentSchema.index({ formType: 1, status: 1 });
evaluationDocumentSchema.index({ accessToken: 1 });
evaluationDocumentSchema.index({ approvalStatus: 1, currentApprovalLevel: 1 });
evaluationDocumentSchema.index({ project: 1, status: 1 });
evaluationDocumentSchema.index({ level0ApprovalStatus: 1, currentApprovalLevel: 1 });
evaluationDocumentSchema.index({ 'level0Approvers.assignedUser': 1 });
evaluationDocumentSchema.index({ currentLevel0Approver: 1 });

module.exports = mongoose.model('EvaluationDocument', evaluationDocumentSchema);

