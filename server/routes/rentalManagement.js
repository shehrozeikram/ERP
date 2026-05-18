const express = require('express');
const router = express.Router();
const RentalManagement = require('../models/hr/RentalManagement');
const RentalAgreement = require('../models/hr/RentalAgreement');
const User = require('../models/User');
const { createAndEmitNotification } = require('../services/realtimeNotificationService');
const {
  getEligibleUtilityBillApproverUserIds,
  assertUtilityBillApproversEligible
} = require('../utils/utilityBillApproverEligibility');
const { isWorkflowAuditBlockingEditStatus } = require('../utils/workflowAuditQueue');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

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
const getActorId = (req) => String(req?.user?._id || req?.user?.id || '');
const addWorkflowHistory = (record, fromStatus, toStatus, changedBy, comments = '') => {
  if (!Array.isArray(record.workflowHistory)) record.workflowHistory = [];
  record.workflowHistory.push({ fromStatus, toStatus, changedBy, changedAt: new Date(), comments });
};

const populateRentalRecord = (query) => query
  .populate('createdBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('updatedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('rentalAgreement', 'agreementNumber propertyName')
  .populate('approvalChain.approver', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('draftApproverIds', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('approvedByUser', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('rejectedByUser', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('workflowHistory.changedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('observations.addedBy', 'firstName lastName email employeeId digitalSignature approvalStamp')
  .populate('observations.answeredBy', 'firstName lastName email employeeId digitalSignature approvalStamp');

const notifyAuditQueue = async ({ actorId, record }) => {
  const users = await User.find({
    isActive: true,
    role: { $in: ['audit_manager', 'auditor', 'audit_director', 'super_admin', 'admin'] }
  }).select('_id');
  const recipientIds = users.map((u) => String(u._id));
  if (!recipientIds.length) return;
  await createAndEmitNotification({
    recipientIds,
    title: 'Rental management pending Pre Audit',
    message: `Rental record ${record._id} moved to Audit queue. Please review in Pre-Audit.`,
    type: 'info',
    category: 'approval',
    priority: 'high',
    actionUrl: '/audit',
    createdBy: actorId,
    excludeUserId: actorId,
    metadata: {
      module: 'audit',
      entityId: record._id,
      entityType: 'RentalManagement',
      queueStage: 'pending_audit',
      targetModule: 'audit',
      targetTab: 'pre_audit'
    }
  });
};

// Get all rental agreements for dropdown
router.get('/rental-agreements/list', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const agreements = await RentalAgreement.find()
      .select('_id agreementNumber propertyName')
      .sort({ createdAt: -1 });
    
    res.json(agreements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all rental management records
router.get('/', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const records = await populateRentalRecord(RentalManagement.find())
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/approver-candidates', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const eligibleIds = await getEligibleUtilityBillApproverUserIds();
    const filter = { isActive: true, _id: { $in: [...eligibleIds] } };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$and = [
        { _id: { $in: [...eligibleIds] } },
        { $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { employeeId: rx }] }
      ];
      delete filter._id;
    }
    const users = await User.find(filter)
      .select('firstName lastName email employeeId department digitalSignature approvalStamp')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get rental management record by ID
router.get('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'read'), async (req, res) => {
  try {
    const record = await populateRentalRecord(RentalManagement.findById(req.params.id));
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new rental management record
router.post('/', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'create'), async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.approvalChain;
    delete payload.approvalStatus;
    delete payload.approvedByUser;
    delete payload.approvedAt;
    delete payload.rejectedByUser;
    delete payload.rejectedAt;
    delete payload.rejectionReason;
    if (payload.rentalAgreement === '') {
      delete payload.rentalAgreement;
    }
    payload.draftApproverIds = uniqueApproverIds(normalizeApproverIds(req.body.draftApproverIds)).slice(0, 2);
    if (payload.draftApproverIds.length) {
      const approverCheck = await assertUtilityBillApproversEligible(payload.draftApproverIds);
      if (!approverCheck.ok) {
        return res.status(400).json({ success: false, message: approverCheck.message });
      }
    }
    const record = new RentalManagement({
      ...payload,
      createdBy: getActorId(req)
    });
    
    await record.save();
    
    // Populate the saved record
    const populatedRecord = await populateRentalRecord(RentalManagement.findById(record._id));
    
    res.status(201).json(populatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update rental management record
router.put('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const existing = await RentalManagement.findById(req.params.id).select('approvalStatus workflowStatus');
    if (!existing) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    if (existing.approvalStatus === 'Approved' && isWorkflowAuditBlockingEditStatus(existing.workflowStatus)) {
      return res.status(400).json({
        success: false,
        message: 'This record is with audit and cannot be edited until it is returned for correction.'
      });
    }

    const payload = { ...req.body };
    delete payload.approvalChain;
    delete payload.approvalStatus;
    delete payload.approvedByUser;
    delete payload.approvedAt;
    delete payload.rejectedByUser;
    delete payload.rejectedAt;
    delete payload.rejectionReason;
    if (payload.rentalAgreement === '') {
      payload.rentalAgreement = null;
    }
    if (req.body.draftApproverIds !== undefined) {
      payload.draftApproverIds = uniqueApproverIds(normalizeApproverIds(req.body.draftApproverIds)).slice(0, 2);
      if (payload.draftApproverIds.length) {
        const approverCheck = await assertUtilityBillApproversEligible(payload.draftApproverIds);
        if (!approverCheck.ok) {
          return res.status(400).json({ success: false, message: approverCheck.message });
        }
      }
    }
    const record = await RentalManagement.findByIdAndUpdate(
      req.params.id,
      {
        ...payload,
        updatedBy: getActorId(req)
      },
      { new: true, runValidators: true }
    );
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    // Populate the updated record
    const populatedRecord = await populateRentalRecord(RentalManagement.findById(record._id));
    
    res.json(populatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/submit', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const record = await RentalManagement.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rental management record not found' });
    if (!['Draft', 'Rejected'].includes(record.approvalStatus || 'Draft')) {
      return res.status(400).json({ success: false, message: 'Only draft or rejected records can be submitted' });
    }

    const fromBody = normalizeApproverIds(req.body?.approverIds);
    const fromDraft = normalizeApproverIds(record.draftApproverIds || []);
    const approverIds = uniqueApproverIds(fromBody.length ? fromBody : fromDraft);
    if (approverIds.length !== 2) {
      return res.status(400).json({ success: false, message: 'Select Manager Approver and Head Of Department Approver' });
    }
    const actorId = getActorId(req);
    if (actorId && approverIds.includes(actorId)) {
      return res.status(400).json({ success: false, message: 'Requester cannot be selected as Manager or Head Of Department approver' });
    }
    const approverDeptCheck = await assertUtilityBillApproversEligible(approverIds);
    if (!approverDeptCheck.ok) {
      return res.status(400).json({ success: false, message: approverDeptCheck.message });
    }
    const approvers = await User.find({ _id: { $in: approverIds }, isActive: true }).select('_id');
    if (approvers.length !== 2) return res.status(400).json({ success: false, message: 'Selected approval authorities are not valid' });

    const previousStatus = record.approvalStatus || 'Draft';
    record.approvalStatus = 'Submitted';
    record.status = 'Submitted';
    record.approvalChain = approverIds.map((id) => ({ approver: id, status: 'pending' }));
    record.draftApproverIds = [];
    record.approvedByUser = undefined;
    record.approvedAt = undefined;
    record.rejectedByUser = undefined;
    record.rejectedAt = undefined;
    record.rejectionReason = '';
    addWorkflowHistory(record, previousStatus, record.approvalStatus, actorId, 'Submitted for approval');
    await record.save();
    const populated = await populateRentalRecord(RentalManagement.findById(record._id));
    res.json({ success: true, message: 'Rental management record submitted for approval', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/approve-authority', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const record = await RentalManagement.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rental management record not found' });
    if (record.approvalStatus !== 'Submitted') return res.status(400).json({ success: false, message: 'Only submitted records can be approved' });
    const userId = getActorId(req);
    if (String(record.createdBy) === userId) {
      return res.status(403).json({ success: false, message: 'Requester cannot approve Manager or Head Of Department approval authority' });
    }
    const pendingIndex = (record.approvalChain || []).findIndex((step) => String(step.approver) === userId && step.status === 'pending');
    if (pendingIndex === -1) return res.status(403).json({ success: false, message: 'You are not the pending approval authority for this record' });
    record.approvalChain[pendingIndex].status = 'approved';
    record.approvalChain[pendingIndex].actedAt = new Date();

    const previousStatus = record.approvalStatus;
    const allApproved = (record.approvalChain || []).every((step) => step.status === 'approved');
    if (allApproved) {
      record.approvalStatus = 'Approved';
      record.status = 'Approved';
      record.approvedByUser = userId;
      record.approvedAt = new Date();
      const previousWorkflowStatus = record.workflowStatus || 'Draft';
      record.workflowStatus = 'Send to Audit';
      addWorkflowHistory(record, previousWorkflowStatus, record.workflowStatus, userId, 'Sent to Pre-Audit after approval authority completed');
    }
    addWorkflowHistory(record, previousStatus, record.approvalStatus, userId, allApproved ? 'Approved' : 'Approval authority approved');
    await record.save();
    if (allApproved) await notifyAuditQueue({ actorId: userId, record });
    const populated = await populateRentalRecord(RentalManagement.findById(record._id));
    res.json({ success: true, message: 'Rental management record approved', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/reject-authority', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const reason = String(req.body?.rejectionReason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    const record = await RentalManagement.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rental management record not found' });
    if (record.approvalStatus !== 'Submitted') return res.status(400).json({ success: false, message: 'Only submitted records can be rejected' });
    const userId = getActorId(req);
    if (String(record.createdBy) === userId) {
      return res.status(403).json({ success: false, message: 'Requester cannot reject Manager or Head Of Department approval authority' });
    }
    const pendingIndex = (record.approvalChain || []).findIndex((step) => String(step.approver) === userId && step.status === 'pending');
    if (pendingIndex === -1) return res.status(403).json({ success: false, message: 'You are not the pending approval authority for this record' });

    record.approvalChain[pendingIndex].status = 'rejected';
    record.approvalChain[pendingIndex].actedAt = new Date();
    record.approvalChain[pendingIndex].comment = reason;
    const previousStatus = record.approvalStatus;
    record.approvalStatus = 'Rejected';
    record.status = 'Rejected';
    record.rejectedByUser = userId;
    record.rejectedAt = new Date();
    record.rejectionReason = reason;
    addWorkflowHistory(record, previousStatus, record.approvalStatus, userId, reason);
    await record.save();
    const populated = await populateRentalRecord(RentalManagement.findById(record._id));
    res.json({ success: true, message: 'Rental management record rejected', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/resend-to-audit', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const record = await RentalManagement.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Rental management record not found' });
    }
    if (record.workflowStatus !== 'Returned from Audit') {
      return res.status(400).json({
        success: false,
        message: 'Only records returned from audit can be sent back to Pre-Audit.'
      });
    }
    if (record.approvalStatus !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Record must be approved by internal authorities before it can re-enter the audit queue.'
      });
    }

    const actorId = getActorId(req);
    const observationAnswers = req.body?.observationAnswers;

    if (Array.isArray(observationAnswers)) {
      for (const entry of observationAnswers) {
        const oid = entry?.observationId;
        const text = String(entry?.answer || '').trim();
        if (!oid || !text) continue;
        try {
          const sub = record.observations.id(oid);
          if (sub) {
            sub.answer = text;
            sub.answeredBy = actorId;
            sub.answeredAt = new Date();
            sub.resolved = true;
          }
        } catch (e) {
          // ignore invalid subdocument ids
        }
      }
    }

    const previousWorkflow = record.workflowStatus;
    record.workflowStatus = 'Send to Audit';
    const note = String(req.body?.resubmitComments || '').trim();
    addWorkflowHistory(
      record,
      previousWorkflow,
      record.workflowStatus,
      actorId,
      note ? `Resent to Pre-Audit: ${note}` : 'Resent to Pre-Audit after corrections'
    );
    record.updatedBy = actorId;
    await record.save();
    const populated = await populateRentalRecord(RentalManagement.findById(record._id));
    await notifyAuditQueue({ actorId, record: populated });
    res.json({ success: true, message: 'Record sent back to the Pre-Audit queue.', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to resend to audit' });
  }
});

// Delete rental management record
router.delete('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'delete'), async (req, res) => {
  try {
    const record = await RentalManagement.findByIdAndDelete(req.params.id);
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json({ message: 'Rental management record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Update status of rental management record
router.put('/:id/status', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_management', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const record = await RentalManagement.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    if (!record) {
      return res.status(404).json({ message: 'Rental management record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
