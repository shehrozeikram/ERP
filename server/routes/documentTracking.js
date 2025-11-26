const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const DocumentMaster = require('../models/hr/DocumentMaster');
const DocumentMovement = require('../models/hr/DocumentMovement');
const Department = require('../models/hr/Department');
const User = require('../models/User');
const { generateQRCode, generateQRCodeBuffer } = require('../utils/qrCodeHelper');
const path = require('path');

const router = express.Router();

// ==================== DOCUMENT MASTER ROUTES ====================

// @route   GET /api/document-tracking
// @desc    Get all documents with filters and pagination
// @access  Private
router.get('/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing']),
    query('category').optional().trim(),
    query('search').optional().trim()
  ],
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isActive: true };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.category) {
      filter.category = new RegExp(req.query.category, 'i');
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    if (req.query.department) {
      filter['currentHolder.department'] = req.query.department;
    }

    if (req.query.owner) {
      filter.owner = req.query.owner;
    }

    if (req.query.currentHolder) {
      filter['currentHolder.user'] = req.query.currentHolder;
    }

    // Get documents
    const documents = await DocumentMaster.find(filter)
      .populate('owner', 'firstName lastName email')
      .populate('currentHolder.user', 'firstName lastName email')
      .populate('currentHolder.department', 'name code')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await DocumentMaster.countDocuments(filter);

    res.json({
      success: true,
      data: documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// @route   GET /api/document-tracking/:id
// @desc    Get single document by ID
// @access  Private
router.get('/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const document = await DocumentMaster.findById(req.params.id)
      .populate('owner', 'firstName lastName email employeeId')
      .populate('currentHolder.user', 'firstName lastName email employeeId')
      .populate('currentHolder.department', 'name code')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: document
    });
  })
);

// @route   POST /api/document-tracking
// @desc    Create new document
// @access  Private
router.post('/',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('Document name is required').trim(),
    body('category').notEmpty().withMessage('Category is required').trim(),
    body('type').notEmpty().withMessage('Document type is required').trim(),
    body('owner').isMongoId().withMessage('Valid owner ID is required'),
    body('status').optional().isIn(['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing']),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Check if owner exists
    const owner = await User.findById(req.body.owner);
    if (!owner) {
      return res.status(400).json({
        success: false,
        message: 'Owner not found'
      });
    }

    // Create document
    const document = new DocumentMaster({
      name: req.body.name,
      category: req.body.category,
      type: req.body.type,
      owner: req.body.owner,
      status: req.body.status || 'Registered',
      priority: req.body.priority || 'Medium',
      physicalLocation: req.body.physicalLocation || {},
      description: req.body.description,
      tags: req.body.tags || [],
      dueDate: req.body.dueDate,
      currentHolder: {
        user: req.body.owner,
        department: owner.department ? new mongoose.Types.ObjectId(owner.department) : null,
        receivedAt: new Date()
      },
      createdBy: req.user.id
    });

    await document.save();

    // Generate QR code
    try {
      const qrData = await generateQRCode(document.trackingId, document._id.toString());
      document.qrCode = qrData.qrCode;
      document.qrCodeImage = qrData.qrCodeImage;
      await document.save();
    } catch (qrError) {
      console.error('Error generating QR code:', qrError);
      // Continue even if QR code generation fails
    }

    // Create initial movement record
    const initialMovement = new DocumentMovement({
      document: document._id,
      toDepartment: owner.department ? mongoose.Types.ObjectId(owner.department) : null,
      toUser: req.body.owner,
      reason: 'Document registered',
      statusBefore: 'Registered',
      statusAfter: document.status,
      movementType: 'Status Change',
      createdBy: req.user.id
    });

    await initialMovement.save();

    // Populate and return
    await document.populate([
      { path: 'owner', select: 'firstName lastName email' },
      { path: 'currentHolder.user', select: 'firstName lastName email' },
      { path: 'currentHolder.department', select: 'name code' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Document created successfully',
      data: document
    });
  })
);

// @route   PUT /api/document-tracking/:id
// @desc    Update document
// @access  Private
router.put('/:id',
  authMiddleware,
  [
    body('name').optional().notEmpty().withMessage('Document name cannot be empty').trim(),
    body('category').optional().notEmpty().withMessage('Category cannot be empty').trim(),
    body('type').optional().notEmpty().withMessage('Document type cannot be empty').trim(),
    body('status').optional().isIn(['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing']),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Track status change
    const statusChanged = req.body.status && req.body.status !== document.status;

    // Update fields
    if (req.body.name) document.name = req.body.name;
    if (req.body.category) document.category = req.body.category;
    if (req.body.type) document.type = req.body.type;
    if (req.body.status) document.status = req.body.status;
    if (req.body.priority) document.priority = req.body.priority;
    if (req.body.description !== undefined) document.description = req.body.description;
    if (req.body.tags) document.tags = req.body.tags;
    if (req.body.physicalLocation) document.physicalLocation = { ...document.physicalLocation, ...req.body.physicalLocation };
    if (req.body.dueDate !== undefined) document.dueDate = req.body.dueDate;
    if (req.body.owner) {
      document.owner = req.body.owner;
      // Update current holder if owner changes
      const owner = await User.findById(req.body.owner);
      if (owner) {
        document.currentHolder = {
          user: req.body.owner,
          department: owner.department ? new mongoose.Types.ObjectId(owner.department) : null,
          receivedAt: new Date()
        };
      }
    }

    document.updatedBy = req.user.id;

    await document.save();

    // Create movement record if status changed
    if (statusChanged) {
      const movement = new DocumentMovement({
        document: document._id,
        fromDepartment: document.currentHolder.department,
        toDepartment: document.currentHolder.department,
        fromUser: document.currentHolder.user,
        toUser: document.currentHolder.user,
        reason: 'Status updated',
        statusBefore: document.status === req.body.status ? 'Registered' : document.status,
        statusAfter: req.body.status,
        movementType: 'Status Change',
        createdBy: req.user.id
      });
      await movement.save();
    }

    // Populate and return
    await document.populate([
      { path: 'owner', select: 'firstName lastName email' },
      { path: 'currentHolder.user', select: 'firstName lastName email' },
      { path: 'currentHolder.department', select: 'name code' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'updatedBy', select: 'firstName lastName email' }
    ]);

    res.json({
      success: true,
      message: 'Document updated successfully',
      data: document
    });
  })
);

// @route   DELETE /api/document-tracking/:id
// @desc    Soft delete document
// @access  Private (Admin, HR Manager)
router.delete('/:id',
  authMiddleware,
  authorize('super_admin', 'admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
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

// ==================== DOCUMENT MOVEMENT ROUTES ====================

// @route   GET /api/document-tracking/:id/timeline
// @desc    Get document movement timeline
// @access  Private
router.get('/:id/timeline',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const movements = await DocumentMovement.getDocumentHistory(req.params.id);

    res.json({
      success: true,
      data: {
        document,
        movements
      }
    });
  })
);

// @route   POST /api/document-tracking/:id/move
// @desc    Move document to another user/department
// @access  Private
router.post('/:id/move',
  authMiddleware,
  [
    body('toUser').isMongoId().withMessage('Valid to user ID is required'),
    body('toDepartment').optional().isMongoId().withMessage('Valid to department ID is required'),
    body('reason').notEmpty().withMessage('Reason is required').trim(),
    body('comments').optional().trim(),
    body('statusAfter').optional().isIn(['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if toUser exists
    const toUser = await User.findById(req.body.toUser);
    if (!toUser) {
      return res.status(400).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Get toDepartment from user if not provided
    let toDepartment = req.body.toDepartment;
    if (!toDepartment && toUser.department) {
      toDepartment = toUser.department;
    }

    // Check if toDepartment exists
    if (toDepartment) {
      const department = await Department.findById(toDepartment);
      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Target department not found'
        });
      }
    }

    const statusBefore = document.status;
    const statusAfter = req.body.statusAfter || document.status;

    // Create movement record
    const movement = new DocumentMovement({
      document: document._id,
      fromDepartment: document.currentHolder.department,
      toDepartment: toDepartment ? new mongoose.Types.ObjectId(toDepartment) : null,
      fromUser: document.currentHolder.user,
      toUser: req.body.toUser,
      reason: req.body.reason,
      comments: req.body.comments,
      statusBefore,
      statusAfter,
      movementType: 'Transfer',
      createdBy: req.user.id
    });

    await movement.save();

    // Update document
    document.currentHolder = {
      user: req.body.toUser,
      department: toDepartment ? mongoose.Types.ObjectId(toDepartment) : null,
      receivedAt: new Date()
    };
    document.status = statusAfter;
    document.updatedBy = req.user.id;

    await document.save();

    // Populate and return
    await document.populate([
      { path: 'owner', select: 'firstName lastName email' },
      { path: 'currentHolder.user', select: 'firstName lastName email' },
      { path: 'currentHolder.department', select: 'name code' }
    ]);

    await movement.populate([
      { path: 'fromUser', select: 'firstName lastName email' },
      { path: 'toUser', select: 'firstName lastName email' },
      { path: 'fromDepartment', select: 'name code' },
      { path: 'toDepartment', select: 'name code' }
    ]);

    res.json({
      success: true,
      message: 'Document moved successfully',
      data: {
        document,
        movement
      }
    });
  })
);

// @route   POST /api/document-tracking/:id/receive
// @desc    Acknowledge receipt of document
// @access  Private
router.post('/:id/receive',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if user is the current holder
    if (document.currentHolder.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not the current holder of this document'
      });
    }

    // Find pending movement and acknowledge it
    const pendingMovement = await DocumentMovement.findOne({
      document: document._id,
      toUser: req.user.id,
      acknowledgedAt: { $exists: false },
      isActive: true
    }).sort({ timestamp: -1 });

    if (pendingMovement) {
      pendingMovement.acknowledgedAt = new Date();
      pendingMovement.acknowledgedBy = req.user.id;
      await pendingMovement.save();
    }

    res.json({
      success: true,
      message: 'Document receipt acknowledged',
      data: document
    });
  })
);

// @route   GET /api/document-tracking/movements/pending
// @desc    Get pending movements for current user
// @access  Private
router.get('/movements/pending',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const pendingMovements = await DocumentMovement.getPendingMovements(req.user.id);

    res.json({
      success: true,
      data: pendingMovements
    });
  })
);

// @route   GET /api/document-tracking/movements/my-movements
// @desc    Get all movements for current user
// @access  Private
router.get('/movements/my-movements',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const movements = await DocumentMovement.getMovementsByUser(req.user.id, limit);

    res.json({
      success: true,
      data: movements
    });
  })
);

// ==================== DASHBOARD ROUTES ====================

// @route   GET /api/document-tracking/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard/stats',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const stats = {
      total: await DocumentMaster.countDocuments({ isActive: true }),
      registered: await DocumentMaster.countDocuments({ status: 'Registered', isActive: true }),
      inReview: await DocumentMaster.countDocuments({ status: 'In Review', isActive: true }),
      inApproval: await DocumentMaster.countDocuments({ status: 'In Approval', isActive: true }),
      sent: await DocumentMaster.countDocuments({ status: 'Sent', isActive: true }),
      completed: await DocumentMaster.countDocuments({ status: 'Completed', isActive: true }),
      archived: await DocumentMaster.countDocuments({ status: 'Archived', isActive: true }),
      missing: await DocumentMaster.countDocuments({ status: 'Missing', isActive: true }),
      overdue: await DocumentMaster.findOverdue().countDocuments(),
      withMe: await DocumentMaster.countDocuments({ 'currentHolder.user': req.user.id, isActive: true })
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

// ==================== QR CODE ROUTES ====================

// @route   GET /api/document-tracking/:id/qr-code
// @desc    Get QR code image for document
// @access  Private
router.get('/:id/qr-code',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Generate QR code buffer
    const buffer = await generateQRCodeBuffer(document.trackingId);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${document.trackingId}.png"`);
    res.send(buffer);
  })
);

// @route   GET /api/document-tracking/:id/qr-code/download
// @desc    Download QR code image
// @access  Private
router.get('/:id/qr-code/download',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const document = await DocumentMaster.findById(req.params.id);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Generate QR code buffer
    const buffer = await generateQRCodeBuffer(document.trackingId);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr-${document.trackingId}.png"`);
    res.send(buffer);
  })
);

// ==================== EXPORT ROUTES ====================

// @route   GET /api/document-tracking/export/csv
// @desc    Export documents to CSV
// @access  Private
router.get('/export/csv',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = new RegExp(req.query.category, 'i');
    if (req.query.department) filter['currentHolder.department'] = req.query.department;

    const documents = await DocumentMaster.find(filter)
      .populate('owner', 'firstName lastName email')
      .populate('currentHolder.user', 'firstName lastName email')
      .populate('currentHolder.department', 'name code')
      .sort({ createdAt: -1 })
      .limit(10000); // Limit to prevent memory issues

    // Generate CSV
    const csvRows = [];
    csvRows.push([
      'Tracking ID',
      'Name',
      'Category',
      'Type',
      'Status',
      'Priority',
      'Owner',
      'Current Holder',
      'Department',
      'Due Date',
      'Created Date'
    ].join(','));

    documents.forEach(doc => {
      csvRows.push([
        `"${doc.trackingId || ''}"`,
        `"${doc.name || ''}"`,
        `"${doc.category || ''}"`,
        `"${doc.type || ''}"`,
        `"${doc.status || ''}"`,
        `"${doc.priority || ''}"`,
        `"${doc.owner?.firstName || ''} ${doc.owner?.lastName || ''}"`,
        `"${doc.currentHolder?.user?.firstName || ''} ${doc.currentHolder?.user?.lastName || ''}"`,
        `"${doc.currentHolder?.department?.name || ''}"`,
        `"${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString() : ''}"`,
        `"${doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}"`
      ].join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="documents-${Date.now()}.csv"`);
    res.send(csv);
  })
);

module.exports = router;

