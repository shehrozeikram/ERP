const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const Level0ApproverAssignment = require('../models/hr/Level0ApproverAssignment');
const Project = require('../models/hr/Project');
const User = require('../models/User');
const EmailService = require('../services/emailService');
const TrackingService = require('../services/evaluationDocumentTrackingService');

const employeePopulate = {
  path: 'employee',
  select: 'firstName lastName employeeId email placementDepartment placementProject placementDesignation designation user',
  populate: [
    { path: 'placementDepartment', select: 'name' },
    { path: 'placementProject', select: 'name company' },
    { path: 'placementDesignation', select: 'title' },
    { path: 'user', select: 'firstName lastName email department position employeeId' }
  ]
};

const evaluatorPopulate = {
  path: 'evaluator',
  select: 'firstName lastName employeeId email placementDepartment placementDesignation designation user',
  populate: [
    { path: 'placementDepartment', select: 'name' },
    { path: 'placementDesignation', select: 'title' },
    { path: 'user', select: 'firstName lastName email department position employeeId' }
  ]
};

const approvalPopulate = {
  path: 'approvalLevels.approver',
  select: 'firstName lastName employeeId email placementDepartment placementDesignation designation user',
  populate: [
    { path: 'placementDepartment', select: 'name' },
    { path: 'placementDesignation', select: 'title' },
    { path: 'user', select: 'firstName lastName email department position employeeId' }
  ]
};

const basePopulateConfig = [
  employeePopulate,
  evaluatorPopulate,
  { path: 'department', select: 'name isActive' },
  approvalPopulate
];

const withPopulates = (query) => query.populate(basePopulateConfig);
const hydrateDocument = async (document) => {
  if (!document) return document;
  await document.populate(basePopulateConfig);
  return document;
};

// Get all evaluation documents grouped by department
router.get('/', async (req, res) => {
  try {
    const { status, formType } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (formType) query.formType = formType;
    
    const documents = await withPopulates(
      EvaluationDocument.find(query)
    ).sort({ createdAt: -1 });
    
    res.json(documents);
  } catch (error) {
    console.error('Error fetching evaluation documents:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation documents' });
  }
});

// Evaluation document tracking
router.get('/tracking', async (req, res) => {
  try {
    const EvaluationDocumentTracking = require('../models/hr/EvaluationDocumentTracking');
    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const tracking = await EvaluationDocumentTracking.find(query)
      .populate('evaluationDocument', 'formType status approvalStatus currentApprovalLevel')
      .populate('employee', 'firstName lastName employeeId')
      .sort({ updatedAt: -1 });

    res.json(tracking);
  } catch (error) {
    console.error('Error fetching tracking data:', error);
    res.status(500).json({ error: 'Failed to fetch tracking data' });
  }
});

router.get('/:id/tracking', async (req, res) => {
  try {
    const EvaluationDocumentTracking = require('../models/hr/EvaluationDocumentTracking');

    const tracking = await EvaluationDocumentTracking.findOne({
      evaluationDocument: req.params.id
    })
      .populate('evaluationDocument')
      .populate('employee', 'firstName lastName employeeId');

    if (!tracking) {
      return res.status(404).json({ error: 'Tracking not found' });
    }

    res.json(tracking);
  } catch (error) {
    console.error('Error fetching document tracking:', error);
    res.status(500).json({ error: 'Failed to fetch document tracking' });
  }
});

// Get evaluation document by ID (public access with token)
router.get('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    const document = await withPopulates(
      EvaluationDocument.findById(req.params.id)
    );
    
    if (!document) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }
    
    // If token is provided, verify it (for public access)
    if (token && document.accessToken !== token) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }

    // If form is already submitted, return error for public access (prevents duplicate access)
    if (token && (document.status === 'submitted' || document.status === 'completed')) {
      return res.status(400).json({ 
        error: 'This evaluation form has already been submitted and cannot be accessed again.',
        alreadySubmitted: true
      });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching evaluation document:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation document' });
  }
});

// Create new evaluation document
router.post('/', [
  body('employee').isMongoId().withMessage('Valid employee ID is required'),
  body('evaluator').isMongoId().withMessage('Valid evaluator ID is required'),
  body('formType').isIn(['blue_collar', 'white_collar']).withMessage('Valid form type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const document = new EvaluationDocument(req.body);
    await document.save();
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );

    await TrackingService.syncDocumentTracking({
      document: populated,
      actorUser: req.user,
      holderEmployee: populated.evaluator
    });
    
    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating evaluation document:', error);
    res.status(500).json({ error: 'Failed to create evaluation document' });
  }
});

// Update evaluation document (public access with token OR Level 0 approver)
router.put('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    
    // Find document first to verify token if provided
    const existingDoc = await EvaluationDocument.findById(req.params.id);
    if (!existingDoc) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }

    // Check access: either token-based (public) OR Level 0 approver
    let hasAccess = false;
    
    if (token) {
      // Public access with token
      if (existingDoc.accessToken === token) {
        hasAccess = true;
      } else {
        return res.status(403).json({ error: 'Invalid or expired access token' });
      }
    } else if (req.user) {
      // Authenticated user - check if Level 0 approver (static or dynamic)
      let isLevel0Approver = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', 0, req.user._id);
      
      // Also check dynamic Level 0 assignments
      if (!isLevel0Approver && existingDoc.currentApprovalLevel === 0) {
        // Check if user is assigned to this document's department/project
        const Employee = require('../models/hr/Employee');
        const employeeDoc = await Employee.findById(existingDoc.employee)
          .populate('placementProject placementDepartment');
        
        const projectId = existingDoc.project || employeeDoc?.placementProject?._id;
        const departmentId = existingDoc.department || employeeDoc?.placementDepartment?._id;
        
        if (projectId && departmentId) {
          // Check for department-project assignment
          const deptProjectAssignment = await Level0ApproverAssignment.findOne({
            assignedUser: req.user._id,
            assignmentType: 'department_project',
            'departmentProjectAssignments': {
              $elemMatch: {
                department: departmentId,
                project: projectId
              }
            },
            isActive: true
          });
          
          if (deptProjectAssignment) {
            isLevel0Approver = true;
          } else {
            // Check for project-level assignment
            const projectAssignment = await Level0ApproverAssignment.findOne({
              assignedUser: req.user._id,
              assignmentType: 'project',
              assignedProjects: projectId,
              isActive: true
            });
            
            if (projectAssignment) {
              isLevel0Approver = true;
            }
          }
        }
      }
      
      if (isLevel0Approver && existingDoc.currentApprovalLevel === 0) {
        // Level 0 approver can edit documents at Level 0
        hasAccess = true;
      } else {
        return res.status(403).json({ error: 'You are not authorized to edit this document' });
      }
    } else {
      return res.status(401).json({ error: 'Authentication required or valid token needed' });
    }

    // Prevent duplicate submissions - if already submitted, reject the update
    // BUT allow Level 0 approvers to edit submitted documents at Level 0
    if (req.body.status === 'submitted' && (existingDoc.status === 'submitted' || existingDoc.status === 'completed')) {
      // Check if user is Level 0 approver editing a Level 0 document (static or dynamic)
      if (req.user) {
        let isLevel0Approver = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', 0, req.user._id);
        
        // Also check dynamic Level 0 assignments
        if (!isLevel0Approver && existingDoc.currentApprovalLevel === 0) {
          const Employee = require('../models/hr/Employee');
          const employeeDoc = await Employee.findById(existingDoc.employee)
            .populate('placementProject placementDepartment');
          
          const projectId = existingDoc.project || employeeDoc?.placementProject?._id;
          const departmentId = existingDoc.department || employeeDoc?.placementDepartment?._id;
          
          if (projectId && departmentId) {
            const deptProjectAssignment = await Level0ApproverAssignment.findOne({
              assignedUser: req.user._id,
              assignmentType: 'department_project',
              'departmentProjectAssignments': {
                $elemMatch: {
                  department: departmentId,
                  project: projectId
                }
              },
              isActive: true
            });
            
            if (deptProjectAssignment) {
              isLevel0Approver = true;
            } else {
              const projectAssignment = await Level0ApproverAssignment.findOne({
                assignedUser: req.user._id,
                assignmentType: 'project',
                assignedProjects: projectId,
                isActive: true
              });
              
              if (projectAssignment) {
                isLevel0Approver = true;
              }
            }
          }
        }
        
        if (isLevel0Approver && existingDoc.currentApprovalLevel === 0) {
          // Level 0 approver can edit even if submitted (as long as it's at Level 0)
          // Don't block the update
        } else {
          return res.status(400).json({ 
            error: 'This evaluation form has already been submitted and cannot be modified.',
            alreadySubmitted: true
          });
        }
      } else {
        return res.status(400).json({ 
          error: 'This evaluation form has already been submitted and cannot be modified.',
          alreadySubmitted: true
        });
      }
    }

    // Check if status is changing to 'submitted' and approval levels need to be initialized
    const isSubmitting = req.body.status === 'submitted' && existingDoc.status !== 'submitted';
    const isResubmitting = req.body.status === 'submitted' && existingDoc.status === 'submitted' && !token && req.user;

    const updateData = {
      ...req.body,
      ...(req.body.status === 'submitted' && !isResubmitting && { submittedAt: new Date() }),
      ...(req.body.status === 'completed' && { completedAt: new Date() })
    };

    // Track edit history for Level 0 approvers (static or dynamic)
    if (!token && req.user && existingDoc.status === 'submitted') {
      // Level 0 approver is editing/resubmitting
      let isLevel0Approver = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', 0, req.user._id);
      
      // Also check dynamic Level 0 assignments
      if (!isLevel0Approver && existingDoc.currentApprovalLevel === 0) {
        const Employee = require('../models/hr/Employee');
        const employeeDoc = await Employee.findById(existingDoc.employee)
          .populate('placementProject placementDepartment');
        
        const projectId = existingDoc.project || employeeDoc?.placementProject?._id;
        const departmentId = existingDoc.department || employeeDoc?.placementDepartment?._id;
        
        if (projectId && departmentId) {
          const deptProjectAssignment = await Level0ApproverAssignment.findOne({
            assignedUser: req.user._id,
            assignmentType: 'department_project',
            'departmentProjectAssignments': {
              $elemMatch: {
                department: departmentId,
                project: projectId
              }
            },
            isActive: true
          });
          
          if (deptProjectAssignment) {
            isLevel0Approver = true;
          } else {
            const projectAssignment = await Level0ApproverAssignment.findOne({
              assignedUser: req.user._id,
              assignmentType: 'project',
              assignedProjects: projectId,
              isActive: true
            });
            
            if (projectAssignment) {
              isLevel0Approver = true;
            }
          }
        }
      }
      
      if (isLevel0Approver && existingDoc.currentApprovalLevel === 0) {
        // Initialize editHistory if it doesn't exist
        if (!updateData.editHistory) {
          updateData.editHistory = existingDoc.editHistory || [];
        }
        
        // Add edit history entry
        const editEntry = {
          editedBy: req.user._id,
          editedByName: `${req.user.firstName} ${req.user.lastName}`,
          editedAt: new Date(),
          changes: isResubmitting ? 'Resubmitted evaluation with changes' : 'Edited evaluation data',
          level: 0
        };
        
        // Compare key fields to identify what changed
        const changes = [];
        if (req.body.totalScore !== undefined && req.body.totalScore !== existingDoc.totalScore) {
          changes.push(`Total Score: ${existingDoc.totalScore} → ${req.body.totalScore}`);
        }
        if (req.body.percentage !== undefined && req.body.percentage !== existingDoc.percentage) {
          changes.push(`Percentage: ${existingDoc.percentage}% → ${req.body.percentage}%`);
        }
        if (req.body.overallResult && req.body.overallResult !== existingDoc.overallResult) {
          changes.push(`Overall Result: ${existingDoc.overallResult} → ${req.body.overallResult}`);
        }
        
        if (changes.length > 0) {
          editEntry.changes = changes.join(', ');
        }
        
        updateData.editHistory = [...(existingDoc.editHistory || []), editEntry];
      }
    }

    // Note: Approval levels initialization is now handled in the pre-save middleware
    // which will create Level 0-4 from ApprovalLevelConfiguration

    const document = await withPopulates(
      EvaluationDocument.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    );
    
    if (isSubmitting) {
      await TrackingService.logSubmission(document, req.user);
    } else if (isResubmitting) {
      // Log resubmission for Level 0 approvers - use syncDocumentTracking which handles holder properly
      await TrackingService.syncDocumentTracking({
        document,
        actorUser: req.user,
        holderEmployee: document?.evaluator,
        reason: 'Resubmitted by Level 0 approver after editing',
        comments: 'Document was edited and resubmitted by Level 0 approver'
      });
    }

    await TrackingService.syncDocumentTracking({
      document,
      actorUser: req.user,
      holderEmployee: document?.evaluator
    });

    res.json(document);
  } catch (error) {
    console.error('Error updating evaluation document:', error);
    res.status(500).json({ error: 'Failed to update evaluation document' });
  }
});

// Delete evaluation document
router.delete('/:id', async (req, res) => {
  try {
    const document = await EvaluationDocument.findByIdAndDelete(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }
    
    res.json({ message: 'Evaluation document deleted successfully' });
  } catch (error) {
    console.error('Error deleting evaluation document:', error);
    res.status(500).json({ error: 'Failed to delete evaluation document' });
  }
});

// Get documents grouped by department for dashboard
// Get user's assigned approval levels
router.get('/approval-levels/assigned', async (req, res) => {
  try {
    // Note: This endpoint should be called after authMiddleware is applied at route level
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const levelConfigs = await ApprovalLevelConfiguration.find({
      module: 'evaluation_appraisal',
      assignedUser: req.user._id,
      isActive: true
    })
    .populate('assignedUser', 'firstName lastName email role')
    .sort({ level: 1 });

    const assignedLevels = levelConfigs.map(config => ({
      level: config.level,
      title: config.title,
      module: config.module
    }));

    // Check for dynamic Level 0 assignments
    const level0Assignments = await Level0ApproverAssignment.find({
      assignedUser: req.user._id,
      isActive: true
    });

    // If user has dynamic Level 0 assignments, add Level 0 to assigned levels
    if (level0Assignments.length > 0 && !assignedLevels.some(l => l.level === 0)) {
      assignedLevels.push({
        level: 0,
        title: 'Department/Project Approver',
        module: 'evaluation_appraisal'
      });
      // Sort by level
      assignedLevels.sort((a, b) => a.level - b.level);
    }

    res.json({
      success: true,
      data: {
        assignedLevels,
        canApprove: assignedLevels.length > 0
      }
    });
  } catch (error) {
    console.error('Error fetching assigned approval levels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned approval levels',
      message: error.message
    });
  }
});

router.get('/dashboard/grouped', async (req, res) => {
  try {
    const { status, formType, groupBy = 'department' } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (formType) query.formType = formType;
    
    // STRICT FILTERING: Only return documents at user's assigned approval level(s)
    // Get user's assigned approval levels (static from ApprovalLevelConfiguration)
    let userAssignedLevels = [];
    if (req.user) {
      const levelConfigs = await ApprovalLevelConfiguration.find({
        module: 'evaluation_appraisal',
        assignedUser: req.user._id,
        isActive: true
      });
      userAssignedLevels = levelConfigs.map(config => config.level);
    }
    
    // Check for dynamic Level 0 assignments
    let level0Assignments = [];
    let hasLevel0Static = userAssignedLevels.includes(0);
    let hasLevel0Dynamic = false;
    
    if (req.user) {
      level0Assignments = await Level0ApproverAssignment.find({
        assignedUser: req.user._id,
        isActive: true
      })
        .populate('assignedProjects', '_id')
        .populate('departmentProjectAssignments.project', '_id')
        .populate('departmentProjectAssignments.department', '_id');
      
      hasLevel0Dynamic = level0Assignments.length > 0;
    }
    
    // If user has Level 0 assignments (static or dynamic), filter documents
    if (hasLevel0Static || hasLevel0Dynamic) {
      query.currentApprovalLevel = 0;
    } else if (userAssignedLevels.length > 0) {
      // User has other levels (1-4) but not Level 0
      query.currentApprovalLevel = { $in: userAssignedLevels };
    } else {
      // If user has no assigned levels, return empty result (don't show any documents)
      return res.json([]);
    }
    
    // Use the base populate configuration (which already includes placementProject)
    let documents = await withPopulates(
      EvaluationDocument.find(query)
    ).sort({ createdAt: -1 });
    
    // If user has dynamic Level 0 assignments, filter documents in memory
    // (because we need to check populated employee fields)
    if (hasLevel0Dynamic && documents.length > 0) {
      const projectIds = [];
      const departmentProjectFilters = [];
      
      level0Assignments.forEach(assignment => {
        if (assignment.assignmentType === 'project') {
          // Project-level: add all project IDs
          assignment.assignedProjects.forEach(project => {
            if (project && project._id) {
              projectIds.push(project._id.toString());
            }
          });
        } else if (assignment.assignmentType === 'department_project') {
          // Department-project level: add specific combinations
          assignment.departmentProjectAssignments.forEach(dp => {
            if (dp.project && dp.department && dp.project._id && dp.department._id) {
              departmentProjectFilters.push({
                project: dp.project._id.toString(),
                department: dp.department._id.toString()
              });
            }
          });
        }
      });
      
      // Filter documents based on employee's placementProject and placementDepartment
      documents = documents.filter(doc => {
        const employee = doc.employee;
        if (!employee) return false;
        
        const docProjectId = (employee.placementProject?._id || doc.project || employee.placementProject)?.toString();
        const docDeptId = (employee.placementDepartment?._id || doc.department || employee.placementDepartment)?.toString();
        
        // Check project-level assignments
        if (projectIds.length > 0 && docProjectId) {
          if (projectIds.includes(docProjectId)) {
            return true; // Document is in an assigned project
          }
        }
        
        // Check department-project assignments
        if (departmentProjectFilters.length > 0 && docProjectId && docDeptId) {
          const matches = departmentProjectFilters.some(dp => {
            return dp.project === docProjectId && dp.department === docDeptId;
          });
          if (matches) {
            return true; // Document matches a department-project assignment
          }
        }
        
        // If we have filters but document doesn't match, exclude it
        if (projectIds.length > 0 || departmentProjectFilters.length > 0) {
          return false;
        }
        
        // If no dynamic filters, include all Level 0 documents
        return true;
      });
    }
    
    const grouped = {};
    
    if (groupBy === 'project') {
      // Group by project
      documents.forEach(doc => {
        // Skip documents from inactive departments
        if (doc.department && doc.department.isActive === false) {
          return;
        }
        
        const projectId = doc.employee?.placementProject?._id?.toString() || 'no-project';
        const projectName = doc.employee?.placementProject?.name || 'No Project';
        
        if (!grouped[projectId]) {
          grouped[projectId] = {
            project: {
              _id: doc.employee?.placementProject?._id || null,
              name: projectName
            },
            department: null,
            hod: null,
            documents: []
          };
        }
        
        grouped[projectId].documents.push(doc);
      });
    } else {
      // Group by department (default)
      documents.forEach(doc => {
        // Skip documents from inactive departments
        if (doc.department && doc.department.isActive === false) {
          return;
        }
        
        const deptId = doc.department?._id?.toString() || 'no-department';
        const deptName = doc.department?.name || 'No Department';
        
        if (!grouped[deptId]) {
          grouped[deptId] = {
            department: {
              _id: doc.department?._id || null,
              name: deptName
            },
            project: null,
            hod: null,
            documents: []
          };
        }
        
        grouped[deptId].documents.push(doc);
      });
      
      // Get HOD for each department
      for (const deptId in grouped) {
        if (deptId !== 'no-department') {
          const hod = await Employee.findOne({
            'placementDepartment': deptId,
            $or: [
              { 'placementDesignation.title': { $regex: /hod|head of department/i } }
            ]
          }).select('firstName lastName employeeId email');
          
          if (hod) {
            grouped[deptId].hod = hod;
          }
        }
      }
    }
    
    res.json(Object.values(grouped));
  } catch (error) {
    console.error('Error fetching grouped evaluation documents:', error);
    res.status(500).json({ error: 'Failed to fetch grouped evaluation documents' });
  }
});

// Update status
router.patch('/:id/status', [
  body('status').isIn(['draft', 'sent', 'in_progress', 'submitted', 'completed', 'archived'])
    .withMessage('Valid status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { status } = req.body;
    const updateData = { status };
    
    if (status === 'sent') updateData.sentAt = new Date();
    if (status === 'submitted') updateData.submittedAt = new Date();
    if (status === 'completed') updateData.completedAt = new Date();
    
    const document = await withPopulates(
      EvaluationDocument.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    );
    
    if (!document) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }
    
    await TrackingService.syncDocumentTracking({
      document,
      actorUser: req.user,
      holderEmployee: document.evaluator
    });
    
    res.json(document);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Send evaluation documents to authorities
router.post('/send', async (req, res) => {
  try {
    const { employeeIds, evaluatorIds } = req.body;
    
    // Simple validation - just check if data exists
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Employee IDs array is required' });
    }
    
    if (!evaluatorIds || !Array.isArray(evaluatorIds) || evaluatorIds.length === 0) {
      return res.status(400).json({ error: 'Evaluator IDs array is required' });
    }
    // Always use production URL for evaluation document emails
    const baseUrl = 'https://tovus.net';
    const results = [];

    // Get employees with their categories
    const employees = await Employee.find({ _id: { $in: employeeIds } })
      .populate('placementDepartment', 'name')
      .populate('placementDesignation', 'title')
      .populate('user', 'firstName lastName email department position employeeId');

    // Get evaluators
    const evaluators = await Employee.find({ _id: { $in: evaluatorIds } })
      .populate('placementDepartment', 'name')
      .populate('placementDesignation', 'title')
      .populate('user', 'firstName lastName email department position employeeId');

    // Step 1: Create all documents first (grouped by evaluator)
    const evaluatorDocumentsMap = new Map(); // evaluatorId -> array of {document, employee, accessLink}

    for (const employee of employees) {
      // Determine form type from employee's category (default to white_collar if not set)
      const employeeFormType = employee.employeeCategory === 'blue_collar' ? 'blue_collar' : 'white_collar';

      for (const evaluator of evaluators) {
        try {
          // Generate unique access token for each document (secure)
          const accessToken = crypto.randomBytes(32).toString('hex');

          // Create evaluation document with auto-determined form type
          const document = new EvaluationDocument({
            employee: employee._id,
            evaluator: evaluator._id,
            formType: employeeFormType,
            status: 'draft',
            department: employee.placementDepartment?._id || null,
            code: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            designation: employee.placementDesignation?.title || '',
            accessToken
          });

          await document.save();

          // Skip self-evaluation: if evaluator is evaluating themselves, don't include in email
          if (employee._id.toString() === evaluator._id.toString()) {
            // Still save the document but don't send email for self-evaluation
            await EvaluationDocument.findByIdAndUpdate(document._id, {
              status: 'sent',
              sentAt: new Date(),
              emailSent: false,
              emailSentAt: null
            });
            
            results.push({
              employeeId: employee._id,
              employeeName: `${employee.firstName} ${employee.lastName}`,
              evaluatorId: evaluator._id,
              evaluatorName: `${evaluator.firstName} ${evaluator.lastName}`,
              evaluatorEmail: evaluator.email,
              documentId: document._id,
              emailSent: false,
              emailError: 'Self-evaluation not sent via email'
            });
            continue; // Skip adding to email map
          }

          // Generate access link with unique token
          const accessLink = `${baseUrl}/hr/evaluation-appraisal/fill/${document._id}?token=${accessToken}`;

          // Group by evaluator (only non-self evaluations)
          if (!evaluatorDocumentsMap.has(evaluator._id.toString())) {
            evaluatorDocumentsMap.set(evaluator._id.toString(), []);
          }
          evaluatorDocumentsMap.get(evaluator._id.toString()).push({
            document,
            employee,
            accessLink,
            department: employee.placementDepartment,
            formType: employeeFormType
          });

          results.push({
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            evaluatorId: evaluator._id,
            evaluatorName: `${evaluator.firstName} ${evaluator.lastName}`,
            evaluatorEmail: evaluator.email,
            documentId: document._id,
            emailSent: false, // Will be updated after email is sent
            emailError: null
          });
        } catch (error) {
          console.error(`Error creating document for employee ${employee._id} and evaluator ${evaluator._id}:`, error);
          results.push({
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            evaluatorId: evaluator._id,
            evaluatorName: `${evaluator.firstName} ${evaluator.lastName}`,
            evaluatorEmail: evaluator.email,
            emailSent: false,
            emailError: error.message
          });
        }
      }
    }

    // Step 2: Send one email per evaluator with all their evaluation links
    for (const [evaluatorId, documentsData] of evaluatorDocumentsMap.entries()) {
      const evaluator = evaluators.find(e => e._id.toString() === evaluatorId);
      if (!evaluator) continue;

      // Skip if no documents to send (all were self-evaluations)
      if (!documentsData || documentsData.length === 0) {
        continue;
      }

      try {
        // Group documents by form type for email content
        const documentsByFormType = documentsData.reduce((acc, d) => {
          const formType = d.formType || 'white_collar';
          if (!acc[formType]) acc[formType] = [];
          acc[formType].push({
            employee: d.employee,
            document: d.document,
            department: d.department,
            accessLink: d.accessLink
          });
          return acc;
        }, {});

        // Send one email per form type with all employees for this evaluator
        // For backward compatibility, send one email with mixed form types if needed
        const allDocuments = documentsData.map(d => ({
          employee: d.employee,
          document: d.document,
          department: d.department,
          accessLink: d.accessLink,
          formType: d.formType || 'white_collar'
        }));

        // Use the primary form type (most common) or white_collar as default
        const primaryFormType = documentsData.length > 0 
          ? (documentsData[0].formType || 'white_collar')
          : 'white_collar';

        const emailResult = await EmailService.sendBulkEvaluationDocumentEmail(
          evaluator,
          allDocuments,
          primaryFormType // Pass for email template context, but documents contain their own formType
        );

        // Update all documents for this evaluator with email status
        const updatePromises = documentsData.map(d => {
          return EvaluationDocument.findByIdAndUpdate(d.document._id, {
            status: 'sent',
            sentAt: new Date(),
            emailSent: emailResult.success,
            emailSentAt: new Date()
          });
        });
        await Promise.all(updatePromises);

        // Log tracking for all documents
        if (emailResult.success) {
          const trackingPromises = documentsData.map(d => {
            return TrackingService.logSend({
              document: d.document,
              evaluator,
              employee: d.employee,
              actorUser: req.user
            });
          });
          await Promise.all(trackingPromises);
        }

        // Update results
        documentsData.forEach(d => {
          const result = results.find(r => 
            r.documentId && r.documentId.toString() === d.document._id.toString()
          );
          if (result) {
            result.emailSent = emailResult.success;
            result.emailError = emailResult.error || null;
          }
        });
      } catch (error) {
        console.error(`Error sending bulk email to evaluator ${evaluatorId}:`, error);
        // Update results with error
        documentsData.forEach(d => {
          const result = results.find(r => 
            r.documentId && r.documentId.toString() === d.document._id.toString()
          );
          if (result) {
            result.emailSent = false;
            result.emailError = error.message;
          }
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} evaluation document(s)`,
      results
    });
  } catch (error) {
    console.error('Error sending evaluation documents:', error);
    res.status(500).json({ error: 'Failed to send evaluation documents' });
  }
});

// Helper function to approve a single document (reusable for bulk approval)
const approveDocument = async (documentId, comments, user) => {
  const document = await EvaluationDocument.findById(documentId);
  if (!document) {
    throw new Error('Evaluation document not found');
  }
  
  await hydrateDocument(document);
  
  // Check if document is submitted and can be approved
  if (document.status !== 'submitted') {
    throw new Error('Document must be submitted before approval');
  }
  
  if (document.approvalStatus === 'approved') {
    throw new Error('Document is already approved');
  }
  
  if (document.approvalStatus === 'rejected') {
    throw new Error('Document has been rejected');
  }
  
  // Initialize approval levels if they don't exist, or add Level 0 if missing
  if (!document.approvalLevels || document.approvalLevels.length === 0) {
    // Level 0-4 will be initialized by the pre-save middleware
    // But we need to ensure the document is saved to trigger the middleware
    await document.save();
    
    // Reload the document to get the initialized approval levels
    await hydrateDocument(document);
  } else {
    // Check if Level 0 exists, if not, add it
    const hasLevel0 = document.approvalLevels.some(level => level.level === 0);
    if (!hasLevel0) {
      // Get Level 0 configuration
      const level0Config = await ApprovalLevelConfiguration.getByModuleAndLevel('evaluation_appraisal', 0);
      
      if (level0Config && level0Config.isActive) {
        // Find Employee record for Level 0 approver
        const level0Employee = await Employee.findOne({ user: level0Config.assignedUser._id });
        
        // Add Level 0 at the beginning
        document.approvalLevels.unshift({
          level: 0,
          title: level0Config.title,
          approverName: level0Config.assignedUser 
            ? `${level0Config.assignedUser.firstName} ${level0Config.assignedUser.lastName}`
            : 'Unknown',
          approver: level0Employee ? level0Employee._id : null,
          assignedUserId: level0Config.assignedUser ? level0Config.assignedUser._id : null,
          status: 'pending'
        });
        
        // Update currentApprovalLevel to 0 if document is still pending
        if (document.approvalStatus === 'pending' || document.approvalStatus === 'in_progress') {
          document.currentApprovalLevel = 0;
        }
        
        await document.save();
        await hydrateDocument(document);
      }
    }
  }
  
  const currentLevel = document.currentApprovalLevel ?? (document.approvalLevels && document.approvalLevels.length > 0 ? document.approvalLevels[0].level : 1);
  
  // Find the index of the current level in approvalLevels array
  const levelIndex = document.approvalLevels.findIndex(level => level.level === currentLevel);
  
  if (levelIndex < 0 || levelIndex >= document.approvalLevels.length) {
    throw new Error('Invalid approval level');
  }
  
  const currentLevelData = document.approvalLevels[levelIndex];
  
  if (currentLevelData.status === 'approved') {
    throw new Error('Current approval level is already approved');
  }
  
  if (currentLevelData.status === 'rejected') {
    throw new Error('Current approval level has been rejected');
  }
  
  if (currentLevelData.status !== 'pending') {
    throw new Error('Current approval level is not in pending status');
  }
  
  // Check if current user is assigned to this approval level
  if (user) {
    // Handle Level 0-4 approval (configuration-based)
    // Check assignedUserId first (User reference), then check configuration
    const assignedUserId = currentLevelData.assignedUserId;
    if (assignedUserId && assignedUserId.toString() !== user._id.toString()) {
      throw new Error(`Only the assigned approver can approve at level ${currentLevel}`);
    }
    
    // Also check against configuration as fallback (this is the source of truth)
    const isAssigned = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', currentLevel, user._id);
    if (!isAssigned) {
      throw new Error(`You are not authorized to approve at level ${currentLevel}`);
    }
  }
  
  // Approve current level
  document.approvalLevels[levelIndex].status = 'approved';
  document.approvalLevels[levelIndex].approvedAt = new Date();
  document.approvalLevels[levelIndex].comments = comments || '';
  if (user) {
    document.approvalLevels[levelIndex].approvedBy = user._id; // User reference
    
    // Also set approver to the Employee record (for display purposes)
    // Find the Employee record that corresponds to this User
    const approverEmployee = await Employee.findOne({ user: user._id });
    if (approverEmployee) {
      document.approvalLevels[levelIndex].approver = approverEmployee._id; // Employee reference
    }
  }
  
  // Check if all levels are approved
  const allApproved = document.approvalLevels.every(level => level.status === 'approved');
  
  if (allApproved) {
    document.approvalStatus = 'approved';
    document.status = 'completed';
    document.completedAt = new Date();
    document.currentApprovalLevel = null; // All levels completed
  } else {
    // Find next pending level
    const nextPendingLevel = document.approvalLevels.find(level => level.status === 'pending');
    if (nextPendingLevel) {
      document.currentApprovalLevel = nextPendingLevel.level;
    } else {
      // All levels are either approved or rejected, but not all approved
      document.currentApprovalLevel = null;
    }
    document.approvalStatus = 'in_progress';
  }
  
  await document.save();
  await hydrateDocument(document);
  
  // Find next level data for tracking
  let nextLevelData = null;
  if (!allApproved && document.currentApprovalLevel !== null) {
    const nextLevelIndex = document.approvalLevels.findIndex(
      level => level.level === document.currentApprovalLevel
    );
    if (nextLevelIndex >= 0) {
      nextLevelData = document.approvalLevels[nextLevelIndex];
    }
  }
  
  await TrackingService.logApproval({
    document,
    nextLevel: nextLevelData,
    actorUser: user
  });
  
  return await withPopulates(
    EvaluationDocument.findById(document._id)
  );
};

// Approve evaluation document at current level
router.post('/:id/approve', async (req, res) => {
  try {
    const { comments } = req.body;
    const populated = await approveDocument(req.params.id, comments, req.user);
    
    res.json({
      success: true,
      message: 'Document approved successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error approving evaluation document:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('already') || error.message.includes('rejected') || error.message.includes('submitted') ? 400 : 500;
    res.status(statusCode).json({ 
      success: false,
      error: error.message || 'Failed to approve evaluation document'
    });
  }
});

// Bulk approve evaluation documents by department
router.post('/bulk-approve', async (req, res) => {
  try {
    const { documentIds, excludeDocumentIds = [], comments } = req.body;
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document IDs are required'
      });
    }
    
    // Filter out excluded documents
    const documentsToApprove = documentIds.filter(id => !excludeDocumentIds.includes(id.toString()));
    
    if (documentsToApprove.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No documents to approve after exclusions'
      });
    }
    
    // Validate that all documents are at the same approval level
    // This ensures each approver only approves their own level
    const documents = await EvaluationDocument.find({
      _id: { $in: documentsToApprove }
    }).select('currentApprovalLevel approvalStatus status');
    
    if (documents.length !== documentsToApprove.length) {
      return res.status(400).json({
        success: false,
        error: 'Some documents were not found'
      });
    }
    
    // Check that all documents are at the same current approval level
    const approvalLevels = documents.map(doc => doc.currentApprovalLevel || 1);
    const uniqueLevels = [...new Set(approvalLevels)];
    
    if (uniqueLevels.length > 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot bulk approve documents at different approval levels. Found levels: ${uniqueLevels.join(', ')}. Please approve documents at the same level together.`
      });
    }
    
    const targetLevel = uniqueLevels[0];
    
    // Verify all documents are in a state that can be approved
    const invalidDocs = documents.filter(doc => 
      doc.status !== 'submitted' || 
      (doc.approvalStatus !== 'pending' && doc.approvalStatus !== 'in_progress') ||
      doc.approvalStatus === 'approved' ||
      doc.approvalStatus === 'rejected'
    );
    
    if (invalidDocs.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${invalidDocs.length} document(s) are not in a valid state for approval at level ${targetLevel}`
      });
    }
    
    // Check if current user is assigned to this approval level
    if (req.user) {
      const isAssigned = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', targetLevel, req.user._id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: `You are not authorized to approve documents at level ${targetLevel}`
        });
      }
    }
    
    const results = {
      successful: [],
      failed: [],
      total: documentsToApprove.length,
      level: targetLevel
    };
    
    // Process approvals in parallel with error handling
    // Each approval will only approve the CURRENT level, not all levels
    const approvalPromises = documentsToApprove.map(async (docId) => {
      try {
        const populated = await approveDocument(docId, comments, req.user);
        results.successful.push({
          documentId: docId,
          employeeName: populated.employee ? `${populated.employee.firstName} ${populated.employee.lastName}` : 'Unknown',
          status: 'approved',
          level: targetLevel
        });
        return { success: true, documentId: docId, data: populated };
      } catch (error) {
        results.failed.push({
          documentId: docId,
          error: error.message,
          level: targetLevel
        });
        return { success: false, documentId: docId, error: error.message };
      }
    });
    
    await Promise.all(approvalPromises);
    
    // Process excluded documents - advance them to the next level
    const excludedResults = {
      advanced: [],
      failed: []
    };
    
    if (excludeDocumentIds && excludeDocumentIds.length > 0) {
      // Fetch excluded documents to validate and advance them
      const excludedDocs = await EvaluationDocument.find({
        _id: { $in: excludeDocumentIds }
      });
      
      // Validate excluded documents are at the same level and in valid state
      const validExcludedDocs = excludedDocs.filter(doc => 
        doc.status === 'submitted' && 
        (doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress') &&
        doc.approvalStatus !== 'approved' &&
        doc.approvalStatus !== 'rejected' &&
        (doc.currentApprovalLevel || 1) === targetLevel
      );
      
      // Advance excluded documents to next level
      const advancePromises = validExcludedDocs.map(async (doc) => {
        try {
          await hydrateDocument(doc);
          
          // Initialize approval levels if needed
          if (!doc.approvalLevels || doc.approvalLevels.length === 0) {
            const levelConfigs = await ApprovalLevelConfiguration.getActiveForModule('evaluation_appraisal');
            if (levelConfigs && levelConfigs.length > 0) {
              const approvalLevels = await Promise.all(levelConfigs.map(async (config) => {
                let approverEmployee = null;
                if (config.assignedUser) {
                  approverEmployee = await Employee.findOne({ user: config.assignedUser._id });
                }
                return {
                  level: config.level,
                  title: config.title,
                  approverName: config.assignedUser ? `${config.assignedUser.firstName} ${config.assignedUser.lastName}` : 'Unknown',
                  approver: approverEmployee ? approverEmployee._id : null,
                  assignedUserId: config.assignedUser ? config.assignedUser._id : null,
                  status: 'pending'
                };
              }));
              doc.approvalLevels = approvalLevels;
              doc.approvalStatus = 'pending';
              doc.currentApprovalLevel = 1;
            }
          }
          
          const currentLevel = doc.currentApprovalLevel || 1;
          const levelIndex = currentLevel - 1;
          
          if (levelIndex >= 0 && levelIndex < doc.approvalLevels.length) {
            // Auto-approve current level with comment indicating auto-advancement
            doc.approvalLevels[levelIndex].status = 'approved';
            doc.approvalLevels[levelIndex].approvedAt = new Date();
            doc.approvalLevels[levelIndex].comments = `Auto-advanced from bulk approval (excluded from selection at Level ${targetLevel})`;
            if (req.user) {
              doc.approvalLevels[levelIndex].approvedBy = req.user._id;
              const approverEmployee = await Employee.findOne({ user: req.user._id });
              if (approverEmployee) {
                doc.approvalLevels[levelIndex].approver = approverEmployee._id;
              }
            }
            
            // Check if all levels are approved
            const allApproved = doc.approvalLevels.every(level => level.status === 'approved');
            
            if (allApproved) {
              doc.approvalStatus = 'approved';
              doc.status = 'completed';
              doc.completedAt = new Date();
            } else {
              // Move to next level
              doc.currentApprovalLevel = currentLevel + 1;
              doc.approvalStatus = 'in_progress';
            }
            
            await doc.save();
            await hydrateDocument(doc);
            
            excludedResults.advanced.push({
              documentId: doc._id,
              employeeName: doc.employee ? `${doc.employee.firstName} ${doc.employee.lastName}` : 'Unknown',
              fromLevel: targetLevel,
              toLevel: doc.currentApprovalLevel || targetLevel + 1
            });
          }
        } catch (error) {
          console.error(`Error advancing excluded document ${doc._id}:`, error);
          excludedResults.failed.push({
            documentId: doc._id,
            error: error.message
          });
        }
      });
      
      await Promise.all(advancePromises);
    }
    
    // Build message
    let message = `Bulk approval completed for Level ${targetLevel}: ${results.successful.length} approved`;
    if (results.failed.length > 0) {
      message += `, ${results.failed.length} failed`;
    }
    if (excludedResults.advanced.length > 0) {
      message += `. ${excludedResults.advanced.length} excluded document(s) advanced to next level`;
    }
    message += '.';
    
    res.json({
      success: true,
      message: message,
      data: {
        successful: results.successful,
        failed: results.failed,
        excluded: excludedResults.advanced,
        excludedFailed: excludedResults.failed,
        total: results.total,
        successCount: results.successful.length,
        failureCount: results.failed.length,
        excludedCount: excludedResults.advanced.length,
        approvedLevel: targetLevel,
        note: excludedResults.advanced.length > 0 
          ? 'Selected documents were approved. Excluded documents were automatically advanced to the next level for the next approver.'
          : 'Selected documents were approved and will proceed to the next level for the next approver.'
      }
    });
  } catch (error) {
    console.error('Error in bulk approval:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk approval',
      message: error.message
    });
  }
});

// Reject evaluation document at current level
router.post('/:id/reject', async (req, res) => {
  try {
    const { comments } = req.body;
    const document = await EvaluationDocument.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }
    
    if (document.approvalStatus === 'approved') {
      return res.status(400).json({ error: 'Document is already approved' });
    }
    
    if (document.approvalStatus === 'rejected') {
      return res.status(400).json({ error: 'Document has already been rejected' });
    }
    
    // Get current level - defaults to first level in array (could be 0 or 1)
  const currentLevel = document.currentApprovalLevel ?? (document.approvalLevels && document.approvalLevels.length > 0 ? document.approvalLevels[0].level : 1);
    const levelIndex = document.approvalLevels.findIndex(level => level.level === currentLevel);
    
    if (!document.approvalLevels || document.approvalLevels.length === 0) {
      return res.status(400).json({ error: 'Approval levels not initialized' });
    }
    
    if (levelIndex < 0 || levelIndex >= document.approvalLevels.length) {
      return res.status(400).json({ error: 'Invalid approval level' });
    }
    
    // Reject at current level
    document.approvalLevels[levelIndex].status = 'rejected';
    document.approvalLevels[levelIndex].rejectedAt = new Date();
    document.approvalLevels[levelIndex].comments = comments || '';
    if (req.user) {
      document.approvalLevels[levelIndex].approvedBy = req.user._id;
    }
    
    document.approvalStatus = 'rejected';
    
    await document.save();
    await hydrateDocument(document);

    await TrackingService.logRejection({
      document,
      levelData: document.approvalLevels[levelIndex],
      comments,
      actorUser: req.user
    });
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );
    
    res.json({
      success: true,
      message: 'Document rejected',
      data: populated
    });
  } catch (error) {
    console.error('Error rejecting evaluation document:', error);
    res.status(500).json({ error: 'Failed to reject evaluation document' });
  }
});

module.exports = router;
