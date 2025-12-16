const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const mongoose = require('mongoose');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const EvaluationLevel0Authority = require('../models/hr/EvaluationLevel0Authority');
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

const level0ApproversPopulate = {
  path: 'level0Approvers.assignedUser',
  select: 'firstName lastName email _id id'
};

const basePopulateConfig = [
  employeePopulate,
  evaluatorPopulate,
  { path: 'department', select: 'name isActive' },
  { path: 'project', select: 'name _id' },
  approvalPopulate,
  level0ApproversPopulate
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

// Get evaluation document by ID (public access with token OR authenticated user for Level 0 editing)
router.get('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    const document = await withPopulates(
      EvaluationDocument.findById(req.params.id)
    );
    
    if (!document) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }
    
    // Check if user is authenticated (for Level 0 editing)
    const isAuthenticated = req.user && req.user._id;
    const isLevel0Edit = isAuthenticated && 
                         document.currentApprovalLevel === 0 && 
                         document.level0ApprovalStatus === 'pending';
    
    // If token is provided, verify it (for public access)
    if (token && !isLevel0Edit && document.accessToken !== token) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }

    // If no token and not authenticated, require token
    if (!token && !isAuthenticated) {
      return res.status(401).json({ error: 'Access token or authentication required' });
    }

    // If form is already submitted, allow access only for Level 0 editing
    if (token && !isLevel0Edit && (document.status === 'submitted' || document.status === 'completed')) {
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

// Update evaluation document (public access with token)
router.put('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    
    // Find document first to verify token if provided
    const existingDoc = await EvaluationDocument.findById(req.params.id);
    if (!existingDoc) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }

    // Check access: token-based (public) only
    if (!token) {
      return res.status(401).json({ error: 'Authentication required or valid token needed' });
    }
    
    if (existingDoc.accessToken !== token) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }

    // Prevent duplicate submissions - if already submitted, reject the update
    if (req.body.status === 'submitted' && (existingDoc.status === 'submitted' || existingDoc.status === 'completed')) {
      return res.status(400).json({ 
        error: 'This evaluation form has already been submitted and cannot be modified.',
        alreadySubmitted: true
      });
    }

    // Check if status is changing to 'submitted' and approval levels need to be initialized
    const isSubmitting = req.body.status === 'submitted' && existingDoc.status !== 'submitted';

    const updateData = {
      ...req.body,
      ...(req.body.status === 'submitted' && { submittedAt: new Date() }),
      ...(req.body.status === 'completed' && { completedAt: new Date() })
    };

    // Note: Approval levels initialization is now handled in the pre-save middleware
    // which will create Level 1-4 from ApprovalLevelConfiguration

    const document = await withPopulates(
      EvaluationDocument.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    );
    
    if (isSubmitting) {
      await TrackingService.logSubmission(document, req.user);
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
    
    // Default to submitted if no status specified
    if (!query.status) {
      query.status = 'submitted';
    }
    
    // Check and fix documents that should be at Level 0 but aren't
    // This ensures consistent routing for documents that were submitted before Level 0 authority was set up
    try {
      const fixResult = await EvaluationDocument.checkAndFixLevel0Routing();
    } catch (fixError) {
      // Don't fail the request if fix fails, just log it
      console.error('[Dashboard] Error fixing Level 0 routing:', fixError.message);
    }
    
    // Check if user has Level 0 authority
    let userLevel0Authorities = null;
    if (req.user) {
      userLevel0Authorities = await EvaluationLevel0Authority.getUserAuthorities(req.user._id);
    }
    
    // Filter by user's assigned approval level(s) for Level 1+
    let userAssignedLevels = [];
    if (req.user) {
      const levelConfigs = await ApprovalLevelConfiguration.find({
        module: 'evaluation_appraisal',
        assignedUser: req.user._id,
        isActive: true
      });
      userAssignedLevels = levelConfigs.map(config => config.level);
    }
    
    // Use the base populate configuration (which already includes placementProject)
    let documents = await withPopulates(
      EvaluationDocument.find(query)
    ).sort({ createdAt: -1 });
    
    // Filter documents based on user's authority
    if (req.user) {
      const filteredDocs = [];
      
      // Check if user has Level 0 authority
      const hasLevel0Authority = userLevel0Authorities && userLevel0Authorities.projects.length > 0;
      
      for (const doc of documents) {
        let shouldShow = false;
        
        // LEVEL 0 FILTERING: If user has Level 0 authority
        if (hasLevel0Authority) {
          // Get document's project and department - try multiple sources
          let docProjectId = null;
          let docDeptId = null;
          
          // Try direct project field first
          if (doc.project) {
            docProjectId = doc.project._id ? doc.project._id.toString() : doc.project.toString();
          }
          
          // Try from employee placementProject
          if (!docProjectId && doc.employee?.placementProject) {
            docProjectId = doc.employee.placementProject._id 
              ? doc.employee.placementProject._id.toString() 
              : doc.employee.placementProject.toString();
          }
          
          // Try direct department field
          if (doc.department) {
            docDeptId = doc.department._id ? doc.department._id.toString() : doc.department.toString();
          }
          
          // Try from employee placementDepartment
          if (!docDeptId && doc.employee?.placementDepartment) {
            docDeptId = doc.employee.placementDepartment._id 
              ? doc.employee.placementDepartment._id.toString() 
              : doc.employee.placementDepartment.toString();
          }
          
          // Check if document matches user's Level 0 authority scope
          if (docProjectId && userLevel0Authorities.projects.includes(docProjectId)) {
            // Check if user has authority for this project
            const projectDepts = userLevel0Authorities.projectDepartments[docProjectId];
            
            // If projectDepts is null, it means all departments in this project
            // If projectDepts is an array, check if document's department is in it (or if no specific dept required)
            const deptMatches = projectDepts === null || 
                                !docDeptId || 
                                (projectDepts && projectDepts.includes(docDeptId));
            
            if (deptMatches) {
              // Show if document is at Level 0
              // Check if document is at Level 0 (either currentApprovalLevel === 0 or level0ApprovalStatus === 'pending')
              if (doc.currentApprovalLevel === 0 || 
                  (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')) {
                // Also verify user is in level0Approvers (if array exists)
                if (!doc.level0Approvers || doc.level0Approvers.length === 0) {
                  // No level0Approvers set, but user has authority - show it
                  shouldShow = true;
                } else {
                  // Check if user is in the level0Approvers array
                  const userInApprovers = doc.level0Approvers.some(
                    approver => {
                      const approverUserId = approver.assignedUser?._id 
                        ? approver.assignedUser._id.toString() 
                        : (approver.assignedUser ? approver.assignedUser.toString() : null);
                      return approverUserId === req.user._id.toString();
                    }
                  );
                  if (userInApprovers) {
                    shouldShow = true;
                  }
                }
              } 
              // Also show documents that were approved at Level 0 but have moved to Level 1+
              // This allows Level 0 approvers to see their approved documents that have progressed
              else if (doc.level0ApprovalStatus === 'approved' && 
                       doc.currentApprovalLevel >= 1 &&
                       doc.status === 'submitted') {
                // Check if user was a Level 0 approver for this document
                if (doc.level0Approvers && doc.level0Approvers.length > 0) {
                  const userInApprovers = doc.level0Approvers.some(
                    approver => {
                      const approverUserId = approver.assignedUser?._id 
                        ? approver.assignedUser._id.toString() 
                        : (approver.assignedUser ? approver.assignedUser.toString() : null);
                      return approverUserId === req.user._id.toString();
                    }
                  );
                  if (userInApprovers) {
                    shouldShow = true;
                  }
                }
              } else if (doc.status === 'submitted' && 
                        (doc.level0ApprovalStatus === 'not_required' || !doc.level0ApprovalStatus) &&
                        doc.currentApprovalLevel !== 0) {
                // Document was submitted but Level 0 routing might have failed
                // Check if it should have gone to Level 0 based on user's authority
                // This handles cases where routing failed but user should see it
                shouldShow = true;
              }
            }
          }
        }
        
        // LEVEL 1+ FILTERING: If user has Level 1+ assignments
        if (!shouldShow && userAssignedLevels.length > 0) {
          // Check if document has any entry at user's assigned levels
          if (doc.approvalLevels && doc.approvalLevels.length > 0) {
            for (const level of userAssignedLevels) {
              const levelEntry = doc.approvalLevels.find(l => l.level === level);
              if (levelEntry) {
                // Show if pending, approved, or currently at this level
                if (levelEntry.status === 'pending' || 
                    levelEntry.status === 'approved' || 
                    doc.currentApprovalLevel === level) {
                  shouldShow = true;
                  break;
                }
              }
            }
          }
          
          // Also check if document is currently at one of user's assigned levels
          if (!shouldShow && doc.currentApprovalLevel && userAssignedLevels.includes(doc.currentApprovalLevel)) {
            shouldShow = true;
          }
        }
        
        if (shouldShow) {
          filteredDocs.push(doc);
        }
      }
      
      documents = filteredDocs;
      
      // If user has no Level 0 authority and no Level 1+ assignments, return empty
      if (!hasLevel0Authority && userAssignedLevels.length === 0) {
        documents = [];
      }
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
      .populate('placementProject', 'name')
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
            project: employee.placementProject?._id || null, // IMPORTANT: Set project for Level 0 routing
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
  
  // Initialize approval levels if they don't exist
  if (!document.approvalLevels || document.approvalLevels.length === 0) {
    // Level 1-4 will be initialized by the pre-save middleware
    // But we need to ensure the document is saved to trigger the middleware
    await document.save();
    
    // Reload the document to get the initialized approval levels
    await hydrateDocument(document);
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
    // For Level 1-4, use standard assignment check
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
    // For Level 0, we need to populate project, department, employee, and level0Approvers
    const documents = await EvaluationDocument.find({
      _id: { $in: documentsToApprove }
    })
    .populate('project', '_id')
    .populate('department', '_id')
    .populate('employee', 'placementProject placementDepartment')
    .populate('employee.placementProject', '_id')
    .populate('employee.placementDepartment', '_id')
    .populate('level0Approvers.assignedUser', '_id')
    .select('currentApprovalLevel approvalStatus status level0ApprovalStatus level0Approvers project department employee');
    
    if (documents.length !== documentsToApprove.length) {
      return res.status(400).json({
        success: false,
        error: 'Some documents were not found'
      });
    }
    
    // Check that all documents are at the same current approval level
    // For Level 0, check if level0ApprovalStatus is 'pending' and currentApprovalLevel is 0
    const approvalLevels = documents.map(doc => {
      // If document is at Level 0 (either currentApprovalLevel === 0 or level0ApprovalStatus === 'pending')
      if (doc.currentApprovalLevel === 0 || 
          (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted' && (!doc.currentApprovalLevel || doc.currentApprovalLevel === 0))) {
        return 0;
      }
      return doc.currentApprovalLevel || 1;
    });
    const uniqueLevels = [...new Set(approvalLevels)];
    
    if (uniqueLevels.length > 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot bulk approve documents at different approval levels. Found levels: ${uniqueLevels.join(', ')}. Please approve documents at the same level together.`
      });
    }
    
    const targetLevel = uniqueLevels[0];
    
    // Verify all documents are in a state that can be approved
    const invalidDocs = documents.filter(doc => {
      // For Level 0, check level0ApprovalStatus
      if (targetLevel === 0) {
        return doc.status !== 'submitted' || doc.level0ApprovalStatus !== 'pending';
      }
      // For Level 1-4, check approvalStatus
      return doc.status !== 'submitted' || 
             (doc.approvalStatus !== 'pending' && doc.approvalStatus !== 'in_progress') ||
             doc.approvalStatus === 'approved' ||
             doc.approvalStatus === 'rejected';
    });
    
    if (invalidDocs.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${invalidDocs.length} document(s) are not in a valid state for approval at level ${targetLevel}`
      });
    }
    
    // Check if current user is assigned to this approval level
    if (req.user) {
      if (targetLevel === 0) {
        // For Level 0, check authorization for each document individually
        const unauthorizedDocs = [];
        for (const doc of documents) {
          const docProjectId = doc.project?._id?.toString() || doc.employee?.placementProject?._id?.toString() || null;
          const docDeptId = doc.department?._id?.toString() || doc.employee?.placementDepartment?._id?.toString() || null;
          
          const hasAuthority = await EvaluationLevel0Authority.hasAuthorityForDocument(
            req.user._id,
            docProjectId,
            docDeptId
          );
          
          if (!hasAuthority) {
            unauthorizedDocs.push(doc._id);
            continue;
          }
          
          // Check if user is in level0Approvers array
          const userInApprovers = doc.level0Approvers && doc.level0Approvers.some(approver => {
            if (!approver.assignedUser) return false;
            
            // Handle populated User object (has _id property)
            if (typeof approver.assignedUser === 'object' && approver.assignedUser._id) {
              return approver.assignedUser._id.toString() === req.user._id.toString();
            }
            // Handle ObjectId (direct or string)
            return approver.assignedUser.toString() === req.user._id.toString();
          });
          
          if (!userInApprovers) {
            unauthorizedDocs.push(doc._id);
          }
        }
        
        if (unauthorizedDocs.length > 0) {
          return res.status(403).json({
            success: false,
            error: `You are not authorized to approve ${unauthorizedDocs.length} document(s) at Level 0`
          });
        }
      } else {
        // For Level 1-4, use the standard approval level check
        const isAssigned = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', targetLevel, req.user._id);
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            error: `You are not authorized to approve documents at level ${targetLevel}`
          });
        }
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
        let populated;
        
        if (targetLevel === 0) {
          // Handle Level 0 approval separately
          const doc = documents.find(d => d._id.toString() === docId.toString());
          if (!doc) {
            throw new Error('Document not found');
          }
          
          await hydrateDocument(doc);
          
          // Check if document is at Level 0
          if (doc.currentApprovalLevel !== 0 && 
              !(doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')) {
            throw new Error('Document is not at Level 0 approval stage');
          }
          
          if (doc.level0ApprovalStatus === 'approved') {
            throw new Error('Document is already approved at Level 0');
          }
          
          if (doc.level0ApprovalStatus === 'rejected') {
            throw new Error('Document has been rejected at Level 0');
          }
          
          // Approve at Level 0 - mark the current user's approval
          if (doc.level0Approvers && doc.level0Approvers.length > 0) {
            const approverIndex = doc.level0Approvers.findIndex(approver => {
              if (!approver.assignedUser) return false;
              
              // Handle populated User object (has _id property)
              if (typeof approver.assignedUser === 'object' && approver.assignedUser._id) {
                return approver.assignedUser._id.toString() === req.user._id.toString();
              }
              // Handle ObjectId (direct or string)
              return approver.assignedUser.toString() === req.user._id.toString();
            });
            
            if (approverIndex >= 0) {
              // Update the approver's status to approved
              doc.level0Approvers[approverIndex].status = 'approved';
              doc.level0Approvers[approverIndex].approvedAt = new Date();
              doc.level0Approvers[approverIndex].comments = comments || '';
            }
            
            // Check if all Level 0 approvers have approved
            const allApproved = doc.level0Approvers.every(approver => approver.status === 'approved');
            
            if (allApproved) {
              // All Level 0 approvers have approved - move to Level 1
              doc.level0ApprovalStatus = 'approved';
              doc.currentApprovalLevel = 1;
              doc.approvalStatus = 'in_progress'; // In progress because Level 1+ are still pending
              
              // Initialize Level 1-4 if not already done
              if (!doc.approvalLevels || doc.approvalLevels.length === 0) {
                const levelConfigs = await ApprovalLevelConfiguration.find({
                  module: 'evaluation_appraisal',
                  level: { $gte: 1, $lte: 4 },
                  isActive: true
                })
                  .populate('assignedUser', 'firstName lastName email role')
                  .sort({ level: 1 });
                
                const approvalLevels = await Promise.all(levelConfigs.map(async (config) => {
                  let approverEmployee = null;
                  if (config.assignedUser) {
                    approverEmployee = await Employee.findOne({ user: config.assignedUser._id });
                  }
                  return {
                    level: config.level,
                    title: config.title,
                    approverName: config.assignedUser 
                      ? `${config.assignedUser.firstName} ${config.assignedUser.lastName}`
                      : 'Unknown',
                    approver: approverEmployee ? approverEmployee._id : null,
                    assignedUserId: config.assignedUser ? config.assignedUser._id : null,
                    status: 'pending'
                  };
                }));
                
                doc.approvalLevels = approvalLevels;
              } else {
                // Level 1-4 already exist, ensure Level 1 exists and is set to pending
                let level1Entry = doc.approvalLevels.find(l => l.level === 1);
                
                if (!level1Entry) {
                  // Level 1 entry doesn't exist - create it
                  const level1Config = await ApprovalLevelConfiguration.findOne({
                    module: 'evaluation_appraisal',
                    level: 1,
                    isActive: true
                  }).populate('assignedUser', 'firstName lastName email role');
                  
                  if (level1Config) {
                    const approverEmployee = await Employee.findOne({ user: level1Config.assignedUser?._id });
                    level1Entry = {
                      level: 1,
                      title: level1Config.title,
                      approverName: level1Config.assignedUser 
                        ? `${level1Config.assignedUser.firstName} ${level1Config.assignedUser.lastName}`
                        : 'Unknown',
                      approver: approverEmployee ? approverEmployee._id : null,
                      assignedUserId: level1Config.assignedUser ? level1Config.assignedUser._id : null,
                      status: 'pending'
                    };
                    doc.approvalLevels.push(level1Entry);
                    doc.approvalLevels.sort((a, b) => a.level - b.level);
                  }
                } else {
                  // Level 1 exists, ensure it's set to pending
                  level1Entry.status = 'pending';
                }
              }
            }
          }
          
          await doc.save();
          await hydrateDocument(doc);
          
          // Log approval tracking
          await TrackingService.logApproval({
            document: doc,
            nextLevel: doc.approvalLevels && doc.approvalLevels.length > 0 ? doc.approvalLevels.find(l => l.level === 1) : null,
            actorUser: req.user
          });
          
          populated = await withPopulates(
            EvaluationDocument.findById(doc._id)
          );
        } else {
          // For Level 1-4, use the standard approveDocument function
          populated = await approveDocument(docId, comments, req.user);
        }
        
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
    
    // Excluded documents remain at their current level - no auto-advancement
    // They will stay at the current level and can be approved later by the same or different approver
    
    // Build message
    let message = `Bulk approval completed for Level ${targetLevel}: ${results.successful.length} approved`;
    if (results.failed.length > 0) {
      message += `, ${results.failed.length} failed`;
    }
    if (excludeDocumentIds && excludeDocumentIds.length > 0) {
      message += `. ${excludeDocumentIds.length} document(s) excluded and remain at Level ${targetLevel}`;
    }
    message += '.';
    
    res.json({
      success: true,
      message: message,
      data: {
        successful: results.successful,
        failed: results.failed,
        excluded: excludeDocumentIds || [],
        total: results.total,
        successCount: results.successful.length,
        failureCount: results.failed.length,
        excludedCount: excludeDocumentIds ? excludeDocumentIds.length : 0,
        approvedLevel: targetLevel,
        note: excludeDocumentIds && excludeDocumentIds.length > 0 
          ? 'Selected documents were approved and will proceed to the next level. Excluded documents remain at the current level and can be approved later.'
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

// Level 0 Approval Routes
// Approve at Level 0
router.post('/:id/level0-approve', async (req, res) => {
  try {
    const { comments } = req.body;
    const document = await EvaluationDocument.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Evaluation document not found' 
      });
    }
    
    await hydrateDocument(document);
    
    // Check if document is at Level 0
    if (document.currentApprovalLevel !== 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Document is not at Level 0 approval stage' 
      });
    }
    
    if (document.level0ApprovalStatus === 'approved') {
      return res.status(400).json({ 
        success: false,
        error: 'Document is already approved at Level 0' 
      });
    }
    
    if (document.level0ApprovalStatus === 'rejected') {
      return res.status(400).json({ 
        success: false,
        error: 'Document has been rejected at Level 0' 
      });
    }
    
    // Check if current user has Level 0 authority for this document
    if (req.user) {
      const docProjectId = document.project?._id?.toString() || document.employee?.placementProject?._id?.toString() || null;
      const docDeptId = document.department?._id?.toString() || document.employee?.placementDepartment?._id?.toString() || null;
      
      const hasAuthority = await EvaluationLevel0Authority.hasAuthorityForDocument(
        req.user._id,
        docProjectId,
        docDeptId
      );
      
      if (!hasAuthority) {
        return res.status(403).json({ 
          success: false,
          error: 'You are not authorized to approve this document at Level 0' 
        });
      }
      
      // Check if user is in level0Approvers array
      // Handle both populated User object and ObjectId
      const userInApprovers = document.level0Approvers && document.level0Approvers.some(approver => {
        if (!approver.assignedUser) return false;
        
        // Handle populated User object (has _id property)
        if (typeof approver.assignedUser === 'object' && approver.assignedUser._id) {
          return approver.assignedUser._id.toString() === req.user._id.toString();
        }
        // Handle ObjectId (direct or string)
        return approver.assignedUser.toString() === req.user._id.toString();
      });
      
      if (!userInApprovers) {
        return res.status(403).json({ 
          success: false,
          error: 'You are not assigned as a Level 0 approver for this document' 
        });
      }
    }
    
    // Approve at Level 0 - mark the current user's approval
    if (document.level0Approvers && document.level0Approvers.length > 0) {
      const approverIndex = document.level0Approvers.findIndex(approver => {
        if (!approver.assignedUser) return false;
        
        // Handle populated User object (has _id property)
        if (typeof approver.assignedUser === 'object' && approver.assignedUser._id) {
          return approver.assignedUser._id.toString() === req.user._id.toString();
        }
        // Handle ObjectId (direct or string)
        return approver.assignedUser.toString() === req.user._id.toString();
      });
      
      if (approverIndex >= 0) {
        // Update the approver's status to approved
        document.level0Approvers[approverIndex].status = 'approved';
        document.level0Approvers[approverIndex].approvedAt = new Date();
        document.level0Approvers[approverIndex].comments = comments || '';
      }
      
      // Check if all Level 0 approvers have approved
      const allApproved = document.level0Approvers.every(approver => approver.status === 'approved');
      
      if (allApproved) {
        // All Level 0 approvers have approved - move to Level 1
        document.level0ApprovalStatus = 'approved';
        document.currentApprovalLevel = 1;
        document.approvalStatus = 'in_progress'; // In progress because Level 1+ are still pending
        
        // Initialize Level 1-4 if not already done
        if (!document.approvalLevels || document.approvalLevels.length === 0) {
          const levelConfigs = await ApprovalLevelConfiguration.find({
            module: 'evaluation_appraisal',
            level: { $gte: 1, $lte: 4 },
            isActive: true
          })
            .populate('assignedUser', 'firstName lastName email role')
            .sort({ level: 1 });
          
          const approvalLevels = levelConfigs.map(config => ({
            level: config.level,
            title: config.title,
            approverName: config.assignedUser 
              ? `${config.assignedUser.firstName} ${config.assignedUser.lastName}`
              : 'Unknown',
            approver: null,
            assignedUserId: config.assignedUser ? config.assignedUser._id : null,
            status: 'pending'
          }));
          
          document.approvalLevels = approvalLevels;
          
          // Link approvers to Employee records
          for (let i = 0; i < approvalLevels.length; i++) {
            if (approvalLevels[i].assignedUserId) {
              const approver = await Employee.findOne({ user: approvalLevels[i].assignedUserId });
              if (approver) {
                document.approvalLevels[i].approver = approver._id;
              }
            }
          }
        } else {
          // Level 1-4 already exist, ensure Level 1 exists and is set to pending
          let level1Entry = document.approvalLevels.find(l => l.level === 1);
          
          if (!level1Entry) {
            // Level 1 entry doesn't exist - create it
            const level1Config = await ApprovalLevelConfiguration.findOne({
              module: 'evaluation_appraisal',
              level: 1,
              isActive: true
            }).populate('assignedUser', 'firstName lastName email role');
            
            if (level1Config) {
              level1Entry = {
                level: 1,
                title: level1Config.title,
                approverName: level1Config.assignedUser 
                  ? `${level1Config.assignedUser.firstName} ${level1Config.assignedUser.lastName}`
                  : 'Unknown',
                approver: null,
                assignedUserId: level1Config.assignedUser ? level1Config.assignedUser._id : null,
                status: 'pending'
              };
              
              // Link approver to Employee record
              if (level1Entry.assignedUserId) {
                const approver = await Employee.findOne({ user: level1Entry.assignedUserId });
                if (approver) {
                  level1Entry.approver = approver._id;
                }
              }
              
              document.approvalLevels.push(level1Entry);
            }
          } else if (level1Entry.status !== 'pending') {
            // Reset Level 1 to pending if it was already approved/rejected
            level1Entry.status = 'pending';
            level1Entry.approvedAt = null;
            level1Entry.rejectedAt = null;
            level1Entry.approvedBy = null;
          }
        }
      } else {
        // Not all approvers have approved yet - keep at Level 0 but update status
        // The document remains at Level 0 until all approvers approve
        document.level0ApprovalStatus = 'pending'; // Still pending until all approve
        document.currentApprovalLevel = 0;
        document.approvalStatus = 'in_progress'; // In progress because some approvers have approved
      }
    }
    
    await document.save();
    await hydrateDocument(document);
    
    await TrackingService.logApproval({
      document,
      nextLevel: document.approvalLevels && document.approvalLevels.length > 0 ? document.approvalLevels[0] : null,
      actorUser: req.user,
      level: 0
    });
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );
    
    // Determine message based on whether document moved to Level 1
    let message = 'Document approved at Level 0 successfully';
    if (populated.currentApprovalLevel === 1) {
      message = 'Document approved at Level 0 and moved to Level 1';
    } else if (populated.level0Approvers && populated.level0Approvers.some(a => a.status === 'approved')) {
      message = 'Your approval has been recorded. Waiting for other Level 0 approvers.';
    }
    
    res.json({
      success: true,
      message: message,
      data: populated
    });
  } catch (error) {
    console.error('Error approving evaluation document at Level 0:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to approve evaluation document at Level 0',
      message: error.message
    });
  }
});

// Reject at Level 0
router.post('/:id/level0-reject', async (req, res) => {
  try {
    const { comments } = req.body;
    const document = await EvaluationDocument.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Evaluation document not found' 
      });
    }
    
    await hydrateDocument(document);
    
    // Check if document is at Level 0
    if (document.currentApprovalLevel !== 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Document is not at Level 0 approval stage' 
      });
    }
    
    // Check if current user has Level 0 authority for this document
    if (req.user) {
      const docProjectId = document.project?._id?.toString() || document.employee?.placementProject?._id?.toString() || null;
      const docDeptId = document.department?._id?.toString() || document.employee?.placementDepartment?._id?.toString() || null;
      
      const hasAuthority = await EvaluationLevel0Authority.hasAuthorityForDocument(
        req.user._id,
        docProjectId,
        docDeptId
      );
      
      if (!hasAuthority) {
        return res.status(403).json({ 
          success: false,
          error: 'You are not authorized to reject this document at Level 0' 
        });
      }
      
      // Check if user is in level0Approvers array
      // Handle both populated User object and ObjectId
      const userInApprovers = document.level0Approvers && document.level0Approvers.some(approver => {
        if (!approver.assignedUser) return false;
        
        // Handle populated User object (has _id property)
        if (typeof approver.assignedUser === 'object' && approver.assignedUser._id) {
          return approver.assignedUser._id.toString() === req.user._id.toString();
        }
        // Handle ObjectId (direct or string)
        return approver.assignedUser.toString() === req.user._id.toString();
      });
      
      if (!userInApprovers) {
        return res.status(403).json({ 
          success: false,
          error: 'You are not assigned as a Level 0 approver for this document' 
        });
      }
    }
    
    // Reject at Level 0
    if (document.level0Approvers && document.level0Approvers.length > 0) {
      const approverIndex = document.level0Approvers.findIndex(approver => {
        if (!approver.assignedUser) return false;
        
        // Handle populated User object (has _id property)
        if (typeof approver.assignedUser === 'object' && approver.assignedUser._id) {
          return approver.assignedUser._id.toString() === req.user._id.toString();
        }
        // Handle ObjectId (direct or string)
        return approver.assignedUser.toString() === req.user._id.toString();
      });
      
      if (approverIndex >= 0) {
        document.level0Approvers[approverIndex].status = 'rejected';
        document.level0Approvers[approverIndex].rejectedAt = new Date();
        document.level0Approvers[approverIndex].comments = comments || '';
      }
    }
    
    document.level0ApprovalStatus = 'rejected';
    document.approvalStatus = 'rejected';
    
    await document.save();
    await hydrateDocument(document);
    
    await TrackingService.logRejection({
      document,
      levelData: document.level0Approvers && document.level0Approvers.length > 0 ? document.level0Approvers[0] : null,
      comments,
      actorUser: req.user,
      level: 0
    });
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );
    
    res.json({
      success: true,
      message: 'Document rejected at Level 0',
      data: populated
    });
  } catch (error) {
    console.error('Error rejecting evaluation document at Level 0:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject evaluation document at Level 0',
      message: error.message
    });
  }
});

// Edit and resubmit at Level 0
router.put('/:id/level0-edit', async (req, res) => {
  try {
    const document = await EvaluationDocument.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Evaluation document not found' 
      });
    }
    
    await hydrateDocument(document);
    
    // Check if document is at Level 0
    if (document.currentApprovalLevel !== 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Document is not at Level 0 approval stage' 
      });
    }
    
    // Check if current user has Level 0 authority for this document
    if (req.user) {
      const docProjectId = document.project?._id?.toString() || document.employee?.placementProject?._id?.toString() || null;
      const docDeptId = document.department?._id?.toString() || document.employee?.placementDepartment?._id?.toString() || null;
      
      const hasAuthority = await EvaluationLevel0Authority.hasAuthorityForDocument(
        req.user._id,
        docProjectId,
        docDeptId
      );
      
      if (!hasAuthority) {
        return res.status(403).json({ 
          success: false,
          error: 'You are not authorized to edit this document at Level 0' 
        });
      }
    }
    
    // Update document with new data (exclude system fields)
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.employee;
    delete updateData.evaluator;
    
    // Update document
    Object.assign(document, updateData);
    
    // Log edit history
    if (req.user) {
      if (!document.editHistory) {
        document.editHistory = [];
      }
      // Get user's name - try multiple sources
      let editedByName = null;
      
      // First try: Get from User model directly
      try {
        const user = await User.findById(req.user._id).select('firstName lastName email');
        if (user) {
          if (user.firstName) {
            editedByName = user.lastName && user.lastName.trim() 
              ? `${user.firstName} ${user.lastName}`
              : user.firstName;
          } else if (user.email) {
            editedByName = user.email;
          }
        }
      } catch (error) {
        console.error('Error fetching user for edit history:', error);
      }
      
      // Fallback: Use req.user directly if available
      if (!editedByName && req.user.firstName) {
        editedByName = req.user.lastName && req.user.lastName.trim()
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user.firstName;
      }
      
      // Final fallback: Use email
      if (!editedByName) {
        editedByName = req.user.email || 'User';
      }
      
      document.editHistory.push({
        editedBy: req.user._id,
        editedByName: editedByName,
        editedAt: new Date(),
        changes: 'Document edited at Level 0',
        level: 0
      });
    }
    
    await document.save();
    await hydrateDocument(document);
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );
    
    res.json({
      success: true,
      message: 'Document updated successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error editing evaluation document at Level 0:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to edit evaluation document at Level 0',
      message: error.message
    });
  }
});

// Resubmit at Level 0 (edit and move to Level 1)
router.post('/:id/level0-resubmit', async (req, res) => {
  try {
    const document = await EvaluationDocument.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Evaluation document not found' 
      });
    }
    
    await hydrateDocument(document);
    
    // Check if document is at Level 0
    if (document.currentApprovalLevel !== 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Document is not at Level 0 approval stage' 
      });
    }
    
    // Check if current user has Level 0 authority for this document
    if (req.user) {
      const docProjectId = document.project?._id?.toString() || document.employee?.placementProject?._id?.toString() || null;
      const docDeptId = document.department?._id?.toString() || document.employee?.placementDepartment?._id?.toString() || null;
      
      const hasAuthority = await EvaluationLevel0Authority.hasAuthorityForDocument(
        req.user._id,
        docProjectId,
        docDeptId
      );
      
      if (!hasAuthority) {
        return res.status(403).json({ 
          success: false,
          error: 'You are not authorized to resubmit this document at Level 0' 
        });
      }
    }
    
    // Capture previous data for change tracking
    const previousData = {
      totalScore: document.totalScore,
      percentage: document.percentage,
      evaluationScores: document.evaluationScores ? JSON.parse(JSON.stringify(document.evaluationScores)) : null,
      whiteCollarProfessionalScores: document.whiteCollarProfessionalScores ? JSON.parse(JSON.stringify(document.whiteCollarProfessionalScores)) : null,
      whiteCollarPersonalScores: document.whiteCollarPersonalScores ? JSON.parse(JSON.stringify(document.whiteCollarPersonalScores)) : null,
      overallResult: document.overallResult
    };
    
    // Update document with new data (exclude system fields)
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.employee;
    delete updateData.evaluator;
    delete updateData.accessToken; // Don't update access token
    delete updateData.status; // Don't change status (should remain 'submitted')
    delete updateData.submittedAt; // Don't change submission time
    
    // Update document fields - ensure all fields are properly updated
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        document[key] = updateData[key];
      }
    });
    
    // Calculate mark changes
    const newData = {
      totalScore: document.totalScore,
      percentage: document.percentage,
      evaluationScores: document.evaluationScores ? JSON.parse(JSON.stringify(document.evaluationScores)) : null,
      whiteCollarProfessionalScores: document.whiteCollarProfessionalScores ? JSON.parse(JSON.stringify(document.whiteCollarProfessionalScores)) : null,
      whiteCollarPersonalScores: document.whiteCollarPersonalScores ? JSON.parse(JSON.stringify(document.whiteCollarPersonalScores)) : null,
      overallResult: document.overallResult
    };
    
    // Build changes description
    const changes = [];
    if (previousData.totalScore !== newData.totalScore) {
      changes.push(`Total Score: ${previousData.totalScore || 0} → ${newData.totalScore || 0}`);
    }
    if (previousData.percentage !== newData.percentage) {
      changes.push(`Percentage: ${previousData.percentage || 0}% → ${newData.percentage || 0}%`);
    }
    if (previousData.overallResult !== newData.overallResult) {
      changes.push(`Overall Result: ${previousData.overallResult || 'N/A'} → ${newData.overallResult || 'N/A'}`);
    }
    
    // Check for score changes in evaluation scores
    if (document.formType === 'blue_collar' && previousData.evaluationScores && newData.evaluationScores) {
      const scoreChanges = [];
      Object.keys(newData.evaluationScores).forEach(key => {
        const oldScore = previousData.evaluationScores[key]?.score || 0;
        const newScore = newData.evaluationScores[key]?.score || 0;
        if (oldScore !== newScore) {
          scoreChanges.push(`${key}: ${oldScore} → ${newScore}`);
        }
      });
      if (scoreChanges.length > 0) {
        changes.push(`Score Changes: ${scoreChanges.join(', ')}`);
      }
    } else if (document.formType === 'white_collar') {
      // Check professional scores
      if (previousData.whiteCollarProfessionalScores && newData.whiteCollarProfessionalScores) {
        const profChanges = [];
        Object.keys(newData.whiteCollarProfessionalScores).forEach(key => {
          const oldScore = previousData.whiteCollarProfessionalScores[key]?.score || 0;
          const newScore = newData.whiteCollarProfessionalScores[key]?.score || 0;
          if (oldScore !== newScore) {
            profChanges.push(`${key}: ${oldScore} → ${newScore}`);
          }
        });
        if (profChanges.length > 0) {
          changes.push(`Professional Scores: ${profChanges.join(', ')}`);
        }
      }
      // Check personal scores
      if (previousData.whiteCollarPersonalScores && newData.whiteCollarPersonalScores) {
        const persChanges = [];
        Object.keys(newData.whiteCollarPersonalScores).forEach(key => {
          const oldScore = previousData.whiteCollarPersonalScores[key]?.score || 0;
          const newScore = newData.whiteCollarPersonalScores[key]?.score || 0;
          if (oldScore !== newScore) {
            persChanges.push(`${key}: ${oldScore} → ${newScore}`);
          }
        });
        if (persChanges.length > 0) {
          changes.push(`Personal Scores: ${persChanges.join(', ')}`);
        }
      }
    }
    
    const changesDescription = changes.length > 0 
      ? `Document edited and resubmitted at Level 0. Changes: ${changes.join('; ')}`
      : 'Document edited and resubmitted at Level 0';
    
    // Keep document at Level 0 - don't automatically approve or move to Level 1
    // Level 0 approver needs to separately approve to move to Level 1
    // Reset Level 0 approvers status back to pending if they were already approved
    if (document.level0Approvers && document.level0Approvers.length > 0) {
      document.level0Approvers.forEach(approver => {
        // Reset to pending so approver can review and approve again
        approver.status = 'pending';
        approver.approvedAt = null;
        approver.comments = req.body.comments || approver.comments || '';
      });
    }
    
    // Keep Level 0 approval status as pending
    document.level0ApprovalStatus = 'pending';
    
    // Keep at Level 0 - don't move to Level 1 yet
    document.currentApprovalLevel = 0;
    document.approvalStatus = 'pending';
    
    // Don't initialize Level 1-4 yet - wait for Level 0 approval
    // Level 1-4 will be initialized when Level 0 is approved
    
    // Log edit history with detailed changes
    if (req.user) {
      if (!document.editHistory) {
        document.editHistory = [];
      }
      // Get user's name - try multiple sources
      let editedByName = null;
      
      // First try: Get from User model directly
      try {
        const user = await User.findById(req.user._id).select('firstName lastName email');
        if (user) {
          if (user.firstName) {
            editedByName = user.lastName && user.lastName.trim() 
              ? `${user.firstName} ${user.lastName}`
              : user.firstName;
          } else if (user.email) {
            editedByName = user.email;
          }
        }
      } catch (error) {
        // Silently handle error
      }
      
      // Fallback: Use req.user directly if available
      if (!editedByName && req.user.firstName) {
        editedByName = req.user.lastName && req.user.lastName.trim()
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user.firstName;
      }
      
      // Final fallback: Use email
      if (!editedByName) {
        editedByName = req.user.email || 'User';
      }
      
      document.editHistory.push({
        editedBy: req.user._id,
        editedByName: editedByName,
        editedAt: new Date(),
        changes: changesDescription,
        level: 0,
        previousData: previousData,
        newData: newData
      });
    }
    
    await document.save();
    await hydrateDocument(document);
    
    // Don't log approval yet - document is still at Level 0
    // Approval will be logged when Level 0 approver approves it
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );
    
    res.json({
      success: true,
      message: 'Document updated and resubmitted successfully. Please approve to move to Level 1.',
      data: populated
    });
  } catch (error) {
    console.error('Error resubmitting evaluation document at Level 0:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to resubmit evaluation document at Level 0',
      message: error.message
    });
  }
});

// Helper function to create edit/resubmit endpoints for levels 1-4
const createLevelEditResubmitEndpoints = (level) => {
  // Edit at Level X
  router.put(`/:id/level${level}-edit`, async (req, res) => {
    try {
      const document = await EvaluationDocument.findById(req.params.id);
      
      if (!document) {
        return res.status(404).json({ 
          success: false,
          error: 'Evaluation document not found' 
        });
      }
      
      await hydrateDocument(document);
      
      // Check if document is at the correct level
      if (document.currentApprovalLevel !== level) {
        return res.status(400).json({ 
          success: false,
          error: `Document is not at Level ${level} approval stage` 
        });
      }
      
      // Check if current user is assigned to this approval level
      if (req.user) {
        const isAssigned = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', level, req.user._id);
        if (!isAssigned) {
          return res.status(403).json({ 
            success: false,
            error: `You are not authorized to edit this document at Level ${level}` 
          });
        }
      }
      
      // Update document with new data (exclude system fields)
      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.employee;
      delete updateData.evaluator;
      
      // Update document
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          document[key] = updateData[key];
        }
      });
      
      // Log edit history
      if (req.user) {
        if (!document.editHistory) {
          document.editHistory = [];
        }
        // Get user's name
        let editedByName = null;
        try {
          const user = await User.findById(req.user._id).select('firstName lastName email');
          if (user) {
            if (user.firstName) {
              editedByName = user.lastName && user.lastName.trim() 
                ? `${user.firstName} ${user.lastName}`
                : user.firstName;
            } else if (user.email) {
              editedByName = user.email;
            }
          }
        } catch (error) {
          // Silently handle error
        }
        
        if (!editedByName && req.user.firstName) {
          editedByName = req.user.lastName && req.user.lastName.trim()
            ? `${req.user.firstName} ${req.user.lastName}`
            : req.user.firstName;
        }
        
        if (!editedByName) {
          editedByName = req.user.email || 'User';
        }
        
        document.editHistory.push({
          editedBy: req.user._id,
          editedByName: editedByName,
          editedAt: new Date(),
          changes: `Document edited at Level ${level}`,
          level: level
        });
      }
      
      await document.save();
      await hydrateDocument(document);
      
      const populated = await withPopulates(
        EvaluationDocument.findById(document._id)
      );
      
      res.json({
        success: true,
        message: 'Document updated successfully',
        data: populated
      });
    } catch (error) {
      console.error(`Error editing evaluation document at Level ${level}:`, error);
      res.status(500).json({ 
        success: false,
        error: `Failed to edit evaluation document at Level ${level}`,
        message: error.message
      });
    }
  });

  // Resubmit at Level X
  router.post(`/:id/level${level}-resubmit`, async (req, res) => {
    try {
      const document = await EvaluationDocument.findById(req.params.id);
      
      if (!document) {
        return res.status(404).json({ 
          success: false,
          error: 'Evaluation document not found' 
        });
      }
      
      await hydrateDocument(document);
      
      // Check if document is at the correct level
      if (document.currentApprovalLevel !== level) {
        return res.status(400).json({ 
          success: false,
          error: `Document is not at Level ${level} approval stage` 
        });
      }
      
      // Check if current user is assigned to this approval level
      if (req.user) {
        const isAssigned = await ApprovalLevelConfiguration.isUserAssigned('evaluation_appraisal', level, req.user._id);
        if (!isAssigned) {
          return res.status(403).json({ 
            success: false,
            error: `You are not authorized to resubmit this document at Level ${level}` 
          });
        }
      }
      
      // Capture previous data for change tracking
      const previousData = {
        totalScore: document.totalScore,
        percentage: document.percentage,
        evaluationScores: document.evaluationScores ? JSON.parse(JSON.stringify(document.evaluationScores)) : null,
        whiteCollarProfessionalScores: document.whiteCollarProfessionalScores ? JSON.parse(JSON.stringify(document.whiteCollarProfessionalScores)) : null,
        whiteCollarPersonalScores: document.whiteCollarPersonalScores ? JSON.parse(JSON.stringify(document.whiteCollarPersonalScores)) : null,
        overallResult: document.overallResult
      };
      
      // Update document with new data (exclude system fields)
      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.employee;
      delete updateData.evaluator;
      delete updateData.accessToken;
      delete updateData.status;
      delete updateData.submittedAt;
      
      // Update document fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          document[key] = updateData[key];
        }
      });
      
      // Calculate mark changes
      const newData = {
        totalScore: document.totalScore,
        percentage: document.percentage,
        evaluationScores: document.evaluationScores ? JSON.parse(JSON.stringify(document.evaluationScores)) : null,
        whiteCollarProfessionalScores: document.whiteCollarProfessionalScores ? JSON.parse(JSON.stringify(document.whiteCollarProfessionalScores)) : null,
        whiteCollarPersonalScores: document.whiteCollarPersonalScores ? JSON.parse(JSON.stringify(document.whiteCollarPersonalScores)) : null,
        overallResult: document.overallResult
      };
      
      // Build changes description
      const changes = [];
      if (previousData.totalScore !== newData.totalScore) {
        changes.push(`Total Score: ${previousData.totalScore || 0} → ${newData.totalScore || 0}`);
      }
      if (previousData.percentage !== newData.percentage) {
        changes.push(`Percentage: ${previousData.percentage || 0}% → ${newData.percentage || 0}%`);
      }
      if (previousData.overallResult !== newData.overallResult) {
        changes.push(`Overall Result: ${previousData.overallResult || 'N/A'} → ${newData.overallResult || 'N/A'}`);
      }
      
      // Check for score changes
      if (document.formType === 'blue_collar' && previousData.evaluationScores && newData.evaluationScores) {
        const scoreChanges = [];
        Object.keys(newData.evaluationScores).forEach(key => {
          const oldScore = previousData.evaluationScores[key]?.score || 0;
          const newScore = newData.evaluationScores[key]?.score || 0;
          if (oldScore !== newScore) {
            scoreChanges.push(`${key}: ${oldScore} → ${newScore}`);
          }
        });
        if (scoreChanges.length > 0) {
          changes.push(`Score Changes: ${scoreChanges.join(', ')}`);
        }
      } else if (document.formType === 'white_collar') {
        if (previousData.whiteCollarProfessionalScores && newData.whiteCollarProfessionalScores) {
          const profChanges = [];
          Object.keys(newData.whiteCollarProfessionalScores).forEach(key => {
            const oldScore = previousData.whiteCollarProfessionalScores[key]?.score || 0;
            const newScore = newData.whiteCollarProfessionalScores[key]?.score || 0;
            if (oldScore !== newScore) {
              profChanges.push(`${key}: ${oldScore} → ${newScore}`);
            }
          });
          if (profChanges.length > 0) {
            changes.push(`Professional Scores: ${profChanges.join(', ')}`);
          }
        }
        if (previousData.whiteCollarPersonalScores && newData.whiteCollarPersonalScores) {
          const persChanges = [];
          Object.keys(newData.whiteCollarPersonalScores).forEach(key => {
            const oldScore = previousData.whiteCollarPersonalScores[key]?.score || 0;
            const newScore = newData.whiteCollarPersonalScores[key]?.score || 0;
            if (oldScore !== newScore) {
              persChanges.push(`${key}: ${oldScore} → ${newScore}`);
            }
          });
          if (persChanges.length > 0) {
            changes.push(`Personal Scores: ${persChanges.join(', ')}`);
          }
        }
      }
      
      const changesDescription = changes.length > 0 
        ? `Document edited and resubmitted at Level ${level}. Changes: ${changes.join('; ')}`
        : `Document edited and resubmitted at Level ${level}`;
      
      // Reset the current level's approval status back to pending
      if (document.approvalLevels && document.approvalLevels.length > 0) {
        const levelEntry = document.approvalLevels.find(l => l.level === level);
        if (levelEntry) {
          levelEntry.status = 'pending';
          levelEntry.approvedAt = null;
          levelEntry.comments = req.body.comments || levelEntry.comments || '';
        }
      }
      
      // Keep at current level - don't move to next level yet
      document.currentApprovalLevel = level;
      document.approvalStatus = 'pending';
      
      // Log edit history
      if (req.user) {
        if (!document.editHistory) {
          document.editHistory = [];
        }
        let editedByName = null;
        try {
          const user = await User.findById(req.user._id).select('firstName lastName email');
          if (user) {
            if (user.firstName) {
              editedByName = user.lastName && user.lastName.trim() 
                ? `${user.firstName} ${user.lastName}`
                : user.firstName;
            } else if (user.email) {
              editedByName = user.email;
            }
          }
        } catch (error) {
          // Silently handle error
        }
        
        if (!editedByName && req.user.firstName) {
          editedByName = req.user.lastName && req.user.lastName.trim()
            ? `${req.user.firstName} ${req.user.lastName}`
            : req.user.firstName;
        }
        
        if (!editedByName) {
          editedByName = req.user.email || 'User';
        }
        
        document.editHistory.push({
          editedBy: req.user._id,
          editedByName: editedByName,
          editedAt: new Date(),
          changes: changesDescription,
          level: level,
          previousData: previousData,
          newData: newData
        });
      }
      
      await document.save();
      await hydrateDocument(document);
      
      const populated = await withPopulates(
        EvaluationDocument.findById(document._id)
      );
      
      res.json({
        success: true,
        message: `Document updated and resubmitted successfully. Please approve to move to Level ${level + 1}.`,
        data: populated
      });
    } catch (error) {
      console.error(`Error resubmitting evaluation document at Level ${level}:`, error);
      res.status(500).json({ 
        success: false,
        error: `Failed to resubmit evaluation document at Level ${level}`,
        message: error.message
      });
    }
  });
};

// Create edit/resubmit endpoints for levels 1-4
createLevelEditResubmitEndpoints(1);
createLevelEditResubmitEndpoints(2);
createLevelEditResubmitEndpoints(3);
createLevelEditResubmitEndpoints(4);

module.exports = router;
