const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Audit = require('../models/audit/Audit');
const AuditFinding = require('../models/audit/AuditFinding');
const CorrectiveAction = require('../models/audit/CorrectiveAction');
const AuditTrail = require('../models/audit/AuditTrail');
const AuditChecklist = require('../models/audit/AuditChecklist');
const AuditSchedule = require('../models/audit/AuditSchedule');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'audit');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audit-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common document and image formats
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, Word, and Excel files are allowed.'), false);
    }
  }
});

// ================================
// AUDIT ROUTES
// ================================

// @route   GET /api/audit
// @desc    Get all audits with filtering and pagination
// @access  Private (Super Admin, Audit Manager, Auditor, Audit Director)
router.get('/', 
  authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      auditType,
      module,
      department,
      leadAuditor,
      riskLevel,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filters = { isActive: true };
    
    if (status) filters.status = status;
    if (auditType) filters.auditType = auditType;
    if (module) filters.module = module;
    if (department) filters.department = department;
    if (leadAuditor) filters.leadAuditor = leadAuditor;
    if (riskLevel) filters.riskLevel = riskLevel;
    
    if (startDate || endDate) {
      filters.plannedStartDate = {};
      if (startDate) filters.plannedStartDate.$gte = new Date(startDate);
      if (endDate) filters.plannedStartDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { auditNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [audits, totalCount] = await Promise.all([
      Audit.find(filters)
        .populate('department', 'name')
        .populate('leadAuditor', 'firstName lastName email')
        .populate('auditTeam.user', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Audit.countDocuments(filters)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        audits,
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

// @route   GET /api/audit/statistics
// @desc    Get audit statistics
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/statistics', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { auditType, module, department, startDate, endDate } = req.query;
    
    const filters = {};
    if (auditType) filters.auditType = auditType;
    if (module) filters.module = module;
    if (department) filters.department = department;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const [auditStats, findingStats, carStats] = await Promise.all([
      Audit.getStatistics(filters),
      AuditFinding.getStatistics(filters),
      CorrectiveAction.getStatistics(filters)
    ]);

    res.json({
      success: true,
      data: {
        audits: auditStats,
        findings: findingStats,
        correctiveActions: carStats
      }
    });
  })
);

// @route   GET /api/audit/:id
// @desc    Get single audit by ID
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/:id', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const audit = await Audit.findById(req.params.id)
      .populate('department', 'name')
      .populate('leadAuditor', 'firstName lastName email role department')
      .populate('auditTeam.user', 'firstName lastName email role department')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email');

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    // Get related findings
    const findings = await AuditFinding.find({ audit: audit._id, isActive: true })
      .populate('assignedTo', 'firstName lastName email')
      .populate('correctiveAction')
      .sort({ createdAt: -1 });

    // Get related corrective actions
    const correctiveActions = await CorrectiveAction.find({ audit: audit._id, isActive: true })
      .populate('responsiblePerson', 'firstName lastName email')
      .populate('finding')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        audit,
        findings,
        correctiveActions
      }
    });
  })
);

// @route   POST /api/audit
// @desc    Create new audit
// @access  Private (Super Admin, Audit Manager, Audit Director)
router.post('/', 
  authorize('super_admin', 'audit_manager', 'audit_director'),
  upload.array('attachments', 10),
  [
    body('title').trim().notEmpty().withMessage('Audit title is required'),
    body('auditType').isIn(['internal', 'departmental', 'compliance', 'financial', 'asset']).withMessage('Valid audit type is required'),
    body('module').isIn(['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'general']).withMessage('Valid module is required'),
    body('department').isMongoId().withMessage('Valid department is required'),
    body('leadAuditor').isMongoId().withMessage('Valid lead auditor is required'),
    body('plannedStartDate').isISO8601().withMessage('Valid planned start date is required'),
    body('plannedEndDate').isISO8601().withMessage('Valid planned end date is required'),
    body('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid risk level is required')
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

    const auditData = {
      ...req.body,
      attachments,
      createdBy: req.user._id
    };

    // Validate dates
    if (new Date(auditData.plannedStartDate) >= new Date(auditData.plannedEndDate)) {
      return res.status(400).json({
        success: false,
        message: 'Planned end date must be after planned start date'
      });
    }

    const audit = new Audit(auditData);
    await audit.save();

    // Populate the saved audit
    await audit.populate([
      { path: 'department', select: 'name' },
      { path: 'leadAuditor', select: 'firstName lastName email' },
      { path: 'auditTeam.user', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    // Log the audit creation
    await AuditTrail.logAction({
      action: 'create',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'Audit',
      entityId: audit._id,
      entityName: audit.title,
      description: `Created audit: ${audit.title}`,
      details: {
        auditType: audit.auditType,
        module: audit.module,
        department: audit.department._id,
        riskLevel: audit.riskLevel
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.status(201).json({
      success: true,
      message: 'Audit created successfully',
      data: audit
    });
  })
);

// @route   PUT /api/audit/:id
// @desc    Update audit
// @access  Private (Super Admin, Audit Manager)
router.put('/:id', 
  authorize('super_admin', 'audit_manager'),
  upload.array('attachments', 10),
  [
    body('title').optional().trim().notEmpty().withMessage('Audit title cannot be empty'),
    body('auditType').optional().isIn(['internal', 'departmental', 'compliance', 'financial', 'asset']).withMessage('Valid audit type is required'),
    body('module').optional().isIn(['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'general']).withMessage('Valid module is required'),
    body('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid risk level is required')
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

    const audit = await Audit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    // Store old values for audit trail
    const oldValues = audit.toObject();

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        audit.attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          uploadedBy: req.user._id
        });
      });
    }

    // Update audit fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== 'attachments') {
        audit[key] = req.body[key];
      }
    });

    audit.updatedBy = req.user._id;
    await audit.save();

    const changedFieldEntries = Object.keys(req.body)
      .filter(key => req.body[key] !== undefined && key !== 'attachments')
      .map(key => ({
        field: key,
        oldValue: oldValues[key],
        newValue: audit[key]
      }));

    // Log the audit update
    await AuditTrail.logAction({
      action: 'update',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'Audit',
      entityId: audit._id,
      entityName: audit.title,
      description: `Updated audit: ${audit.title}`,
      oldValues,
      newValues: audit.toObject(),
      changedFields: changedFieldEntries,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Audit updated successfully',
      data: audit
    });
  })
);

// @route   DELETE /api/audit/:id
// @desc    Delete audit (soft delete)
// @access  Private (Super Admin, Audit Manager)
router.delete('/:id', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const audit = await Audit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    // Soft delete
    audit.isActive = false;
    audit.updatedBy = req.user._id;
    await audit.save();

    // Log the audit deletion
    await AuditTrail.logAction({
      action: 'delete',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'Audit',
      entityId: audit._id,
      entityName: audit.title,
      description: `Deleted audit: ${audit.title}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Audit deleted successfully'
    });
  })
);

// @route   PUT /api/audit/:id/status
// @desc    Update audit status
// @access  Private (Super Admin, Audit Manager, Auditor, Audit Director)
router.put('/:id/status', 
  authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'),
  [
    body('status').isIn(['planned', 'in_progress', 'under_review', 'completed', 'cancelled']).withMessage('Valid status is required'),
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

    const audit = await Audit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    const oldStatus = audit.status;
    audit.status = req.body.status;
    audit.updatedBy = req.user._id;

    // Set actual dates based on status
    if (req.body.status === 'in_progress' && !audit.actualStartDate) {
      audit.actualStartDate = new Date();
    }
    if (req.body.status === 'completed' && !audit.actualEndDate) {
      audit.actualEndDate = new Date();
    }

    await audit.save();

    // Log the status change
    await AuditTrail.logAction({
      action: 'update',
      module: 'audit',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      userDepartment: req.user.department,
      entityType: 'Audit',
      entityId: audit._id,
      entityName: audit.title,
      description: `Changed audit status from ${oldStatus} to ${req.body.status}`,
      details: {
        oldStatus,
        newStatus: req.body.status,
        comments: req.body.comments
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl
    });

    res.json({
      success: true,
      message: 'Audit status updated successfully',
      data: audit
    });
  })
);

module.exports = router;
