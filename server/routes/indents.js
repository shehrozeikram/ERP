const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const Indent = require('../models/general/Indent');
const Department = require('../models/hr/Department');
const User = require('../models/User');

const router = express.Router();

// ==================== INDENT ROUTES ====================

// @route   GET /api/indents
// @desc    Get all indents with filters and pagination
// @access  Private
router.get('/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled', 'Cancelled']),
    query('category').optional().trim(),
    query('department').optional().isMongoId().withMessage('Invalid department ID'),
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
    const andConditions = [];
    // When used for Procurement Requisitions: exclude indents still pending store stock check
    if (req.query.forRequisition === 'true' || req.query.forRequisition === '1') {
      andConditions.push({
        $or: [
          { storeRoutingStatus: { $ne: 'pending_store_check' } },
          { storeRoutingStatus: null }
        ]
      });
    }
    if (req.query.search) {
      andConditions.push({
        $or: [
          { indentNumber: new RegExp(req.query.search, 'i') },
          { title: new RegExp(req.query.search, 'i') },
          { description: new RegExp(req.query.search, 'i') }
        ]
      });
    }
    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.department) {
      filter.department = req.query.department;
    }

    // Get indents
    const indents = await Indent.find(filter)
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email employeeId')
      .populate('approvedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Indent.countDocuments(filter);

    res.json({
      success: true,
      data: indents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// @route   GET /api/indents/next-number
// @desc    Get next available indent number
// @access  Private
router.get('/next-number',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indentNumber = await Indent.generateIndentNumber();
    res.json({
      success: true,
      data: { nextIndentNumber: indentNumber }
    });
  })
);

// @route   GET /api/indents/next-erp-ref
// @desc    Get next available ERP Ref number
// @access  Private
router.get('/next-erp-ref',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const erpRef = await Indent.generateERPRef();
    res.json({
      success: true,
      data: { nextERPRef: erpRef }
    });
  })
);

// @route   GET /api/indents/dashboard
// @desc    Get dashboard statistics for indents
// @access  Private
router.get('/dashboard',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Get all indents for statistics
    const allIndents = await Indent.find({ isActive: true });
    
    // Get user's department
    const user = await User.findById(userId).populate('department');
    const userDepartment = user?.department?._id || null;
    
    // Calculate statistics
    const stats = {
      total: allIndents.length,
      byStatus: {
        Draft: allIndents.filter(i => i.status === 'Draft').length,
        Submitted: allIndents.filter(i => i.status === 'Submitted').length,
        'Under Review': allIndents.filter(i => i.status === 'Under Review').length,
        Approved: allIndents.filter(i => i.status === 'Approved').length,
        Rejected: allIndents.filter(i => i.status === 'Rejected').length,
        'Partially Fulfilled': allIndents.filter(i => i.status === 'Partially Fulfilled').length,
        Fulfilled: allIndents.filter(i => i.status === 'Fulfilled').length,
        Cancelled: allIndents.filter(i => i.status === 'Cancelled').length
      },
      byPriority: {
        Low: allIndents.filter(i => i.priority === 'Low').length,
        Medium: allIndents.filter(i => i.priority === 'Medium').length,
        High: allIndents.filter(i => i.priority === 'High').length,
        Urgent: allIndents.filter(i => i.priority === 'Urgent').length
      },
      totalEstimatedCost: allIndents.reduce((sum, i) => sum + (i.totalEstimatedCost || 0), 0),
      myIndents: userDepartment ? allIndents.filter(i => 
        i.department?.toString() === userDepartment.toString() || 
        i.requestedBy?.toString() === userId.toString()
      ).length : allIndents.filter(i => i.requestedBy?.toString() === userId.toString()).length,
      pendingApproval: allIndents.filter(i => 
        i.status === 'Submitted' || i.status === 'Under Review'
      ).length
    };

    // Get recent indents
    const recentIndents = await Indent.find({ isActive: true })
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get my indents
    const myIndents = await Indent.find({
      isActive: true,
      $or: [
        { requestedBy: userId },
        ...(userDepartment ? [{ department: userDepartment }] : [])
      ]
    })
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats,
        recentIndents,
        myIndents
      }
    });
  })
);

// @route   GET /api/indents/:id
// @desc    Get single indent by ID
// @access  Private
router.get('/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id)
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email employeeId department')
      .populate('approvedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('comments.user', 'firstName lastName email');

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    res.json({
      success: true,
      data: indent
    });
  })
);

// @route   POST /api/indents
// @desc    Create new indent
// @access  Private
router.post('/',
  authMiddleware,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('department').isMongoId().withMessage('Valid department is required'),
    body('requiredDate').notEmpty().withMessage('Required date is required').isISO8601().withMessage('Required date must be a valid date'),
    body('justification').trim().notEmpty().withMessage('Justification is required'),
    body('priority').notEmpty().withMessage('Priority is required').isIn(['Low', 'Medium', 'High', 'Urgent']).withMessage('Invalid priority'),
    body('category').notEmpty().withMessage('Category is required').isIn(['Office Supplies', 'IT Equipment', 'Furniture', 'Maintenance', 'Raw Materials', 'Services', 'Other']).withMessage('Invalid category'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.itemName').trim().notEmpty().withMessage('Item name is required'),
    body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
    body('items.*.brand').trim().notEmpty().withMessage('Brand is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.unit').trim().notEmpty().withMessage('Unit is required'),
    body('items.*.purpose').trim().notEmpty().withMessage('Purpose is required'),
    body('items.*.estimatedCost').isFloat({ min: 0 }).withMessage('Estimated cost is required and must be 0 or greater')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const indentData = {
      ...req.body,
      requestedBy: req.user.id,
      createdBy: req.user.id,
      status: req.body.status || 'Draft'
    };
    
    // Don't allow manual indentNumber or erpRef override - they will be auto-generated by pre-save middleware
    delete indentData.indentNumber;
    delete indentData.erpRef;

    const indent = new Indent(indentData);
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');
    await indent.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Indent created successfully',
      data: indent
    });
  })
);

// @route   PUT /api/indents/:id
// @desc    Update indent
// @access  Private
router.put('/:id',
  authMiddleware,
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('items.*.itemName').optional().trim().notEmpty().withMessage('Item name cannot be empty'),
    body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('status').optional().isIn(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    // Check if user can edit (only draft or own indents)
    if (indent.status !== 'Draft' && indent.requestedBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit draft indents or your own indents'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'indentNumber' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
        indent[key] = req.body[key];
      }
    });

    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');
    await indent.populate('updatedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Indent updated successfully',
      data: indent
    });
  })
);

// @route   PUT /api/indents/:id/comparative-statement-approvals
// @desc    Save comparative statement approval authorities (names/designations) for an indent
// @access  Private
router.put('/:id/comparative-statement-approvals',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    const { preparedBy, verifiedBy, authorisedRep, financeRep, managerProcurement, notes } = req.body;

    if (!indent.comparativeStatementApprovals) {
      indent.comparativeStatementApprovals = {};
    }
    if (preparedBy !== undefined) indent.comparativeStatementApprovals.preparedBy = preparedBy || '';
    if (verifiedBy !== undefined) indent.comparativeStatementApprovals.verifiedBy = verifiedBy || '';
    if (authorisedRep !== undefined) indent.comparativeStatementApprovals.authorisedRep = authorisedRep || '';
    if (financeRep !== undefined) indent.comparativeStatementApprovals.financeRep = financeRep || '';
    if (managerProcurement !== undefined) indent.comparativeStatementApprovals.managerProcurement = managerProcurement || '';
    if (notes !== undefined) indent.notes = notes == null ? '' : String(notes).trim();

    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');
    await indent.populate('updatedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Comparative statement approvals saved successfully',
      data: indent
    });
  })
);

// @route   DELETE /api/indents/:id
// @desc    Delete indent (soft delete)
// @access  Private
router.delete('/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    // Only allow deletion of draft indents or by admin
    if (indent.status !== 'Draft' && !['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only draft indents can be deleted'
      });
    }

    indent.isActive = false;
    indent.updatedBy = req.user.id;
    await indent.save({ validateBeforeSave: false }); // skip validation on soft-delete (old indents may lack new required fields)

    res.json({
      success: true,
      message: 'Indent deleted successfully'
    });
  })
);

// @route   POST /api/indents/:id/submit
// @desc    Submit indent for approval
// @access  Private
router.post('/:id/submit',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    if (indent.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft indents can be submitted'
      });
    }

    if (indent.requestedBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own indents'
      });
    }

    indent.status = 'Submitted';
    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Indent submitted successfully',
      data: indent
    });
  })
);

// @route   POST /api/indents/:id/approve
// @desc    Approve indent
// @access  Private (Admin/Manager)
router.post('/:id/approve',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    if (!['Submitted', 'Under Review'].includes(indent.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review indents can be approved'
      });
    }

    indent.status = 'Approved';
    indent.approvedBy = req.user.id;
    indent.approvedDate = new Date();
    indent.updatedBy = req.user.id;
    indent.storeRoutingStatus = 'pending_store_check'; // Goes to Store first for stock check
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');
    await indent.populate('approvedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Indent approved successfully',
      data: indent
    });
  })
);

// @route   POST /api/indents/:id/move-to-procurement
// @desc    Store user moves approved indent to Procurement Requisitions (items not in stock). Reason required.
// @access  Private (Store/Procurement/Admin)
router.post('/:id/move-to-procurement',
  authMiddleware,
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('reason').trim().notEmpty().withMessage('Reason for moving to procurement is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    if (indent.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved indents can be moved to procurement'
      });
    }

    if (indent.storeRoutingStatus === 'moved_to_procurement') {
      return res.status(400).json({
        success: false,
        message: 'Indent already moved to Procurement Requisitions'
      });
    }

    indent.storeRoutingStatus = 'moved_to_procurement';
    indent.movedToProcurementBy = req.user.id;
    indent.movedToProcurementAt = new Date();
    indent.movedToProcurementReason = (req.body.reason || '').trim();
    indent.updatedBy = req.user.id;
    await indent.save({ validateBeforeSave: false });

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');
    await indent.populate('approvedBy', 'firstName lastName email');
    await indent.populate('movedToProcurementBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Indent moved to Procurement Requisitions successfully',
      data: indent
    });
  })
);

// @route   POST /api/indents/:id/reject
// @desc    Reject indent
// @access  Private (Admin/Manager)
router.post('/:id/reject',
  authMiddleware,
  [
    body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    if (!['Submitted', 'Under Review'].includes(indent.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review indents can be rejected'
      });
    }

    indent.status = 'Rejected';
    indent.rejectionReason = req.body.rejectionReason;
    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Indent rejected successfully',
      data: indent
    });
  })
);

// @route   POST /api/indents/:id/comment
// @desc    Add comment to indent
// @access  Private
router.post('/:id/comment',
  authMiddleware,
  [
    body('comment').trim().notEmpty().withMessage('Comment is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    indent.comments.push({
      user: req.user.id,
      comment: req.body.comment
    });

    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('comments.user', 'firstName lastName email');
    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: indent
    });
  })
);

module.exports = router;

