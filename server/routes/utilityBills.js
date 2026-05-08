const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const UtilityBill = require('../models/hr/UtilityBill');
const User = require('../models/User');
const { createAndEmitNotification } = require('../services/realtimeNotificationService');

const populateUtilityBill = (query) => query
  .populate('createdBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('draftApproverIds', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('approvedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('rejectedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('workflowHistory.changedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('observations.addedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('observations.answeredBy', 'firstName lastName email employeeId digitalSignature approvalStamp');

const populateUtilityBillDocument = async (bill) => {
  await bill.populate([
    { path: 'createdBy', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'approvalChain.approver', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'draftApproverIds', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'approvedBy', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'rejectedBy', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'workflowHistory.changedBy', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'observations.addedBy', select: 'firstName lastName email employeeId digitalSignature approvalStamp' },
    { path: 'observations.answeredBy', select: 'firstName lastName email employeeId digitalSignature approvalStamp' }
  ]);
  return bill;
};

const addWorkflowHistory = (bill, fromStatus, toStatus, changedBy, comments = '') => {
  if (!Array.isArray(bill.workflowHistory)) bill.workflowHistory = [];
  bill.workflowHistory.push({
    fromStatus,
    toStatus,
    changedBy,
    changedAt: new Date(),
    comments
  });
};

const notifyAuditQueue = async ({ actorId, bill }) => {
  const users = await User.find({
    isActive: true,
    role: { $in: ['audit_manager', 'auditor', 'audit_director', 'super_admin', 'admin'] }
  }).select('_id');
  const recipientIds = users.map((user) => String(user._id));
  if (!recipientIds.length) return;

  await createAndEmitNotification({
    recipientIds,
    title: 'Utility bill pending Pre Audit',
    message: `Utility Bill ${bill.billId || bill._id} moved to Audit queue. Please review in Pre-Audit.`,
    type: 'info',
    category: 'approval',
    priority: 'high',
    actionUrl: '/audit',
    createdBy: actorId,
    excludeUserId: actorId,
    metadata: {
      module: 'audit',
      entityId: bill._id,
      entityType: 'UtilityBill',
      queueStage: 'pending_audit',
      targetModule: 'audit',
      targetTab: 'pre_audit'
    }
  });
};

const normalizeApproverIds = (value) => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return [value].map(String).filter(Boolean);
    }
  }
  return [];
};

const uniqueApproverIds = (ids = []) => [...new Set(ids.map(String).filter(Boolean))];

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/utility-bills');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bill-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Apply authentication middleware
router.use(authMiddleware);

// Get all utility bills with optional filters
router.get('/', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const { 
      search, 
      utilityType, 
      status, 
      provider,
      accountHead,
      site,
      location,
      department,
      custodian,
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query
    const query = {};
    
    if (utilityType) query.utilityType = utilityType;
    if (status) query.status = status;
    if (provider) query.provider = { $regex: provider, $options: 'i' };
    if (accountHead) query.accountHead = accountHead;
    if (site) query.site = { $regex: site, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };
    if (department) query.department = { $regex: department, $options: 'i' };
    if (custodian) query.custodian = { $regex: custodian, $options: 'i' };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const bills = await populateUtilityBill(UtilityBill.find(query))
      .sort({ billDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UtilityBill.countDocuments(query);

    // Filter by search term if provided
    let filteredBills = bills;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBills = bills.filter(bill => 
        bill.billId?.toLowerCase().includes(searchLower) ||
        bill.provider?.toLowerCase().includes(searchLower) ||
        bill.accountNumber?.toLowerCase().includes(searchLower) ||
        bill.description?.toLowerCase().includes(searchLower) ||
        bill.forWhat?.toLowerCase().includes(searchLower) ||
        bill.accountHead?.toLowerCase().includes(searchLower) ||
        bill.site?.toLowerCase().includes(searchLower) ||
        bill.location?.toLowerCase().includes(searchLower) ||
        bill.department?.toLowerCase().includes(searchLower) ||
        bill.custodian?.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: filteredBills,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching utility bills:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch utility bills' });
  }
});

// Get utility bills by type
router.get('/by-type/:utilityType', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const { utilityType } = req.params;
    const { status = 'Pending' } = req.query;

    const query = { 
      utilityType,
      status 
    };

    const bills = await populateUtilityBill(UtilityBill.find(query))
      .sort({ billDate: -1 });

    res.json({
      success: true,
      data: bills,
      count: bills.length,
      utilityType,
      status
    });

  } catch (error) {
    console.error('Error fetching utility bills by type:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch utility bills by type',
      error: error.message 
    });
  }
});

// Get utility bills summary by type
router.get('/summary', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const summary = await UtilityBill.aggregate([
      {
        $group: {
          _id: '$utilityType',
          total: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          paidAmount: { $sum: '$paidAmount' },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
          },
          paid: {
            $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] }
          },
          overdue: {
            $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] }
          },
          partial: {
            $sum: { $cond: [{ $eq: ['$status', 'Partial'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get monthly totals
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const monthlySummary = await UtilityBill.aggregate([
      {
        $match: {
          billDate: { $gte: currentMonth, $lt: nextMonth }
        }
      },
      {
        $group: {
          _id: null,
          monthlyTotal: { $sum: '$amount' },
          monthlyPaid: { $sum: '$paidAmount' },
          monthlyBills: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byType: summary,
        monthly: monthlySummary[0] || { monthlyTotal: 0, monthlyPaid: 0, monthlyBills: 0 }
      }
    });

  } catch (error) {
    console.error('Error fetching utility bills summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch utility bills summary',
      error: error.message 
    });
  }
});

// Get overdue bills
router.get('/overdue', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const bills = await populateUtilityBill(UtilityBill.find({ 
      status: 'Overdue',
      dueDate: { $lt: new Date() }
    }))
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching overdue bills:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue bills',
      error: error.message
    });
  }
});

// Get pending bills
router.get('/pending', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const bills = await populateUtilityBill(UtilityBill.find({ status: 'Pending' }))
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching pending bills:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending bills',
      error: error.message
    });
  }
});

// Get active users for approval authority selection
router.get('/approver-candidates', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = { isActive: true };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { firstName: rx },
        { lastName: rx },
        { email: rx },
        { employeeId: rx }
      ];
    }

    const users = await User.find(filter)
      .select('firstName lastName email employeeId department')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching utility bill approvers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch approvers' });
  }
});

// Get single utility bill
router.get('/:id', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const bill = await populateUtilityBill(UtilityBill.findById(req.params.id));

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error fetching utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch utility bill' });
  }
});

// Create new utility bill
router.post('/', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'create'), upload.single('billImage'), async (req, res) => {
  try {
    const billData = {
      ...req.body,
      createdBy: req.user._id
    };
    delete billData.approvalChain;
    delete billData.approvalStatus;
    delete billData.approvedBy;
    delete billData.approvedAt;
    delete billData.rejectedBy;
    delete billData.rejectedAt;
    delete billData.workflowHistory;
    delete billData.auditStatus;
    delete billData.observations;
    delete billData.updatedBy;
    billData.draftApproverIds = uniqueApproverIds(normalizeApproverIds(req.body.draftApproverIds)).slice(0, 2);

    // Add image path if uploaded
    if (req.file) {
      billData.billImage = `/uploads/utility-bills/${req.file.filename}`;
    } else {
      // Ensure billImage is not an empty object
      delete billData.billImage;
    }

    // Convert string values to appropriate types
    if (billData.amount) billData.amount = parseFloat(billData.amount);
    if (billData.paidAmount) billData.paidAmount = parseFloat(billData.paidAmount);
    if (billData.lastMonthAmount) billData.lastMonthAmount = parseFloat(billData.lastMonthAmount);
    if (billData.balanceAmount) billData.balanceAmount = parseFloat(billData.balanceAmount);
    if (billData.grandTotal) billData.grandTotal = parseFloat(billData.grandTotal);
    if (!billData.grandTotal && billData.amount) {
      billData.grandTotal = billData.amount || 0;
    }
    if (!billData.balanceAmount && billData.grandTotal) {
      billData.balanceAmount = Math.max((billData.grandTotal || 0) - (billData.lastMonthAmount || 0), 0);
    }
    if (billData.billDate) billData.billDate = new Date(billData.billDate);
    if (billData.dueDate) billData.dueDate = new Date(billData.dueDate);

    const bill = new UtilityBill(billData);
    await bill.save();

    await populateUtilityBillDocument(bill);

    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bill ID already exists'
      });
    }
    console.error('Error creating utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to create utility bill' });
  }
});

// Update utility bill
router.put('/:id', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), upload.single('billImage'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.approvalChain;
    delete updateData.approvalStatus;
    delete updateData.approvedBy;
    delete updateData.approvedAt;
    delete updateData.rejectedBy;
    delete updateData.rejectedAt;
    delete updateData.workflowHistory;
    delete updateData.auditStatus;
    delete updateData.observations;
    delete updateData.updatedBy;
    if (req.body.draftApproverIds !== undefined) {
      updateData.draftApproverIds = uniqueApproverIds(normalizeApproverIds(req.body.draftApproverIds)).slice(0, 2);
    }

    // Add image path if uploaded
    if (req.file) {
      updateData.billImage = `/uploads/utility-bills/${req.file.filename}`;
    } else if (updateData.billImage === '{}' || updateData.billImage === '') {
      // Remove empty billImage field
      delete updateData.billImage;
    }

    // Convert string values to appropriate types
    if (updateData.amount) updateData.amount = parseFloat(updateData.amount);
    if (updateData.paidAmount) updateData.paidAmount = parseFloat(updateData.paidAmount);
    if (updateData.lastMonthAmount) updateData.lastMonthAmount = parseFloat(updateData.lastMonthAmount);
    if (updateData.balanceAmount) updateData.balanceAmount = parseFloat(updateData.balanceAmount);
    if (updateData.grandTotal) updateData.grandTotal = parseFloat(updateData.grandTotal);
    if (!updateData.grandTotal && updateData.amount) {
      updateData.grandTotal = updateData.amount || 0;
    }
    if (!updateData.balanceAmount && updateData.grandTotal) {
      updateData.balanceAmount = Math.max((updateData.grandTotal || 0) - (updateData.lastMonthAmount || 0), 0);
    }
    if (updateData.billDate) updateData.billDate = new Date(updateData.billDate);
    if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);

    const bill = await UtilityBill.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    await populateUtilityBillDocument(bill);

    res.json({ success: true, data: bill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bill ID already exists'
      });
    }
    console.error('Error updating utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to update utility bill' });
  }
});

// Submit utility bill for approval
router.post('/:id/submit', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), async (req, res) => {
  try {
    const bill = await UtilityBill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    if (!['Draft', 'Rejected'].includes(bill.approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Only draft or rejected bills can be submitted' });
    }

    const fromBody = normalizeApproverIds(req.body?.approverIds);
    const fromDraft = normalizeApproverIds(bill.draftApproverIds || []);
    const approverIds = uniqueApproverIds(fromBody.length ? fromBody : fromDraft);

    if (approverIds.length !== 2) {
      return res.status(400).json({ success: false, message: 'Select Manager Approver and Head Of Department Approver' });
    }

    if (approverIds.includes(req.user._id.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Requester cannot be selected as Manager or Head Of Department approver'
      });
    }

    const approvers = await User.find({ _id: { $in: approverIds }, isActive: true }).select('_id');
    if (approvers.length !== 2) {
      return res.status(400).json({ success: false, message: 'Selected approval authorities are not valid' });
    }

    const previousStatus = bill.approvalStatus;
    bill.approvalStatus = 'Submitted';
    bill.approvalChain = approverIds.map((approverId) => ({ approver: approverId, status: 'pending' }));
    bill.draftApproverIds = [];
    bill.approvedBy = undefined;
    bill.approvedAt = undefined;
    bill.rejectedBy = undefined;
    bill.rejectedAt = undefined;
    bill.rejectionReason = '';
    addWorkflowHistory(bill, previousStatus, bill.approvalStatus, req.user._id, 'Submitted for approval');
    await bill.save();
    await populateUtilityBillDocument(bill);

    res.json({ success: true, message: 'Utility bill submitted for approval', data: bill });
  } catch (error) {
    console.error('Error submitting utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to submit utility bill' });
  }
});

// Approve utility bill
router.post('/:id/approve', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), async (req, res) => {
  try {
    const bill = await UtilityBill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    if (bill.approvalStatus !== 'Submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted bills can be approved' });
    }

    const userId = req.user._id.toString();
    if (bill.createdBy?.toString() === userId) {
      return res.status(403).json({
        success: false,
        message: 'Requester cannot approve Manager or Head Of Department approval authority'
      });
    }
    const pendingIndex = (bill.approvalChain || []).findIndex((step) => (
      step.approver?.toString() === userId && step.status === 'pending'
    ));

    if (pendingIndex === -1) {
      return res.status(403).json({ success: false, message: 'You are not the pending approval authority for this bill' });
    }

    bill.approvalChain[pendingIndex].status = 'approved';
    bill.approvalChain[pendingIndex].actedAt = new Date();

    const previousStatus = bill.approvalStatus;
    const allApproved = (bill.approvalChain || []).every((step) => step.status === 'approved');
    if (allApproved) {
      bill.approvalStatus = 'Approved';
      bill.approvedBy = req.user._id;
      bill.approvedAt = new Date();
      const previousAuditStatus = bill.auditStatus || 'Not Sent';
      bill.auditStatus = 'Send to Audit';
      addWorkflowHistory(bill, previousAuditStatus, bill.auditStatus, req.user._id, 'Sent to Pre-Audit after approval authority completed');
    }
    addWorkflowHistory(bill, previousStatus, bill.approvalStatus, req.user._id, allApproved ? 'Approved' : 'Approval authority approved');
    await bill.save();
    if (allApproved) {
      await notifyAuditQueue({ actorId: req.user._id, bill });
    }
    await populateUtilityBillDocument(bill);

    res.json({ success: true, message: 'Utility bill approved', data: bill });
  } catch (error) {
    console.error('Error approving utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to approve utility bill' });
  }
});

// Reject utility bill
router.post('/:id/reject', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), async (req, res) => {
  try {
    const reason = String(req.body?.rejectionReason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const bill = await UtilityBill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    if (bill.approvalStatus !== 'Submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted bills can be rejected' });
    }

    const userId = req.user._id.toString();
    if (bill.createdBy?.toString() === userId) {
      return res.status(403).json({
        success: false,
        message: 'Requester cannot reject Manager or Head Of Department approval authority'
      });
    }
    const pendingIndex = (bill.approvalChain || []).findIndex((step) => (
      step.approver?.toString() === userId && step.status === 'pending'
    ));

    if (pendingIndex === -1) {
      return res.status(403).json({ success: false, message: 'You are not the pending approval authority for this bill' });
    }

    bill.approvalChain[pendingIndex].status = 'rejected';
    bill.approvalChain[pendingIndex].actedAt = new Date();
    bill.approvalChain[pendingIndex].comment = reason;

    const previousStatus = bill.approvalStatus;
    bill.approvalStatus = 'Rejected';
    bill.rejectedBy = req.user._id;
    bill.rejectedAt = new Date();
    bill.rejectionReason = reason;
    addWorkflowHistory(bill, previousStatus, bill.approvalStatus, req.user._id, reason);
    await bill.save();
    await populateUtilityBillDocument(bill);

    res.json({ success: true, message: 'Utility bill rejected', data: bill });
  } catch (error) {
    console.error('Error rejecting utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to reject utility bill' });
  }
});

// Record payment
router.put('/:id/payment', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), async (req, res) => {
  try {
    const { paidAmount, paymentMethod, paymentDate, notes } = req.body;

    const bill = await UtilityBill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Utility bill not found'
      });
    }

    bill.paidAmount = paidAmount;
    bill.paymentMethod = paymentMethod;
    bill.paymentDate = paymentDate || new Date();
    if (notes) bill.notes = notes;
    
    await bill.save();

    const populatedBill = await populateUtilityBill(UtilityBill.findById(bill._id));

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: populatedBill
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording payment',
      error: error.message
    });
  }
});

// Delete utility bill
router.delete('/:id', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'delete'), async (req, res) => {
  try {
    const bill = await UtilityBill.findByIdAndDelete(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Utility bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Utility bill deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting utility bill:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting utility bill',
      error: error.message
    });
  }
});

module.exports = router;
