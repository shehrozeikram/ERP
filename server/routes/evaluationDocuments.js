const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
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
  { path: 'department', select: 'name' },
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
router.get('/dashboard/grouped', async (req, res) => {
  try {
    const { status, formType } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (formType) query.formType = formType;
    
    const documents = await EvaluationDocument.find(query)
      .populate('employee', 'firstName lastName employeeId email')
      .populate('evaluator', 'firstName lastName employeeId email')
      .populate('department', 'name')
      .populate({
        path: 'approvalLevels.approver',
        select: 'firstName lastName employeeId email',
        populate: {
          path: 'placementDesignation',
          select: 'title'
        }
      });
    
    // Group by department
    const grouped = {};
    
    documents.forEach(doc => {
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
    const { employeeIds, evaluatorIds, formType } = req.body;
    
    // Simple validation - just check if data exists
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Employee IDs array is required' });
    }
    
    if (!evaluatorIds || !Array.isArray(evaluatorIds) || evaluatorIds.length === 0) {
      return res.status(400).json({ error: 'Evaluator IDs array is required' });
    }
    
    if (!formType || !['blue_collar', 'white_collar'].includes(formType)) {
      return res.status(400).json({ error: 'Valid form type is required' });
    }
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const results = [];

    // Get employees
    const employees = await Employee.find({ _id: { $in: employeeIds } })
      .populate('placementDepartment', 'name')
      .populate('placementDesignation', 'title')
      .populate('user', 'firstName lastName email department position employeeId');

    // Get evaluators
    const evaluators = await Employee.find({ _id: { $in: evaluatorIds } })
      .populate('placementDepartment', 'name')
      .populate('placementDesignation', 'title')
      .populate('user', 'firstName lastName email department position employeeId');

    // Create documents and send emails
    for (const employee of employees) {
      for (const evaluator of evaluators) {
        try {
          // Generate access token
          const accessToken = crypto.randomBytes(32).toString('hex');

          // Create evaluation document
          const document = new EvaluationDocument({
            employee: employee._id,
            evaluator: evaluator._id,
            formType,
            status: 'draft',
            department: employee.placementDepartment?._id || null,
            code: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            designation: employee.placementDesignation?.title || '',
            accessToken
          });

          await document.save();

          // Generate access link
          const accessLink = `${baseUrl}/hr/evaluation-appraisal/fill/${document._id}?token=${accessToken}`;

          // Send email
          const emailResult = await EmailService.sendEvaluationDocumentEmail(
            evaluator,
            employee,
            { department: employee.placementDepartment },
            formType,
            accessLink
          );

          // Update document with email status
          await EvaluationDocument.findByIdAndUpdate(document._id, {
            status: 'sent',
            sentAt: new Date(),
            emailSent: emailResult.success,
            emailSentAt: new Date()
          });

          if (emailResult.success) {
            await TrackingService.logSend({
              document,
              evaluator,
              employee,
              actorUser: req.user
            });
          }

          results.push({
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            evaluatorId: evaluator._id,
            evaluatorName: `${evaluator.firstName} ${evaluator.lastName}`,
            evaluatorEmail: evaluator.email,
            documentId: document._id,
            emailSent: emailResult.success,
            emailError: emailResult.error || null
          });
        } catch (error) {
          console.error(`Error processing employee ${employee._id} for evaluator ${evaluator._id}:`, error);
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

// Approve evaluation document at current level
router.post('/:id/approve', async (req, res) => {
  try {
    const { comments } = req.body;
    const document = await EvaluationDocument.findById(req.params.id);
    await hydrateDocument(document);
    await hydrateDocument(document);
    
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Evaluation document not found' 
      });
    }
    
    console.log('Approval request for document:', {
      id: document._id,
      status: document.status,
      approvalStatus: document.approvalStatus,
      currentApprovalLevel: document.currentApprovalLevel,
      approvalLevelsCount: document.approvalLevels?.length || 0
    });
    
    // Check if document is submitted and can be approved
    // The document must be in 'submitted' status for approval to begin
    if (document.status !== 'submitted') {
      return res.status(400).json({ 
        success: false,
        error: 'Document must be submitted before approval',
        currentStatus: document.status,
        approvalStatus: document.approvalStatus,
        requiredStatus: 'submitted',
        hint: 'The document needs to be submitted by the evaluator before it can be approved'
      });
    }
    
    if (document.approvalStatus === 'approved') {
      return res.status(400).json({ 
        success: false,
        error: 'Document is already approved' 
      });
    }
    
    if (document.approvalStatus === 'rejected') {
      return res.status(400).json({ 
        success: false,
        error: 'Document has been rejected' 
      });
    }
    
    // Initialize approval levels if they don't exist (fallback for documents that were submitted without initialization)
    if (!document.approvalLevels || document.approvalLevels.length === 0) {
      console.log('Approval levels not found, initializing them...');
      
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
      
      // Try to find and link approvers by name
      for (let i = 0; i < approvalLevels.length; i++) {
        const approver = await Employee.findOne({
          $or: [
            { 
              firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') }, 
              lastName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ').slice(1).join(' '), 'i') } 
            },
            { 
              firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') } 
            }
          ]
        });
        
        if (approver) {
          approvalLevels[i].approver = approver._id;
        }
      }
      
      document.approvalLevels = approvalLevels;
      document.approvalStatus = 'pending';
      document.currentApprovalLevel = 1;
      
      // Save the document with initialized approval levels
      await document.save();
      console.log('Approval levels initialized successfully');
    }
    
    const currentLevel = document.currentApprovalLevel || 1;
    const levelIndex = currentLevel - 1;
    
    if (levelIndex < 0 || levelIndex >= document.approvalLevels.length) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid approval level',
        currentLevel,
        totalLevels: document.approvalLevels.length
      });
    }
    
    const currentLevelData = document.approvalLevels[levelIndex];
    
    // Check if current level is already approved
    if (currentLevelData.status === 'approved') {
      return res.status(400).json({ 
        success: false,
        error: 'Current approval level is already approved',
        level: currentLevel,
        levelTitle: currentLevelData.title
      });
    }
    
    // Check if current level is rejected
    if (currentLevelData.status === 'rejected') {
      return res.status(400).json({ 
        success: false,
        error: 'Current approval level has been rejected',
        level: currentLevel,
        levelTitle: currentLevelData.title
      });
    }
    
    // Check if current level is pending (explicit check)
    if (currentLevelData.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        error: 'Current approval level is not in pending status',
        level: currentLevel,
        levelTitle: currentLevelData.title,
        currentStatus: currentLevelData.status,
        requiredStatus: 'pending'
      });
    }
    
    // Approve current level
    document.approvalLevels[levelIndex].status = 'approved';
    document.approvalLevels[levelIndex].approvedAt = new Date();
    document.approvalLevels[levelIndex].comments = comments || '';
    if (req.user) {
      document.approvalLevels[levelIndex].approvedBy = req.user._id;
    }
    
    // Check if all levels are approved
    const allApproved = document.approvalLevels.every(level => level.status === 'approved');
    
    if (allApproved) {
      document.approvalStatus = 'approved';
      document.status = 'completed';
      document.completedAt = new Date();
    } else {
      // Move to next level
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
      actorUser: req.user
    });
    
    const populated = await withPopulates(
      EvaluationDocument.findById(document._id)
    );
    
    res.json({
      success: true,
      message: allApproved ? 'Document fully approved' : 'Approved at current level',
      data: populated
    });
  } catch (error) {
    console.error('Error approving evaluation document:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to approve evaluation document',
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

