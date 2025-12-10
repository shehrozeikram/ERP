const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const EmailService = require('../services/emailService');
const TrackingService = require('../services/evaluationDocumentTrackingService');

const employeePopulate = {
  path: 'employee',
  select: 'firstName lastName employeeId email placementDepartment placementDesignation designation user',
  populate: [
    { path: 'placementDepartment', select: 'name' },
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

// Update evaluation document (public access with token)
router.put('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    
    // Find document first to verify token if provided
    const existingDoc = await EvaluationDocument.findById(req.params.id);
    if (!existingDoc) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }

    // If token is provided, verify it (for public access)
    if (token && existingDoc.accessToken !== token) {
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

    // Initialize approval levels if submitting for the first time
    if (isSubmitting && (!existingDoc.approvalLevels || existingDoc.approvalLevels.length === 0)) {
      const approvalLevels = [
        {
          level: 1,
          title: 'Assistant Vice President / CHRO SGC',
          approverName: 'Fahad Fareed',
          status: 'pending'
        },
        {
          level: 2,
          title: 'Chairman Steering Committee',
          approverName: 'Ahmad Tansim',
          status: 'pending'
        },
        {
          level: 3,
          title: 'CEO SGC',
          approverName: 'Sardar Umer Tanveer',
          status: 'pending'
        },
        {
          level: 4,
          title: 'President SGC',
          approverName: 'Sardar Tanveer Ilyas',
          status: 'pending'
        }
      ];
      
      updateData.approvalLevels = approvalLevels;
      updateData.approvalStatus = 'pending';
      updateData.currentApprovalLevel = 1;
      
      // Try to find and link approvers by name
      for (let i = 0; i < approvalLevels.length; i++) {
        const approver = await Employee.findOne({
          $or: [
            { firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') }, 
              lastName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ').slice(1).join(' '), 'i') } },
            { firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') } }
          ]
        });
        
        if (approver) {
          updateData.approvalLevels[i].approver = approver._id;
        }
      }
    }

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
    const { status, formType } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (formType) query.formType = formType;
    
    // Use the full populate configuration to ensure all fields are populated correctly
    const documents = await withPopulates(
      EvaluationDocument.find(query)
    ).sort({ createdAt: -1 });
    
    // Group by department - filter out documents from inactive departments
    const grouped = {};
    
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
  
  // Initialize approval levels if they don't exist
  if (!document.approvalLevels || document.approvalLevels.length === 0) {
    // Get approval level configuration from database
    const levelConfigs = await ApprovalLevelConfiguration.getActiveForModule('evaluation_appraisal');
    
    if (!levelConfigs || levelConfigs.length === 0) {
      throw new Error('Approval level configuration not found. Please configure approval levels first.');
    }
    
    // Build approval levels from configuration
    // Find Employee records for assigned users (approver field should reference Employee, not User)
    const approvalLevels = await Promise.all(levelConfigs.map(async (config) => {
      let approverEmployee = null;
      if (config.assignedUser) {
        // Find the Employee record that corresponds to this User
        approverEmployee = await Employee.findOne({ user: config.assignedUser._id });
      }
      
      return {
        level: config.level,
        title: config.title,
        approverName: config.assignedUser ? `${config.assignedUser.firstName} ${config.assignedUser.lastName}` : 'Unknown',
        approver: approverEmployee ? approverEmployee._id : null, // Employee reference
        assignedUserId: config.assignedUser ? config.assignedUser._id : null, // User reference for validation
        status: 'pending'
      };
    }));
    
    document.approvalLevels = approvalLevels;
    document.approvalStatus = 'pending';
    document.currentApprovalLevel = 1;
    await document.save();
  }
  
  const currentLevel = document.currentApprovalLevel || 1;
  const levelIndex = currentLevel - 1;
  
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
  } else {
    document.currentApprovalLevel = currentLevel + 1;
    document.approvalStatus = 'in_progress';
  }
  
  await document.save();
  await hydrateDocument(document);
  
  const nextLevelData = allApproved
    ? null
    : document.approvalLevels[(document.currentApprovalLevel || 1) - 1];
  
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
    
    const currentLevel = document.currentApprovalLevel || 1;
    const levelIndex = currentLevel - 1;
    
    if (!document.approvalLevels || document.approvalLevels.length === 0) {
      return res.status(400).json({ error: 'Approval levels not initialized' });
    }
    
    if (levelIndex >= document.approvalLevels.length) {
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
