/**
 * Build personal executive approval inbox for the logged-in user.
 * Only documents where the user is the active approver right now.
 */

const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const CashApproval = require('../models/procurement/CashApproval');
const PaymentSettlement = require('../models/hr/PaymentSettlement');
const NonEmployeeRecord = require('../models/hr/NonEmployeeRecord');
const Indent = require('../models/general/Indent');
const UtilityBill = require('../models/hr/UtilityBill');
const AccountsPayable = require('../models/finance/AccountsPayable');
const {
  isDesignatedCeoApprover,
  isCeoSecretariatPsRole,
  canViewCeoForwardedQueue,
  isExecutiveOverride,
  resolveDesignatedCeoUserIds,
  getUserIdentityTokens,
  userMatchesText,
  sameUserId
} = require('./executiveAccess');

/** Resolve a human-readable company label from common document shapes. */
const resolveCompanyLabel = (...sources) => {
  for (const doc of sources) {
    if (!doc) continue;
    if (typeof doc === 'string' && doc.trim()) return doc.trim();
    if (typeof doc !== 'object') continue;
    const candidates = [
      doc.company,
      doc.companyName,
      doc.parentCompanyName,
      doc.subsidiaryName,
      doc.accountHead,
      doc.companyId,
      doc.placementCompany,
      doc.indent?.companyId,
      doc.indent?.company,
      doc.indent?.companyName
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim() && c.trim() !== '—') return c.trim();
      if (c && typeof c === 'object') {
        const name = c.name || c.companyName || c.companyCode;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    }
  }
  return null;
};

const card = (partial) => ({
  id: String(partial.id),
  type: partial.type,
  number: partial.number || '—',
  status: partial.status || '—',
  date: partial.date || null,
  amount: partial.amount != null ? Number(partial.amount) : null,
  party: partial.party || null,
  company: partial.company || null,
  subtitle: partial.subtitle || null,
  path: partial.path || null,
  // Flags for existing executive UI / approve routes
  isPurchaseOrder: partial.type === 'purchase_order',
  isCashApproval: partial.type === 'cash_approval',
  isPaymentSettlement: partial.type === 'payment_settlement',
  isOnboarding: partial.type === 'onboarding',
  isIndent: partial.type === 'indent',
  isUtilityBill: partial.type === 'utility_bill',
  isVendorBill: partial.type === 'vendor_bill',
  itemType: partial.itemType,
  displayRef: partial.number,
  displayDate: partial.date,
  displayAmount: partial.amount != null ? Number(partial.amount) : 0,
  displayVendor: partial.party || '—',
  displayNotes: partial.subtitle || partial.itemType || '',
  department: partial.department || null,
  workflowStatus: partial.status,
  /** PS / secretariat may see CEO queue but must not approve as CEO */
  ceoViewOnly: Boolean(partial.ceoViewOnly),
  raw: partial.raw || null
});

const isAssignedByAuthorityText = (approvalAuthorities, user) => {
  const authorities = approvalAuthorities || {};
  const assignedTexts = [
    authorities.preparedBy,
    authorities.verifiedBy,
    authorities.authorisedRep,
    authorities.financeRep,
    authorities.managerProcurement,
    authorities.srManagerProcurement,
    authorities.ceoApproval,
    authorities.avp,
    authorities.chairman
  ].filter(Boolean);
  return assignedTexts.some((t) => userMatchesText(user, t));
};

const userPendingInChain = (chain, user) => {
  if (!Array.isArray(chain) || !chain.length) return false;
  const uid = String(user._id || user.id || '');
  return chain.some((step) => {
    if (String(step.status || '').toLowerCase() !== 'pending') return false;
    return sameUserId(step.approver, uid);
  });
};

/** First pending approver id on a chain (string), or ''. */
const firstPendingApproverId = (chain) => {
  if (!Array.isArray(chain)) return '';
  const step = chain.find((s) => String(s.status || '').toLowerCase() === 'pending');
  if (!step) return '';
  return String(step.approver?._id || step.approver || '');
};

/**
 * CEO office ids for Other-tab queue (Indent / Utility / Vendor).
 * Includes env + role=ceo; also the logged-in designated CEO (non-override).
 */
async function getCeoOfficeApproverIds(user) {
  if (!canViewCeoForwardedQueue(user)) return [];
  const mongoose = require('mongoose');
  const ids = await resolveDesignatedCeoUserIds();
  const uid = String(user._id || user.id || '');
  if (
    uid
    && isDesignatedCeoApprover(user)
    && !isExecutiveOverride(user)
    && !ids.includes(uid)
  ) {
    ids.push(uid);
  }
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
}

const isPendingOnCeoOffice = (chain, ceoIds) => {
  if (!ceoIds?.length) return false;
  const pendingId = firstPendingApproverId(chain);
  return Boolean(pendingId && ceoIds.some((id) => String(id) === pendingId));
};

async function fetchPurchaseOrdersForUser(user) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);
  const tokens = getUserIdentityTokens(user);

  const or = [];
  if (canViewCeoQueue) {
    or.push({ status: 'Forwarded to CEO' });
  }

  // Comparative statement authority user ids on linked indent
  const indents = await Indent.find({
    $or: [
      { 'comparativeStatementApprovals.preparedByUser': uid },
      { 'comparativeStatementApprovals.verifiedByUser': uid },
      { 'comparativeStatementApprovals.authorisedRepUser': uid },
      { 'comparativeStatementApprovals.financeRepUser': uid },
      { 'comparativeStatementApprovals.managerProcurementUser': uid }
    ]
  }).select('_id').lean();
  const indentIds = indents.map((i) => i._id);
  if (indentIds.length) {
    or.push({
      indent: { $in: indentIds },
      status: {
        $in: [
          'Pending Approval',
          'Pending Audit',
          'Send to CEO Office',
          'Forwarded to CEO',
          'Returned from CEO Office',
          'Pending Finance'
        ]
      }
    });
  }

  // Authority text match — fetch recent open POs and filter in memory (text fields)
  const openStatuses = [
    'Pending Approval',
    'Pending Audit',
    'Forwarded to Audit Director',
    'Send to CEO Office',
    'Forwarded to CEO',
    'Returned from CEO Office',
    'Returned from Audit',
    'Pending Finance'
  ];

  const populatePoCompany = (q) => q
    .populate('vendor', 'name')
    .populate('companyId', 'name companyCode')
    .populate({
      path: 'indent',
      select: 'indentNumber title comparativeStatementApprovals companyId companyName',
      populate: { path: 'companyId', select: 'name companyCode' }
    });

  let docs = [];
  if (or.length) {
    docs = await populatePoCompany(
      PurchaseOrder.find({ $or: or }).populate('createdBy', 'firstName lastName')
    )
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
  }

  // Supplement with authority-text matches
  if (tokens.length) {
    const candidates = await populatePoCompany(
      PurchaseOrder.find({
        status: { $in: openStatuses },
        _id: { $nin: docs.map((d) => d._id) }
      })
    )
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    const matched = candidates.filter((po) => {
      if (po.status === 'Forwarded to CEO') return canViewCeoQueue;
      return isAssignedByAuthorityText(po.approvalAuthorities, user);
    });
    docs = [...docs, ...matched];
  }

  // Deduplicate + CEO isolation: only CEO/PS-coordinator may see Forwarded to CEO
  const seen = new Set();
  return docs.filter((po) => {
    const id = String(po._id);
    if (seen.has(id)) return false;
    seen.add(id);
    if (po.status === 'Forwarded to CEO' && !canViewCeoQueue) return false;
    return true;
  }).map((po) => card({
    id: po._id,
    type: 'purchase_order',
    itemType: 'Purchase Order',
    number: po.orderNumber || po.poNumber,
    status: po.status,
    date: po.orderDate || po.updatedAt,
    amount: po.totalAmount,
    party: po.vendor?.name,
    company: resolveCompanyLabel(po, po.indent),
    subtitle: po.notes || (po.indent?.title ? `PR: ${po.indent.title}` : 'Purchase Order'),
    department: 'Procurement',
    path: `/procurement/purchase-orders/${po._id}`,
    ceoViewOnly: po.status === 'Forwarded to CEO' && !isCeo,
    raw: po
  }));
}

async function fetchCashApprovalsForUser(user) {
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);
  const uid = String(user._id || user.id || '');
  const tokens = getUserIdentityTokens(user);

  const or = [];
  if (canViewCeoQueue) or.push({ status: 'Forwarded to CEO' });

  // Pending department approval chain
  or.push({
    'departmentApprovalChain.approver': uid,
    'departmentApprovalChain.status': 'pending',
    departmentApprovalStatus: { $in: ['Submitted', 'Pending'] }
  });

  // Finance authority user refs
  or.push(
    { 'financeApprovalAuthorities.accountsOfficerUser': uid, status: { $in: ['Pending Finance', 'Advance Issued'] } },
    { 'financeApprovalAuthorities.accountsManagerUser': uid, status: { $in: ['Pending Finance', 'Advance Issued'] } },
    { 'financeApprovalAuthorities.financeControllerUser': uid, status: { $in: ['Pending Finance', 'Advance Issued'] } }
  );

  let docs = await CashApproval.find({ $or: or })
    .populate('vendor', 'name')
    .populate('companyId', 'name companyCode')
    .populate('createdBy', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  if (tokens.length) {
    const candidates = await CashApproval.find({
      status: {
        $in: [
          'Pending Audit',
          'Send to CEO Office',
          'Forwarded to CEO',
          'Returned from CEO Office',
          'Pending Finance',
          'Draft',
          'Submitted'
        ]
      },
      _id: { $nin: docs.map((d) => d._id) }
    })
      .populate('vendor', 'name')
      .populate('companyId', 'name companyCode')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    const matched = candidates.filter((ca) => {
      if (ca.status === 'Forwarded to CEO') return canViewCeoQueue;
      return isAssignedByAuthorityText(ca.approvalAuthorities, user);
    });
    docs = [...docs, ...matched];
  }

  const seen = new Set();
  return docs.filter((ca) => {
    const id = String(ca._id);
    if (seen.has(id)) return false;
    seen.add(id);
    if (ca.status === 'Forwarded to CEO' && !canViewCeoQueue) return false;
    return true;
  }).map((ca) => card({
    id: ca._id,
    type: 'cash_approval',
    itemType: 'Cash Approval',
    number: ca.caNumber,
    status: ca.status || ca.workflowStatus,
    date: ca.approvalDate || ca.updatedAt,
    amount: ca.totalAmount || ca.advanceAmount,
    party: ca.advanceToName || ca.vendor?.name || ca.requestingDepartment,
    company: resolveCompanyLabel(ca),
    subtitle: ca.purpose || 'Cash Approval',
    department: ca.requestingDepartment || 'Cash Approval',
    path: `/procurement/cash-approvals/${ca._id}`,
    ceoViewOnly: (ca.status || ca.workflowStatus) === 'Forwarded to CEO' && !isCeo,
    raw: ca
  }));
}

async function fetchSettlementsForUser(user) {
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);
  const filter = canViewCeoQueue
    ? {
        $or: [
          { workflowStatus: 'Forwarded to CEO' },
          ...(!isCeo ? [{ workflowStatus: { $regex: /Send to|Pending|Forwarded/i } }] : [])
        ]
      }
    : {
        // Named prepared/approved-by text fields under HM review stages
        workflowStatus: { $regex: /Send to|Pending|Forwarded/i }
      };

  let docs = await PaymentSettlement.find(filter)
    .sort({ updatedAt: -1 })
    .limit(canViewCeoQueue ? 100 : 80)
    .lean();

  if (!isCeo) {
    docs = docs.filter((s) => {
      if (s.workflowStatus === 'Forwarded to CEO') return canViewCeoQueue;
      // Match if user name appears on authorization slots and status is awaiting sign-off
      const texts = [
        s.preparedBy,
        s.checkedBy,
        s.approvedBy,
        s.authorisedBy,
        s.verifiedBy,
        s.custodian
      ];
      return texts.some((t) => userMatchesText(user, t));
    });
  }

  return docs.map((s) => card({
    id: s._id,
    type: 'payment_settlement',
    itemType: 'Payment Settlement',
    number: s.referenceNumber || String(s._id),
    status: s.workflowStatus || s.status,
    date: s.date || s.updatedAt,
    amount: parseFloat(String(s.grandTotal || s.amount || '0').replace(/,/g, '')) || 0,
    party: s.toWhomPaid || s.custodian,
    subtitle: s.forWhat || s.notes || 'Payment Settlement',
    department: s.fromDepartment || 'Administration',
    company: resolveCompanyLabel(s) || s.subsidiaryName || s.parentCompanyName || null,
    path: `/admin/payment-settlement`,
    ceoViewOnly: s.workflowStatus === 'Forwarded to CEO' && !isCeo,
    raw: s
  }));
}

async function fetchOnboardingForUser(user) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);
  const or = [
    { workflowStatus: 'Pending AVP', assignedAvp: uid },
    { workflowStatus: 'Pending Chairman', assignedChairman: uid },
    { workflowStatus: 'Pending HOD HR', assignedHod: uid },
    { workflowStatus: 'Pending Sr Director', assignedSrDirector: uid }
  ];
  if (canViewCeoQueue) or.push({ workflowStatus: 'Forwarded to CEO' });

  const docs = await NonEmployeeRecord.find({ $or: or })
    .populate('assignedAvp', 'firstName lastName')
    .populate('assignedChairman', 'firstName lastName')
    .populate('assignedHod', 'firstName lastName')
    .populate('assignedSrDirector', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return docs.map((r) => {
    const first = Array.isArray(r.employees) && r.employees[0] ? r.employees[0] : null;
    const party = first
      ? (first.name || [first.firstName, first.lastName].filter(Boolean).join(' ').trim())
      : (r.employeeName || [r.firstName, r.lastName].filter(Boolean).join(' ') || '—');
    const extra = Array.isArray(r.employees) && r.employees.length > 1
      ? ` (+${r.employees.length - 1} more)`
      : '';
    return card({
      id: r._id,
      type: 'onboarding',
      itemType: 'Onboarding',
      number: r.recordNumber || first?.cnic || String(r._id),
      status: r.workflowStatus,
      date: r.updatedAt || r.createdAt,
      amount: null,
      party: `${party || '—'}${extra}`,
      company: resolveCompanyLabel(r, first) || first?.project || first?.location || null,
      subtitle: 'Non-employee onboarding',
      department: 'HR',
      path: `/hr/non-employee-onboarding`,
      ceoViewOnly: r.workflowStatus === 'Forwarded to CEO' && !isCeo,
      raw: r
    });
  });
}

async function fetchIndentsForUser(user, ceoIds = []) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);

  const or = [
    { approvalChain: { $elemMatch: { approver: uid, status: 'pending' } } }
  ];
  if (canViewCeoQueue && ceoIds.length) {
    or.push({
      approvalChain: {
        $elemMatch: { approver: { $in: ceoIds }, status: 'pending' }
      }
    });
  }

  const docs = await Indent.find({
    $or: or,
    status: { $nin: ['Draft', 'Cancelled', 'Rejected', 'Fulfilled'] }
  })
    .populate('requestedBy', 'firstName lastName')
    .populate('department', 'name')
    .populate('companyId', 'name companyCode')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  const seen = new Set();
  return docs.filter((ind) => {
    const id = String(ind._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((ind) => {
    const onCeoQueue = isPendingOnCeoOffice(ind.approvalChain, ceoIds);
    const iAmPending = userPendingInChain(ind.approvalChain, user);
    return card({
      id: ind._id,
      type: 'indent',
      itemType: 'Indent',
      number: ind.indentNumber,
      status: ind.status,
      date: ind.requestedDate || ind.updatedAt,
      amount: ind.estimatedTotal || null,
      party: ind.requestedBy
        ? `${ind.requestedBy.firstName || ''} ${ind.requestedBy.lastName || ''}`.trim()
        : null,
      subtitle: ind.title || 'Indent pending approval',
      department: ind.department?.name || 'Indent',
      company: resolveCompanyLabel(ind),
      path: `/general/indents/${ind._id}`,
      ceoViewOnly: onCeoQueue && !isCeo && !iAmPending,
      raw: ind
    });
  });
}

async function fetchUtilityBillsForUser(user, ceoIds = []) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);

  const or = [
    { approvalChain: { $elemMatch: { approver: uid, status: 'pending' } } }
  ];
  if (canViewCeoQueue && ceoIds.length) {
    or.push({
      approvalChain: {
        $elemMatch: { approver: { $in: ceoIds }, status: 'pending' }
      }
    });
  }

  const docs = await UtilityBill.find({
    $or: or,
    approvalStatus: { $in: ['Submitted', 'Draft'] }
  })
    .populate('createdBy', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  const seen = new Set();
  return docs.filter((b) => {
    const id = String(b._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((b) => {
    const onCeoQueue = isPendingOnCeoOffice(b.approvalChain, ceoIds);
    const iAmPending = userPendingInChain(b.approvalChain, user);
    return card({
      id: b._id,
      type: 'utility_bill',
      itemType: 'Store / Utility Bill',
      number: b.billId || b.billNumber || String(b._id),
      status: b.approvalStatus || b.status,
      date: b.billDate || b.updatedAt,
      amount: b.totalAmount,
      party: b.provider || b.vendorName,
      company: resolveCompanyLabel(b) || b.accountHead || b.site || null,
      subtitle: b.forWhat || b.notes || 'Bill pending approval',
      department: 'Centralized Store',
      path: `/general/centralized-store/bills`,
      ceoViewOnly: onCeoQueue && !isCeo && !iAmPending,
      raw: b
    });
  });
}

async function fetchVendorBillsForUser(user, ceoIds = []) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const canViewCeoQueue = canViewCeoForwardedQueue(user);
  const ceoIdSet = new Set((ceoIds || []).map(String));

  // Chart of Accounts bills: department approvalChain (Sr Manager Finance → GM Finance), sequential pending step
  const or = [
    { approvalChain: { $elemMatch: { approver: uid, status: 'pending' } } }
  ];
  if (canViewCeoQueue && ceoIds.length) {
    or.push({
      approvalChain: {
        $elemMatch: { approver: { $in: ceoIds }, status: 'pending' }
      }
    });
  }

  const docs = await AccountsPayable.find({
    approvalStatus: 'Submitted',
    $or: or,
    status: { $nin: ['paid', 'cancelled', 'void', 'approved', 'partial'] }
  })
    .select('billNumber billDate totalAmount status approvalStatus vendor vendorName company companyId notes approvalChain module referenceType')
    .populate('companyId', 'name companyCode')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean()
    .catch(() => []);

  const seen = new Set();
  return (docs || [])
    .filter((b) => {
      const id = String(b._id);
      if (seen.has(id)) return false;
      seen.add(id);
      // Only surface when this user (or CEO office) is the first pending step
      const chain = Array.isArray(b.approvalChain) ? b.approvalChain : [];
      const firstPending = chain.find((s) => s.status === 'pending');
      if (!firstPending) return false;
      const pendingId = String(firstPending.approver?._id || firstPending.approver || '');
      if (pendingId === uid) return true;
      if (canViewCeoQueue && ceoIdSet.has(pendingId)) return true;
      return false;
    })
    .map((b) => {
      const onCeoQueue = isPendingOnCeoOffice(b.approvalChain, ceoIds);
      const iAmPending = userPendingInChain(b.approvalChain, user);
      return card({
        id: b._id,
        type: 'vendor_bill',
        itemType: 'Chart of Accounts Bill',
        number: b.billNumber,
        status: b.approvalStatus || b.status,
        date: b.billDate || b.updatedAt,
        amount: b.totalAmount,
        party: b.vendorName || b.vendor?.name,
        company: resolveCompanyLabel(b),
        subtitle: b.notes || 'Pending department approval (Finance)',
        department: 'Finance',
        path: `/finance/accounts-payable`,
        ceoViewOnly: onCeoQueue && !isCeo && !iAmPending,
        raw: b
      });
    });
}

/**
 * @param {object} user - req.user
 * @returns {Promise<{ items: object[], counts: object, isDesignatedCeo: boolean }>}
 */
async function buildExecutiveMyApprovals(user) {
  if (!user) {
    return {
      items: [],
      counts: {},
      isDesignatedCeo: false,
      canApproveAsCeo: false,
      isCeoSecretariatPs: false,
      canViewCeoForwardedQueue: false
    };
  }

  const ceoIds = await getCeoOfficeApproverIds(user).catch((e) => {
    console.error('[executiveMyApprovals] ceoIds', e.message);
    return [];
  });

  const [
    purchaseOrders,
    cashApprovals,
    settlements,
    onboarding,
    indents,
    utilityBills,
    vendorBills
  ] = await Promise.all([
    fetchPurchaseOrdersForUser(user).catch((e) => {
      console.error('[executiveMyApprovals] PO', e.message);
      return [];
    }),
    fetchCashApprovalsForUser(user).catch((e) => {
      console.error('[executiveMyApprovals] CA', e.message);
      return [];
    }),
    fetchSettlementsForUser(user).catch((e) => {
      console.error('[executiveMyApprovals] Settlement', e.message);
      return [];
    }),
    fetchOnboardingForUser(user).catch((e) => {
      console.error('[executiveMyApprovals] Onboarding', e.message);
      return [];
    }),
    fetchIndentsForUser(user, ceoIds).catch((e) => {
      console.error('[executiveMyApprovals] Indent', e.message);
      return [];
    }),
    fetchUtilityBillsForUser(user, ceoIds).catch((e) => {
      console.error('[executiveMyApprovals] UtilityBill', e.message);
      return [];
    }),
    fetchVendorBillsForUser(user, ceoIds).catch((e) => {
      console.error('[executiveMyApprovals] VendorBill', e.message);
      return [];
    })
  ]);

  const items = [
    ...purchaseOrders,
    ...cashApprovals,
    ...settlements,
    ...onboarding,
    ...indents,
    ...utilityBills,
    ...vendorBills
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const counts = {
    purchase_order: purchaseOrders.length,
    cash_approval: cashApprovals.length,
    payment_settlement: settlements.length,
    onboarding: onboarding.length,
    indent: indents.length,
    utility_bill: utilityBills.length,
    vendor_bill: vendorBills.length,
    total: items.length
  };

  return {
    items,
    counts,
    isDesignatedCeo: isDesignatedCeoApprover(user),
    canApproveAsCeo: isDesignatedCeoApprover(user),
    isCeoSecretariatPs: isCeoSecretariatPsRole(user),
    canViewCeoForwardedQueue: canViewCeoForwardedQueue(user)
  };
}

module.exports = {
  buildExecutiveMyApprovals,
  userPendingInChain,
  isAssignedByAuthorityText
};
