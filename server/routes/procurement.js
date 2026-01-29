const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const dayjs = require('dayjs');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const Supplier = require('../models/hr/Supplier');
const FinanceHelper = require('../utils/financeHelper');
const AccountsPayable = require('../models/finance/AccountsPayable');
const Inventory = require('../models/procurement/Inventory');
const GoodsReceive = require('../models/procurement/GoodsReceive');
const GoodsIssue = require('../models/procurement/GoodsIssue');
const CostCenter = require('../models/procurement/CostCenter');
const Quotation = require('../models/procurement/Quotation');
const QuotationInvitation = require('../models/procurement/QuotationInvitation');
const Indent = require('../models/general/Indent');
const User = require('../models/User');

console.log('✅ Procurement routes loaded successfully');

const router = express.Router();

// ==================== PURCHASE ORDERS ROUTES ====================

// @route   GET /api/procurement/purchase-orders
// @desc    Get all purchase orders with pagination and filters
// @access  Private (Procurement and Admin)
router.get('/purchase-orders', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    console.log('📦 GET /purchase-orders - User:', req.user?.role);
    
    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority,
      vendor,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (vendor) query.vendor = vendor;

    // Date range filter
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Query filters:', query);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    try {
      const purchaseOrders = await PurchaseOrder.find(query)
        .populate('vendor', 'name email phone contactPerson')
        .populate('createdBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await PurchaseOrder.countDocuments(query);

      console.log(`Found ${purchaseOrders.length} purchase orders out of ${total} total`);

      res.json({
        success: true,
        data: {
          purchaseOrders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      throw error;
    }
  })
);

// @route   GET /api/procurement/purchase-orders/statistics
// @desc    Get purchase orders statistics
// @access  Private (Procurement and Admin)
router.get('/purchase-orders/statistics', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    console.log('📊 GET /purchase-orders/statistics - User:', req.user?.role);
    
    try {
      const stats = await PurchaseOrder.getStatistics();
      
      // Get recent orders
      const recentOrders = await PurchaseOrder.find()
        .populate('vendor', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber vendor status totalAmount orderDate');

      console.log('Statistics loaded successfully');

      res.json({
        success: true,
        data: {
          ...stats,
          recentOrders
        }
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Return empty stats instead of erroring
      res.json({
        success: true,
        data: {
          totalOrders: 0,
          totalValue: 0,
          byStatus: [],
          recentOrders: []
        }
      });
    }
  })
);

// @route   GET /api/procurement/purchase-orders/ceo-secretariat
// @desc    Get POs for CEO Secretariat / CEO (status: Send to CEO Office, Forwarded to CEO, Returned from CEO Office)
// @access  Private (Super Admin, Admin, HR Manager, Higher Management)
router.get('/purchase-orders/ceo-secretariat',
  authorize('super_admin', 'admin', 'hr_manager', 'higher_management'),
  asyncHandler(async (req, res) => {
    const purchaseOrders = await PurchaseOrder.find({
      status: { $in: ['Send to CEO Office', 'Forwarded to CEO', 'Returned from CEO Office'] }
    })
      .populate('vendor', 'name email phone contactPerson')
      .populate('createdBy', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .exec();
    res.json({
      success: true,
      data: purchaseOrders
    });
  })
);

// @route   GET /api/procurement/purchase-orders/:id
// @desc    Get purchase order by ID
// @access  Private (Procurement, Admin, CEO Secretariat, CEO)
router.get('/purchase-orders/:id', 
  authorize('super_admin', 'admin', 'procurement_manager', 'hr_manager', 'higher_management'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate('vendor', 'name email phone contactPerson address')
      .populate({
        path: 'indent',
        select: 'indentNumber title erpRef requestedDate requiredDate department requestedBy',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'requestedBy', select: 'firstName lastName email' }
        ]
      })
      .populate('quotation', 'quotationNumber quotationDate')
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .populate('qaCheckedBy', 'firstName lastName');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.json({
      success: true,
      data: purchaseOrder
    });
  })
);

// @route   POST /api/procurement/purchase-orders
// @desc    Create new purchase order
// @access  Private (Procurement and Admin)
router.post('/purchase-orders', [
  body('vendor').isMongoId().withMessage('Valid vendor ID is required'),
  body('orderDate').isDate().withMessage('Valid order date is required'),
  body('expectedDeliveryDate').isDate().withMessage('Valid expected delivery date is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Item quantity must be greater than 0'),
  body('items.*.unit').trim().notEmpty().withMessage('Item unit is required'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Verify vendor exists
  const vendor = await Supplier.findById(req.body.vendor);
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor not found'
    });
  }

  // Calculate item amounts
  const items = req.body.items.map(item => ({
    ...item,
    amount: (item.quantity * item.unitPrice) - (item.discount || 0) + ((item.quantity * item.unitPrice - (item.discount || 0)) * (item.taxRate || 0) / 100)
  }));

  const purchaseOrder = new PurchaseOrder({
    ...req.body,
    items,
    createdBy: req.user.id
  });

  await purchaseOrder.save();

  const populatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    message: 'Purchase order created successfully',
    data: populatedOrder
  });
}));

// @route   PUT /api/procurement/purchase-orders/:id
// @desc    Update purchase order
// @access  Private (Procurement and Admin)
router.put('/purchase-orders/:id', [
  body('vendor').optional().isMongoId().withMessage('Valid vendor ID is required'),
  body('orderDate').optional().isDate().withMessage('Valid order date is required'),
  body('expectedDeliveryDate').optional().isDate().withMessage('Valid expected delivery date is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const purchaseOrder = await PurchaseOrder.findById(req.params.id);
  if (!purchaseOrder) {
    return res.status(404).json({
      success: false,
      message: 'Purchase order not found'
    });
  }

  // Prevent editing approved or completed orders
  if (['Received', 'Cancelled'].includes(purchaseOrder.status) && req.body.status !== 'Cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Cannot edit completed or cancelled purchase orders'
    });
  }

  // If items are being updated, recalculate amounts
  if (req.body.items) {
    req.body.items = req.body.items.map(item => ({
      ...item,
      amount: (item.quantity * item.unitPrice) - (item.discount || 0) + ((item.quantity * item.unitPrice - (item.discount || 0)) * (item.taxRate || 0) / 100)
    }));
  }

  Object.assign(purchaseOrder, req.body);
  purchaseOrder.updatedBy = req.user.id;
  
  await purchaseOrder.save();

  const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email');

  res.json({
    success: true,
    message: 'Purchase order updated successfully',
    data: updatedOrder
  });
}));

// @route   PUT /api/procurement/purchase-orders/:id/approve
// @desc    Approve purchase order
// @access  Private (Admin only)
router.put('/purchase-orders/:id/approve', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.status !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Only pending purchase orders can be approved'
      });
    }

    purchaseOrder.status = 'Approved';
    purchaseOrder.approvedBy = req.user.id;
    purchaseOrder.approvedAt = new Date();
    
    await purchaseOrder.save();

    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('approvedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Purchase order approved successfully',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/send-to-audit
// @desc    Send purchase order to audit module (status -> Pending Audit)
// @access  Private (Procurement and Admin)
router.put('/purchase-orders/:id/send-to-audit',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (!['Draft', 'Returned from Audit', 'Returned from CEO Secretariat'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only Draft, Returned from Audit, or Returned from CEO Secretariat purchase orders can be sent to audit'
      });
    }
    purchaseOrder.status = 'Pending Audit';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('updatedBy', 'firstName lastName email');
    res.json({
      success: true,
      message: 'Purchase order sent to audit successfully',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/audit-approve
// @desc    Audit module approves purchase order (status -> Send to CEO Office)
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/purchase-orders/:id/audit-approve',
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Pending Audit') {
      return res.status(400).json({
        success: false,
        message: 'Only purchase orders in Pending Audit can be audit-approved'
      });
    }
    purchaseOrder.status = 'Send to CEO Office';
    purchaseOrder.auditApprovedBy = req.user.id;
    purchaseOrder.auditApprovedAt = new Date();
    purchaseOrder.auditRemarks = req.body.approvalComments || req.body.comments || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('auditApprovedBy', 'firstName lastName email');
    res.json({
      success: true,
      message: 'Purchase order audit-approved successfully and sent to CEO Office',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/audit-reject
// @desc    Audit module rejects purchase order (status -> Rejected)
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/purchase-orders/:id/audit-reject',
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { rejectionComments, observations } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Pending Audit') {
      return res.status(400).json({
        success: false,
        message: 'Only purchase orders in Pending Audit can be audit-rejected'
      });
    }
    purchaseOrder.status = 'Rejected';
    purchaseOrder.auditRejectedBy = req.user.id;
    purchaseOrder.auditRejectedAt = new Date();
    purchaseOrder.auditRejectionComments = rejectionComments || '';
    purchaseOrder.auditRejectObservations = observations || [];
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('auditRejectedBy', 'firstName lastName email');
    res.json({
      success: true,
      message: 'Purchase order audit-rejected successfully',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/audit-return
// @desc    Audit module returns purchase order to procurement (status -> Returned from Audit)
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/purchase-orders/:id/audit-return',
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Pending Audit') {
      return res.status(400).json({
        success: false,
        message: 'Only purchase orders in Pending Audit can be returned from audit'
      });
    }
    purchaseOrder.status = 'Returned from Audit';
    purchaseOrder.auditReturnedBy = req.user.id;
    purchaseOrder.auditReturnedAt = new Date();
    purchaseOrder.auditReturnComments = req.body.returnComments || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('auditReturnedBy', 'firstName lastName email');
    res.json({
      success: true,
      message: 'Purchase order returned from audit successfully',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/forward-to-ceo
// @desc    CEO Coordinator forwards PO to CEO (status -> Forwarded to CEO)
// @access  Private (Super Admin, Admin, HR Manager / CEO Coordinator)
router.put('/purchase-orders/:id/forward-to-ceo',
  authorize('super_admin', 'admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (!['Send to CEO Office', 'Returned from CEO Office'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only POs in Send to CEO Office or Returned from CEO Office can be forwarded to CEO'
      });
    }
    purchaseOrder.status = 'Forwarded to CEO';
    purchaseOrder.ceoForwardedBy = req.user.id;
    purchaseOrder.ceoForwardedAt = new Date();
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('ceoForwardedBy', 'firstName lastName email');
    res.json({
      success: true,
      message: 'Purchase order forwarded to CEO successfully',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/ceo-approve
// @desc    CEO approves PO (status -> Approved) and creates Accounts Payable entry
// @access  Private (Super Admin, Admin, Higher Management / CEO)
router.put('/purchase-orders/:id/ceo-approve',
  authorize('super_admin', 'admin', 'higher_management'),
  asyncHandler(async (req, res) => {
    const { approvalComments, digitalSignature } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate('vendor');
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Forwarded to CEO') {
      return res.status(400).json({
        success: false,
        message: 'Only POs in Forwarded to CEO can be approved by CEO'
      });
    }
    purchaseOrder.status = 'Approved';
    purchaseOrder.ceoApprovedBy = req.user.id;
    purchaseOrder.ceoApprovedAt = new Date();
    purchaseOrder.ceoApprovalComments = approvalComments || '';
    purchaseOrder.ceoDigitalSignature = digitalSignature || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();

    let accountsPayableCreated = false;
    let accountsPayableId = null;
    try {
      const existingAP = await AccountsPayable.findOne({ referenceId: purchaseOrder._id });
      const amount = Number(purchaseOrder.totalAmount) || 0;
      if (!existingAP && amount > 0) {
        const billDate = new Date();
        billDate.setHours(0, 0, 0, 0);
        const dueDate = new Date(billDate);
        dueDate.setDate(dueDate.getDate() + 30);
        const apEntry = await FinanceHelper.createAPFromBill({
          vendorName: purchaseOrder.vendor?.name || 'Unknown Vendor',
          vendorEmail: purchaseOrder.vendor?.email || '',
          vendorId: purchaseOrder.vendor?._id,
          billNumber: `PO-${purchaseOrder.orderNumber}`,
          billDate,
          dueDate,
          amount,
          department: 'procurement',
          module: 'procurement',
          referenceId: purchaseOrder._id,
          referenceType: 'purchase_order',
          lineDescription: `Purchase Order ${purchaseOrder.orderNumber}`,
          createdBy: req.user.id
        });
        accountsPayableCreated = true;
        accountsPayableId = apEntry._id;
      }
    } catch (apError) {
      console.error('❌ Error creating AP for CEO approved purchase order:', apError);
    }

    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('ceoApprovedBy', 'firstName lastName email');
    res.json({
      success: true,
      message: accountsPayableCreated
        ? 'Purchase order approved by CEO and Accounts Payable entry created'
        : 'Purchase order approved by CEO successfully',
      data: updatedOrder,
      accountsPayableCreated,
      accountsPayableId
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/ceo-reject
// @desc    CEO rejects PO (status -> Rejected)
// @access  Private (Super Admin, Admin, Higher Management / CEO)
router.put('/purchase-orders/:id/ceo-reject',
  authorize('super_admin', 'admin', 'higher_management'),
  asyncHandler(async (req, res) => {
    const { rejectionComments, digitalSignature } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Forwarded to CEO') {
      return res.status(400).json({
        success: false,
        message: 'Only POs in Forwarded to CEO can be rejected by CEO'
      });
    }
    purchaseOrder.status = 'Rejected';
    purchaseOrder.ceoRejectedBy = req.user.id;
    purchaseOrder.ceoRejectedAt = new Date();
    purchaseOrder.ceoRejectionComments = rejectionComments || '';
    purchaseOrder.ceoDigitalSignature = digitalSignature || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    res.json({
      success: true,
      message: 'Purchase order rejected by CEO successfully',
      data: purchaseOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/ceo-return
// @desc    CEO returns PO (status -> Returned from CEO Office)
// @access  Private (Super Admin, Admin, Higher Management / CEO)
router.put('/purchase-orders/:id/ceo-return',
  authorize('super_admin', 'admin', 'higher_management'),
  asyncHandler(async (req, res) => {
    const { returnComments, digitalSignature } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Forwarded to CEO') {
      return res.status(400).json({
        success: false,
        message: 'Only POs in Forwarded to CEO can be returned by CEO'
      });
    }
    purchaseOrder.status = 'Returned from CEO Office';
    purchaseOrder.ceoReturnedBy = req.user.id;
    purchaseOrder.ceoReturnedAt = new Date();
    purchaseOrder.ceoReturnComments = returnComments || '';
    purchaseOrder.ceoDigitalSignature = digitalSignature || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    res.json({
      success: true,
      message: 'Purchase order returned by CEO successfully',
      data: purchaseOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/ceo-secretariat-reject
// @desc    CEO Coordinator rejects PO from CEO Secretariat (status -> Rejected)
// @access  Private (Super Admin, Admin, HR Manager / CEO Coordinator)
router.put('/purchase-orders/:id/ceo-secretariat-reject',
  authorize('super_admin', 'admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { rejectionComments, digitalSignature, observations } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Send to CEO Office') {
      return res.status(400).json({
        success: false,
        message: 'Only POs in Send to CEO Office can be rejected by CEO Secretariat'
      });
    }
    purchaseOrder.status = 'Rejected';
    purchaseOrder.ceoRejectedBy = req.user.id;
    purchaseOrder.ceoRejectedAt = new Date();
    purchaseOrder.ceoRejectionComments = rejectionComments || '';
    purchaseOrder.ceoDigitalSignature = digitalSignature || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    res.json({
      success: true,
      message: 'Purchase order rejected by CEO Secretariat successfully',
      data: purchaseOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/ceo-secretariat-return
// @desc    CEO Coordinator returns PO to procurement (status -> Returned from CEO Secretariat)
// @access  Private (Super Admin, Admin, HR Manager / CEO Coordinator)
router.put('/purchase-orders/:id/ceo-secretariat-return',
  authorize('super_admin', 'admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { returnComments, digitalSignature, observations } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Send to CEO Office') {
      return res.status(400).json({
        success: false,
        message: 'Only POs in Send to CEO Office can be returned by CEO Secretariat'
      });
    }
    purchaseOrder.status = 'Returned from CEO Secretariat';
    purchaseOrder.ceoReturnedBy = req.user.id;
    purchaseOrder.ceoReturnedAt = new Date();
    purchaseOrder.ceoReturnComments = returnComments || '';
    purchaseOrder.ceoDigitalSignature = digitalSignature || '';
    purchaseOrder.updatedBy = req.user.id;
    await purchaseOrder.save();
    res.json({
      success: true,
      message: 'Purchase order returned to procurement by CEO Secretariat successfully',
      data: purchaseOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/send-to-store
// @desc    Send approved PO to Store (status -> Sent to Store)
// @access  Private (Procurement and Admin)
router.put('/purchase-orders/:id/send-to-store',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { comments } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (purchaseOrder.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved purchase orders can be sent to store'
      });
    }
    purchaseOrder.status = 'Sent to Store';
    purchaseOrder.updatedBy = req.user.id;
    if (comments) {
      purchaseOrder.internalNotes = (purchaseOrder.internalNotes || '') + (purchaseOrder.internalNotes ? '\n' : '') + `Sent to Store: ${comments}`;
    }
    await purchaseOrder.save();
    
    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('updatedBy', 'firstName lastName email');
    
    res.json({
      success: true,
      message: 'Purchase order sent to store successfully',
      data: updatedOrder
    });
  })
);

// @route   GET /api/procurement/store/dashboard
// @desc    Get Purchase Orders with status "Sent to Store" grouped by month/year
// @access  Private (Procurement, Admin, Store Manager)
router.get('/store/dashboard',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    try {
      // Get all POs with status "Sent to Store"
      const purchaseOrders = await PurchaseOrder.find({ status: 'Sent to Store' })
        .populate('vendor', 'name email phone contactPerson')
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .populate('qaCheckedBy', 'firstName lastName')
        .populate('indent', 'indentNumber title')
        .sort({ updatedAt: -1 })
        .lean();

      // Group by month/year
      const groupedByMonth = {};
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];

      purchaseOrders.forEach(po => {
        const date = new Date(po.updatedAt || po.createdAt);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthYearLabel = `${monthNames[month]} ${year}`;

        if (!groupedByMonth[monthYear]) {
          groupedByMonth[monthYear] = {
            monthYear,
            monthYearLabel,
            month,
            year,
            purchaseOrders: [],
            totalAmount: 0,
            count: 0
          };
        }

        groupedByMonth[monthYear].purchaseOrders.push(po);
        groupedByMonth[monthYear].totalAmount += po.totalAmount || 0;
        groupedByMonth[monthYear].count += 1;
      });

      // Convert to array and sort by date (newest first)
      const groupedArray = Object.values(groupedByMonth).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      // Calculate totals
      const totalCount = purchaseOrders.length;
      const totalAmount = purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

      res.json({
        success: true,
        data: {
          groupedByMonth: groupedArray,
          summary: {
            totalCount,
            totalAmount
          }
        }
      });
    } catch (error) {
      console.error('Error fetching store dashboard data:', error);
      throw error;
    }
  })
);

// @route   GET /api/procurement/store/qa-pending
// @desc    Get POs with QA status Pending (Sent to Store, not yet QA checked)
// @access  Private (Procurement, Admin, Store Manager)
router.get('/store/qa-pending',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const purchaseOrders = await PurchaseOrder.find({
      status: 'Sent to Store',
      $or: [{ qaStatus: { $in: [null, 'Pending'] } }, { qaStatus: { $exists: false } }]
    })
      .populate('vendor', 'name email phone contactPerson')
      .populate('indent', 'indentNumber title')
      .populate('qaCheckedBy', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({
      success: true,
      data: { purchaseOrders }
    });
  })
);

// @route   GET /api/procurement/store/qa-list
// @desc    Get POs by QA state: Pending | Passed (Approved) | Rejected. status=Sent to Store.
// @access  Private (Procurement, Admin, Store Manager)
router.get('/store/qa-list',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { qaStatus = 'Pending' } = req.query; // Pending | Passed | Rejected
    const query = { status: 'Sent to Store' };
    if (qaStatus === 'Pending') {
      query.$or = [{ qaStatus: { $in: [null, 'Pending'] } }, { qaStatus: { $exists: false } }];
    } else {
      query.qaStatus = qaStatus; // Passed or Rejected
    }
    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('vendor', 'name email phone contactPerson')
      .populate('indent', 'indentNumber title')
      .populate('qaCheckedBy', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({
      success: true,
      data: { purchaseOrders, qaStatus }
    });
  })
);

// @route   POST /api/procurement/store/po/:id/qa-check
// @desc    Quality Assurance check: Pass or Reject a PO at store
// @access  Private (Procurement, Admin, Store Manager)
router.post('/store/po/:id/qa-check',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('status').isIn(['Passed', 'Rejected']).withMessage('QA status must be Passed or Rejected'),
    body('remarks').optional().trim()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    if (po.status !== 'Sent to Store') {
      return res.status(400).json({
        success: false,
        message: 'Only purchase orders with status "Sent to Store" can be QA checked'
      });
    }
    const { status, remarks } = req.body;
    po.qaStatus = status;
    po.qaCheckedBy = req.user.id;
    po.qaCheckedAt = new Date();
    po.qaRemarks = remarks || '';
    po.updatedBy = req.user.id;
    await po.save();
    await po.populate('qaCheckedBy', 'firstName lastName');
    res.json({
      success: true,
      message: `Quality Assurance: ${status}`,
      data: po
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/receive
// @desc    Mark items as received
// @access  Private (Procurement and Admin)
router.put('/purchase-orders/:id/receive', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
  
  if (!purchaseOrder) {
    return res.status(404).json({
      success: false,
      message: 'Purchase order not found'
    });
  }

  if (!['Approved', 'Ordered', 'Partially Received'].includes(purchaseOrder.status)) {
    return res.status(400).json({
      success: false,
      message: 'Purchase order must be approved before receiving items'
    });
  }

  // Update received quantities
  req.body.items.forEach((receivedItem, index) => {
    if (purchaseOrder.items[index]) {
      purchaseOrder.items[index].receivedQuantity = receivedItem.receivedQuantity;
    }
  });

  purchaseOrder.receivedBy = req.user.id;
  purchaseOrder.receivedAt = new Date();
  purchaseOrder.updateReceivingStatus();
  
  await purchaseOrder.save();

  // If status is "Received", create Accounts Payable only if not already created (e.g. by CEO approval)
  if (purchaseOrder.status === 'Received') {
    try {
      const existingAP = await AccountsPayable.findOne({ referenceId: purchaseOrder._id });
      const amount = Number(purchaseOrder.totalAmount) || 0;
      if (!existingAP && amount > 0) {
        const supplier = await Supplier.findById(purchaseOrder.vendor);
        const billDate = new Date();
        billDate.setHours(0, 0, 0, 0);
        await FinanceHelper.createAPFromBill({
          vendorName: supplier ? supplier.name : 'Unknown Supplier',
          vendorEmail: supplier ? supplier.email : '',
          vendorId: purchaseOrder.vendor,
          billNumber: `PO-${purchaseOrder.orderNumber}`,
          billDate,
          dueDate: dayjs().add(30, 'day').toDate(),
          amount,
          department: 'procurement',
          module: 'procurement',
          referenceId: purchaseOrder._id,
          referenceType: 'purchase_order',
          lineDescription: `Purchase Order ${purchaseOrder.orderNumber}`,
          createdBy: req.user.id
        });
      }
    } catch (apError) {
      console.error('❌ Error creating AP for received purchase order:', apError);
    }
  }

  res.json({
    success: true,
    message: purchaseOrder.status === 'Received' 
      ? 'Items received and Accounts Payable entry created' 
      : 'Receiving information updated successfully',
    data: purchaseOrder
  });
}));

// @route   DELETE /api/procurement/purchase-orders/:id
// @desc    Delete purchase order
// @access  Private (Admin only)
router.delete('/purchase-orders/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Prevent deleting approved or received orders
    if (['Approved', 'Ordered', 'Partially Received', 'Received'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete approved or received purchase orders. Cancel instead.'
      });
    }

    await PurchaseOrder.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  })
);

// ==================== VENDORS ROUTES ====================

// @route   GET /api/procurement/vendors
// @desc    Get all vendors (suppliers)
// @access  Private (Procurement and Admin)
router.get('/vendors', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search,
      status 
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { supplierId: { $regex: search, $options: 'i' } }
      ];
    }

    const vendors = await Supplier.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Supplier.countDocuments(query);

    res.json({
      success: true,
      data: {
        vendors,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/vendors/statistics
// @desc    Get vendor statistics
// @access  Private (Procurement and Admin)
router.get('/vendors/statistics', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const totalVendors = await Supplier.countDocuments();
    const activeVendors = await Supplier.countDocuments({ status: 'Active' });
    const inactiveVendors = await Supplier.countDocuments({ status: 'Inactive' });
    
    // Get payment terms breakdown
    const paymentTermsBreakdown = await Supplier.aggregate([
      {
        $group: {
          _id: '$paymentTerms',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalVendors,
        activeVendors,
        inactiveVendors,
        paymentTermsBreakdown
      }
    });
  })
);

// @route   GET /api/procurement/vendors/:id
// @desc    Get vendor by ID
// @access  Private (Procurement and Admin)
router.get('/vendors/:id', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const vendor = await Supplier.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      data: vendor
    });
  })
);

// @route   POST /api/procurement/vendors
// @desc    Create new vendor
// @access  Private (Procurement and Admin)
router.post('/vendors', [
  body('name').trim().notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').trim().notEmpty().withMessage('Contact person is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('address').trim().notEmpty().withMessage('Address is required')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Generate supplierId
  const lastSupplier = await Supplier.findOne().sort({ supplierId: -1 });
  let newSupplierId = 'SUP-0001';
  
  if (lastSupplier && lastSupplier.supplierId) {
    const lastNum = parseInt(lastSupplier.supplierId.split('-')[1]);
    newSupplierId = `SUP-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const vendor = new Supplier({
    ...req.body,
    supplierId: newSupplierId,
    createdBy: req.user.id
  });

  await vendor.save();

  const populatedVendor = await Supplier.findById(vendor._id)
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Vendor created successfully',
    data: populatedVendor
  });
}));

// @route   PUT /api/procurement/vendors/:id
// @desc    Update vendor
// @access  Private (Procurement and Admin)
router.put('/vendors/:id', [
  body('name').optional().trim().notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').optional().trim().notEmpty().withMessage('Contact person is required'),
  body('phone').optional().trim().notEmpty().withMessage('Phone is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('address').optional().trim().notEmpty().withMessage('Address is required')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const vendor = await Supplier.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName');

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor not found'
    });
  }

  res.json({
    success: true,
    message: 'Vendor updated successfully',
    data: vendor
  });
}));

// @route   DELETE /api/procurement/vendors/:id
// @desc    Delete vendor
// @access  Private (Admin only)
router.delete('/vendors/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    // Check if vendor is used in any purchase orders
    const usedInPO = await PurchaseOrder.findOne({ vendor: req.params.id });
    
    if (usedInPO) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vendor that has associated purchase orders. Set status to Inactive instead.'
      });
    }

    const vendor = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  })
);

// ==================== INVENTORY ROUTES ====================

// @route   GET /api/procurement/inventory
// @desc    Get all inventory items
// @access  Private (Procurement and Admin)
router.get('/inventory', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search,
      category,
      status,
      supplier
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Inventory.find(query)
      .populate('supplier', 'name contactPerson')
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Inventory.countDocuments(query);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/inventory/statistics
// @desc    Get inventory statistics
// @access  Private (Procurement and Admin)
router.get('/inventory/statistics', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const stats = await Inventory.getStatistics();
    
    // Get low stock items
    const lowStockItems = await Inventory.find({ status: 'Low Stock' })
      .limit(10)
      .select('name itemCode quantity minQuantity')
      .sort({ quantity: 1 });

    res.json({
      success: true,
      data: {
        ...stats,
        lowStockItems
      }
    });
  })
);

// @route   GET /api/procurement/inventory/:id
// @desc    Get inventory item by ID
// @access  Private (Procurement and Admin)
router.get('/inventory/:id', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id)
      .populate('supplier', 'name contactPerson email phone')
      .populate('createdBy', 'firstName lastName email')
      .populate('transactions.performedBy', 'firstName lastName');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  })
);

// @route   POST /api/procurement/inventory
// @desc    Create new inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory', [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('category').isIn(['Raw Materials', 'Finished Goods', 'Office Supplies', 'Equipment', 'Consumables', 'Other']).withMessage('Valid category is required'),
  body('unit').trim().notEmpty().withMessage('Unit is required'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be non-negative'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Generate itemCode
  const lastItem = await Inventory.findOne().sort({ itemCode: -1 });
  let newItemCode = 'INV-0001';
  
  if (lastItem && lastItem.itemCode) {
    const lastNum = parseInt(lastItem.itemCode.split('-')[1]);
    newItemCode = `INV-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const item = new Inventory({
    ...req.body,
    itemCode: newItemCode,
    createdBy: req.user.id,
    lastRestocked: new Date()
  });

  await item.save();

  const populatedItem = await Inventory.findById(item._id)
    .populate('supplier', 'name')
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Inventory item created successfully',
    data: populatedItem
  });
}));

// @route   PUT /api/procurement/inventory/:id
// @desc    Update inventory item
// @access  Private (Procurement and Admin)
router.put('/inventory/:id', [
  body('name').optional().trim().notEmpty().withMessage('Item name is required'),
  body('category').optional().isIn(['Raw Materials', 'Finished Goods', 'Office Supplies', 'Equipment', 'Consumables', 'Other']).withMessage('Valid category is required'),
  body('unit').optional().trim().notEmpty().withMessage('Unit is required'),
  body('unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  Object.assign(item, req.body);
  item.updatedBy = req.user.id;
  await item.save();

  const updatedItem = await Inventory.findById(item._id)
    .populate('supplier', 'name')
    .populate('createdBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Inventory item updated successfully',
    data: updatedItem
  });
}));

// @route   POST /api/procurement/inventory/:id/add-stock
// @desc    Add stock to inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory/:id/add-stock', [
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  await item.addStock(
    req.body.quantity,
    req.body.reference || '',
    req.body.notes || '',
    req.user.id
  );

  res.json({
    success: true,
    message: 'Stock added successfully',
    data: item
  });
}));

// @route   POST /api/procurement/inventory/:id/remove-stock
// @desc    Remove stock from inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory/:id/remove-stock', [
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  try {
    await item.removeStock(
      req.body.quantity,
      req.body.reference || '',
      req.body.notes || '',
      req.user.id
    );

    res.json({
      success: true,
      message: 'Stock removed successfully',
      data: item
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   POST /api/procurement/inventory/:id/adjust-stock
// @desc    Adjust stock for inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory/:id/adjust-stock', [
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  await item.adjustStock(
    req.body.quantity,
    req.body.reference || 'Manual Adjustment',
    req.body.notes || '',
    req.user.id
  );

  res.json({
    success: true,
    message: 'Stock adjusted successfully',
    data: item
  });
}));

// @route   DELETE /api/procurement/inventory/:id
// @desc    Delete inventory item
// @access  Private (Admin only)
router.delete('/inventory/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if item has quantity
    if (item.quantity > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete item with existing stock. Adjust stock to zero first.'
      });
    }

    await Inventory.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  })
);

// ==================== GOODS RECEIVE ROUTES ====================

// @route   GET /api/procurement/goods-receive
// @desc    Get all goods receive records
// @access  Private (Procurement and Admin)
router.get('/goods-receive',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status, supplier, startDate, endDate } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;
    
    if (startDate || endDate) {
      query.receiveDate = {};
      if (startDate) query.receiveDate.$gte = new Date(startDate);
      if (endDate) query.receiveDate.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { receiveNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
        { poNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const receives = await GoodsReceive.find(query)
      .populate('supplier', 'name contactPerson supplierId address')
      .populate('purchaseOrder', 'orderNumber')
      .populate('receivedBy', 'firstName lastName')
      .sort({ receiveDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await GoodsReceive.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        receives,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/goods-receive/:id
// @desc    Get single goods receive record
// @access  Private
router.get('/goods-receive/:id',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const receive = await GoodsReceive.findById(req.params.id)
      .populate('supplier', 'name contactPerson email phone supplierId address')
      .populate('purchaseOrder')
      .populate('items.inventoryItem')
      .populate('receivedBy', 'firstName lastName email');
    
    if (!receive) {
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }
    
    res.json({ success: true, data: receive });
  })
);

// @route   PUT /api/procurement/goods-receive/:id/sync-inventory
// @desc    Sync GRN items to inventory (for existing GRNs or when post-save did not run)
// @access  Private
router.put('/goods-receive/:id/sync-inventory',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const grn = await GoodsReceive.findById(req.params.id).lean();
    if (!grn) {
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }
    await GoodsReceive.syncItemsToInventory(grn);
    res.json({ success: true, message: 'GRN items synced to inventory' });
  })
);

// @route   POST /api/procurement/goods-receive
// @desc    Create GRN (Goods Received Note) record
// @access  Private
router.post('/goods-receive',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('receiveDate').optional().isISO8601(),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.inventoryItem').optional().isMongoId().withMessage('Valid inventory item ID when provided'),
    body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0'),
    body('items.*.itemCode').optional().trim(),
    body('items.*.itemName').optional().trim(),
    body('items.*.unit').optional().trim(),
    body('items.*.unitPrice').optional().isFloat({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      receiveDate, supplier, supplierName, purchaseOrder, poNumber, items, notes,
      narration, supplierAddress, prNumber, store, gatePassNo, currency,
      discount, otherCharges, observation, status: bodyStatus
    } = req.body;

    let resolvedSupplierAddress = supplierAddress;
    if (supplier && !resolvedSupplierAddress) {
      const sup = await Supplier.findById(supplier).select('address').lean();
      if (sup) resolvedSupplierAddress = sup.address;
    }

    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const qty = Number(item.quantity) || 0;
        let inventoryItem = null;
        let itemCode = (item.itemCode != null && String(item.itemCode).trim() !== '') ? String(item.itemCode).trim() : '';
        let itemName = (item.itemName != null && String(item.itemName).trim() !== '') ? String(item.itemName).trim() : '';
        let unit = (item.unit != null && String(item.unit).trim() !== '') ? String(item.unit).trim() : '';
        let rate = (typeof item.unitPrice === 'number' ? item.unitPrice : (item.unitPrice !== '' && item.unitPrice != null ? Number(item.unitPrice) : 0));
        if (item.inventoryItem) {
          const inventory = await Inventory.findById(item.inventoryItem);
          if (inventory) {
            inventoryItem = inventory._id;
            if (!itemCode) itemCode = inventory.itemCode || '';
            if (!itemName) itemName = inventory.name || '';
            if (!unit) unit = inventory.unit || '';
            if (!rate) rate = inventory.unitPrice || 0;
          }
        }
        return {
          inventoryItem,
          itemCode: itemCode || '—',
          itemName: itemName || '—',
          quantity: qty,
          unit: unit || '—',
          unitPrice: rate,
          valueExcludingSalesTax: qty * rate,
          notes: item.notes
        };
      })
    );

    const preparedByName = req.user.firstName && req.user.lastName
      ? `${req.user.firstName} ${req.user.lastName}`.trim()
      : (req.user.email || 'Prepared By');

    const grnStatus = (bodyStatus === 'Complete' || bodyStatus === 'Partial') ? bodyStatus : 'Partial';
    const receive = new GoodsReceive({
      receiveDate: receiveDate || new Date(),
      supplier,
      supplierName,
      supplierAddress: resolvedSupplierAddress,
      purchaseOrder,
      poNumber,
      narration: narration || undefined,
      prNumber: prNumber || undefined,
      store: store || undefined,
      gatePassNo: gatePassNo || undefined,
      currency: currency || 'Rupees',
      discount: Number(discount) || 0,
      otherCharges: Number(otherCharges) || 0,
      observation: observation || undefined,
      preparedByName,
      items: itemsWithDetails,
      notes,
      receivedBy: req.user.id,
      status: grnStatus
    });

    await receive.save();
    await receive.populate([
      { path: 'supplier', select: 'name contactPerson supplierId address' },
      { path: 'purchaseOrder', select: 'orderNumber' },
      { path: 'receivedBy', select: 'firstName lastName' },
      { path: 'items.inventoryItem' }
    ]);

    res.status(201).json({
      success: true,
      message: 'GRN created successfully and inventory updated',
      data: receive
    });
  })
);

// ==================== GOODS ISSUE ROUTES ====================

// @route   GET /api/procurement/goods-issue
// @desc    Get all goods issue records
// @access  Private (Procurement and Admin)
router.get('/goods-issue',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status, department, startDate, endDate } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (department) query.department = department;
    
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { issueNumber: { $regex: search, $options: 'i' } },
        { sinNumber: { $regex: search, $options: 'i' } },
        { departmentName: { $regex: search, $options: 'i' } },
        { requestedByName: { $regex: search, $options: 'i' } },
        { costCenterName: { $regex: search, $options: 'i' } }
      ];
    }

    const issues = await GoodsIssue.find(query)
      .populate('requestedBy', 'firstName lastName')
      .populate('issuedBy', 'firstName lastName')
      .populate('costCenter', 'code name department')
      .sort({ issueDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await GoodsIssue.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        issues,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/goods-issue/:id
// @desc    Get single goods issue record
// @access  Private
router.get('/goods-issue/:id',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const issue = await GoodsIssue.findById(req.params.id)
      .populate('requestedBy', 'firstName lastName email')
      .populate('issuedBy', 'firstName lastName email')
      .populate('costCenter', 'code name department')
      .populate('items.inventoryItem');
    
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Goods issue not found' });
    }
    
    res.json({ success: true, data: issue });
  })
);

// @route   POST /api/procurement/goods-issue
// @desc    Create Store Issue Note (SIN) record
// @access  Private
router.post('/goods-issue',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('issueDate').optional().isISO8601(),
    body('department').isIn(['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general', 'it']).withMessage('Valid department is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.inventoryItem').isMongoId().withMessage('Valid inventory item ID is required'),
    body('items.*.quantity').optional().isFloat({ min: 0 }),
    body('items.*.qtyIssued').optional().isFloat({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      issueDate, department, departmentName, costCenter, costCenterCode, costCenterName,
      requestedBy, requestedByName, items, purpose, notes,
      issuingLocation, requiredFor, justification, eprNo, concernedDepartment,
      returnedByName, approvedByName, receivedByName
    } = req.body;

    if (costCenter) {
      const costCenterDoc = await CostCenter.findById(costCenter);
      if (!costCenterDoc || !costCenterDoc.isActive) {
        throw new Error('Invalid or inactive cost center');
      }
    }

    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const inventory = await Inventory.findById(item.inventoryItem);
        if (!inventory) {
          throw new Error(`Inventory item ${item.inventoryItem} not found`);
        }
        const qtyIssued = (item.qtyIssued != null && item.qtyIssued !== '') ? Number(item.qtyIssued) : (Number(item.quantity) || 0);
        if (qtyIssued <= 0) {
          throw new Error(`Quantity issued must be greater than 0 for ${inventory.name}`);
        }
        if (inventory.quantity < qtyIssued) {
          throw new Error(`Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}, Requested: ${qtyIssued}`);
        }
        const qtyReturned = (item.qtyReturned != null && item.qtyReturned !== '') ? Number(item.qtyReturned) : 0;
        const balanceQty = (item.balanceQty != null && item.balanceQty !== '') ? Number(item.balanceQty) : 0;
        const itemCode = (item.itemCode != null && String(item.itemCode).trim() !== '') ? String(item.itemCode).trim() : inventory.itemCode;
        const itemName = (item.itemName != null && String(item.itemName).trim() !== '') ? String(item.itemName).trim() : inventory.name;
        const unit = (item.unit != null && String(item.unit).trim() !== '') ? String(item.unit).trim() : inventory.unit;
        return {
          inventoryItem: inventory._id,
          itemCode,
          itemName,
          quantity: qtyIssued,
          qtyReturned,
          qtyIssued,
          balanceQty,
          issuedFromNewStock: !!item.issuedFromNewStock,
          issuedFromOldStock: !!item.issuedFromOldStock,
          unit,
          notes: item.notes
        };
      })
    );

    const issuedByName = req.user.firstName && req.user.lastName
      ? `${req.user.firstName} ${req.user.lastName}`.trim()
      : (req.user.email || '');

    const issue = new GoodsIssue({
      issueDate: issueDate || new Date(),
      issuingLocation: issuingLocation || undefined,
      department,
      departmentName,
      concernedDepartment: concernedDepartment || undefined,
      costCenter,
      costCenterCode,
      costCenterName,
      requiredFor: requiredFor || undefined,
      justification: justification || undefined,
      eprNo: eprNo || undefined,
      requestedBy,
      requestedByName,
      returnedByName: returnedByName || undefined,
      approvedByName: approvedByName || undefined,
      issuedByName,
      receivedByName: receivedByName || undefined,
      items: itemsWithDetails,
      purpose,
      notes,
      issuedBy: req.user.id,
      status: 'Issued'
    });

    await issue.save();
    await issue.populate([
      { path: 'requestedBy', select: 'firstName lastName' },
      { path: 'issuedBy', select: 'firstName lastName' },
      { path: 'costCenter', select: 'code name department' },
      { path: 'items.inventoryItem' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Store Issue Note created successfully and inventory updated',
      data: issue
    });
  })
);

// ==================== COST CENTERS ROUTES ====================

// @route   GET /api/procurement/cost-centers
// @desc    Get all cost centers
// @access  Private
router.get('/cost-centers',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, department, isActive } = req.query;
    const query = {};
    
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const costCenters = await CostCenter.find(query)
      .populate('manager', 'firstName lastName email')
      .sort({ code: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await CostCenter.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        costCenters,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/cost-centers/:id
// @desc    Get single cost center
// @access  Private
router.get('/cost-centers/:id',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const costCenter = await CostCenter.findById(req.params.id)
      .populate('manager', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    if (!costCenter) {
      return res.status(404).json({ success: false, message: 'Cost center not found' });
    }
    
    res.json({ success: true, data: costCenter });
  })
);

// @route   POST /api/procurement/cost-centers
// @desc    Create cost center
// @access  Private
router.post('/cost-centers',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('code').trim().notEmpty().withMessage('Cost center code is required'),
    body('name').trim().notEmpty().withMessage('Cost center name is required'),
    body('department').isIn(['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general', 'it']).withMessage('Valid department is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { code, name, description, department, departmentName, location, manager, managerName, budget, budgetPeriod, isActive, notes } = req.body;
    
    const existingCode = await CostCenter.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ success: false, message: 'Cost center code already exists' });
    }
    
    const costCenter = new CostCenter({
      code: code.toUpperCase(),
      name,
      description,
      department,
      departmentName,
      location,
      manager,
      managerName,
      budget: budget || 0,
      budgetPeriod: budgetPeriod || 'Annual',
      isActive: isActive !== undefined ? isActive : true,
      notes,
      createdBy: req.user.id
    });
    
    await costCenter.save();
    await costCenter.populate('manager', 'firstName lastName');
    
    res.status(201).json({
      success: true,
      message: 'Cost center created successfully',
      data: costCenter
    });
  })
);

// @route   PUT /api/procurement/cost-centers/:id
// @desc    Update cost center
// @access  Private
router.put('/cost-centers/:id',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const costCenter = await CostCenter.findById(req.params.id);
    
    if (!costCenter) {
      return res.status(404).json({ success: false, message: 'Cost center not found' });
    }
    
    const { code, name, description, department, departmentName, location, manager, managerName, budget, budgetPeriod, isActive, notes } = req.body;
    
    if (code && code.toUpperCase() !== costCenter.code) {
      const existingCode = await CostCenter.findOne({ code: code.toUpperCase() });
      if (existingCode) {
        return res.status(400).json({ success: false, message: 'Cost center code already exists' });
      }
      costCenter.code = code.toUpperCase();
    }
    
    if (name) costCenter.name = name;
    if (description !== undefined) costCenter.description = description;
    if (department) costCenter.department = department;
    if (departmentName !== undefined) costCenter.departmentName = departmentName;
    if (location !== undefined) costCenter.location = location;
    if (manager !== undefined) costCenter.manager = manager;
    if (managerName !== undefined) costCenter.managerName = managerName;
    if (budget !== undefined) costCenter.budget = budget;
    if (budgetPeriod) costCenter.budgetPeriod = budgetPeriod;
    if (isActive !== undefined) costCenter.isActive = isActive;
    if (notes !== undefined) costCenter.notes = notes;
    costCenter.updatedBy = req.user.id;
    
    await costCenter.save();
    await costCenter.populate('manager', 'firstName lastName');
    
    res.json({
      success: true,
      message: 'Cost center updated successfully',
      data: costCenter
    });
  })
);

// @route   DELETE /api/procurement/cost-centers/:id
// @desc    Delete cost center
// @access  Private (Admin only)
router.delete('/cost-centers/:id',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const costCenter = await CostCenter.findById(req.params.id);
    
    if (!costCenter) {
      return res.status(404).json({ success: false, message: 'Cost center not found' });
    }
    
    // Check if cost center is used in goods issues
    const GoodsIssue = require('../models/procurement/GoodsIssue');
    const usageCount = await GoodsIssue.countDocuments({ costCenter: costCenter._id });
    
    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete cost center. It is used in ${usageCount} goods issue(s).`
      });
    }
    
    await CostCenter.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Cost center deleted successfully'
    });
  })
);

// ==================== REQUISITIONS ROUTES (Proxy to Indents) ====================

// @route   POST /api/procurement/requisitions/send-email
// @desc    Send requisition to vendors via email
// @access  Private (Procurement and Admin)
router.post('/requisitions/send-email',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('requisitionId').isMongoId().withMessage('Valid requisition ID is required'),
    body('vendorIds').isArray({ min: 1 }).withMessage('At least one vendor must be selected')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { requisitionId, vendorIds } = req.body;

    // Get requisition (indent)
    const indent = await Indent.findById(requisitionId)
      .populate('department', 'name')
      .populate('requestedBy', 'firstName lastName email');

    if (!indent) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Get vendors
    const vendors = await Supplier.find({ _id: { $in: vendorIds } });

    if (vendors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No vendors found'
      });
    }

    // Create quotation invitations and send emails
    const emailService = require('../services/emailService');
    const results = [];

    for (const vendor of vendors) {
      try {
        // Check if invitation already exists
        let invitation = await QuotationInvitation.findOne({
          indent: requisitionId,
          vendor: vendor._id,
          status: 'Pending'
        });

        // Create new invitation if doesn't exist
        if (!invitation) {
          invitation = new QuotationInvitation({
            indent: requisitionId,
            vendor: vendor._id,
            email: vendor.email
          });
          await invitation.save();
        }

        // Send email with invitation token
        const emailResult = await emailService.sendRequisitionEmail(vendor, indent, invitation.token);
        results.push({
          vendorId: vendor._id,
          vendorName: vendor.name,
          email: vendor.email,
          success: emailResult.success,
          messageId: emailResult.messageId,
          invitationId: invitation._id,
          error: emailResult.error
        });
      } catch (error) {
        results.push({
          vendorId: vendor._id,
          vendorName: vendor.name,
          email: vendor.email,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Requisition sent to ${successCount} vendor(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
      data: {
        results,
        summary: {
          total: vendors.length,
          success: successCount,
          failed: failCount
        }
      }
    });
  })
);

// @route   GET /api/procurement/requisitions
// @desc    Get all requisitions (indents) with pagination and filters
// @access  Private (Procurement and Admin)
router.get('/requisitions', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      status,
      search,
      department
    } = req.query;

    const filter = { isActive: true };

    if (status) filter.status = status;
    if (department) filter.department = department;

    if (search) {
      filter.$or = [
        { indentNumber: new RegExp(search, 'i') },
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const skip = (page - 1) * limit;

    const indents = await Indent.find(filter)
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email employeeId')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Indent.countDocuments(filter);

    res.json({
      success: true,
      data: {
        indents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// ==================== PUBLIC QUOTATION ROUTES ====================

// @route   GET /api/procurement/public-quotation/:token
// @desc    Get quotation invitation by token (public)
// @access  Public
router.get('/public-quotation/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  const invitation = await QuotationInvitation.findOne({ token })
    .populate('indent', 'indentNumber title description department items')
    .populate('vendor', 'name email contactPerson phone address')
    .populate('indent.department', 'name')
    .populate('indent.requestedBy', 'firstName lastName');

  if (!invitation) {
    return res.status(404).json({
      success: false,
      message: 'Invalid quotation link'
    });
  }

  // Check if expired
  if (invitation.isExpired()) {
    return res.status(400).json({
      success: false,
      message: 'This quotation link has expired',
      expired: true
    });
  }

  // Check if already submitted
  if (invitation.status === 'Submitted') {
    return res.status(400).json({
      success: false,
      message: 'This quotation has already been submitted',
      submitted: true,
      quotationId: invitation.quotation
    });
  }

  res.json({
    success: true,
    data: {
      invitation: {
        _id: invitation._id,
        token: invitation.token,
        expiresAt: invitation.expiresAt
      },
      requisition: invitation.indent,
      vendor: invitation.vendor
    }
  });
}));

// @route   POST /api/procurement/public-quotation/:token
// @desc    Submit quotation via public form (public)
// @access  Public
router.post('/public-quotation/:token', [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Item quantity must be greater than 0'),
  body('items.*.unit').trim().notEmpty().withMessage('Item unit is required'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be non-negative'),
  body('quotationDate').optional().isISO8601().withMessage('Valid quotation date is required'),
  body('validityDays').optional().isInt({ min: 1 }).withMessage('Validity days must be a positive integer')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { token } = req.params;

  // Find invitation
  const invitation = await QuotationInvitation.findOne({ token })
    .populate('indent')
    .populate('vendor');

  if (!invitation) {
    return res.status(404).json({
      success: false,
      message: 'Invalid quotation link'
    });
  }

  // Check if expired
  if (invitation.isExpired()) {
    return res.status(400).json({
      success: false,
      message: 'This quotation link has expired'
    });
  }

  // Check if already submitted
  if (invitation.status === 'Submitted') {
    return res.status(400).json({
      success: false,
      message: 'This quotation has already been submitted'
    });
  }

  // Calculate item amounts
  const items = req.body.items.map(item => {
    const subtotal = item.quantity * item.unitPrice;
    const discountAmount = item.discount || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * (item.taxRate || 0)) / 100;
    const amount = afterDiscount + taxAmount;
    
    return {
      ...item,
      amount
    };
  });

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountAmount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxAmount = items.reduce((sum, item) => {
    const afterDiscount = (item.quantity * item.unitPrice) - (item.discount || 0);
    return sum + (afterDiscount * (item.taxRate || 0) / 100);
  }, 0);
  const totalAmount = subtotal - discountAmount + taxAmount;

  // Calculate expiry date
  const validityDays = req.body.validityDays || 30;
  const expiryDate = req.body.quotationDate 
    ? new Date(new Date(req.body.quotationDate).getTime() + validityDays * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  // Create quotation
  const quotation = new Quotation({
    indent: invitation.indent._id,
    vendor: invitation.vendor._id,
    quotationDate: req.body.quotationDate ? new Date(req.body.quotationDate) : new Date(),
    expiryDate,
    status: 'Received',
    items,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    validityDays,
    deliveryTime: req.body.deliveryTime || '',
    paymentTerms: req.body.paymentTerms || '',
    notes: req.body.notes || '',
    createdBy: null // Public submission, no user
  });

  await quotation.save();

  // Update invitation
  invitation.status = 'Submitted';
  invitation.submittedAt = new Date();
  invitation.quotation = quotation._id;
  await invitation.save();

  const populatedQuotation = await Quotation.findById(quotation._id)
    .populate('indent', 'indentNumber title')
    .populate('vendor', 'name email phone');

  res.status(201).json({
    success: true,
    message: 'Quotation submitted successfully',
    data: populatedQuotation
  });
}));

// ==================== QUOTATIONS ROUTES ====================

// @route   GET /api/procurement/quotations/by-indent/:indentId
// @desc    Get all quotations for a specific indent/requisition
// @access  Private (Procurement and Admin)
router.get('/quotations/by-indent/:indentId',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { indentId } = req.params;

    const quotations = await Quotation.find({ indent: indentId })
      .populate({
        path: 'indent',
        select: 'indentNumber title items erpRef requestedDate requiredDate department requestedBy',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'requestedBy', select: 'firstName lastName email' }
        ]
      })
      .populate('vendor', 'name email phone contactPerson address')
      .sort({ createdAt: 1 })
      .exec();

    res.json({
      success: true,
      data: quotations
    });
  })
);

// @route   GET /api/procurement/quotations
// @desc    Get all quotations with pagination and filters
// @access  Private (Procurement and Admin)
router.get('/quotations', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      status,
      vendor,
      indent,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (indent) query.indent = indent;

    // Date range filter
    if (startDate || endDate) {
      query.quotationDate = {};
      if (startDate) query.quotationDate.$gte = new Date(startDate);
      if (endDate) query.quotationDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const quotations = await Quotation.find(query)
      .populate('indent', 'indentNumber title')
      .populate('vendor', 'name email phone contactPerson')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Quotation.countDocuments(query);

    res.json({
      success: true,
      data: {
        quotations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/quotations/:id
// @desc    Get quotation by ID
// @access  Private (Procurement and Admin)
router.get('/quotations/:id', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id)
      .populate({
        path: 'indent',
        select: 'indentNumber title items erpRef requestedDate requiredDate department requestedBy justification signatures',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'requestedBy', select: 'firstName lastName email' }
        ]
      })
      .populate('vendor', 'name email phone contactPerson address')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.json({
      success: true,
      data: quotation
    });
  })
);

// @route   POST /api/procurement/quotations
// @desc    Create new quotation
// @access  Private (Procurement and Admin)
router.post('/quotations', [
  body('indent').isMongoId().withMessage('Valid indent ID is required'),
  body('vendor').isMongoId().withMessage('Valid vendor ID is required'),
  body('quotationDate').isISO8601().withMessage('Valid quotation date is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Item quantity must be greater than 0'),
  body('items.*.unit').trim().notEmpty().withMessage('Item unit is required'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Verify indent exists
  const indent = await Indent.findById(req.body.indent);
  if (!indent) {
    return res.status(404).json({
      success: false,
      message: 'Indent not found'
    });
  }

  // Verify vendor exists
  const vendor = await Supplier.findById(req.body.vendor);
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor not found'
    });
  }

  // Calculate item amounts
  const items = req.body.items.map(item => {
    const subtotal = item.quantity * item.unitPrice;
    const discountAmount = item.discount || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * (item.taxRate || 0)) / 100;
    const amount = afterDiscount + taxAmount;
    
    return {
      ...item,
      amount
    };
  });

  const quotation = new Quotation({
    ...req.body,
    items,
    createdBy: req.user.id
  });

  await quotation.save();

  const populatedQuotation = await Quotation.findById(quotation._id)
    .populate('indent', 'indentNumber title')
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    message: 'Quotation created successfully',
    data: populatedQuotation
  });
}));

// @route   PUT /api/procurement/quotations/:id
// @desc    Update quotation
// @access  Private (Procurement and Admin)
router.put('/quotations/:id', [
  body('vendor').optional().isMongoId().withMessage('Valid vendor ID is required'),
  body('quotationDate').optional().isISO8601().withMessage('Valid quotation date is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('status').optional().isIn(['Received', 'Shortlisted', 'Finalized', 'Rejected'])
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) {
    return res.status(404).json({
      success: false,
      message: 'Quotation not found'
    });
  }

  // Prevent editing finalized quotations
  if (quotation.status === 'Finalized' && req.body.status !== 'Finalized') {
    return res.status(400).json({
      success: false,
      message: 'Cannot edit finalized quotations'
    });
  }

  // If items are being updated, recalculate amounts
  if (req.body.items) {
    req.body.items = req.body.items.map(item => {
      const subtotal = item.quantity * item.unitPrice;
      const discountAmount = item.discount || 0;
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = (afterDiscount * (item.taxRate || 0)) / 100;
      const amount = afterDiscount + taxAmount;
      
      return {
        ...item,
        amount
      };
    });
  }

  const wasFinalized = quotation.status === 'Finalized';
  const isBeingFinalized = req.body.status === 'Finalized' && quotation.status !== 'Finalized';

  Object.assign(quotation, req.body);
  quotation.updatedBy = req.user.id;
  
  await quotation.save();

  // Automatically create Purchase Order when quotation is finalized
  if (isBeingFinalized) {
    // Check if PO already exists for this quotation
    const existingPO = await PurchaseOrder.findOne({ quotation: quotation._id });
    
    if (!existingPO) {
      // Populate quotation data for PO creation
      await quotation.populate('indent', 'indentNumber title');
      await quotation.populate('vendor', 'name email phone');

      // Calculate expected delivery date based on delivery time or expiry date
      let expectedDeliveryDate = quotation.expiryDate;
      if (!expectedDeliveryDate && quotation.deliveryTime) {
        // Try to parse delivery time (e.g., "2-3 weeks", "30 days")
        const deliveryMatch = quotation.deliveryTime.match(/(\d+)/);
        if (deliveryMatch) {
          const days = parseInt(deliveryMatch[1]);
          expectedDeliveryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        } else {
          expectedDeliveryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
        }
      }
      if (!expectedDeliveryDate) {
        expectedDeliveryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
      }

      // Create purchase order from quotation
      const purchaseOrder = new PurchaseOrder({
        vendor: quotation.vendor._id,
        indent: quotation.indent?._id || null,
        quotation: quotation._id,
        orderDate: new Date(),
        expectedDeliveryDate,
        status: 'Draft',
        priority: 'Medium',
        items: quotation.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || 0,
          discount: item.discount || 0,
          amount: item.amount
        })),
        shippingCost: 0,
        paymentTerms: quotation.paymentTerms || '',
        notes: `Created from quotation ${quotation.quotationNumber}`,
        internalNotes: `Source: Quotation ${quotation.quotationNumber}, Indent: ${quotation.indent?.indentNumber || 'N/A'}`,
        createdBy: req.user.id
      });

      await purchaseOrder.save();
    }
  }

  const updatedQuotation = await Quotation.findById(quotation._id)
    .populate('indent', 'indentNumber title')
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  const message = isBeingFinalized 
    ? 'Quotation finalized successfully and Purchase Order created automatically'
    : 'Quotation updated successfully';

  res.json({
    success: true,
    message,
    data: updatedQuotation
  });
}));

// @route   DELETE /api/procurement/quotations/:id
// @desc    Delete quotation
// @access  Private (Admin only)
router.delete('/quotations/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id);
    
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Prevent deleting finalized quotations
    if (quotation.status === 'Finalized') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete finalized quotations'
      });
    }

    await Quotation.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Quotation deleted successfully'
    });
  })
);

// @route   POST /api/procurement/quotations/:id/create-po
// @desc    Create purchase order from quotation
// @access  Private (Procurement and Admin)
router.post('/quotations/:id/create-po',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id)
      .populate('indent', 'indentNumber title')
      .populate('vendor', 'name email phone');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    if (quotation.status !== 'Finalized') {
      return res.status(400).json({
        success: false,
        message: 'Only finalized quotations can be converted to purchase orders'
      });
    }

    // Create purchase order from quotation
    const purchaseOrder = new PurchaseOrder({
      vendor: quotation.vendor._id,
      orderDate: new Date(),
      expectedDeliveryDate: quotation.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'Draft',
      priority: 'Medium',
      items: quotation.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        discount: item.discount || 0,
        amount: item.amount
      })),
      shippingCost: 0,
      paymentTerms: quotation.paymentTerms || '',
      notes: `Created from quotation ${quotation.quotationNumber}`,
      internalNotes: `Source: Quotation ${quotation.quotationNumber}, Indent: ${quotation.indent?.indentNumber || 'N/A'}`,
      createdBy: req.user.id
    });

    await purchaseOrder.save();

    // Update quotation status to indicate PO was created
    quotation.updatedBy = req.user.id;
    await quotation.save();

    const populatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Purchase order created from quotation successfully',
      data: populatedOrder
    });
  })
);

module.exports = router;
