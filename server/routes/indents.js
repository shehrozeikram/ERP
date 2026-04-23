const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const Indent = require('../models/general/Indent');
const Department = require('../models/hr/Department');
const User = require('../models/User');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const Quotation = require('../models/procurement/Quotation');
const { createAndEmitNotification } = require('../services/realtimeNotificationService');
const {
  canMutateComparativeAuthorityUsers,
  authorityUserRefsChanged
} = require('../utils/comparativeStatementAuthorityLock');

const router = express.Router();

const APPROVAL_SIGNATURE_KEYS = ['headOfDepartment', 'gmPd', 'svpAvp'];
const LEGACY_APPROVER_ROLES = ['super_admin', 'admin', 'hr_manager'];
const INDENT_TARGET_ROUTES = {
  storeDashboard: '/procurement/store',
  procurementRequisitions: '/procurement/requisitions'
};

const getActiveUserIdsByDepartment = async (departmentName) => {
  const users = await User.find({
    isActive: true,
    department: { $regex: `^${String(departmentName)}$`, $options: 'i' }
  }).select('_id');
  return users.map((u) => String(u._id));
};

const getActiveUserIdsByRoles = async (roles = []) => {
  const users = await User.find({
    isActive: true,
    role: { $in: roles }
  }).select('_id');
  return users.map((u) => String(u._id));
};

const getStoreWorkflowRecipients = async () => {
  const byStoreDept = await getActiveUserIdsByDepartment('store');
  const byProcurementDept = await getActiveUserIdsByDepartment('procurement');
  const byStoreRoles = await getActiveUserIdsByRoles(['procurement_manager', 'admin', 'super_admin']);
  return [...new Set([...byStoreDept, ...byProcurementDept, ...byStoreRoles])];
};

const getProcurementWorkflowRecipients = async () => {
  const byProcurementDept = await getActiveUserIdsByDepartment('procurement');
  const byProcurementRoles = await getActiveUserIdsByRoles(['procurement_manager', 'admin', 'super_admin']);
  return [...new Set([...byProcurementDept, ...byProcurementRoles])];
};

const notifyIndentTransition = async ({
  recipientIds = [],
  actorId,
  title,
  message,
  actionUrl,
  indentId
}) => {
  await createAndEmitNotification({
    recipientIds,
    title,
    message,
    priority: 'high',
    type: 'info',
    category: 'approval',
    actionUrl,
    createdBy: actorId,
    excludeUserId: actorId,
    metadata: {
      module: 'procurement',
      entityId: indentId,
      entityType: 'Indent'
    }
  });
};

const pushIndentWorkflowHistory = (indent, {
  fromStatus = '',
  toStatus = '',
  changedBy = null,
  comments = '',
  module = 'Indent'
} = {}) => {
  if (!indent) return;
  if (!Array.isArray(indent.workflowHistory)) indent.workflowHistory = [];
  indent.workflowHistory.push({
    fromStatus,
    toStatus,
    changedBy,
    changedAt: new Date(),
    comments,
    module
  });
};

function syncSignatureSlotFromApprover(indent, chainIndex, approverUser) {
  if (!indent.signatures) indent.signatures = {};
  const key = APPROVAL_SIGNATURE_KEYS[chainIndex];
  if (!key || !approverUser) return;
  const name = [approverUser.firstName, approverUser.lastName].filter(Boolean).join(' ').trim();
  indent.signatures[key] = {
    name: name || approverUser.email || '—',
    date: new Date()
  };
}

// ==================== INDENT ROUTES ====================

// @route   GET /api/indents
// @desc    Get all indents with filters and pagination
// @access  Private
router.get('/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Rejected in Procurement', 'Partially Fulfilled', 'Fulfilled', 'Cancelled']),
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
      .populate('requestedBy', 'firstName lastName email employeeId digitalSignature')
      .populate('approvedBy', 'firstName lastName email digitalSignature')
      .populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature')
      .populate('draftApproverIds', 'firstName lastName email employeeId digitalSignature')
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

// @route   GET /api/indents/check-indent-number
// @desc    Check whether an Indent Number is already taken by another indent
// @access  Private
// Query params: value (required), excludeId (optional – the current indent's _id when editing)
router.get('/check-indent-number',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const value = String(req.query.value || '').trim();
    if (!value) {
      return res.json({ success: true, exists: false });
    }

    const query = { indentNumber: value, isActive: { $ne: false } };
    if (req.query.excludeId) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(req.query.excludeId)) {
        query._id = { $ne: req.query.excludeId };
      }
    }

    const existing = await Indent.findOne(query).select('_id indentNumber').lean();
    res.json({
      success: true,
      exists: !!existing,
      usedBy: existing ? existing.indentNumber : null
    });
  })
);

// @route   GET /api/indents/check-erpref
// @desc    Check whether an ERP Ref is already taken by another indent
// @access  Private
// Query params: value (required), excludeId (optional – the current indent's _id when editing)
router.get('/check-erpref',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const value = String(req.query.value || '').trim();
    if (!value) {
      return res.json({ success: true, exists: false });
    }

    const query = { erpRef: value, isActive: { $ne: false } };
    if (req.query.excludeId) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(req.query.excludeId)) {
        query._id = { $ne: req.query.excludeId };
      }
    }

    const existing = await Indent.findOne(query).select('_id indentNumber').lean();
    res.json({
      success: true,
      exists: !!existing,
      usedBy: existing ? existing.indentNumber : null
    });
  })
);

// @route   GET /api/indents/departments
// @desc    Get active departments for indent form dropdown
// @access  Private
router.get('/departments',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const departments = await Department.find({ isActive: true })
      .select('name code')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: departments
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
      .populate('requestedBy', 'firstName lastName email digitalSignature')
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
      .populate('requestedBy', 'firstName lastName email digitalSignature')
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

// @route   GET /api/indents/approver-candidates
// @desc    Active users for indent approver pickers (any authenticated user)
// @access  Private
router.get('/approver-candidates',
  authMiddleware,
  [
    query('search').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const raw = String(req.query.search || '').trim();
    const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { isActive: true };
    if (raw) {
      const rx = new RegExp(escapeRx(raw), 'i');
      filter.$or = [
        { firstName: rx },
        { lastName: rx },
        { email: rx },
        { employeeId: rx }
      ];
    }
    const users = await User.find(filter)
      .select('firstName lastName email employeeId')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: users
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
      .populate('requestedBy', 'firstName lastName email employeeId department digitalSignature')
      .populate('approvedBy', 'firstName lastName email digitalSignature')
      .populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature')
      .populate('draftApproverIds', 'firstName lastName email employeeId digitalSignature')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('comments.user', 'firstName lastName email')
      .populate('procurementRejection.rejectedBy', 'firstName lastName email')
      .populate('comparativeStatementApprovals.preparedByUser', 'firstName lastName email employeeId digitalSignature')
      .populate('comparativeStatementApprovals.verifiedByUser', 'firstName lastName email employeeId digitalSignature')
      .populate('comparativeStatementApprovals.authorisedRepUser', 'firstName lastName email employeeId digitalSignature')
      .populate('comparativeStatementApprovals.financeRepUser', 'firstName lastName email employeeId digitalSignature')
      .populate('comparativeStatementApprovals.managerProcurementUser', 'firstName lastName email employeeId digitalSignature')
      .populate('comparativeApproval.approvers.approver', 'firstName lastName email employeeId digitalSignature')
      .populate('comparativeApproval.submittedBy', 'firstName lastName email')
      .populate('comparativeApproval.rejectedBy', 'firstName lastName email')
      .populate('workflowHistory.changedBy', 'firstName lastName email');

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    // Backfill initial history entry for records created before workflow tracking
    // or rare cases where first event wasn't written.
    if (!Array.isArray(indent.workflowHistory) || indent.workflowHistory.length === 0) {
      const createdById =
        indent.createdBy?._id || indent.createdBy || indent.requestedBy?._id || indent.requestedBy || null;
      pushIndentWorkflowHistory(indent, {
        fromStatus: '',
        toStatus: indent.status || 'Draft',
        changedBy: createdById,
        comments: 'Indent created',
        module: 'Indent'
      });
      await indent.save({ validateBeforeSave: false });
      await indent.populate('workflowHistory.changedBy', 'firstName lastName email');
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
    body('category').trim().notEmpty().withMessage('Category is required').isLength({ max: 200 }).withMessage('Category cannot exceed 200 characters'),
    body('categoryOtherDescription').optional().trim().isLength({ max: 500 }).withMessage('Category detail cannot exceed 500 characters'),
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

    delete indentData.approvalChain;
    if (Array.isArray(indentData.draftApproverIds)) {
      const uniq = [...new Set(indentData.draftApproverIds.map(String).filter(Boolean))];
      if (uniq.length > 3) {
        return res.status(400).json({
          success: false,
          message: 'At most three draft approvers are allowed.'
        });
      }
      indentData.draftApproverIds = uniq;
    } else {
      delete indentData.draftApproverIds;
    }
    
    // Allow manual indentNumber if provided; otherwise auto-generate in pre-save middleware
    if (indentData.indentNumber !== undefined) {
      indentData.indentNumber = String(indentData.indentNumber || '').trim();
      if (!indentData.indentNumber) delete indentData.indentNumber;
    }

    if (indentData.erpRef !== undefined) {
      indentData.erpRef = String(indentData.erpRef || '').trim();
      if (!indentData.erpRef) delete indentData.erpRef;
    }

    // Check Indent Number uniqueness before save
    if (indentData.indentNumber) {
      const indentNoExists = await Indent.findOne({ indentNumber: indentData.indentNumber, isActive: { $ne: false } }).select('indentNumber').lean();
      if (indentNoExists) {
        return res.status(409).json({
          success: false,
          message: `Indent No. "${indentData.indentNumber}" is already taken. Please choose a different Indent Number.`
        });
      }
    }

    // Check ERP Ref uniqueness before save to give a clear error message
    if (indentData.erpRef) {
      const erpRefExists = await Indent.findOne({ erpRef: indentData.erpRef, isActive: { $ne: false } }).select('indentNumber').lean();
      if (erpRefExists) {
        return res.status(409).json({
          success: false,
          message: `ERP Ref "${indentData.erpRef}" is already used by indent ${erpRefExists.indentNumber}. Please choose a different ERP Ref.`
        });
      }
    }

    const cat = String(indentData.category || '').trim();
    const otherDesc = String(indentData.categoryOtherDescription || '').trim();
    if (cat === 'Others') {
      if (!otherDesc) {
        return res.status(400).json({
          success: false,
          message: 'When category is Others, describe what is required.'
        });
      }
      indentData.categoryOtherDescription = otherDesc;
    } else {
      indentData.categoryOtherDescription = '';
    }

    const indent = new Indent(indentData);
    pushIndentWorkflowHistory(indent, {
      fromStatus: '',
      toStatus: indent.status || 'Draft',
      changedBy: req.user.id,
      comments: 'Indent created',
      module: 'Indent'
    });
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
    await indent.populate('createdBy', 'firstName lastName email');
    await indent.populate('workflowHistory.changedBy', 'firstName lastName email');

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
    body('status').optional().isIn(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Rejected in Procurement', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'])
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

    // Check Indent Number uniqueness before save (exclude the current indent)
    const incomingIndentNumber = req.body.indentNumber ? String(req.body.indentNumber).trim() : null;
    if (incomingIndentNumber && incomingIndentNumber !== indent.indentNumber) {
      const indentNoExists = await Indent.findOne({
        indentNumber: incomingIndentNumber,
        isActive: { $ne: false },
        _id: { $ne: indent._id }
      }).select('indentNumber').lean();
      if (indentNoExists) {
        return res.status(409).json({
          success: false,
          message: `Indent No. "${incomingIndentNumber}" is already taken. Please choose a different Indent Number.`
        });
      }
    }

    // Check ERP Ref uniqueness before save (exclude the current indent)
    const incomingErpRef = req.body.erpRef ? String(req.body.erpRef).trim() : null;
    if (incomingErpRef && incomingErpRef !== indent.erpRef) {
      const erpRefExists = await Indent.findOne({
        erpRef: incomingErpRef,
        isActive: { $ne: false },
        _id: { $ne: indent._id }
      }).select('indentNumber').lean();
      if (erpRefExists) {
        return res.status(409).json({
          success: false,
          message: `ERP Ref "${incomingErpRef}" is already used by indent ${erpRefExists.indentNumber}. Please choose a different ERP Ref.`
        });
      }
    }

    if (req.body.draftApproverIds !== undefined) {
      if (indent.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          message: 'Approvers can only be changed while the indent is in Draft.'
        });
      }
      const arr = Array.isArray(req.body.draftApproverIds) ? req.body.draftApproverIds : [];
      const uniq = [...new Set(arr.map(String).filter(Boolean))];
      if (uniq.length > 3) {
        return res.status(400).json({
          success: false,
          message: 'At most three draft approvers are allowed.'
        });
      }
      indent.draftApproverIds = uniq;
    }

    // Update fields (now also allowing indentNumber updates); never take approvalChain from client
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'approvalChain' && key !== 'draftApproverIds') {
        indent[key] = req.body[key];
      }
    });

    const cat = String(indent.category || '').trim();
    const otherDesc = String(indent.categoryOtherDescription || '').trim();
    if (cat === 'Others') {
      if (!otherDesc) {
        return res.status(400).json({
          success: false,
          message: 'When category is Others, describe what is required.'
        });
      }
      if (otherDesc.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Category detail cannot exceed 500 characters.'
        });
      }
      indent.categoryOtherDescription = otherDesc;
    } else {
      indent.categoryOtherDescription = '';
    }

    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
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

    if (authorityUserRefsChanged(indent, req.body) && !canMutateComparativeAuthorityUsers(req.user, indent)) {
      return res.status(403).json({
        success: false,
        message:
          'Only Prepared By, Procurement Manager (GM), or Super Admin can change comparative approval authority users after they have been set.'
      });
    }

    const {
      preparedBy,
      verifiedBy,
      authorisedRep,
      financeRep,
      managerProcurement,
      preparedByUser,
      verifiedByUser,
      authorisedRepUser,
      financeRepUser,
      managerProcurementUser,
      notes
    } = req.body;

    const userFields = {
      preparedByUser,
      verifiedByUser,
      authorisedRepUser,
      financeRepUser,
      managerProcurementUser
    };
    const validIds = Object.values(userFields).filter((v) => v && mongoose.Types.ObjectId.isValid(String(v)));
    if (validIds.length > 0) {
      const activeUsers = await User.find({ _id: { $in: validIds }, isActive: true }).select('_id firstName lastName email');
      const byId = new Map(activeUsers.map((u) => [String(u._id), u]));
      for (const [fieldKey, fieldVal] of Object.entries(userFields)) {
        if (!fieldVal) continue;
        const keyStr = String(fieldVal);
        if (!byId.has(keyStr)) {
          return res.status(400).json({
            success: false,
            message: `${fieldKey} must be an active user.`
          });
        }
      }
      // Autofill authority display names from selected users (keeps print-friendly names in sync)
      if (preparedByUser) {
        const u = byId.get(String(preparedByUser));
        if (u) indent.comparativeStatementApprovals.preparedBy = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || '';
      }
      if (verifiedByUser) {
        const u = byId.get(String(verifiedByUser));
        if (u) indent.comparativeStatementApprovals.verifiedBy = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || '';
      }
      if (authorisedRepUser) {
        const u = byId.get(String(authorisedRepUser));
        if (u) indent.comparativeStatementApprovals.authorisedRep = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || '';
      }
      if (financeRepUser) {
        const u = byId.get(String(financeRepUser));
        if (u) indent.comparativeStatementApprovals.financeRep = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || '';
      }
      if (managerProcurementUser) {
        const u = byId.get(String(managerProcurementUser));
        if (u) indent.comparativeStatementApprovals.managerProcurement = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || '';
      }
    }

    if (!indent.comparativeStatementApprovals) {
      indent.comparativeStatementApprovals = {};
    }
    if (preparedBy !== undefined) indent.comparativeStatementApprovals.preparedBy = preparedBy || '';
    if (verifiedBy !== undefined) indent.comparativeStatementApprovals.verifiedBy = verifiedBy || '';
    if (authorisedRep !== undefined) indent.comparativeStatementApprovals.authorisedRep = authorisedRep || '';
    if (financeRep !== undefined) indent.comparativeStatementApprovals.financeRep = financeRep || '';
    if (managerProcurement !== undefined) indent.comparativeStatementApprovals.managerProcurement = managerProcurement || '';
    if (preparedByUser !== undefined) indent.comparativeStatementApprovals.preparedByUser = preparedByUser || null;
    if (verifiedByUser !== undefined) indent.comparativeStatementApprovals.verifiedByUser = verifiedByUser || null;
    if (authorisedRepUser !== undefined) indent.comparativeStatementApprovals.authorisedRepUser = authorisedRepUser || null;
    if (financeRepUser !== undefined) indent.comparativeStatementApprovals.financeRepUser = financeRepUser || null;
    if (managerProcurementUser !== undefined) indent.comparativeStatementApprovals.managerProcurementUser = managerProcurementUser || null;
    if (notes !== undefined) indent.notes = notes == null ? '' : String(notes).trim();

    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
    await indent.populate('updatedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Comparative statement approvals saved successfully',
      data: indent
    });
  })
);

// @route   PUT /api/indents/:id/split-po-assignments
// @desc    Save per-item vendor assignments from Comparative Statement and set involved quotations to Shortlisted. Create actual POs from Quotations page.
// @access  Private
router.put('/:id/split-po-assignments',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    const { vendorAssignments } = req.body;
    if (!vendorAssignments || typeof vendorAssignments !== 'object' || Object.keys(vendorAssignments).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'vendorAssignments is required and must be a non-empty object (item index -> quotation id)'
      });
    }

    indent.splitPOAssignments = vendorAssignments;
    indent.updatedBy = req.user.id;
    await indent.save();

    const quotationIds = [...new Set(Object.values(vendorAssignments))];
    await Quotation.updateMany(
      { _id: { $in: quotationIds } },
      { $set: { status: 'Shortlisted' } }
    );

    res.json({
      success: true,
      message: 'Vendor assignments saved and quotations shortlisted. Create Split POs from the Quotations page.',
      data: { indent: indent.toObject ? indent.toObject() : indent }
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

    const fromBody = Array.isArray(req.body?.approverIds) ? req.body.approverIds.map(String).filter(Boolean) : [];
    const fromDraft = (indent.draftApproverIds || []).map((id) => id.toString());
    const merged = fromBody.length ? fromBody : fromDraft;
    const unique = [...new Set(merged)];

    if (unique.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Exactly one approver is required. Choose Head of Department approver.'
      });
    }

    const requesterId = indent.requestedBy.toString();
    if (unique.includes(requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot assign yourself as an approver.'
      });
    }

    const approverUsers = await User.find({
      _id: { $in: unique },
      isActive: true
    })
      .select('_id firstName lastName email')
      .lean();

    if (approverUsers.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Selected approver must be a valid active user.'
      });
    }

    const previousStatus = indent.status;
    indent.approvalChain = unique.map((id) => ({
      approver: id,
      status: 'pending'
    }));
    indent.draftApproverIds = [];
    indent.status = 'Submitted';
    pushIndentWorkflowHistory(indent, {
      fromStatus: previousStatus,
      toStatus: indent.status,
      changedBy: req.user.id,
      comments: 'Submitted for approval',
      module: 'Indent'
    });
    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
    await indent.populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature');

    const approver = approverUsers[0];
    await createAndEmitNotification({
      recipientIds: [approver._id],
      title: 'Indent submitted for your approval',
      message: `Indent ${indent.indentNumber || ''} has been submitted and is awaiting your approval.`,
      priority: 'high',
      type: 'info',
      category: 'approval',
      actionUrl: '/general/indents',
      createdBy: req.user.id,
      excludeUserId: req.user.id,
      metadata: {
        module: 'procurement',
        entityId: indent._id,
        entityType: 'Indent'
      }
    });

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

    const userId = req.user._id.toString();
    const chain = indent.approvalChain || [];

    if (chain.length > 0) {
      const stepIndex = chain.findIndex(
        (step) => step.approver.toString() === userId && step.status === 'pending'
      );
      if (stepIndex === -1) {
        return res.status(403).json({
          success: false,
          message: 'You are not a pending approver for this indent.'
        });
      }

      const actingUser = await User.findById(req.user._id).select('firstName lastName email').lean();
      const previousStatus = indent.status;
      indent.approvalChain[stepIndex].status = 'approved';
      indent.approvalChain[stepIndex].actedAt = new Date();
      syncSignatureSlotFromApprover(indent, stepIndex, actingUser);

      const allApproved = indent.approvalChain.every((s) => s.status === 'approved');
      if (allApproved) {
        indent.status = 'Approved';
        indent.approvedBy = req.user._id;
        indent.approvedDate = new Date();
        indent.storeRoutingStatus = 'pending_store_check';
      } else {
        indent.status = 'Under Review';
      }

      const approverName = [actingUser?.firstName, actingUser?.lastName].filter(Boolean).join(' ').trim() || actingUser?.email || 'Approver';
      pushIndentWorkflowHistory(indent, {
        fromStatus: previousStatus,
        toStatus: indent.status,
        changedBy: req.user.id,
        comments: allApproved
          ? `${approverName} approved indent. Sent to Store Dashboard for stock check.`
          : `${approverName} approved their step.`,
        module: 'Indent'
      });

      indent.updatedBy = req.user.id;
      await indent.save();

      await indent.populate('department', 'name code');
      await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
      await indent.populate('approvedBy', 'firstName lastName email digitalSignature');
      await indent.populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature');

      if (allApproved) {
        const storeRecipients = await getStoreWorkflowRecipients();
        await notifyIndentTransition({
          recipientIds: storeRecipients,
          actorId: req.user.id,
          title: 'Indent sent to Store Dashboard',
          message: `Indent ${indent.indentNumber || ''} is approved and now pending Store stock check.`,
          actionUrl: INDENT_TARGET_ROUTES.storeDashboard,
          indentId: indent._id
        });
      }

      return res.json({
        success: true,
        message: allApproved
          ? 'Indent approved successfully (all approvers completed)'
          : 'Your approval has been recorded.',
        data: indent
      });
    }

    if (!LEGACY_APPROVER_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this indent.'
      });
    }

    indent.status = 'Approved';
    indent.approvedBy = req.user.id;
    indent.approvedDate = new Date();
    indent.updatedBy = req.user.id;
    indent.storeRoutingStatus = 'pending_store_check'; // Goes to Store first for stock check
    pushIndentWorkflowHistory(indent, {
      fromStatus: 'Submitted',
      toStatus: indent.status,
      changedBy: req.user.id,
      comments: 'Approved and sent to Store Dashboard for stock check.',
      module: 'Indent'
    });
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
    await indent.populate('approvedBy', 'firstName lastName email digitalSignature');

    const storeRecipients = await getStoreWorkflowRecipients();
    await notifyIndentTransition({
      recipientIds: storeRecipients,
      actorId: req.user.id,
      title: 'Indent sent to Store Dashboard',
      message: `Indent ${indent.indentNumber || ''} is approved and now pending Store stock check.`,
      actionUrl: INDENT_TARGET_ROUTES.storeDashboard,
      indentId: indent._id
    });

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

    const previousStatus = indent.status;
    indent.storeRoutingStatus = 'moved_to_procurement';
    indent.movedToProcurementBy = req.user.id;
    indent.movedToProcurementAt = new Date();
    indent.movedToProcurementReason = (req.body.reason || '').trim();
    pushIndentWorkflowHistory(indent, {
      fromStatus: previousStatus,
      toStatus: previousStatus,
      changedBy: req.user.id,
      comments: `Moved to Procurement Requisitions. Reason: ${indent.movedToProcurementReason}`,
      module: 'Store'
    });
    indent.updatedBy = req.user.id;
    await indent.save({ validateBeforeSave: false });

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
    await indent.populate('approvedBy', 'firstName lastName email digitalSignature');
    await indent.populate('movedToProcurementBy', 'firstName lastName');

    const procurementRecipients = await getProcurementWorkflowRecipients();
    await notifyIndentTransition({
      recipientIds: procurementRecipients,
      actorId: req.user.id,
      title: 'Indent moved to Procurement Requisitions',
      message: `Indent ${indent.indentNumber || ''} has been moved from Store to Procurement.`,
      actionUrl: INDENT_TARGET_ROUTES.procurementRequisitions,
      indentId: indent._id
    });

    res.json({
      success: true,
      message: 'Indent moved to Procurement Requisitions successfully',
      data: indent
    });
  })
);

// @route   POST /api/indents/:id/resubmit-to-procurement
// @desc    Requester resubmits a procurement-rejected indent back to procurement stage (no re-approval chain)
// @access  Private
router.post('/:id/resubmit-to-procurement',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id);

    if (!indent || !indent.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }

    if (indent.status !== 'Rejected in Procurement') {
      return res.status(400).json({
        success: false,
        message: 'Only requisitions rejected in procurement can be resubmitted.'
      });
    }

    if (String(indent.requestedBy) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can resubmit this requisition.'
      });
    }

    const previousStatus = indent.status;
    indent.status = 'Approved';
    indent.storeRoutingStatus = 'moved_to_procurement';
    indent.procurementRejection = {
      rejectedBy: null,
      rejectedAt: null,
      observation: ''
    };
    indent.procurementAssignment = indent.procurementAssignment || {};
    indent.procurementAssignment.status = 'unassigned';
    indent.procurementAssignment.assignedTo = null;
    indent.procurementAssignment.note = '';
    indent.updatedBy = req.user.id;

    pushIndentWorkflowHistory(indent, {
      fromStatus: previousStatus,
      toStatus: indent.status,
      changedBy: req.user.id,
      comments: 'Requester revised and resubmitted to Procurement (no re-approval required).',
      module: 'Indent'
    });

    await indent.save({ validateBeforeSave: false });

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email employeeId digitalSignature');
    await indent.populate('approvedBy', 'firstName lastName email digitalSignature');
    await indent.populate('procurementRejection.rejectedBy', 'firstName lastName email');
    await indent.populate('workflowHistory.changedBy', 'firstName lastName email');

    const procurementRecipients = await getProcurementWorkflowRecipients();
    await notifyIndentTransition({
      recipientIds: procurementRecipients,
      actorId: req.user.id,
      title: 'Requisition resubmitted to Procurement',
      message: `Requisition ${indent.indentNumber || ''} has been revised by requester and resubmitted.`,
      actionUrl: INDENT_TARGET_ROUTES.procurementRequisitions,
      indentId: indent._id
    });

    res.json({
      success: true,
      message: 'Requisition resubmitted to procurement successfully.',
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

    const userId = req.user._id.toString();
    const chain = indent.approvalChain || [];

    if (chain.length > 0) {
      const stepIndex = chain.findIndex(
        (step) => step.approver.toString() === userId && step.status === 'pending'
      );
      if (stepIndex === -1) {
        return res.status(403).json({
          success: false,
          message: 'You are not a pending approver for this indent.'
        });
      }

      const previousStatus = indent.status;
      indent.approvalChain[stepIndex].status = 'rejected';
      indent.approvalChain[stepIndex].actedAt = new Date();
      indent.approvalChain[stepIndex].comment = req.body.rejectionReason;
      indent.status = 'Rejected';
      indent.rejectionReason = req.body.rejectionReason;
      pushIndentWorkflowHistory(indent, {
        fromStatus: previousStatus,
        toStatus: indent.status,
        changedBy: req.user.id,
        comments: `Rejected: ${req.body.rejectionReason}`,
        module: 'Indent'
      });
      indent.updatedBy = req.user.id;
      await indent.save();

      await indent.populate('department', 'name code');
      await indent.populate('requestedBy', 'firstName lastName email digitalSignature');
      await indent.populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature');

      return res.json({
        success: true,
        message: 'Indent rejected successfully',
        data: indent
      });
    }

    if (!LEGACY_APPROVER_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this indent.'
      });
    }

    const previousStatus = indent.status;
    indent.status = 'Rejected';
    indent.rejectionReason = req.body.rejectionReason;
    pushIndentWorkflowHistory(indent, {
      fromStatus: previousStatus,
      toStatus: indent.status,
      changedBy: req.user.id,
      comments: `Rejected: ${req.body.rejectionReason}`,
      module: 'Indent'
    });
    indent.updatedBy = req.user.id;
    await indent.save();

    await indent.populate('department', 'name code');
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');

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
    await indent.populate('requestedBy', 'firstName lastName email digitalSignature');

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: indent
    });
  })
);

// @route   GET /api/indents/:id/purchase-orders
// @desc    Get all purchase orders linked to an indent (for PO tracking from requisition)
// @access  Private
router.get('/:id/purchase-orders',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const indent = await Indent.findById(req.params.id).select('_id').lean();
    if (!indent) {
      return res.status(404).json({ success: false, message: 'Indent not found' });
    }
    const pos = await PurchaseOrder.find({ indent: req.params.id })
      .populate('vendor', 'name email phone')
      .select('orderNumber status vendor orderDate totalAmount items quotation createdAt')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, data: pos });
  })
);

module.exports = router;

