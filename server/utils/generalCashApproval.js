const {
  assertActiveUserApproversEligible,
  getEligibleUtilityBillApproverUserIds
} = require('./utilityBillApproverEligibility');

const GENERAL_MODULE = 'general';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const hasModuleAccess = (roleDoc, moduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((p) => p?.module === moduleKey);
};

const hasGeneralSubmoduleAccess = (roleDoc, submoduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((p) => {
    if (p?.module !== 'general') return false;
    if (!Array.isArray(p.submodules) || p.submodules.length === 0) return true;
    return p.submodules.some((sm) => {
      if (typeof sm === 'string') return sm === submoduleKey;
      if (sm && typeof sm === 'object') return sm.submodule === submoduleKey;
      return false;
    });
  });
};

const normalizeUserRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const hasGeneralModuleAccess = (user) => {
  if (!user) return false;
  const role = normalizeUserRole(user.role);
  if (['super_admin', 'admin', 'higher_management', 'developer'].includes(role)) return true;
  if (hasModuleAccess(user.roleRef, 'general')) return true;
  if (hasGeneralSubmoduleAccess(user.roleRef, 'general_cash_approvals')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'general') || hasGeneralSubmoduleAccess(r, 'general_cash_approvals'))) {
    return true;
  }
  if (Array.isArray(user.subRoles) && user.subRoles.some((sr) => String(sr?.module || '') === 'general')) {
    return true;
  }
  return false;
};

const isGeneralCashApproval = (ca) =>
  ca && String(ca.originatingModule || '').toLowerCase() === GENERAL_MODULE;

const canManageGeneralCashApproval = (user, ca) => {
  if (!user || !ca) return false;
  if (['super_admin', 'admin'].includes(user.role)) return true;
  const uid = String(user._id || user.id || '');
  return uid && String(ca.createdBy?._id || ca.createdBy || '') === uid;
};

const normalizeLineItem = (raw, idx) => {
  const qty = round2(raw.quantity ?? raw.qty ?? 1);
  const rate = round2(raw.unitPrice ?? raw.rate ?? 0);
  const computed = round2(qty * rate);
  const amount = round2(raw.amount ?? raw.totalAmount ?? computed);
  const itemName = String(raw.itemName || raw.name || '').trim();
  const narration = String(raw.description ?? raw.narration ?? raw.specification ?? '').trim();
  const lineDesc = itemName || narration || `Line ${idx + 1}`;
  return {
    itemName,
    description: lineDesc,
    specification: narration,
    location: String(raw.location || '').trim(),
    quantity: qty > 0 ? qty : 0,
    unit: String(raw.unit || 'pcs').trim() || 'pcs',
    unitPrice: rate,
    taxRate: 0,
    discount: 0,
    amount: amount > 0 ? amount : computed,
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.filter((a) => a && a.url).map((a) => ({
        filename: a.filename || '',
        originalName: a.originalName || a.filename || '',
        url: a.url,
        mimeType: a.mimeType || '',
        uploadedAt: a.uploadedAt || new Date()
      }))
      : []
  };
};

const resolveGeneralCashApprovalTotals = (payload) => {
  const items = (payload.items || []).map(normalizeLineItem);
  const subtotal = round2(items.reduce((s, li) => s + (li.amount || 0), 0));
  const shippingCost = round2(payload.shippingCost || 0);
  const totalAmount = round2(subtotal + shippingCost);
  return { items, subtotal, taxAmount: 0, discountAmount: 0, shippingCost, totalAmount };
};

const validateGeneralCashApprovalPayload = (payload, { forSubmit = false } = {}) => {
  const errors = [];
  const dept = String(payload.requestingDepartment || '').trim();
  if (!dept) errors.push('Department is required');

  const advanceEmployeeId = String(
    payload.advanceToEmployee?._id || payload.advanceToEmployee || ''
  ).trim();
  if (!advanceEmployeeId) errors.push('Advance to (employee) is required');

  const purpose = String(payload.purpose || '').trim();
  if (!purpose) errors.push('Purpose / narration is required');

  const { items, totalAmount } = resolveGeneralCashApprovalTotals(payload);
  if (!items.length) errors.push('Add at least one line item');
  items.forEach((li, i) => {
    if (!String(li.itemName || '').trim() && !String(li.specification || '').trim()) {
      errors.push(`Line ${i + 1}: item name or description is required`);
    }
    if (!(li.quantity > 0)) errors.push(`Line ${i + 1}: quantity must be greater than zero`);
    if (!(li.amount > 0)) errors.push(`Line ${i + 1}: total amount must be greater than zero`);
  });
  if (totalAmount <= 0) errors.push('Total amount must be greater than zero');

  if (forSubmit) {
    const approverIds = (payload.approverIds || payload.draftApproverIds || [])
      .map((id) => String(id || '').trim())
      .filter(Boolean);
    if (approverIds.length !== 2) {
      errors.push('Select Manager Approver and Head Of Department Approver');
    }
  }

  return { errors, items, totalAmount };
};

const buildGeneralCashApprovalDocument = (body, createdBy, advanceRecipient = {}) => {
  const errors = [];
  const dept = String(body.requestingDepartment || '').trim();
  if (!dept) errors.push('Department is required');

  if (!advanceRecipient.advanceToEmployee) errors.push('Advance to (employee) is required');

  const purpose = String(body.purpose || '').trim();
  if (!purpose) errors.push('Purpose / narration is required');

  const totals = resolveGeneralCashApprovalTotals(body);
  if (!totals.items.length) errors.push('Add at least one line item');
  if (totals.totalAmount <= 0) errors.push('Total amount must be greater than zero');

  if (errors.length) {
    return { ok: false, errors };
  }
  const doc = {
    originatingModule: GENERAL_MODULE,
    requestingDepartment: dept,
    purpose,
    notes: String(body.notes || '').trim(),
    internalNotes: String(body.internalNotes || '').trim(),
    priority: body.priority || 'Urgent',
    approvalDate: body.approvalDate ? new Date(body.approvalDate) : new Date(),
    expectedPurchaseDate: body.expectedPurchaseDate
      ? new Date(body.expectedPurchaseDate)
      : body.approvalDate
        ? new Date(body.approvalDate)
        : new Date(),
    advanceTo: advanceRecipient.advanceTo,
    advanceToEmployee: advanceRecipient.advanceToEmployee,
    advanceGlAccount: advanceRecipient.advanceGlAccount,
    advanceGlAccountNumber: advanceRecipient.advanceGlAccountNumber || '',
    advanceToName: advanceRecipient.advanceToName || '',
    advanceAmount: totals.totalAmount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discountAmount,
    shippingCost: totals.shippingCost,
    totalAmount: totals.totalAmount,
    createdBy,
    departmentApprovalStatus: 'Draft',
    draftApproverIds: [],
    departmentApprovalChain: []
  };

  return { ok: true, doc };
};

const uniqueApproverIds = (ids = []) => [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];

const applyGeneralSubmitApprovers = async (ca, approverIds, actorId) => {
  const ids = uniqueApproverIds(approverIds);
  if (ids.length !== 2) {
    const err = new Error('Select Manager Approver and Head Of Department Approver');
    err.statusCode = 400;
    throw err;
  }
  if (actorId && ids.includes(String(actorId))) {
    const err = new Error('Requester cannot be selected as Manager or Head Of Department approver');
    err.statusCode = 400;
    throw err;
  }
  const check = await assertActiveUserApproversEligible(ids);
  if (!check.ok) {
    const err = new Error(check.message || 'Invalid approvers');
    err.statusCode = 400;
    throw err;
  }
  ca.draftApproverIds = [];
  ca.departmentApprovalChain = ids.map((approverId) => ({
    approver: approverId,
    status: 'pending'
  }));
  ca.departmentApprovalStatus = 'Submitted';
  ca.status = 'Pending Approval';
};

const approverIdFromStep = (step) => {
  const a = step?.approver;
  if (!a) return '';
  if (typeof a === 'object' && a._id) return String(a._id);
  return String(a);
};

/** Index of the first step still pending (Manager before HOD). */
const getFirstPendingDepartmentStepIndex = (chain = []) =>
  (chain || []).findIndex((step) => step.status === 'pending');

/** Index user may act on, only if they are the current (first pending) approver. */
const getActorPendingDepartmentStepIndex = (chain, userId) => {
  const uid = String(userId || '');
  const idx = getFirstPendingDepartmentStepIndex(chain);
  if (idx === -1) return -1;
  return approverIdFromStep(chain[idx]) === uid ? idx : -1;
};

module.exports = {
  GENERAL_MODULE,
  isGeneralCashApproval,
  hasGeneralModuleAccess,
  canManageGeneralCashApproval,
  validateGeneralCashApprovalPayload,
  resolveGeneralCashApprovalTotals,
  buildGeneralCashApprovalDocument,
  normalizeLineItem,
  uniqueApproverIds,
  applyGeneralSubmitApprovers,
  getEligibleUtilityBillApproverUserIds,
  approverIdFromStep,
  getFirstPendingDepartmentStepIndex,
  getActorPendingDepartmentStepIndex
};
