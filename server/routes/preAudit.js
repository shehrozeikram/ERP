const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PreAudit = require('../models/audit/PreAudit');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;
const { authorize } = require('../middleware/auth');
const { getWorkflowModules, getModuleConfig } = require('../utils/adminWorkflowConfig');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/pre-audit');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'pre-audit-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and documents
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed'), false);
    }
  }
});

// ================================
// PRE AUDIT ROUTES
// ================================

// @route   GET /api/pre-audit
// @desc    Get all pre-audit documents with filtering and pagination
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/', 
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      sourceDepartment,
      sourceModule,
      documentType,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filters = { isActive: true };
    
    if (status) filters.status = status;
    if (sourceDepartment) filters.sourceDepartment = sourceDepartment;
    if (sourceModule) filters.sourceModule = sourceModule;
    if (documentType) filters.documentType = documentType;
    if (priority) filters.priority = priority;

    // Search functionality
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { documentNumber: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { sourceDepartmentName: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch Pre Audit documents
    const [preAuditDocs, preAuditCount] = await Promise.all([
      PreAudit.find(filters)
        .populate('sourceDepartment', 'name')
        .populate('submittedBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('observations.addedBy', 'firstName lastName email')
        .sort(sort)
        .lean(),
      PreAudit.countDocuments(filters)
    ]);

    // Fetch workflow documents (Payment Settlement, etc.) with status "Send to Audit"
    const workflowDocs = [];
    const workflowModules = getWorkflowModules();
    
    for (const submodule of workflowModules) {
      const config = getModuleConfig(submodule);
      if (!config) continue;
      
      try {
        const Model = require(config.modelPath);
        
        // Build query for documents that were sent to audit, approved, or returned from audit
        // This includes:
        // 1. Documents currently in "Send to Audit" status
        // 2. Documents approved from "Send to Audit" (status like "Approved (from Send to Audit)")
        // 3. Documents returned/rejected from audit (status "Returned from Audit" or "Rejected (from Send to Audit)")
        
        // Map Pre Audit status to workflow statuses
        // Always fetch all relevant workflow statuses, then filter by mapped status
        // IMPORTANT: Use exact match for "Send to Audit" and "Returned from Audit" to avoid partial matches
        const statusConditions = [
          { [config.workflowStatusField]: 'Send to Audit' },
          { [config.workflowStatusField]: { $regex: /^Approved \(from Send to Audit\)/ } },
          { [config.workflowStatusField]: 'Returned from Audit' },
          { [config.workflowStatusField]: { $regex: /^Rejected \(from Send to Audit\)/ } }
        ];
        
        const workflowQuery = {
          $or: statusConditions
        };
        
        // Apply search filter if provided
        if (search) {
          const searchConditions = [
            { [config.titleField]: { $regex: search, $options: 'i' } },
            { [config.descriptionField]: { $regex: search, $options: 'i' } }
          ];
          workflowQuery.$and = [
            { $or: statusConditions },
            { $or: searchConditions }
          ];
        }
        
        const docs = await Model.find(workflowQuery)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email')
          .populate('workflowHistory.changedBy', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .lean();
        
        // Transform workflow documents to Pre Audit format
        for (const doc of docs) {
          const workflowStatus = doc[config.workflowStatusField] || 'Draft';
          
          // Map workflow status to Pre Audit status for tab filtering
          // IMPORTANT: Order matters - check more specific statuses first
          // Use strict matching to ensure documents appear in correct tabs
          let preAuditStatus = 'pending';
          
          // Check for approved status first (must be explicitly approved from audit)
          // Must match exactly: "Approved (from Send to Audit)" or start with it
          if (workflowStatus && 
              (workflowStatus === 'Approved (from Send to Audit)' || 
               workflowStatus.startsWith('Approved (from Send to Audit)'))) {
            preAuditStatus = 'approved';
          }
          // Check for returned/rejected status
          else if (workflowStatus === 'Returned from Audit' || 
                   (workflowStatus && workflowStatus.startsWith('Rejected (from Send to Audit)'))) {
            preAuditStatus = 'returned_with_observations';
          }
          // Check if document is under review (has observations but still in "Send to Audit" status)
          // Must be exactly "Send to Audit" status
          else if (workflowStatus === 'Send to Audit') {
            // Check if document has observations in workflow history
            // BUT: If document was previously returned and sent back, check if the last status change was "Send to Audit"
            // This means it was resubmitted after being returned, so it should be treated as pending (new submission)
            const workflowHistory = doc.workflowHistory || [];
            const lastStatusChange = workflowHistory.length > 0 
              ? workflowHistory[workflowHistory.length - 1]
              : null;
            
            // If the last status change was TO "Send to Audit" (meaning it was just sent/resubmitted),
            // treat it as pending regardless of previous observations
            const wasJustResubmitted = lastStatusChange && 
              lastStatusChange.toStatus === 'Send to Audit' &&
              (lastStatusChange.fromStatus === 'Returned from Audit' || 
               lastStatusChange.fromStatus === 'Draft' ||
               lastStatusChange.fromStatus === 'Rejected (from Send to Audit)');
            
            if (wasJustResubmitted) {
              // Document was just resubmitted after being returned - treat as pending (new submission)
              preAuditStatus = 'pending';
            } else {
              // Check if document has observations in workflow history
              const hasObservations = workflowHistory.some(h => 
                h.comments && (h.comments.toLowerCase().includes('observation') || h.comments.toLowerCase().includes('observation:'))
              );
              if (hasObservations) {
                preAuditStatus = 'under_review';
              } else {
                preAuditStatus = 'pending';
              }
            }
          }
          // Default to pending for any other status (shouldn't happen for documents sent to audit)
          else {
            preAuditStatus = 'pending';
          }
          
          workflowDocs.push({
            _id: doc._id,
            documentNumber: doc[config.titleField] || doc._id.toString(),
            title: `${config.name}: ${doc[config.titleField] || 'Untitled'}`,
            description: doc[config.descriptionField] || '',
            sourceModule: 'admin',
            sourceDepartmentName: 'Admin',
            documentType: 'other',
            documentDate: doc[config.dateField] || doc.createdAt,
            amount: doc[config.amountField] || 0,
            referenceNumber: doc[config.titleField] || '',
            status: preAuditStatus,
            priority: 'medium',
            isWorkflowDocument: true,
            workflowSubmodule: submodule,
            workflowConfig: config,
            originalDocument: doc,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            createdBy: doc.createdBy,
            workflowHistory: doc.workflowHistory || [],
            workflowStatus: workflowStatus // Keep original workflow status for reference
          });
        }
      } catch (error) {
        console.error(`Error fetching workflow documents from ${submodule}:`, error);
      }
    }
    
    // Combine Pre Audit and workflow documents
    const allDocuments = [
      ...preAuditDocs.map(doc => ({ ...doc, isWorkflowDocument: false })), 
      ...workflowDocs
    ];
    
    // Apply status filter if provided (for tab filtering)
    let filteredDocuments = allDocuments;
    if (status) {
      filteredDocuments = allDocuments.filter(doc => {
        // For workflow documents, check the mapped status (must match exactly)
        if (doc.isWorkflowDocument) {
          // Ensure status matches exactly - no partial matches
          return doc.status === status;
        }
        // For regular Pre Audit documents, check the status field (must match exactly)
        return doc.status === status;
      });
    }
    
    // Sort combined documents
    filteredDocuments.sort((a, b) => {
      const aValue = a[sortBy] || a.createdAt;
      const bValue = b[sortBy] || b.createdAt;
      return sortOrder === 'desc' 
        ? new Date(bValue) - new Date(aValue)
        : new Date(aValue) - new Date(bValue);
    });
    
    // Apply pagination to combined results
    const paginatedDocuments = filteredDocuments.slice(skip, skip + parseInt(limit));
    const totalCount = filteredDocuments.length;

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: paginatedDocuments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  })
);

// @route   GET /api/pre-audit/:id
// @desc    Get a single pre-audit document by ID
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/:id',
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const document = await PreAudit.findById(req.params.id)
      .populate('sourceDepartment', 'name')
      .populate('submittedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('observations.addedBy', 'firstName lastName email')
      .populate('observations.resolvedBy', 'firstName lastName email')
      .populate('returnedBy', 'firstName lastName email')
      .populate('departmentResponse.respondedBy', 'firstName lastName email');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    res.json({
      success: true,
      data: document
    });
  })
);

// @route   POST /api/pre-audit
// @desc    Create a new pre-audit document (for departments to submit)
// @access  Private (All authenticated users can submit)
router.post('/',
  authMiddleware,
  upload.array('attachments', 10),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      sourceDepartment,
      sourceDepartmentName,
      sourceModule,
      documentType,
      documentDate,
      amount,
      referenceNumber,
      priority,
      reviewDueDate,
      tags
    } = req.body;

    // Validate required fields
    if (!title || !sourceDepartment || !sourceModule || !documentType || !documentDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, sourceDepartment, sourceModule, documentType, documentDate'
      });
    }

    // Handle file uploads
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedBy: req.user.id,
          uploadedAt: new Date()
        });
      });
    }

    const preAuditDoc = new PreAudit({
      title,
      description,
      sourceDepartment,
      sourceDepartmentName: sourceDepartmentName || req.user.department?.name || 'Unknown',
      sourceModule,
      documentType,
      documentDate: new Date(documentDate),
      amount: amount ? parseFloat(amount) : undefined,
      referenceNumber,
      priority: priority || 'medium',
      reviewDueDate: reviewDueDate ? new Date(reviewDueDate) : undefined,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      attachments,
      submittedBy: req.user.id,
      createdBy: req.user.id,
      status: 'pending'
    });

    await preAuditDoc.save();
    await preAuditDoc.populate([
      { path: 'sourceDepartment', select: 'name' },
      { path: 'submittedBy', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Pre-audit document submitted successfully',
      data: preAuditDoc
    });
  })
);

// @route   PUT /api/pre-audit/:id/approve
// @desc    Approve a pre-audit document
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id/approve',
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { approvalComments } = req.body;

    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    if (document.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Document is already approved'
      });
    }

    document.status = 'approved';
    document.approvedBy = req.user.id;
    document.approvedAt = new Date();
    document.approvalComments = approvalComments;
    document.updatedBy = req.user.id;

    await document.save();
    await document.populate([
      { path: 'approvedBy', select: 'firstName lastName email' },
      { path: 'sourceDepartment', select: 'name' }
    ]);

    res.json({
      success: true,
      message: 'Document approved successfully',
      data: document
    });
  })
);

// @route   PUT /api/pre-audit/:id/add-observation
// @desc    Add observation to a pre-audit document (works for both Pre Audit and workflow documents)
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id/add-observation',
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { observation, severity } = req.body;

    if (!observation) {
      return res.status(400).json({
        success: false,
        message: 'Observation is required'
      });
    }

    // Check if it's a workflow document by trying to find it in workflow modules
    let isWorkflowDocument = false;
    let workflowDocument = null;
    let workflowConfig = null;
    
    const workflowModules = getWorkflowModules();
    for (const submodule of workflowModules) {
      const config = getModuleConfig(submodule);
      if (!config) continue;
      
      try {
        const Model = require(config.modelPath);
        const doc = await Model.findById(req.params.id);
        if (doc && doc[config.workflowStatusField] === 'Send to Audit') {
          isWorkflowDocument = true;
          workflowDocument = doc;
          workflowConfig = config;
          break;
        }
      } catch (error) {
        // Continue to next module
      }
    }

    if (isWorkflowDocument) {
      // For workflow documents, add observation as a comment in workflow history
      workflowDocument.workflowHistory = workflowDocument.workflowHistory || [];
      workflowDocument.workflowHistory.push({
        fromStatus: workflowDocument[workflowConfig.workflowStatusField],
        toStatus: workflowDocument[workflowConfig.workflowStatusField],
        changedBy: req.user.id,
        changedAt: new Date(),
        comments: `Observation (${severity || 'medium'}): ${observation}`
      });
      
      workflowDocument.updatedBy = req.user.id;
      await workflowDocument.save();
      
      await workflowDocument.populate([
        { path: 'workflowHistory.changedBy', select: 'firstName lastName email' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ]);

      return res.json({
        success: true,
        message: 'Observation added successfully',
        data: {
          _id: workflowDocument._id,
          isWorkflowDocument: true,
          observation: {
            observation,
            severity: severity || 'medium',
            addedBy: req.user,
            addedAt: new Date()
          }
        }
      });
    }

    // Handle regular Pre Audit documents
    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    document.observations.push({
      observation,
      severity: severity || 'medium',
      addedBy: req.user.id,
      addedAt: new Date()
    });

    // Update status if not already under review
    if (document.status === 'pending') {
      document.status = 'under_review';
      document.reviewedBy = req.user.id;
      document.reviewedAt = new Date();
    }

    document.updatedBy = req.user.id;
    await document.save();
    await document.populate([
      { path: 'observations.addedBy', select: 'firstName lastName email' },
      { path: 'sourceDepartment', select: 'name' }
    ]);

    res.json({
      success: true,
      message: 'Observation added successfully',
      data: document
    });
  })
);

// @route   PUT /api/pre-audit/:id/return
// @desc    Return document to department with observations (works for both Pre Audit and workflow documents)
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id/return',
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { returnComments } = req.body;

    // Check if it's a workflow document
    let isWorkflowDocument = false;
    let workflowDocument = null;
    let workflowConfig = null;
    
    const workflowModules = getWorkflowModules();
    for (const submodule of workflowModules) {
      const config = getModuleConfig(submodule);
      if (!config) continue;
      
      try {
        const Model = require(config.modelPath);
        const doc = await Model.findById(req.params.id);
        if (doc && doc[config.workflowStatusField] === 'Send to Audit') {
          isWorkflowDocument = true;
          workflowDocument = doc;
          workflowConfig = config;
          break;
        }
      } catch (error) {
        // Continue to next module
      }
    }

    if (isWorkflowDocument) {
      // For workflow documents, set status to "Returned from Audit" so initiator can see it in Admin Dashboard
      workflowDocument[workflowConfig.workflowStatusField] = 'Returned from Audit';
      workflowDocument.workflowHistory = workflowDocument.workflowHistory || [];
      workflowDocument.workflowHistory.push({
        fromStatus: 'Send to Audit',
        toStatus: 'Returned from Audit',
        changedBy: req.user.id,
        changedAt: new Date(),
        comments: `Returned from Pre Audit with observations: ${returnComments || 'Please review and correct'}`
      });
      
      workflowDocument.updatedBy = req.user.id;
      await workflowDocument.save();
      
      await workflowDocument.populate([
        { path: 'workflowHistory.changedBy', select: 'firstName lastName email' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ]);

      return res.json({
        success: true,
        message: 'Document returned to initiator successfully. They can correct and resend to Pre Audit.',
        data: {
          _id: workflowDocument._id,
          isWorkflowDocument: true,
          workflowStatus: workflowDocument[workflowConfig.workflowStatusField]
        }
      });
    }

    // Handle regular Pre Audit documents
    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    if (document.observations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot return document without observations'
      });
    }

    document.status = 'returned_with_observations';
    document.returnedToDepartment = true;
    document.returnedAt = new Date();
    document.returnComments = returnComments;
    document.returnedBy = req.user.id;
    document.updatedBy = req.user.id;

    await document.save();
    await document.populate([
      { path: 'returnedBy', select: 'firstName lastName email' },
      { path: 'sourceDepartment', select: 'name' }
    ]);

    res.json({
      success: true,
      message: 'Document returned to department successfully',
      data: document
    });
  })
);

// @route   PUT /api/pre-audit/:id/reject
// @desc    Reject document with observations (works for both Pre Audit and workflow documents)
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id/reject',
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { rejectionComments, observations } = req.body;

    if (!rejectionComments) {
      return res.status(400).json({
        success: false,
        message: 'Rejection comments are required'
      });
    }

    // Check if it's a workflow document
    let isWorkflowDocument = false;
    let workflowDocument = null;
    let workflowConfig = null;
    
    const workflowModules = getWorkflowModules();
    for (const submodule of workflowModules) {
      const config = getModuleConfig(submodule);
      if (!config) continue;
      
      try {
        const Model = require(config.modelPath);
        const doc = await Model.findById(req.params.id);
        if (doc && doc[config.workflowStatusField] === 'Send to Audit') {
          isWorkflowDocument = true;
          workflowDocument = doc;
          workflowConfig = config;
          break;
        }
      } catch (error) {
        // Continue to next module
      }
    }

    if (isWorkflowDocument) {
      // For workflow documents, reject and return to Draft
      workflowDocument[workflowConfig.workflowStatusField] = 'Rejected (from Send to Audit)';
      workflowDocument.workflowHistory = workflowDocument.workflowHistory || [];
      
      // Add observations to workflow history
      if (observations && Array.isArray(observations)) {
        observations.forEach(obs => {
          workflowDocument.workflowHistory.push({
            fromStatus: 'Send to Audit',
            toStatus: 'Rejected (from Send to Audit)',
            changedBy: req.user.id,
            changedAt: new Date(),
            comments: `Observation (${obs.severity || 'medium'}): ${obs.observation || obs}`
          });
        });
      }
      
      // Add rejection comment
      workflowDocument.workflowHistory.push({
        fromStatus: 'Rejected (from Send to Audit)',
        toStatus: 'Draft',
        changedBy: req.user.id,
        changedAt: new Date(),
        comments: `Rejected with observations: ${rejectionComments}`
      });
      
      // Set status to "Returned from Audit" so initiator can see it in Admin Dashboard
      workflowDocument[workflowConfig.workflowStatusField] = 'Returned from Audit';
      
      workflowDocument.updatedBy = req.user.id;
      await workflowDocument.save();
      
      await workflowDocument.populate([
        { path: 'workflowHistory.changedBy', select: 'firstName lastName email' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ]);

      return res.json({
        success: true,
        message: 'Document rejected and returned to initiator. They can correct and resend to Pre Audit.',
        data: {
          _id: workflowDocument._id,
          isWorkflowDocument: true,
          workflowStatus: workflowDocument[workflowConfig.workflowStatusField]
        }
      });
    }

    // Handle regular Pre Audit documents
    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    // Add observations if provided
    if (observations && Array.isArray(observations)) {
      observations.forEach(obs => {
        document.observations.push({
          observation: obs.observation || obs,
          severity: obs.severity || 'medium',
          addedBy: req.user.id,
          addedAt: new Date()
        });
      });
    }

    document.status = 'rejected';
    document.rejectedBy = req.user.id;
    document.rejectedAt = new Date();
    document.rejectionComments = rejectionComments;
    document.returnedToDepartment = true;
    document.updatedBy = req.user.id;

    await document.save();
    await document.populate([
      { path: 'rejectedBy', select: 'firstName lastName email' },
      { path: 'sourceDepartment', select: 'name' }
    ]);

    res.json({
      success: true,
      message: 'Document rejected successfully',
      data: document
    });
  })
);

// @route   PUT /api/pre-audit/:id/respond
// @desc    Department response to returned document
// @access  Private (Department users)
router.put('/:id/respond',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { response } = req.body;
    const files = req.files || [];

    if (!response) {
      return res.status(400).json({
        success: false,
        message: 'Response is required'
      });
    }

    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    // Check if user belongs to the source department
    if (String(document.sourceDepartment) !== String(req.user.department)) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to documents from your department'
      });
    }

    if (document.status !== 'returned_with_observations') {
      return res.status(400).json({
        success: false,
        message: 'Document is not in returned status'
      });
    }

    // Handle response attachments
    const responseAttachments = [];
    if (files.length > 0) {
      files.forEach(file => {
        responseAttachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          uploadedAt: new Date()
        });
      });
    }

    document.departmentResponse = {
      response,
      respondedBy: req.user.id,
      respondedAt: new Date(),
      attachments: responseAttachments
    };

    // Mark observations as resolved if all are addressed
    document.observations.forEach(obs => {
      if (!obs.resolved) {
        obs.resolved = true;
        obs.resolvedAt = new Date();
        obs.resolvedBy = req.user.id;
      }
    });

    document.status = 'under_review';
    document.updatedBy = req.user.id;

    await document.save();
    await document.populate([
      { path: 'departmentResponse.respondedBy', select: 'firstName lastName email' },
      { path: 'sourceDepartment', select: 'name' }
    ]);

    res.json({
      success: true,
      message: 'Response submitted successfully',
      data: document
    });
  })
);

// @route   PUT /api/pre-audit/:id
// @desc    Update a pre-audit document
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id',
  authMiddleware,
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    const allowedUpdates = ['title', 'description', 'priority', 'reviewDueDate', 'tags'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        document[field] = req.body[field];
      }
    });

    document.updatedBy = req.user.id;
    await document.save();
    await document.populate([
      { path: 'sourceDepartment', select: 'name' },
      { path: 'updatedBy', select: 'firstName lastName email' }
    ]);

    res.json({
      success: true,
      message: 'Document updated successfully',
      data: document
    });
  })
);

// @route   DELETE /api/pre-audit/:id
// @desc    Soft delete a pre-audit document
// @access  Private (Super Admin, Audit Manager)
router.delete('/:id',
  authMiddleware,
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const document = await PreAudit.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Pre-audit document not found'
      });
    }

    document.isActive = false;
    document.updatedBy = req.user.id;
    await document.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  })
);

module.exports = router;

