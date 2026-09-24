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
  getUserIdentityTokens,
  userMatchesText,
  sameUserId
} = require('./executiveAccess');

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

async function fetchPurchaseOrdersForUser(user) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const tokens = getUserIdentityTokens(user);

  const or = [];
  if (isCeo) {
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

  let docs = [];
  if (or.length) {
    docs = await PurchaseOrder.find({ $or: or })
      .populate('vendor', 'name')
      .populate('indent', 'indentNumber title comparativeStatementApprovals')
      .populate('createdBy', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
  }

  // Supplement with authority-text matches
  if (tokens.length) {
    const candidates = await PurchaseOrder.find({
      status: { $in: openStatuses },
      _id: { $nin: docs.map((d) => d._id) }
    })
      .populate('vendor', 'name')
      .populate('indent', 'indentNumber title comparativeStatementApprovals')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    const matched = candidates.filter((po) => {
      if (po.status === 'Forwarded to CEO') return isCeo;
      return isAssignedByAuthorityText(po.approvalAuthorities, user);
    });
    docs = [...docs, ...matched];
  }

  // Deduplicate + CEO isolation: non-CEO must never see Forwarded to CEO
  const seen = new Set();
  return docs.filter((po) => {
    const id = String(po._id);
    if (seen.has(id)) return false;
    seen.add(id);
    if (po.status === 'Forwarded to CEO' && !isCeo) return false;
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
    subtitle: po.notes || (po.indent?.title ? `PR: ${po.indent.title}` : 'Purchase Order'),
    department: 'Procurement',
    path: `/procurement/purchase-orders/${po._id}`,
    raw: po
  }));
}

async function fetchCashApprovalsForUser(user) {
  const isCeo = isDesignatedCeoApprover(user);
  const uid = String(user._id || user.id || '');
  const tokens = getUserIdentityTokens(user);

  const or = [];
  if (isCeo) or.push({ status: 'Forwarded to CEO' });

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
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    const matched = candidates.filter((ca) => {
      if (ca.status === 'Forwarded to CEO') return isCeo;
      return isAssignedByAuthorityText(ca.approvalAuthorities, user);
    });
    docs = [...docs, ...matched];
  }

  const seen = new Set();
  return docs.filter((ca) => {
    const id = String(ca._id);
    if (seen.has(id)) return false;
    seen.add(id);
    if (ca.status === 'Forwarded to CEO' && !isCeo) return false;
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
    subtitle: ca.purpose || 'Cash Approval',
    department: ca.requestingDepartment || 'Cash Approval',
    path: `/procurement/cash-approvals/${ca._id}`,
    raw: ca
  }));
}

async function fetchSettlementsForUser(user) {
  const isCeo = isDesignatedCeoApprover(user);
  const filter = isCeo
    ? { workflowStatus: 'Forwarded to CEO' }
    : {
        // Named prepared/approved-by text fields under HM review stages
        workflowStatus: { $regex: /Send to|Pending|Forwarded/i }
      };

  let docs = await PaymentSettlement.find(filter)
    .sort({ updatedAt: -1 })
    .limit(isCeo ? 100 : 80)
    .lean();

  if (!isCeo) {
    docs = docs.filter((s) => {
      if (s.workflowStatus === 'Forwarded to CEO') return false;
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
    company: s.subsidiaryName || s.parentCompanyName,
    path: `/admin/payment-settlement`,
    raw: s
  }));
}

async function fetchOnboardingForUser(user) {
  const uid = String(user._id || user.id || '');
  const isCeo = isDesignatedCeoApprover(user);
  const or = [
    { workflowStatus: 'Pending AVP', assignedAvp: uid },
    { workflowStatus: 'Pending Chairman', assignedChairman: uid },
    { workflowStatus: 'Pending HOD HR', assignedHod: uid }
  ];
  if (isCeo) or.push({ workflowStatus: 'Forwarded to CEO' });

  const docs = await NonEmployeeRecord.find({ $or: or })
    .populate('assignedAvp', 'firstName lastName')
    .populate('assignedChairman', 'firstName lastName')
    .populate('assignedHod', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return docs.map((r) => card({
    id: r._id,
    type: 'onboarding',
    itemType: 'Onboarding',
    number: r.recordNumber || r.cnic || String(r._id),
    status: r.workflowStatus,
    date: r.updatedAt || r.createdAt,
    amount: null,
    party: r.employeeName || [r.firstName, r.lastName].filter(Boolean).join(' ') || '—',
    subtitle: 'Non-employee onboarding',
    department: 'HR',
    path: `/hr/non-employee-onboarding`,
    raw: r
  }));
}

async function fetchIndentsForUser(user) {
  const uid = String(user._id || user.id || '');
  const docs = await Indent.find({
    approvalChain: {
      $elemMatch: { approver: uid, status: 'pending' }
    },
    status: { $nin: ['Draft', 'Cancelled', 'Rejected', 'Fulfilled'] }
  })
    .populate('requestedBy', 'firstName lastName')
    .populate('department', 'name')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return docs.map((ind) => card({
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
    company: null,
    path: `/general/indents/${ind._id}`,
    raw: ind
  }));
}

async function fetchUtilityBillsForUser(user) {
  const uid = String(user._id || user.id || '');
  const docs = await UtilityBill.find({
    approvalChain: {
      $elemMatch: { approver: uid, status: 'pending' }
    },
    approvalStatus: { $in: ['Submitted', 'Draft'] }
  })
    .populate('createdBy', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return docs.map((b) => card({
    id: b._id,
    type: 'utility_bill',
    itemType: 'Store / Utility Bill',
    number: b.billId || b.billNumber || String(b._id),
    status: b.approvalStatus || b.status,
    date: b.billDate || b.updatedAt,
    amount: b.totalAmount,
    party: b.provider || b.vendorName,
    subtitle: b.forWhat || b.notes || 'Bill pending approval',
    department: 'Centralized Store',
    path: `/general/centralized-store/bills`,
    raw: b
  }));
}

async function fetchVendorBillsForUser(user) {
  const uid = String(user._id || user.id || '');
  // AP bills rarely have approvalChain; include if schema has pending chain or observations assigned
  const docs = await AccountsPayable.find({
    $or: [
      { 'approvalChain.approver': uid, 'approvalChain.status': 'pending' },
      { 'financeApprovalAuthorities.assignedUser': uid }
    ],
    status: { $nin: ['paid', 'cancelled', 'void'] }
  })
    .select('billNumber billDate totalAmount status vendor vendorName company companyId notes')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean()
    .catch(() => []);

  return (docs || []).map((b) => card({
    id: b._id,
    type: 'vendor_bill',
    itemType: 'Vendor Bill',
    number: b.billNumber,
    status: b.status,
    date: b.billDate || b.updatedAt,
    amount: b.totalAmount,
    party: b.vendorName || b.vendor?.name,
    subtitle: b.notes || 'Vendor bill',
    department: 'Finance',
    path: `/finance/accounts-payable`,
    raw: b
  }));
}

/**
 * @param {object} user - req.user
 * @returns {Promise<{ items: object[], counts: object, isDesignatedCeo: boolean }>}
 */
async function buildExecutiveMyApprovals(user) {
  if (!user) {
    return { items: [], counts: {}, isDesignatedCeo: false };
  }

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
    fetchIndentsForUser(user).catch((e) => {
      console.error('[executiveMyApprovals] Indent', e.message);
      return [];
    }),
    fetchUtilityBillsForUser(user).catch((e) => {
      console.error('[executiveMyApprovals] UtilityBill', e.message);
      return [];
    }),
    fetchVendorBillsForUser(user).catch((e) => {
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
    isDesignatedCeo: isDesignatedCeoApprover(user)
  };
}

module.exports = {
  buildExecutiveMyApprovals,
  userPendingInChain,
  isAssignedByAuthorityText
};
