const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const AuditFinding = require('../models/audit/AuditFinding');
const Audit = require('../models/audit/Audit');
const AuditTrail = require('../models/audit/AuditTrail');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'audit-findings');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'finding-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ================================
// AUDIT FINDINGS ROUTES
// ================================

// @route   GET /api/audit/findings
// @desc    Get all audit findings with filtering and pagination
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      audit,
      status,
      severity,
      category,
      assignedTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filters = { isActive: true };
    
    if (audit) filters.audit = audit;
    if (status) filters.status = status;
    if (severity) filters.severity = severity;
    if (category) filters.category = category;
    if (assignedTo) filters.assignedTo = assignedTo;

    // Search functionality
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { findingNumber: { $regex: search, $options: 'i' } },
        { process: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [findings, totalCount] = await Promise.all([
      AuditFinding.find(filters)
        .populate('audit', 'title auditNumber auditType')
        .populate('assignedTo', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      AuditFinding.countDocuments(filters)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        findings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/audit/findings/statistics
// @desc    Get audit findings statistics
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/findings/statistics', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { audit, auditType, module, department, startDate, endDate } = req.query;
    
    const filters = {};
    if (audit) filters.audit = audit;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const findingStats = await AuditFinding.getStatistics(filters);

    // Additional statistics by severity and status
    const severityStats = await AuditFinding.aggregate([
      { $match: { isActive: true, ...filters } },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusStats = await AuditFinding.aggregate([
      { $match: { isActive: true, ...filters } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...findingStats,
        severityBreakdown: severityStats,
        statusBreakdown: statusStats
      }
    });
  })
);

// @route   GET /api/audit/findings/:id
// @desc    Get single audit finding by ID
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/:id', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const finding = await AuditFinding.findById(req.params.id)
      .populate('audit', 'title auditNumber auditType department')
      .populate('assignedTo', 'firstName lastName email role department')
      .populate('assignedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('correctiveAction');

    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Audit finding not found'
      });
    }

    res.json({
      success: true,
      data: finding
    });
  })
);

// @route   POST /api/audit/findings
// @desc    Create new audit finding
// @access  Private (Super Admin, Audit Manager, Auditor)
router.post('/', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  upload.array('attachments', 10),
  [
    body('title').trim().notEmpty().withMessage('Finding title is required'),
    body('description').trim().notEmpty().withMessage('Finding description is required'),
    body('audit').isMongoId().withMessage('Valid audit is required'),
    body('category').isIn(['compliance', 'process', 'financial', 'operational', 'security', 'documentation', 'other']).withMessage('Valid category is required'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid severity is required'),
    body('process').trim().notEmpty().withMessage('Process is required'),
    body('evidence').trim().notEmpty().withMessage('Evidence is required'),
    body('criteria').trim().notEmpty().withMessage('Criteria is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Verify audit exists
    const audit = await Audit.findById(req.body.audit);
    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    // Handle file uploads
    const attachments = [];
    if (req.files) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          uploadedBy: req.user._id
        });
      });
    }

    const findingData = {
      ...req.body,
      attachments,
      createdBy: req.user._id
    };

    const finding = new AuditFinding(findingData);
    await finding.save();

    // Populate the saved finding
    await finding.populate([
      { path: 'audit', select: 'title auditNumber auditType' },
      { path: 'assignedTo', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    // Log the finding creation
    await AuditTrail.logAction({
      action: 'create',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'AuditFinding',
      entityId: finding._id,
      entityName: finding.title,
      description: `Created audit finding: ${finding.title}`,
      details: {
        audit: finding.audit._id,
        severity: finding.severity,
        category: finding.category
      },
      auditContext: {
        auditId: finding.audit._id,
        findingId: finding._id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.status(201).json({
      success: true,
      message: 'Audit finding created successfully',
      data: finding
    });
  })
);

// @route   PUT /api/audit/findings/:id
// @desc    Update audit finding
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  upload.array('attachments', 10),
  [
    body('title').optional().trim().notEmpty().withMessage('Finding title cannot be empty'),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid severity is required'),
    body('category').optional().isIn(['compliance', 'process', 'financial', 'operational', 'security', 'documentation', 'other']).withMessage('Valid category is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const finding = await AuditFinding.findById(req.params.id);
    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Audit finding not found'
      });
    }

    // Store old values for audit trail
    const oldValues = finding.toObject();

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        finding.attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          uploadedBy: req.user._id
        });
      });
    }

    // Update finding fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== 'attachments') {
        finding[key] = req.body[key];
      }
    });

    finding.updatedBy = req.user._id;
    await finding.save();

    // Log the finding update
    await AuditTrail.logAction({
      action: 'update',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'AuditFinding',
      entityId: finding._id,
      entityName: finding.title,
      description: `Updated audit finding: ${finding.title}`,
      oldValues,
      newValues: finding.toObject(),
      changedFields: Object.keys(req.body).filter(key => req.body[key] !== undefined),
      auditContext: {
        auditId: finding.audit,
        findingId: finding._id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Audit finding updated successfully',
      data: finding
    });
  })
);

// @route   PUT /api/audit/findings/:id/assign
// @desc    Assign finding to a user
// @access  Private (Super Admin, Audit Manager)
router.put('/findings/:id/assign', 
  authorize('super_admin', 'audit_manager'),
  [
    body('assignedTo').isMongoId().withMessage('Valid assigned user is required'),
    body('targetResolutionDate').optional().isISO8601().withMessage('Valid target resolution date is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const finding = await AuditFinding.findById(req.params.id);
    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Audit finding not found'
      });
    }

    const oldAssignedTo = finding.assignedTo;
    finding.assignedTo = req.body.assignedTo;
    finding.assignedBy = req.user._id;
    finding.assignedAt = new Date();
    
    if (req.body.targetResolutionDate) {
      finding.targetResolutionDate = new Date(req.body.targetResolutionDate);
    }

    await finding.save();

    // Log the assignment
    await AuditTrail.logAction({
      action: 'update',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'AuditFinding',
      entityId: finding._id,
      entityName: finding.title,
      description: `Assigned finding to user`,
      details: {
        oldAssignedTo,
        newAssignedTo: finding.assignedTo,
        targetResolutionDate: finding.targetResolutionDate
      },
      auditContext: {
        auditId: finding.audit,
        findingId: finding._id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Finding assigned successfully',
      data: finding
    });
  })
);

// @route   PUT /api/audit/findings/:id/status
// @desc    Update finding status
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/findings/:id/status', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  [
    body('status').isIn(['open', 'under_investigation', 'pending_review', 'approved', 'closed', 'rejected']).withMessage('Valid status is required'),
    body('comments').optional().isString().withMessage('Comments must be a string')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const finding = await AuditFinding.findById(req.params.id);
    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Audit finding not found'
      });
    }

    const oldStatus = finding.status;
    finding.status = req.body.status;
    finding.updatedBy = req.user._id;

    // Set resolution date if closing
    if (req.body.status === 'closed' && !finding.actualResolutionDate) {
      finding.actualResolutionDate = new Date();
    }

    await finding.save();

    // Log the status change
    await AuditTrail.logAction({
      action: 'update',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'AuditFinding',
      entityId: finding._id,
      entityName: finding.title,
      description: `Changed finding status from ${oldStatus} to ${req.body.status}`,
      details: {
        oldStatus,
        newStatus: req.body.status,
        comments: req.body.comments
      },
      auditContext: {
        auditId: finding.audit,
        findingId: finding._id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Finding status updated successfully',
      data: finding
    });
  })
);

// @route   DELETE /api/audit/findings/:id
// @desc    Delete audit finding (soft delete)
// @access  Private (Super Admin, Audit Manager)
router.delete('/:id', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const finding = await AuditFinding.findById(req.params.id);
    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Audit finding not found'
      });
    }

    // Soft delete
    finding.isActive = false;
    finding.updatedBy = req.user._id;
    await finding.save();

    // Log the deletion
    await AuditTrail.logAction({
      action: 'delete',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'AuditFinding',
      entityId: finding._id,
      entityName: finding.title,
      description: `Deleted audit finding: ${finding.title}`,
      auditContext: {
        auditId: finding.audit,
        findingId: finding._id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Audit finding deleted successfully'
    });
  })
);

module.exports = router;
