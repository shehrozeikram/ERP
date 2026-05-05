/**
 * Cash Approval Routes
 * Full workflow: Draft → Audit → CEO → Finance (Advance) → Procurement (Evidence) → Finance (Settle) → Procurement → Completed
 */
const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const CashApproval = require('../models/procurement/CashApproval');
const Quotation = require('../models/procurement/Quotation');
const Indent = require('../models/general/Indent');
const User = require('../models/User');
const { createAndEmitNotification } = require('../services/realtimeNotificationService');

const FinanceHelper = require('../utils/financeHelper');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeRoleLabel = (v) => String(v || '').trim().toLowerCase();
const looksLikeAuditDirectorLabel = (value) => {
  const normalized = normalizeRoleLabel(value).replace(/[-\s]+/g, '_');
  return normalized.includes('audit') && normalized.includes('director');
};

const userHasRoleName = (user, names = []) => {
  const accepted = names.map(normalizeRoleLabel);
  if (!user || !accepted.length) return false;
  if (accepted.includes(normalizeRoleLabel(user.role))) return true;
  const collect = (r) => [normalizeRoleLabel(r?.name), normalizeRoleLabel(r?.displayName)].filter(Boolean);
  if (collect(user.roleRef || {}).some((n) => accepted.includes(n))) return true;
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      if (collect(r).some((n) => accepted.includes(n))) return true;
    }
  }
  return false;
};

const hasModuleAccess = (roleDoc, moduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((p) => p?.module === moduleKey);
};

const hasAuditAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'audit_manager', 'auditor', 'audit_director'].includes(user.role)) return true;
  if (hasModuleAccess(user.roleRef, 'audit')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'audit'))) return true;
  return false;
};

const isAuditDirectorUser = (user) => {
  if (!user) return false;
  if (['audit_director', 'Audit Director'].includes(user.role)) return true;
  if (looksLikeAuditDirectorLabel(user.role)) return true;
  if (looksLikeAuditDirectorLabel(user?.roleRef?.name) || looksLikeAuditDirectorLabel(user?.roleRef?.displayName)) return true;
  if (Array.isArray(user?.roles) && user.roles.some((r) => looksLikeAuditDirectorLabel(r?.name) || looksLikeAuditDirectorLabel(r?.displayName))) {
    return true;
  }
  return userHasRoleName(user, ['audit_director', 'audit director']);
};

const hasFinanceAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'finance_manager'].includes(user.role)) return true;
  if (hasModuleAccess(user.roleRef, 'finance')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'finance'))) return true;
  return false;
};

const hasProcurementAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'procurement_manager'].includes(user.role)) return true;
  if (hasModuleAccess(user.roleRef, 'procurement')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'procurement'))) return true;
  return false;
};

const hasCeoSecretariatAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'hr_manager', 'higher_management'].includes(user.role)) return true;
  if (hasModuleAccess(user.roleRef, 'hr') || hasModuleAccess(user.roleRef, 'general')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'hr') || hasModuleAccess(r, 'general'))) return true;
  return false;
};

const isAssignedComparativeAuthorityUser = async (indentId, userId) => {
  if (!indentId || !userId) return false;
  const indent = await Indent.findById(indentId)
    .select('comparativeStatementApprovals comparativeApproval')
    .lean();
  if (!indent) return false;
  const uid = String(userId);
  const csa = indent.comparativeStatementApprovals || {};
  const authorityIds = [
    csa.preparedByUser,
    csa.verifiedByUser,
    csa.authorisedRepUser,
    csa.financeRepUser,
    csa.managerProcurementUser
  ]
    .map((id) => String(id || ''))
    .filter(Boolean);
  if (authorityIds.includes(uid)) return true;

  const steps = Array.isArray(indent?.comparativeApproval?.approvers) ? indent.comparativeApproval.approvers : [];
  return steps.some((s) => String(s?.approver?._id || s?.approver || '') === uid);
};

const normalizeToken = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const AUTHORITY_SLOT_CONFIG = [
  { key: 'preparedBy', label: 'Prepared By', indentUserField: 'preparedByUser' },
  { key: 'verifiedBy', label: 'Verified By (Procurement Committee)', indentUserField: 'verifiedByUser' },
  { key: 'authorisedRep', label: 'Authorised Rep.', indentUserField: 'authorisedRepUser' },
  { key: 'financeRep', label: 'Finance Rep.', indentUserField: 'financeRepUser' },
  { key: 'managerProcurement', label: 'Manager Procurement', indentUserField: 'managerProcurementUser' }
];
const getUserIdentityTokens = (user) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return [...new Set([
    normalizeToken(fullName),
    normalizeToken(user?.email),
    normalizeToken(user?.employeeId)
  ].filter(Boolean))];
};
const isAssignedByAuthorityText = (approvalAuthorities, user) => {
  const authorities = approvalAuthorities || {};
  const assignedTexts = [
    authorities.preparedBy,
    authorities.verifiedBy,
    authorities.authorisedRep,
    authorities.financeRep,
    authorities.managerProcurement
  ].map(normalizeToken).filter(Boolean);
  if (!assignedTexts.length) return false;
  const tokens = getUserIdentityTokens(user);
  return tokens.some((t) => assignedTexts.includes(t));
};
const getRequiredAuthoritySlots = async (indentId, approvalAuthorities = {}) => {
  const indent = indentId
    ? await Indent.findById(indentId).select('comparativeStatementApprovals').lean()
    : null;
  const csa = indent?.comparativeStatementApprovals || {};
  return AUTHORITY_SLOT_CONFIG.map((slot) => {
    const userId = String(csa?.[slot.indentUserField] || '').trim();
    const textToken = normalizeToken(approvalAuthorities?.[slot.key]);
    if (!userId && !textToken) return null;
    return { ...slot, userId: userId || '', textToken: textToken || '' };
  }).filter(Boolean);
};
const matchUserToAuthoritySlots = (requiredSlots, user) => {
  const uid = String(user?.id || user?._id || '').trim();
  const tokens = getUserIdentityTokens(user);
  return requiredSlots.filter((slot) => {
    if (slot.userId && uid && slot.userId === uid) return true;
    if (slot.textToken && tokens.includes(slot.textToken)) return true;
    return false;
  });
};

const getAssignedIndentIdsForUser = async (userId) => {
  if (!userId) return [];
  const uid = String(userId);
  const indents = await Indent.find({
    $or: [
      { 'comparativeStatementApprovals.preparedByUser': uid },
      { 'comparativeStatementApprovals.verifiedByUser': uid },
      { 'comparativeStatementApprovals.authorisedRepUser': uid },
      { 'comparativeStatementApprovals.financeRepUser': uid },
      { 'comparativeStatementApprovals.managerProcurementUser': uid },
      { 'comparativeApproval.approvers.approver': uid }
    ]
  }).select('_id').lean();
  return indents.map((i) => i._id);
};

const normalizeIds = (ids = []) => [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];

const getUserIdsByRoles = async (roles = []) => {
  const users = await User.find({ isActive: true, role: { $in: roles } }).select('_id');
  return users.map((u) => String(u._id));
};
const getUserIdsByDepartment = async (dept) => {
  if (!dept) return [];
  const users = await User.find({ isActive: true, department: { $regex: `^${String(dept)}$`, $options: 'i' } }).select('_id');
  return users.map((u) => String(u._id));
};
const getAuditRecipients = async () => {
  const a = await getUserIdsByDepartment('audit');
  const b = await getUserIdsByRoles(['audit_manager', 'auditor', 'audit_director', 'admin', 'super_admin']);
  return [...new Set([...a, ...b])];
};
const getCeoSecretariatRecipients = async () => {
  const a = await getUserIdsByRoles(['hr_manager', 'admin', 'super_admin']);
  const b = await getUserIdsByDepartment('hr');
  return [...new Set([...a, ...b])];
};
const getCeoRecipients = async () => {
  const byRole = await getUserIdsByRoles(['higher_management', 'admin', 'super_admin']);
  return [...new Set(byRole)];
};
const getFinanceRecipients = async () => {
  const a = await getUserIdsByDepartment('finance');
  const b = await getUserIdsByRoles(['finance_manager', 'admin', 'super_admin']);
  return [...new Set([...a, ...b])];
};
const getProcurementRecipients = async () => {
  const a = await getUserIdsByDepartment('procurement');
  const b = await getUserIdsByRoles(['procurement_manager', 'admin', 'super_admin']);
  return [...new Set([...a, ...b])];
};

const notify = async ({ recipientIds, actorId, title, message, actionUrl, entityId, entityType = 'CashApproval', module = 'procurement', metadata = {} }) => {
  const ids = normalizeIds(recipientIds).filter((id) => id !== String(actorId || ''));
  if (!ids.length) return;
  await createAndEmitNotification({
    recipientIds: ids,
    title,
    message,
    type: 'info',
    category: 'approval',
    priority: 'high',
    actionUrl,
    entityId,
    entityType,
    module,
    metadata
  });
};

const pushHistory = (ca, from, to, userId, comments, module) => {
  ca.workflowHistory.push({ fromStatus: from, toStatus: to, changedBy: userId, changedAt: new Date(), comments: comments || '', module: module || 'Procurement' });
};

function buildCAChangeSummary(currentItems, snapshot) {
  if (!snapshot || !Array.isArray(snapshot.items)) return '';
  const prev = snapshot.items;
  const curr = currentItems || [];
  const lines = [];
  const maxLen = Math.max(prev.length, curr.length);
  for (let i = 0; i < maxLen; i++) {
    const p = prev[i];
    const c = curr[i];
    const desc = (c || p)?.description || `Item ${i + 1}`;
    if (!p && c) {
      lines.push(`• Added: "${desc}" — Quantity ${c.quantity || 0} ${(c.unit || '').trim() || 'units'}, Rate ${c.unitPrice != null ? c.unitPrice : '—'}, Amount ${c.amount != null ? c.amount : '—'}`);
      continue;
    }
    if (p && !c) {
      lines.push(`• Removed: "${desc}" (was Quantity ${p.quantity} ${(p.unit || '').trim() || 'units'})`);
      continue;
    }
    if (!p || !c) continue;
    const qtyChange = Number(p.quantity) !== Number(c.quantity);
    const rateChange = (p.unitPrice != null && c.unitPrice != null && Number(p.unitPrice) !== Number(c.unitPrice));
    const amtChange = (p.amount != null && c.amount != null && Number(p.amount) !== Number(c.amount));
    if (qtyChange) {
      lines.push(`• "${desc}": Quantity changed from ${p.quantity} to ${c.quantity}${(c.unit || p.unit) ? ` ${String(c.unit || p.unit).trim()}` : ''}`);
    }
    if (rateChange) {
      lines.push(`• "${desc}": Unit price changed from ${p.unitPrice} to ${c.unitPrice}`);
    }
    if (amtChange && !qtyChange && !rateChange) {
      lines.push(`• "${desc}": Amount changed from ${p.amount} to ${c.amount}`);
    }
  }
  const totalPrev = snapshot.totalAmount != null ? Number(snapshot.totalAmount) : null;
  const totalCurr = curr.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  if (totalPrev != null && Math.abs(totalCurr - totalPrev) > 0.01) {
    lines.push(`• Total amount changed from ${totalPrev} to ${totalCurr}`);
  }
  return lines.length ? lines.join('\n') : '';
}

const indentWithComparativePopulate = {
  path: 'indent',
  select: 'indentNumber title erpRef requestedDate requiredDate department requestedBy items notes justification approvalChain signatures comparativeStatementApprovals comparativeApproval',
  populate: [
    { path: 'department', select: 'name code' },
    { path: 'requestedBy', select: 'firstName lastName email digitalSignature' },
    { path: 'approvalChain.approver', select: 'firstName lastName email digitalSignature' },
    { path: 'comparativeStatementApprovals.preparedByUser', select: 'firstName lastName email employeeId digitalSignature' },
    { path: 'comparativeStatementApprovals.verifiedByUser', select: 'firstName lastName email employeeId digitalSignature' },
    { path: 'comparativeStatementApprovals.authorisedRepUser', select: 'firstName lastName email employeeId digitalSignature' },
    { path: 'comparativeStatementApprovals.financeRepUser', select: 'firstName lastName email employeeId digitalSignature' },
    { path: 'comparativeStatementApprovals.managerProcurementUser', select: 'firstName lastName email employeeId digitalSignature' },
    { path: 'comparativeApproval.approvers.approver', select: 'firstName lastName email employeeId digitalSignature' }
  ]
};

const fullPopulate = (q) => q
  .populate('vendor', 'name email phone')
  .populate(indentWithComparativePopulate)
  .populate('quotation', 'quotationNumber')
  .populate('createdBy', 'firstName lastName email')
  .populate('updatedBy', 'firstName lastName email')
  .populate('authorityApprovals.approver', 'firstName lastName email employeeId digitalSignature')
  .populate('authorityApprovedBy', 'firstName lastName email employeeId digitalSignature')
  .populate('advanceTo', 'firstName lastName email')
  .populate('advanceIssuedBy', 'firstName lastName email')
  .populate('evidenceSubmittedBy', 'firstName lastName email')
  .populate('settledBy', 'firstName lastName email')
  .populate('sentToProcurementBy', 'firstName lastName email')
  .populate('completedBy', 'firstName lastName email')
  .populate('auditApprovedBy', 'firstName lastName email digitalSignature')
  .populate('preAuditInitialApprovedBy', 'firstName lastName email digitalSignature')
  .populate('auditObservations.addedBy', 'firstName lastName email')
  .populate('auditObservations.answeredBy', 'firstName lastName email')
  .populate('ceoApprovedBy', 'firstName lastName email')
  .populate('ceoForwardedBy', 'firstName lastName email')
  .populate('workflowHistory.changedBy', 'firstName lastName email digitalSignature');

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// GET /api/cash-approvals
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status = '', vendor = '', priority = '' } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;
  if (priority) filter.priority = priority;
  if (search) {
    filter.$or = [
      { caNumber: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } }
    ];
  }
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [data, total] = await Promise.all([
    fullPopulate(CashApproval.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))),
    CashApproval.countDocuments(filter)
  ]);
  res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
}));

// GET /api/cash-approvals/statistics
router.get('/statistics', authMiddleware, asyncHandler(async (req, res) => {
  const stats = await CashApproval.getStatistics();
  res.json({ success: true, data: stats });
}));

// GET /api/cash-approvals/pending-finance  (for Finance view)
router.get('/pending-finance', authMiddleware, asyncHandler(async (req, res) => {
  const data = await fullPopulate(
    CashApproval.find({ status: { $in: ['Pending Finance', 'Advance Issued', 'Evidence Submitted', 'Payment Settled'] } }).sort({ createdAt: -1 })
  );
  res.json({ success: true, data });
}));

// GET /api/cash-approvals/ceo-secretariat — same queue stages as PO (Payments / CEO flow)
router.get('/ceo-secretariat',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const isCeoQueueUser = hasCeoSecretariatAccess(req.user);
    let filter = {
      status: { $in: ['Send to CEO Office', 'Forwarded to CEO', 'Returned from CEO Office'] }
    };
    if (!isCeoQueueUser) {
      const indentIds = await getAssignedIndentIdsForUser(req.user.id);
      const tokens = getUserIdentityTokens(req.user);
      const authorityTextConditions = tokens.length ? [
        { 'approvalAuthorities.preparedBy': { $in: tokens } },
        { 'approvalAuthorities.verifiedBy': { $in: tokens } },
        { 'approvalAuthorities.authorisedRep': { $in: tokens } },
        { 'approvalAuthorities.financeRep': { $in: tokens } },
        { 'approvalAuthorities.managerProcurement': { $in: tokens } }
      ] : [];
      if (!indentIds.length && !authorityTextConditions.length) {
        return res.json({ success: true, data: [] });
      }
      filter = {
        ...filter,
        $or: [
          ...(indentIds.length ? [{ indent: { $in: indentIds } }] : []),
          ...authorityTextConditions
        ]
      };
    }
    const list = await fullPopulate(
      CashApproval.find(filter).sort({ updatedAt: -1 })
    );
    res.json({ success: true, data: list });
  })
);

// GET /api/cash-approvals/:id
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await fullPopulate(CashApproval.findById(req.params.id));
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  res.json({ success: true, data: ca });
}));

// POST /api/cash-approvals
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { quotationId, ...body } = req.body;

  // Pre-fill from quotation if provided
  if (quotationId) {
    const quotation = await Quotation.findById(quotationId).populate('indent');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    body.vendor = body.vendor || quotation.vendor;
    body.indent = body.indent || (quotation.indent?._id || quotation.indent);
    body.quotation = quotationId;
    if (!body.items || !body.items.length) {
      body.items = (quotation.items || []).map((item) => ({
        description: item.description || item.name || '',
        specification: item.specification || '',
        brand: item.brand || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        unitPrice: item.unitPrice || item.price || 0,
        taxRate: item.taxRate || 0,
        discount: item.discount || 0,
        amount: ((item.quantity || 1) * (item.unitPrice || item.price || 0)) - (item.discount || 0)
      }));
    }
    if (!body.notes && quotation.notes) body.notes = quotation.notes;
    // Pre-fill approval authorities from comparative statement approvals on indent
    if (quotation.indent && quotation.indent.comparativeStatementApprovals) {
      const csa = quotation.indent.comparativeStatementApprovals;
      body.approvalAuthorities = body.approvalAuthorities || {};
      body.approvalAuthorities.preparedBy = body.approvalAuthorities.preparedBy || csa.preparedBy || '';
      body.approvalAuthorities.verifiedBy = body.approvalAuthorities.verifiedBy || csa.verifiedBy || '';
      body.approvalAuthorities.authorisedRep = body.approvalAuthorities.authorisedRep || csa.authorisedRep || '';
      body.approvalAuthorities.financeRep = body.approvalAuthorities.financeRep || csa.financeRep || '';
      body.approvalAuthorities.managerProcurement = body.approvalAuthorities.managerProcurement || csa.managerProcurement || '';
    }
  }

  const ca = new CashApproval({ ...body, status: 'Pending Approval', createdBy: req.user.id });
  await ca.save();
  pushHistory(ca, '—', 'Pending Approval', req.user.id, 'Created in Procurement and submitted for authority approval', 'Procurement');
  await ca.save();
  const saved = await fullPopulate(CashApproval.findById(ca._id));
  res.status(201).json({ success: true, message: 'Cash Approval created successfully', data: saved });
}));

// PUT /api/cash-approvals/:id
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const editableStatuses = ['Pending Approval', 'Draft', 'Returned from Audit', 'Returned from CEO Office', 'Returned from CEO Secretariat'];
  if (!editableStatuses.includes(ca.status)) {
    return res.status(400).json({ success: false, message: `Cannot edit a Cash Approval in "${ca.status}" status` });
  }
  const { status: _s, caNumber: _n, createdBy: _c, workflowHistory: _w, ...updates } = req.body;
  Object.assign(ca, updates);
  ca.updatedBy = req.user.id;
  await ca.save();
  const updated = await fullPopulate(CashApproval.findById(ca._id));
  res.json({ success: true, message: 'Cash Approval updated', data: updated });
}));

// DELETE /api/cash-approvals/:id
router.delete('/:id', authMiddleware, authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (!['Pending Approval', 'Draft', 'Cancelled', 'Rejected'].includes(ca.status)) {
    return res.status(400).json({ success: false, message: 'Only Draft, Cancelled, or Rejected Cash Approvals can be deleted' });
  }
  await CashApproval.deleteOne({ _id: ca._id });
  res.json({ success: true, message: 'Cash Approval deleted' });
}));

// ─── Workflow Actions ─────────────────────────────────────────────────────────

// Phase 3: Authority Approve (assigned authority -> move to Pending Audit)
router.put('/:id/approve', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (ca.status !== 'Pending Approval') {
    return res.status(400).json({ success: false, message: 'Only pending cash approvals can be approved' });
  }
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
  if (!isAdmin && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'Only assigned authority can approve this cash approval' });
  }
  const requiredSlots = await getRequiredAuthoritySlots(ca.indent, ca.approvalAuthorities);
  if (!requiredSlots.length) {
    return res.status(400).json({ success: false, message: 'No approval authorities configured on this cash approval' });
  }
  const matchedSlots = matchUserToAuthoritySlots(requiredSlots, req.user);
  if (!matchedSlots.length) {
    return res.status(400).json({ success: false, message: 'Your user is not mapped to any pending authority slot' });
  }
  const approvals = Array.isArray(ca.authorityApprovals) ? [...ca.authorityApprovals] : [];
  const approvedKeys = new Set(approvals.map((a) => String(a?.authorityKey || '').trim()).filter(Boolean));
  const pendingMatchedSlots = matchedSlots.filter((slot) => !approvedKeys.has(slot.key));
  if (!pendingMatchedSlots.length) {
    return res.status(400).json({ success: false, message: 'You have already approved your assigned authority slot(s)' });
  }
  const now = new Date();
  pendingMatchedSlots.forEach((slot) => {
    approvals.push({
      authorityKey: slot.key,
      authorityLabel: slot.label,
      approver: req.user.id,
      approvedAt: now,
      comments: req.body.comments || ''
    });
  });
  ca.authorityApprovals = approvals;
  const requiredKeys = new Set(requiredSlots.map((s) => s.key));
  const updatedApprovedKeys = new Set(ca.authorityApprovals.map((a) => String(a?.authorityKey || '').trim()).filter(Boolean));
  const allApproved = [...requiredKeys].every((key) => updatedApprovedKeys.has(key));
  ca.authorityApprovedBy = req.user.id;
  ca.authorityApprovedAt = now;
  ca.authorityApprovalComments = req.body.comments || '';
  if (allApproved) {
    pushHistory(ca, 'Pending Approval', 'Pending Audit', req.user.id, req.body.comments || 'All assigned authorities approved and sent to Pre-Audit', 'Procurement');
    ca.status = 'Pending Audit';
  } else {
    const remaining = requiredSlots.length - updatedApprovedKeys.size;
    pushHistory(ca, 'Pending Approval', 'Pending Approval', req.user.id, req.body.comments || `Authority approval recorded. ${remaining} approval(s) remaining.`, 'Procurement');
  }
  ca.updatedBy = req.user.id;
  await ca.save();
  if (allApproved) {
    const recipients = await getAuditRecipients();
    await notify({
      recipientIds: recipients,
      actorId: req.user.id,
      title: 'Cash Approval pending Audit review',
      message: `Cash Approval ${ca.caNumber} received all authority approvals and is now waiting in Pre-Audit queue.`,
      actionUrl: '/audit',
      entityId: ca._id
    });
  }
  const remaining = requiredSlots.length - updatedApprovedKeys.size;
  const message = allApproved
    ? 'All authority approvals completed. Cash Approval sent to Pre-Audit successfully'
    : `Authority approval recorded successfully. ${remaining} approval(s) remaining before Pre-Audit`;
  res.json({ success: true, message, data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 3: Authority Reject
router.put('/:id/reject', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (ca.status !== 'Pending Approval') {
    return res.status(400).json({ success: false, message: 'Only pending cash approvals can be rejected' });
  }
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
  if (!isAdmin && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'Only assigned authority can reject this cash approval' });
  }
  const rejectMsg = req.body?.rejectionComments || req.body?.comments || '';
  pushHistory(ca, 'Pending Approval', 'Rejected', req.user.id, rejectMsg || 'Rejected by assigned authority', 'Procurement');
  ca.status = 'Rejected';
  ca.auditRejectionComments = rejectMsg;
  ca.updatedBy = req.user.id;
  await ca.save();
  res.json({ success: true, message: 'Cash Approval rejected successfully', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 4: Send to Audit
router.put('/:id/send-to-audit', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasProcurementAccess(req.user)) {
    return res.status(403).json({ success: false, message: 'Procurement access required' });
  }
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const allowed = ['Draft', 'Returned from Audit', 'Returned from CEO Secretariat', 'Rejected'];
  if (!allowed.includes(ca.status)) {
    return res.status(400).json({ success: false, message: `Cannot send to audit from status: ${ca.status}` });
  }

  if ((ca.status === 'Returned from Audit' || ca.status === 'Rejected') && req.body.observationAnswers) {
    const { observationAnswers } = req.body;
    if (Array.isArray(observationAnswers) && ca.auditObservations && ca.auditObservations.length > 0) {
      observationAnswers.forEach(({ observationId, answer }) => {
        const observation = ca.auditObservations.id(observationId);
        if (observation && answer && answer.trim()) {
          observation.answer = answer.trim();
          observation.answeredBy = req.user.id;
          observation.answeredAt = new Date();
          observation.resolved = true;
        }
      });
    }
  }
  if (ca.status === 'Returned from Audit' || ca.status === 'Rejected') {
    const snapshot = ca.auditSnapshotAtReturn;
    if (snapshot && (ca.items || []).length >= 0) {
      const summary = buildCAChangeSummary(ca.items, snapshot);
      ca.resubmissionChangeSummary = summary || ca.resubmissionChangeSummary || '';
    }
  }

  const prev = ca.status;
  pushHistory(ca, prev, 'Pending Audit', req.user.id, req.body.comments || 'Sent to Pre-Audit', 'Procurement');
  ca.status = 'Pending Audit';
  ca.updatedBy = req.user.id;
  await ca.save();
  const recipients = await getAuditRecipients();
  await notify({
    recipientIds: recipients,
    actorId: req.user.id,
    title: 'Cash Approval pending Audit review',
    message: `Cash Approval ${ca.caNumber} moved to Audit queue. Please review in Pre-Audit.`,
    actionUrl: '/audit',
    entityId: ca._id,
    metadata: { queueStage: 'pending_audit', targetModule: 'audit', targetTab: 'pre_audit' }
  });
  res.json({ success: true, message: 'Cash Approval sent to Audit', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 4a: Audit initial approval (Pre-Audit assistant)
router.put('/:id/audit-approve', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasAuditAccess(req.user)) {
    return res.status(403).json({ success: false, message: 'Audit access required' });
  }
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });

  const approvalText = req.body.approvalComments || req.body.comments || '';

  // Step 1: Initial pre-audit approval (assistant/auditor)
  if (ca.status === 'Pending Audit') {
    if (isAuditDirectorUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Initial approval must be done by assistant/auditor, not the Audit Director.' });
    }
    ca.preAuditInitialApprovedBy = req.user.id;
    ca.preAuditInitialApprovedAt = new Date();
    ca.preAuditInitialComments = approvalText;
    ca.updatedBy = req.user.id;
    pushHistory(ca, 'Pending Audit', 'Pending Audit', req.user.id, approvalText || 'Initial pre-audit approval recorded', 'Pre-Audit');
    await ca.save();
    return res.json({ success: true, message: 'Initial pre-audit approval recorded. Forward to Audit Director for final approval.', data: await fullPopulate(CashApproval.findById(ca._id)) });
  }

  // Step 2: Audit Director final approval
  if (ca.status !== 'Forwarded to Audit Director') {
    return res.status(400).json({ success: false, message: 'Must be in "Forwarded to Audit Director" status for final approval.' });
  }
  if (!isAuditDirectorUser(req.user) && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Only Audit Director can provide final approval.' });
  }
  pushHistory(ca, 'Forwarded to Audit Director', 'Send to CEO Office', req.user.id, approvalText, 'Pre-Audit');
  ca.status = 'Send to CEO Office';
  ca.auditApprovedBy = req.user.id;
  ca.auditApprovedAt = new Date();
  ca.auditRemarks = approvalText;
  ca.updatedBy = req.user.id;
  await ca.save();
  const ceoRecipients = await getCeoSecretariatRecipients();
  await notify({
    recipientIds: ceoRecipients,
    actorId: req.user.id,
    title: 'Cash Approval pending CEO Secretariat',
    message: `Cash Approval ${ca.caNumber} is audit-approved and now waiting in CEO Secretariat queue (Payments).`,
    actionUrl: '/general/ceo-secretariat/payments',
    entityId: ca._id,
    entityType: 'CashApproval',
    module: 'procurement',
    metadata: {
      queueStage: 'send_to_ceo_office',
      targetModule: 'general',
      targetTab: 'ceo_secretariat_payments'
    }
  });
  res.json({ success: true, message: 'Cash Approval audit-approved and sent to CEO Office', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 4b: Forward to Audit Director
router.put('/:id/forward-to-audit-director', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasAuditAccess(req.user)) return res.status(403).json({ success: false, message: 'Audit access required' });
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (ca.status !== 'Pending Audit') return res.status(400).json({ success: false, message: 'Cash Approval must be in Pending Audit status' });
  if (!ca.preAuditInitialApprovedBy) return res.status(400).json({ success: false, message: 'Initial pre-audit approval required before forwarding to Audit Director' });
  pushHistory(ca, 'Pending Audit', 'Forwarded to Audit Director', req.user.id, req.body.comments || 'Forwarded to Audit Director', 'Pre-Audit');
  ca.status = 'Forwarded to Audit Director';
  ca.updatedBy = req.user.id;
  await ca.save();
  res.json({ success: true, message: 'Forwarded to Audit Director', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 4c: Audit reject
router.put('/:id/audit-reject', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasAuditAccess(req.user)) return res.status(403).json({ success: false, message: 'Audit access required' });
  const { rejectionComments, observations } = req.body;
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (!['Pending Audit', 'Forwarded to Audit Director'].includes(ca.status)) {
    return res.status(400).json({ success: false, message: 'Can only reject from Pending Audit or Forwarded to Audit Director' });
  }
  const rejectMsg = rejectionComments || req.body.comments || 'Rejected with observations';
  pushHistory(ca, ca.status, 'Rejected', req.user.id, rejectMsg, 'Pre-Audit');
  ca.status = 'Rejected';
  ca.auditRejectedBy = req.user.id;
  ca.auditRejectedAt = new Date();
  ca.auditRejectionComments = rejectionComments || req.body.comments || '';
  ca.auditSnapshotAtReturn = {
    items: JSON.parse(JSON.stringify(ca.items || [])),
    totalAmount: ca.totalAmount,
    subtotal: ca.subtotal
  };
  if (observations && Array.isArray(observations) && observations.length > 0) {
    ca.auditObservations = ca.auditObservations || [];
    observations.forEach((obs) => {
      ca.auditObservations.push({
        observation: typeof obs === 'string' ? obs : (obs.observation || obs.text || ''),
        severity: (typeof obs === 'object' && obs.severity ? obs.severity : 'medium').toLowerCase(),
        addedBy: req.user.id,
        addedAt: new Date(),
        resolved: false
      });
    });
  }
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval Rejected by Audit', message: `Cash Approval ${ca.caNumber} was rejected by Audit. Reason: ${rejectMsg}`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Cash Approval rejected by Audit', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 4d: Audit return
router.put('/:id/audit-return', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasAuditAccess(req.user)) return res.status(403).json({ success: false, message: 'Audit access required' });
  const { returnComments, observations } = req.body;
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (!['Pending Audit', 'Forwarded to Audit Director'].includes(ca.status)) {
    return res.status(400).json({ success: false, message: 'Can only return from Pending Audit or Forwarded to Audit Director' });
  }
  const retMsg = returnComments || req.body.comments || '';
  pushHistory(ca, ca.status, 'Returned from Audit', req.user.id, retMsg, 'Pre-Audit');
  ca.status = 'Returned from Audit';
  ca.auditReturnedBy = req.user.id;
  ca.auditReturnedAt = new Date();
  ca.auditReturnComments = retMsg;
  ca.auditSnapshotAtReturn = {
    items: JSON.parse(JSON.stringify(ca.items || [])),
    totalAmount: ca.totalAmount,
    subtotal: ca.subtotal
  };
  if (observations && Array.isArray(observations) && observations.length > 0) {
    ca.auditObservations = ca.auditObservations || [];
    observations.forEach((obs) => {
      ca.auditObservations.push({
        observation: obs.observation || obs.text || obs,
        severity: (obs.severity || 'medium').toLowerCase(),
        addedBy: req.user.id,
        addedAt: new Date(),
        resolved: false
      });
    });
  }
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval Returned from Audit', message: `Cash Approval ${ca.caNumber} was returned from Audit for corrections.`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Cash Approval returned from Audit', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 5: CEO Secretariat forward to CEO (same rules as PO)
router.put('/:id/forward-to-ceo', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!hasCeoSecretariatAccess(req.user) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'CEO Secretariat access required' });
  }
  if (!['Send to CEO Office', 'Returned from CEO Office'].includes(ca.status)) {
    return res.status(400).json({
      success: false,
      message: 'Only Cash Approvals in Send to CEO Office or Returned from CEO Office can be forwarded to CEO'
    });
  }
  const from = ca.status;
  pushHistory(ca, from, 'Forwarded to CEO', req.user.id, req.body.comments || 'Forwarded to CEO for approval', 'CEO Secretariat');
  ca.status = 'Forwarded to CEO';
  ca.ceoForwardedBy = req.user.id;
  ca.ceoForwardedAt = new Date();
  ca.updatedBy = req.user.id;
  await ca.save();
  const ceoRecipients = await getCeoRecipients();
  await notify({
    recipientIds: ceoRecipients,
    actorId: req.user.id,
    title: 'Cash Approval pending CEO approval',
    message: `Cash Approval ${ca.caNumber} was forwarded to CEO and is awaiting approval.`,
    actionUrl: '/general/ceo-secretariat/payments',
    entityId: ca._id,
    entityType: 'CashApproval',
    module: 'procurement',
    metadata: {
      queueStage: 'forwarded_to_ceo',
      targetModule: 'general',
      targetTab: 'ceo_secretariat_payments'
    }
  });
  res.json({ success: true, message: 'Forwarded to CEO', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 5: CEO Secretariat return (Send to CEO Office only — matches PO)
router.put('/:id/ceo-secretariat-return', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!hasCeoSecretariatAccess(req.user) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'CEO Secretariat access required' });
  }
  if (ca.status !== 'Send to CEO Office') {
    return res.status(400).json({
      success: false,
      message: 'Only Cash Approvals in Send to CEO Office can be returned by CEO Secretariat'
    });
  }
  pushHistory(ca, 'Send to CEO Office', 'Returned from CEO Secretariat', req.user.id, req.body.returnComments || req.body.comments || '', 'CEO Secretariat');
  ca.status = 'Returned from CEO Secretariat';
  ca.ceoReturnedBy = req.user.id;
  ca.ceoReturnedAt = new Date();
  ca.ceoReturnComments = req.body.returnComments || req.body.comments || '';
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval Returned from CEO Secretariat', message: `Cash Approval ${ca.caNumber} was returned from CEO Secretariat.`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Returned from CEO Secretariat', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 5: CEO Secretariat reject (Send to CEO Office only — matches PO)
router.put('/:id/ceo-secretariat-reject', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!hasCeoSecretariatAccess(req.user) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'CEO Secretariat access required' });
  }
  if (ca.status !== 'Send to CEO Office') {
    return res.status(400).json({
      success: false,
      message: 'Only Cash Approvals in Send to CEO Office can be rejected by CEO Secretariat'
    });
  }
  const rejectionComments = req.body.rejectionComments || req.body.comments || '';
  pushHistory(ca, 'Send to CEO Office', 'Rejected', req.user.id, rejectionComments, 'CEO Secretariat');
  ca.status = 'Rejected';
  ca.ceoRejectedBy = req.user.id;
  ca.ceoRejectedAt = new Date();
  ca.ceoRejectionComments = rejectionComments;
  if (req.body.digitalSignature) {
    ca.ceoDigitalSignature = req.body.digitalSignature;
  }
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({
    recipientIds: procRecipients,
    actorId: req.user.id,
    title: 'Cash Approval rejected by CEO Secretariat',
    message: `Cash Approval ${ca.caNumber} was rejected from Payments (CEO Secretariat).`,
    actionUrl: '/procurement/cash-approvals',
    entityId: ca._id
  });
  res.json({ success: true, message: 'Cash Approval rejected by CEO Secretariat', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 5: CEO Approve → always goes to Pending Finance for cash approvals
router.put('/:id/ceo-approve', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!['super_admin', 'admin', 'higher_management'].includes(req.user.role) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'CEO approval access required' });
  }
  if (ca.status !== 'Forwarded to CEO') {
    return res.status(400).json({ success: false, message: 'Cash Approval must be "Forwarded to CEO" to approve' });
  }
  pushHistory(ca, 'Forwarded to CEO', 'Pending Finance', req.user.id, req.body.comments || 'CEO Approved', 'CEO');
  ca.status = 'Pending Finance';
  ca.ceoApprovedBy = req.user.id;
  ca.ceoApprovedAt = new Date();
  ca.ceoApprovalComments = req.body.comments || '';
  ca.ceoDigitalSignature = req.body.digitalSignature || '';
  ca.updatedBy = req.user.id;
  await ca.save();
  const financeRecipients = await getFinanceRecipients();
  await notify({ recipientIds: financeRecipients, actorId: req.user.id, title: 'Cash Approval pending Finance', message: `Cash Approval ${ca.caNumber} CEO-approved. Please issue the advance.`, actionUrl: '/finance/cash-approvals', entityId: ca._id, entityType: 'CashApproval', module: 'finance' });
  res.json({ success: true, message: 'CEO approved. Cash Approval moved to Pending Finance.', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 5: CEO Reject
router.put('/:id/ceo-reject', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!['super_admin', 'admin', 'higher_management'].includes(req.user.role) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'CEO rejection access required' });
  }
  if (ca.status !== 'Forwarded to CEO') {
    return res.status(400).json({ success: false, message: 'Cash Approval must be "Forwarded to CEO" to reject' });
  }
  const rejectMsg = req.body.rejectionComments || req.body.comments || '';
  pushHistory(ca, 'Forwarded to CEO', 'Rejected', req.user.id, rejectMsg, 'CEO');
  ca.status = 'Rejected';
  ca.ceoRejectedBy = req.user.id;
  ca.ceoRejectedAt = new Date();
  ca.ceoRejectionComments = rejectMsg;
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval Rejected by CEO', message: `Cash Approval ${ca.caNumber} was rejected by CEO.`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Cash Approval rejected by CEO', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 5: CEO Return
router.put('/:id/ceo-return', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!['super_admin', 'admin', 'higher_management'].includes(req.user.role) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'CEO return access required' });
  }
  if (ca.status !== 'Forwarded to CEO') {
    return res.status(400).json({ success: false, message: 'Cash Approval must be "Forwarded to CEO" to return' });
  }
  pushHistory(ca, 'Forwarded to CEO', 'Returned from CEO Office', req.user.id, req.body.comments || '', 'CEO');
  ca.status = 'Returned from CEO Office';
  ca.ceoReturnedBy = req.user.id;
  ca.ceoReturnedAt = new Date();
  ca.ceoReturnComments = req.body.comments || '';
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval Returned from CEO', message: `Cash Approval ${ca.caNumber} was returned from CEO for corrections.`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Returned from CEO', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 6: Finance Issue Advance
router.put('/:id/issue-advance', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!hasFinanceAccess(req.user) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'Finance access required' });
  }
  if (ca.status !== 'Pending Finance') {
    return res.status(400).json({ success: false, message: 'Cash Approval must be in "Pending Finance" status to issue advance' });
  }
  const { advanceTo, advanceToName, advanceAmount, advancePaymentMethod, advanceVoucherNo, advanceRemarks } = req.body;
  if (!advanceAmount || advanceAmount <= 0) return res.status(400).json({ success: false, message: 'Advance amount is required and must be > 0' });

  const amount = Math.round(parseFloat(advanceAmount) * 100) / 100;
  const isCash = (advancePaymentMethod || 'Cash').toLowerCase() === 'cash';

  pushHistory(ca, 'Pending Finance', 'Advance Issued', req.user.id, `Advance of ${amount} issued via ${advancePaymentMethod || 'Cash'}. Voucher: ${advanceVoucherNo || '-'}`, 'Finance');
  ca.status = 'Advance Issued';
  ca.advanceTo = advanceTo || null;
  ca.advanceToName = advanceToName || '';
  ca.advanceAmount = amount;
  ca.advancePaymentMethod = advancePaymentMethod || 'Cash';
  ca.advanceVoucherNo = advanceVoucherNo || '';
  ca.advanceRemarks = advanceRemarks || '';
  ca.advanceIssuedBy = req.user.id;
  ca.advanceIssuedAt = new Date();
  ca.updatedBy = req.user.id;
  await ca.save();

  // ── Journal Entry 1: DR Cash Advance to Staff / CR Cash or Bank ──────────────
  try {
    const staffAdvAcc = await FinanceHelper.ensureStaffAdvanceAccount(req.user.id);
    const cashBankAcc = await FinanceHelper.getAccountByNumber(
      isCash ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
    );
    if (staffAdvAcc && cashBankAcc) {
      await FinanceHelper.createAndPostJournalEntry({
        date: new Date(),
        reference: advanceVoucherNo || ca.caNumber,
        description: `Cash Advance issued for ${ca.caNumber}${advanceToName ? ` to ${advanceToName}` : ''}`,
        department: 'procurement',
        module: 'procurement',
        referenceId: ca._id,
        referenceType: 'payment',
        journalCode: isCash ? 'CASH' : 'BANK',
        createdBy: req.user.id,
        lines: [
          {
            account: staffAdvAcc._id,
            description: `Staff advance for ${ca.caNumber}${advanceToName ? ` — ${advanceToName}` : ''}`,
            debit: amount,
            department: 'procurement'
          },
          {
            account: cashBankAcc._id,
            description: `${isCash ? 'Cash' : 'Bank'} payment — advance for ${ca.caNumber}`,
            credit: amount,
            department: 'finance'
          }
        ]
      });
    }
  } catch (jeErr) {
    // JE failure is non-fatal — CA status is already saved; log for investigation
    console.error(`⚠️  JE (advance) failed for ${ca.caNumber}:`, jeErr.message);
  }

  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval Advance Issued', message: `Advance of PKR ${amount.toLocaleString()} issued for Cash Approval ${ca.caNumber}. Proceed with purchase.`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Advance issued successfully', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 7: Procurement Submit Evidence (after advance received, purchase made)
router.put('/:id/submit-evidence', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasProcurementAccess(req.user)) return res.status(403).json({ success: false, message: 'Procurement access required' });
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (ca.status !== 'Advance Issued') {
    return res.status(400).json({ success: false, message: 'Evidence can only be submitted when status is "Advance Issued"' });
  }
  const { evidenceActualAmount, purchaseInvoiceNo, evidenceRemarks, purchaseReceipts } = req.body;
  if (!evidenceActualAmount || parseFloat(evidenceActualAmount) <= 0) {
    return res.status(400).json({ success: false, message: 'Actual amount spent is required' });
  }
  pushHistory(
    ca, 'Advance Issued', 'Evidence Submitted', req.user.id,
    `Purchase evidence submitted. Invoice: ${purchaseInvoiceNo || '—'}. Amount spent: ${evidenceActualAmount}. ${evidenceRemarks || ''}`,
    'Procurement'
  );
  ca.status = 'Evidence Submitted';
  ca.evidenceSubmittedBy = req.user.id;
  ca.evidenceSubmittedAt = new Date();
  ca.purchaseInvoiceNo = purchaseInvoiceNo || '';
  ca.evidenceActualAmount = parseFloat(evidenceActualAmount);
  ca.evidenceRemarks = evidenceRemarks || '';
  if (Array.isArray(purchaseReceipts) && purchaseReceipts.length) {
    ca.purchaseReceipts.push(...purchaseReceipts);
  }
  ca.updatedBy = req.user.id;
  await ca.save();
  const financeRecipients = await getFinanceRecipients();
  await notify({
    recipientIds: financeRecipients,
    actorId: req.user.id,
    title: 'Purchase Evidence Submitted — Action Required',
    message: `Procurement has submitted purchase receipts for Cash Approval ${ca.caNumber}. Please review and confirm settlement.`,
    actionUrl: '/finance/cash-approvals',
    entityId: ca._id
  });
  res.json({ success: true, message: 'Purchase evidence submitted. Finance will review and confirm settlement.', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 8: Finance Confirm Settlement (reviews evidence, records final amounts)
router.put('/:id/settle-payment', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess =
    await isAssignedComparativeAuthorityUser(ca.indent, req.user.id) ||
    isAssignedByAuthorityText(ca.approvalAuthorities, req.user);
  if (!hasFinanceAccess(req.user) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'Finance access required' });
  }
  if (ca.status !== 'Evidence Submitted') {
    return res.status(400).json({ success: false, message: 'Finance can only confirm settlement after procurement submits purchase evidence' });
  }
  const { actualAmountSpent, settlementRemarks, financeVerificationNotes, receiptAttachments } = req.body;
  if (actualAmountSpent === undefined || actualAmountSpent === null) {
    return res.status(400).json({ success: false, message: 'Actual amount spent is required' });
  }
  const spent = Math.round(parseFloat(actualAmountSpent) * 100) / 100;
  const advance = Math.round((ca.advanceAmount || 0) * 100) / 100;
  const excess = advance > spent ? Math.round((advance - spent) * 100) / 100 : 0;
  const additional = spent > advance ? Math.round((spent - advance) * 100) / 100 : 0;

  pushHistory(
    ca, 'Evidence Submitted', 'Payment Settled', req.user.id,
    `Finance confirmed. Actual spent: ${spent}. Excess returned: ${excess}. Additional paid: ${additional}. ${settlementRemarks || ''}`,
    'Finance'
  );
  ca.status = 'Payment Settled';
  ca.actualAmountSpent = spent;
  ca.excessReturned = excess;
  ca.additionalPaid = additional;
  ca.settlementRemarks = settlementRemarks || '';
  ca.financeVerificationNotes = financeVerificationNotes || '';
  ca.settlementDate = new Date();
  ca.settledBy = req.user.id;
  ca.updatedBy = req.user.id;
  if (Array.isArray(receiptAttachments) && receiptAttachments.length) {
    ca.receiptAttachments.push(...receiptAttachments);
  }
  await ca.save();

  // ── Journal Entry 2: Settle the advance ──────────────────────────────────────
  //
  // Three possible scenarios:
  //   A) Exact match  — DR Expense / CR Staff Advance  (advance == spent)
  //   B) Excess cash  — DR Expense / DR Cash / CR Staff Advance (spent < advance, staff returns change)
  //   C) Extra spend  — DR Expense / CR Staff Advance / CR Cash (spent > advance, company tops up)
  //
  try {
    const staffAdvAcc  = await FinanceHelper.ensureStaffAdvanceAccount(req.user.id);
    const expenseAcc   = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.EXPENSE_GENERAL);
    const isCash       = (ca.advancePaymentMethod || 'Cash').toLowerCase() === 'cash';
    const cashBankAcc  = await FinanceHelper.getAccountByNumber(
      isCash ? FinanceHelper.ACCOUNTS.CASH : FinanceHelper.ACCOUNTS.BANK
    );

    if (staffAdvAcc && expenseAcc && cashBankAcc) {
      const lines = [];

      // Debit: Expense for the actual amount spent
      lines.push({
        account: expenseAcc._id,
        description: `Purchase expense — ${ca.caNumber} (${ca.vendor?.name || 'Vendor'})`,
        debit: spent,
        department: 'procurement'
      });

      // Scenario B: excess cash returned — DR Cash (staff returns leftover)
      if (excess > 0) {
        lines.push({
          account: cashBankAcc._id,
          description: `Excess cash returned for ${ca.caNumber}`,
          debit: excess,
          department: 'finance'
        });
      }

      // Credit: Clear the staff advance account (the full advance amount)
      lines.push({
        account: staffAdvAcc._id,
        description: `Staff advance cleared — ${ca.caNumber}`,
        credit: advance,
        department: 'procurement'
      });

      // Scenario C: additional spend by company — CR Cash (company tops up)
      if (additional > 0) {
        lines.push({
          account: cashBankAcc._id,
          description: `Additional cash paid for ${ca.caNumber}`,
          credit: additional,
          department: 'finance'
        });
      }

      await FinanceHelper.createAndPostJournalEntry({
        date: new Date(),
        reference: ca.caNumber,
        description: `Cash Advance Settlement — ${ca.caNumber}${ca.vendor?.name ? ` (${ca.vendor.name})` : ''}`,
        department: 'procurement',
        module: 'procurement',
        referenceId: ca._id,
        referenceType: 'expense',
        journalCode: isCash ? 'CASH' : 'BANK',
        createdBy: req.user.id,
        lines
      });
    }
  } catch (jeErr) {
    console.error(`⚠️  JE (settlement) failed for ${ca.caNumber}:`, jeErr.message);
  }

  const procRecipients = await getProcurementRecipients();
  await notify({
    recipientIds: procRecipients,
    actorId: req.user.id,
    title: 'Cash Approval Payment Settled',
    message: `Finance has confirmed the settlement for Cash Approval ${ca.caNumber}. Awaiting final confirmation.`,
    actionUrl: '/procurement/cash-approvals',
    entityId: ca._id
  });
  res.json({ success: true, message: 'Payment settled successfully', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 8: Finance Send to Procurement
router.put('/:id/send-to-procurement', authMiddleware, asyncHandler(async (req, res) => {
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const assignedAuthorityAccess = await isAssignedComparativeAuthorityUser(ca.indent, req.user.id);
  if (!hasFinanceAccess(req.user) && !assignedAuthorityAccess) {
    return res.status(403).json({ success: false, message: 'Finance access required' });
  }
  if (ca.status !== 'Payment Settled') {
    return res.status(400).json({ success: false, message: 'Payment must be settled before sending back to Procurement' });
  }
  pushHistory(ca, 'Payment Settled', 'Sent to Procurement', req.user.id, req.body.remarks || 'Sent back to Procurement for confirmation', 'Finance');
  ca.status = 'Sent to Procurement';
  ca.sentToProcurementBy = req.user.id;
  ca.sentToProcurementAt = new Date();
  ca.sentToProcurementRemarks = req.body.remarks || '';
  ca.updatedBy = req.user.id;
  await ca.save();
  const procRecipients = await getProcurementRecipients();
  await notify({ recipientIds: procRecipients, actorId: req.user.id, title: 'Cash Approval ready for Procurement closure', message: `Cash Approval ${ca.caNumber} payment settled. Please confirm goods received and complete.`, actionUrl: '/procurement/cash-approvals', entityId: ca._id });
  res.json({ success: true, message: 'Sent to Procurement for final confirmation', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Phase 9: Procurement Complete
router.put('/:id/complete', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasProcurementAccess(req.user)) return res.status(403).json({ success: false, message: 'Procurement access required' });
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  if (ca.status !== 'Sent to Procurement') {
    return res.status(400).json({ success: false, message: 'Cash Approval must be in "Sent to Procurement" status to complete' });
  }
  pushHistory(ca, 'Sent to Procurement', 'Completed', req.user.id, req.body.remarks || 'Goods received and confirmed. Cash Approval completed.', 'Procurement');
  ca.status = 'Completed';
  ca.completedBy = req.user.id;
  ca.completedAt = new Date();
  ca.completionRemarks = req.body.remarks || '';
  ca.updatedBy = req.user.id;
  await ca.save();
  res.json({ success: true, message: 'Cash Approval completed successfully', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

// Cancel
router.put('/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
  if (!hasProcurementAccess(req.user)) return res.status(403).json({ success: false, message: 'Procurement access required' });
  const ca = await CashApproval.findById(req.params.id);
  if (!ca) return res.status(404).json({ success: false, message: 'Cash Approval not found' });
  const cancellable = ['Draft', 'Returned from Audit', 'Returned from CEO Office', 'Returned from CEO Secretariat'];
  if (!cancellable.includes(ca.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel Cash Approval in "${ca.status}" status` });
  }
  pushHistory(ca, ca.status, 'Cancelled', req.user.id, req.body.reason || 'Cancelled', 'Procurement');
  ca.status = 'Cancelled';
  ca.updatedBy = req.user.id;
  await ca.save();
  res.json({ success: true, message: 'Cash Approval cancelled', data: await fullPopulate(CashApproval.findById(ca._id)) });
}));

module.exports = router;
