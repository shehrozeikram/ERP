/**
 * Permission-aware document search for the AI Document Assistant.
 * Intent → structured filters → Mongo via these helpers only (never free-form LLM queries).
 */

const Indent = require('../models/general/Indent');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const CashApproval = require('../models/procurement/CashApproval');
const AccountsPayable = require('../models/finance/AccountsPayable');
const JournalEntry = require('../models/finance/JournalEntry');
const GoodsReceive = require('../models/procurement/GoodsReceive');
const UtilityBill = require('../models/hr/UtilityBill');
const { tryAuthorize } = require('../middleware/auth');
const {
  resolveCompanyFromRequest,
  companyQuery,
  voucherCompanyQuery
} = require('./financeCompanyContext');

const DOC_TYPES = [
  'indent',
  'purchase_order',
  'cash_approval',
  'bill',
  'voucher',
  'grn',
  'utility_bill'
];
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 15;

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasModuleAccess = (roleDoc, moduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((p) => p?.module === moduleKey);
};

const hasFinanceAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'finance_manager', 'higher_management', 'developer'].includes(user.role)) {
    return true;
  }
  if (hasModuleAccess(user.roleRef, 'finance')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'finance'))) return true;
  return false;
};

const hasProcurementAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'procurement_manager', 'higher_management', 'developer'].includes(user.role)) {
    return true;
  }
  if (hasModuleAccess(user.roleRef, 'procurement')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => hasModuleAccess(r, 'procurement'))) return true;
  return false;
};

const companyName = (doc) => {
  const c = doc?.companyId;
  if (!c) return null;
  if (typeof c === 'object') return c.name || c.companyCode || null;
  return null;
};

const formatCard = ({ type, id, number, status, company, amount, date, path, subtitle, location }) => ({
  type,
  id: String(id),
  number: number || '—',
  status: status || '—',
  company: company || null,
  amount: amount != null && !Number.isNaN(Number(amount)) ? Number(amount) : null,
  date: date ? new Date(date).toISOString() : null,
  path,
  subtitle: subtitle || null,
  location: location || status || null
});

const APPROVER_ROLE_LABELS = {
  manager: 'Manager Approver',
  hod: 'Head Of Department',
  sr_manager: 'Sr Manager',
  avp_taj: 'AVP Taj'
};

const USER_POPULATE = 'firstName lastName department';

function userLabel(user) {
  if (!user || typeof user !== 'object') return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

function userDept(user) {
  if (!user || typeof user !== 'object') return null;
  const dept = String(user.department || '').trim();
  return dept || null;
}

/** Map workflow status → owning department / queue (when no single assignee). */
function departmentForWorkflowStatus(status) {
  const s = String(status || '');
  if (/audit director|forwarded to audit/i.test(s)) {
    return { department: 'Audit', queue: 'Audit Director' };
  }
  if (/send to audit|pending audit|sent to audit|pre-?audit/i.test(s)) {
    return { department: 'Pre-Audit', queue: 'Pre-Audit team' };
  }
  if (/ceo/i.test(s)) {
    return { department: 'CEO Office', queue: 'CEO Office / Secretariat' };
  }
  if (/finance|payment settled|pending finance|sent to finance|paid/i.test(s)) {
    return { department: 'Finance', queue: 'Finance team' };
  }
  if (/store|grn|sent to store|goods receive/i.test(s)) {
    return { department: 'Store', queue: 'Store team' };
  }
  if (/procurement|sent to procurement/i.test(s)) {
    return { department: 'Procurement', queue: 'Procurement team' };
  }
  return null;
}

/**
 * Build location like:
 * "With Ahmed Khan · Manager Approver · HR — Department approval"
 * "At Pre-Audit team · Pre-Audit — Send to Audit"
 */
function formatWorkflowLocation({ stage, department, person, role, queue } = {}) {
  const bits = [];
  if (person || role || department) {
    const withParts = [];
    if (person) withParts.push(person);
    if (role) withParts.push(role);
    if (department) withParts.push(department);
    bits.push(`With ${withParts.join(' · ')}`);
  } else if (queue) {
    bits.push(`At ${queue}${department && department !== queue ? ` (${department})` : ''}`);
  } else if (department) {
    bits.push(`At ${department}`);
  }
  if (stage) bits.push(stage);
  return bits.filter(Boolean).join(' — ') || stage || 'Unknown stage';
}

function pendingChainStep(chain) {
  if (!Array.isArray(chain)) return null;
  return chain.find((s) => String(s?.status || '').toLowerCase() === 'pending') || null;
}

/** Human-readable workflow location for utility / store bills. */
function locationForUtilityBill(d) {
  const audit = String(d.auditStatus || '').trim();
  if (audit && audit !== 'Not Sent') {
    if (/Returned|Rejected/i.test(audit)) {
      return formatWorkflowLocation({
        stage: audit,
        person: userLabel(d.createdBy),
        department: userDept(d.createdBy),
        role: 'Requester'
      });
    }
    const map = departmentForWorkflowStatus(audit);
    return formatWorkflowLocation({
      stage: audit,
      department: map?.department,
      queue: map?.queue
    });
  }
  if (d.approvalStatus === 'Draft') {
    return formatWorkflowLocation({
      stage: 'Draft (not submitted)',
      person: userLabel(d.createdBy),
      department: userDept(d.createdBy),
      role: 'Creator'
    });
  }
  if (d.approvalStatus === 'Rejected') {
    return formatWorkflowLocation({
      stage: 'Rejected in approval',
      person: userLabel(d.createdBy),
      department: userDept(d.createdBy),
      role: 'Requester'
    });
  }
  if (d.approvalStatus === 'Submitted') {
    const pending = pendingChainStep(d.approvalChain);
    if (pending) {
      const appr = pending.approver;
      return formatWorkflowLocation({
        stage: 'Department approval',
        person: userLabel(appr),
        department: userDept(appr),
        role: APPROVER_ROLE_LABELS[pending.role] || pending.role || 'Approver'
      });
    }
    return formatWorkflowLocation({
      stage: 'Submitted · in approval',
      queue: 'Department approvers',
      department: 'Department'
    });
  }
  if (d.approvalStatus === 'Approved') {
    if (d.status === 'Paid') {
      return formatWorkflowLocation({ stage: 'Paid (complete)', department: 'Finance', queue: 'Finance team' });
    }
    if (d.status === 'Partial') {
      return formatWorkflowLocation({ stage: 'Partially paid', department: 'Finance', queue: 'Finance team' });
    }
    if (d.status === 'Overdue') {
      return formatWorkflowLocation({ stage: 'Payment overdue', department: 'Finance', queue: 'Finance team' });
    }
    return formatWorkflowLocation({
      stage: 'Approved · next: Audit / Finance',
      department: 'Pre-Audit',
      queue: 'Ready for Audit / Finance'
    });
  }
  return d.status || d.approvalStatus || 'Unknown stage';
}

function locationForCashApproval(d) {
  const deptStatus = String(d.departmentApprovalStatus || '').trim();
  if (deptStatus === 'Submitted' || (d.status === 'Pending Approval' && deptStatus !== 'Approved')) {
    const pending = pendingChainStep(d.departmentApprovalChain);
    if (pending) {
      const appr = pending.approver;
      return formatWorkflowLocation({
        stage: 'Department approval',
        person: userLabel(appr),
        department: userDept(appr),
        role: 'Approver'
      });
    }
  }
  if (/^Draft$/i.test(d.status) || deptStatus === 'Draft') {
    return formatWorkflowLocation({
      stage: 'Draft',
      person: userLabel(d.createdBy),
      department: userDept(d.createdBy),
      role: 'Creator'
    });
  }
  const map = departmentForWorkflowStatus(d.status);
  if (map) {
    return formatWorkflowLocation({ stage: d.status, department: map.department, queue: map.queue });
  }
  return formatWorkflowLocation({ stage: d.status, department: 'Cash Approval' });
}

function locationForIndent(d) {
  const pending = pendingChainStep(d.approvalChain);
  if (pending || /submitted|under review|pending/i.test(String(d.status || ''))) {
    if (pending) {
      const appr = pending.approver;
      return formatWorkflowLocation({
        stage: d.status || 'Pending approval',
        person: userLabel(appr),
        department: userDept(appr),
        role: 'Approver'
      });
    }
  }
  if (/draft/i.test(String(d.status || ''))) {
    return formatWorkflowLocation({
      stage: 'Draft',
      person: userLabel(d.createdBy) || userLabel(d.requestedBy),
      department: userDept(d.createdBy) || userDept(d.requestedBy),
      role: 'Requester'
    });
  }
  const map = departmentForWorkflowStatus(d.status);
  if (map) {
    return formatWorkflowLocation({ stage: d.status, department: map.department, queue: map.queue });
  }
  return formatWorkflowLocation({
    stage: d.status,
    person: userLabel(d.requestedBy) || userLabel(d.createdBy),
    department: userDept(d.requestedBy) || userDept(d.createdBy)
  });
}

function locationForPurchaseOrder(d) {
  if (/draft/i.test(String(d.status || ''))) {
    return formatWorkflowLocation({
      stage: 'Draft',
      person: userLabel(d.createdBy),
      department: userDept(d.createdBy) || 'Procurement',
      role: 'Creator'
    });
  }
  if (/pending approval/i.test(String(d.status || ''))) {
    return formatWorkflowLocation({
      stage: d.status,
      department: 'Procurement',
      queue: 'Procurement approvers'
    });
  }
  const map = departmentForWorkflowStatus(d.status);
  if (map) {
    return formatWorkflowLocation({ stage: d.status, department: map.department, queue: map.queue });
  }
  return formatWorkflowLocation({ stage: d.status, department: 'Procurement' });
}

function locationForSimpleStatus(status, moduleHint, holderUser = null) {
  const s = String(status || '').trim();
  if (!s) return moduleHint || 'Unknown stage';
  if (/draft/i.test(s)) {
    return formatWorkflowLocation({
      stage: 'Draft',
      person: userLabel(holderUser),
      department: userDept(holderUser) || moduleHint,
      role: 'Creator'
    });
  }
  const map = departmentForWorkflowStatus(s);
  if (map) {
    return formatWorkflowLocation({ stage: s, department: map.department, queue: map.queue });
  }
  if (/approv/i.test(s)) return formatWorkflowLocation({ stage: s, department: moduleHint });
  return s;
}

/** Scope Mongo filter to the current user's own documents. */
function withOwnerScope(filter, intent, ownerFields = ['createdBy']) {
  if (!intent?.mine || !intent?.userId) return filter;
  const uid = intent.userId;
  const ownerOr = ownerFields.map((f) => ({ [f]: uid }));
  const ownerClause = ownerOr.length === 1 ? ownerOr[0] : { $or: ownerOr };
  const base = filter && Object.keys(filter).length ? filter : null;
  if (!base) return ownerClause;
  return { $and: [base, ownerClause] };
}

/** Rule-based intent parser (works without OPENAI_API_KEY). */
function parseIntentRules(rawQuery) {
  const query = String(rawQuery || '').trim();
  const lower = query.toLowerCase();

  // Utility bill IDs look like ELE123456 / OTH325450 (3-letter type + digits)
  const UTILITY_BILL_ID_RE = /\b((?:ELE|WAT|GAS|INT|PHO|MAI|SEC|CLE|REN|OTH)[A-Z0-9]*\d{4,})\b/i;

  const numberMatchers = [
    { type: 'indent', re: /\bIND(?:ENT)?[-/\s]*[A-Z0-9][A-Z0-9\-_/]*/i },
    // PO-000275, PO 275, PO000275 — require separator or digits so "pending" never matches
    { type: 'purchase_order', re: /\bP\.?O\.?(?:[-/\s]+[A-Z0-9][A-Z0-9\-_/]*|[0-9][A-Z0-9\-_/]*)/i },
    // Require separator so "cash" never becomes CA number
    { type: 'cash_approval', re: /\bC\.?A\.?[-/\s]+[A-Z0-9][A-Z0-9\-_/]*/i },
    { type: 'voucher', re: /\b(?:BPV|CPV|JV|PV)[-/\s]+[A-Z0-9][A-Z0-9\-_/]*/i },
    // GRN / GR / common typo "grin"
    { type: 'grn', re: /\b(?:GRN|GRIN|GR)[-/\s]*[0-9][A-Z0-9\-_/]*/i },
    // Formal prefixes only with hyphen/slash (not space) — "bill OTH325450" must NOT become BILLOTH…
    { type: 'bill', re: /\b(?:BILL|INV)[-/]+[A-Z0-9][A-Z0-9\-_/]*/i }
  ];

  let number = null;
  let numberRaw = null;
  let typesFromNumber = [];
  for (const m of numberMatchers) {
    const match = query.match(m.re);
    if (match) {
      numberRaw = match[0];
      number = match[0].replace(/\s+/g, '').toUpperCase().replace(/^GRIN/i, 'GRN');
      typesFromNumber.push(m.type);
      break;
    }
  }

  // Utility bill id first (OTH325450) — English "bill OTH…" must keep OTH… as the number
  if (!number) {
    const ub = query.match(UTILITY_BILL_ID_RE);
    if (ub) {
      numberRaw = ub[1];
      number = ub[1].toUpperCase();
      typesFromNumber.push('utility_bill');
    }
  }

  // "bill OTH325450" / "invoice ABC123" — capture id only, not the word BILL
  if (!number) {
    const billRef = query.match(
      /\b(?:bills?|invoices?|vendor\s*bills?)\s*(?:number|no\.?|#|:)?\s*([A-Z0-9][A-Z0-9\-_/]{3,})\b/i
    );
    if (billRef) {
      numberRaw = billRef[0];
      number = billRef[1].toUpperCase();
      typesFromNumber.push('bill');
      // Unknown style ids may be utility or AP — search both
      typesFromNumber.push('utility_bill');
    }
  }

  // "purchase order 000275" / "po number 275" without PO- prefix
  if (!number) {
    const poNum = query.match(
      /\b(?:purchase\s*orders?|p\.?o\.?)\s*(?:number|no\.?|#|:)?\s*([A-Z0-9][A-Z0-9\-_/]{2,})\b/i
    );
    if (poNum) {
      numberRaw = poNum[0];
      number = poNum[1].toUpperCase();
      typesFromNumber.push('purchase_order');
    }
  }

  // Bare alphanumeric doc-looking tokens (e.g. "ABC-2024-001" or "OTH325450")
  if (!number) {
    const bare = query.match(/\b([A-Z]{2,5}[-_/][A-Z0-9][A-Z0-9\-_/]*)\b/i);
    if (bare) {
      numberRaw = bare[1];
      number = bare[1].toUpperCase();
    } else {
      const compact = query.match(/\b([A-Z]{3}\d{4,})\b/i);
      if (compact) {
        numberRaw = compact[1];
        number = compact[1].toUpperCase();
        typesFromNumber.push('utility_bill');
        typesFromNumber.push('bill');
      }
    }
  }

  const types = new Set(typesFromNumber);
  if (/\b(indent|indents|requisition|purchase\s*request)\b/i.test(lower)) types.add('indent');
  if (
    /\b(purchase\s*orders?|\bp\.?o\.?s?\b)\b/i.test(lower) ||
    /\bpurchase\s+order\b/i.test(lower)
  ) {
    types.add('purchase_order');
  }
  if (/\b(cash\s*approvals?|\bca\b)\b/i.test(lower)) types.add('cash_approval');
  // Utility / store bills before generic "bill" so "utility bill" does not become AP only
  if (
    /\b(utility\s*bills?|centrali[sz]ed\s*store\s*bills?|electricity\s*bills?|gas\s*bills?|water\s*bills?|internet\s*bills?)\b/i.test(
      lower
    ) ||
    /\butility\b/i.test(lower) ||
    types.has('utility_bill')
  ) {
    types.add('utility_bill');
  }
  if (
    !types.has('utility_bill') &&
    /\b(bills?|accounts?\s*payable|\bap\b|vendor\s*bills?|invoices?)\b/i.test(lower)
  ) {
    types.add('bill');
  } else if (
    types.has('utility_bill') &&
    /\b(accounts?\s*payable|\bap\b|vendor\s*bills?)\b/i.test(lower)
  ) {
    types.add('bill');
  } else if (
    // "my bill OTH…" — also check AP in case id is not utility
    types.has('utility_bill') &&
    /\bbills?\b/i.test(lower)
  ) {
    types.add('bill');
  }
  if (/\b(vouchers?|bpv|cpv|journal\s*entr)/i.test(lower)) types.add('voucher');
  // GRN + common typo "grin"
  if (
    /\b(grns?|grin|goods\s*receiv(?:e|ed|ing)?|goods\s*receipt|gate\s*pass)\b/i.test(lower)
  ) {
    types.add('grn');
  }

  // "my bills / where are my …" → scope to current user
  let mine =
    /\b(my|mine)\b/i.test(lower) ||
    /\bwhere\s+(are|is)\s+my\b/i.test(lower) ||
    /\b(i\s+created|i\s+raised|i\s+submitted)\b/i.test(lower) ||
    /\bthis\s+(bill|po|document|indent|grn|voucher|approval)\b/i.test(lower);

  // Everyday “my bills” usually means utility/store bills as well as AP
  if (
    mine &&
    types.has('bill') &&
    !/\b(vendor\s*bills?|accounts?\s*payable|\bap\b)\b/i.test(lower)
  ) {
    types.add('utility_bill');
  }
  if (mine && /\b(documents?|docs)\b/i.test(lower) && types.size === 0) {
    DOC_TYPES.forEach((t) => types.add(t));
  }

  let status = null;
  if (/\b(pending|awaiting|under\s*review)\b/i.test(lower)) status = 'pending';
  else if (/\b(returned|sent\s*back)\b/i.test(lower)) status = 'returned';
  else if (/\b(approved|complete[d]?)\b/i.test(lower)) status = 'approved';
  else if (/\b(draft)\b/i.test(lower)) status = 'draft';
  else if (/\b(rejected|cancelled|canceled)\b/i.test(lower)) status = 'rejected';
  else if (/\b(paid|settled)\b/i.test(lower)) status = 'paid';
  else if (/\b(unpaid|outstanding|overdue)\b/i.test(lower)) status = 'unpaid';

  // Question focus
  let focus = null;
  if (/\b(who has|who('?s| is) holding|with whom|whose desk|who is holding)\b/i.test(lower)) {
    focus = 'who';
  } else if (/\b(what should i do|what do i do|next step|what next|how do i proceed|what('?s| is) next)\b/i.test(lower)) {
    focus = 'next';
  } else if (/\b(related|linked|trail|document\s*chain|documents?\s+for\s+this|show\s+related)\b/i.test(lower)) {
    focus = 'related';
  } else if (/\b(where\s+(is|are)|right\s+now|current\s+location|where\s+does)\b/i.test(lower)) {
    focus = 'where';
  }

  // Who/next without a specific number → default to the current user's documents
  if ((focus === 'who' || focus === 'next') && !number) {
    mine = true;
  }

  // Vendor / supplier name: "bills for vendor ABC" / "vendor Ali Traders"
  let vendor = null;
  const vendorMatch =
    query.match(/\b(?:vendor|supplier)\s*[:\-]?\s*([A-Za-z0-9][\w\s.&'-]{1,50})\b/i) ||
    query.match(/\bbills?\s+for\s+(?:vendor\s+|supplier\s+)?([A-Za-z0-9][\w\s.&'-]{1,50})\b/i);
  if (vendorMatch) {
    vendor = vendorMatch[1]
      .replace(/\b(please|today|now|pending|unpaid|my)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (vendor.length < 2) vendor = null;
    else {
      types.add('bill');
      types.add('utility_bill');
    }
  }

  // Stuck / older than N days
  let stuckDays = null;
  const stuckMatch =
    lower.match(/\b(?:stuck|older\s+than|more\s+than|over|above)\s*(\d{1,3})\s*days?\b/i) ||
    lower.match(/\b(\d{1,3})\s*\+?\s*days?\s*(?:stuck|pending|waiting|old)?\b/i);
  if (stuckMatch) {
    stuckDays = Math.min(365, Math.max(1, parseInt(stuckMatch[1], 10) || 7));
  } else if (/\b(stuck|ageing|aging|long\s*pending)\b/i.test(lower)) {
    stuckDays = 7;
  }
  if (stuckDays && !number && !vendor) {
    mine = true;
  }

  // GRN for a PO → search GRNs by poNumber
  let relatedPo = null;
  const poInQuery =
    number && /^P\.?O/i.test(String(number))
      ? number
      : (query.match(/\bP\.?O\.?[-/\s]*[A-Z0-9][A-Z0-9\-_/]*/i) || [])[0];
  if (
    poInQuery &&
    (types.has('grn') || /\b(grn|grin|goods\s*receiv)/i.test(lower)) &&
    (/\b(for|against|of)\b/i.test(lower) || types.has('purchase_order'))
  ) {
    relatedPo = String(poInQuery).replace(/\s+/g, '').toUpperCase();
    types.add('grn');
    types.delete('purchase_order');
    // Don't treat PO number as a GRN receive number
    if (number && /^P\.?O/i.test(String(number))) {
      number = null;
      numberRaw = null;
    }
  }
  if (focus === 'related' && poInQuery) {
    relatedPo = String(poInQuery).replace(/\s+/g, '').toUpperCase();
    types.add('purchase_order');
    types.add('grn');
    types.add('bill');
    types.add('indent');
  }

  // Strip known number first so keyword cleanup does not mangle PO-000275 → -000275
  let remainder = query;
  if (numberRaw) {
    remainder = remainder.replace(new RegExp(escapeRegex(numberRaw), 'i'), ' ');
  } else if (number) {
    remainder = remainder.replace(new RegExp(escapeRegex(number), 'i'), ' ');
  }
  if (relatedPo) {
    remainder = remainder.replace(new RegExp(escapeRegex(relatedPo), 'i'), ' ');
  }
  if (vendor) {
    remainder = remainder.replace(new RegExp(escapeRegex(vendor), 'i'), ' ');
  }
  remainder = remainder.replace(/\bGRIN\b/gi, ' ');

  let searchText = remainder
    .replace(
      /\b(?:hi|hello|hey|find|show|get|search|look\s*up|open|where\s+are|where\s+is|what\s+is|what\s+should|what\s+do|what\s+next|please|the|for|about|me|my|mine|a|an|of|on|this|with|number|no\.?|tell|also|and|as\s+well|their|them|these|those|currently|right\s+now|who\s+has|who\s+is|holding|related|linked|trail|against|vendor|supplier|stuck|older\s+than|more\s+than|next\s+step|next|should\s+i\s+do|how\s+do\s+i\s+proceed|i\s+do)\b/gi,
      ' '
    )
    .replace(/[?!.]+/g, ' ')
    .replace(
      /\b(?:indent|indents|requisition|purchase\s*request|purchase\s*orders?|\bp\.?o\.?s?\b|cash\s*approvals?|\bca\b|utility\s*bills?|utility|centrali[sz]ed\s*store\s*bills?|electricity\s*bills?|gas\s*bills?|water\s*bills?|internet\s*bills?|electricity|gas|water|internet|bills?|accounts?\s*payable|\bap\b|vendor\s*bills?|invoices?|vouchers?|bpv|cpv|grns?|grin|goods\s*receiv(?:e|ed|ing)?|goods\s*receipt|gate\s*pass|documents?|docs)\b/gi,
      ' '
    )
    .replace(
      /\b(?:pending|approved|draft|rejected|returned|cancelled|canceled|paid|unpaid|outstanding|overdue|awaiting|under\s*review|complete[d]?|locations?|workflow|stage|status|days?)\b/gi,
      ' '
    )
    .replace(/\b\d{1,3}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    types: types.size ? [...types] : [...DOC_TYPES],
    number,
    status,
    searchText: searchText && searchText.length >= 2 ? searchText : null,
    mine,
    focus,
    vendor,
    relatedPo,
    stuckDays,
    rawQuery: query
  };
}

/** Optional LLM intent enrichment — returns same shape as parseIntentRules or null. */
async function parseIntentWithLlm(rawQuery) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `You extract ERP document search filters. Reply with JSON only:
{"types":["indent"|"purchase_order"|"cash_approval"|"bill"|"voucher"|"grn"|"utility_bill"],"number":string|null,"status":"pending"|"approved"|"draft"|"rejected"|"returned"|"paid"|"unpaid"|null,"searchText":string|null,"mine":boolean,"focus":"where"|"who"|"next"|"related"|null,"vendor":string|null,"relatedPo":string|null,"stuckDays":number|null}
types may be multiple. number is a document number if present.
mine=true for "my …" docs. focus=where/who/next/related for those question types.
vendor=name when asking bills for a vendor. relatedPo=PO number when asking GRN/related docs for a PO.
stuckDays=N when asking documents stuck/older than N days (default 7 if "stuck" with no number).
Map synonyms: PO→purchase_order; CA→cash_approval; GRN/grin→grn; utility bill→utility_bill; vendor bill→bill; my bills→bill+utility_bill.
Never invent Mongo queries.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: String(rawQuery || '').slice(0, 500) }
        ]
      })
    });
    if (!res.ok) {
      console.warn('[aiAssistant] OpenAI intent failed:', res.status);
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const types = Array.isArray(parsed.types)
      ? parsed.types.filter((t) => DOC_TYPES.includes(t))
      : [];
    const focusOk = ['where', 'who', 'next', 'related'].includes(parsed.focus)
      ? parsed.focus
      : null;
    const stuck =
      parsed.stuckDays != null && !Number.isNaN(Number(parsed.stuckDays))
        ? Math.min(365, Math.max(1, Number(parsed.stuckDays)))
        : null;
    return {
      types: types.length ? types : [...DOC_TYPES],
      number: parsed.number ? String(parsed.number).trim() : null,
      status: parsed.status || null,
      searchText: parsed.searchText ? String(parsed.searchText).trim() : null,
      mine: Boolean(parsed.mine),
      focus: focusOk,
      vendor: parsed.vendor ? String(parsed.vendor).trim() : null,
      relatedPo: parsed.relatedPo ? String(parsed.relatedPo).trim().toUpperCase() : null,
      stuckDays: stuck,
      rawQuery: String(rawQuery || '').trim(),
      source: 'llm'
    };
  } catch (err) {
    console.warn('[aiAssistant] OpenAI intent error:', err.message);
    return null;
  }
}

async function parseIntent(rawQuery) {
  const rules = parseIntentRules(rawQuery);
  const llm = await parseIntentWithLlm(rawQuery);
  if (!llm) return { ...rules, source: 'rules' };

  // Prefer explicit number/types from rules when present; fill gaps from LLM
  return {
    types: rules.types.length && rules.types.length < DOC_TYPES.length ? rules.types : llm.types,
    number: rules.number || llm.number,
    status: rules.status || llm.status,
    searchText: rules.searchText || llm.searchText,
    mine: Boolean(rules.mine || llm.mine),
    focus: rules.focus || llm.focus || null,
    vendor: rules.vendor || llm.vendor || null,
    relatedPo: rules.relatedPo || llm.relatedPo || null,
    stuckDays: rules.stuckDays || llm.stuckDays || null,
    rawQuery: rules.rawQuery,
    source: 'rules+llm'
  };
}

function statusFilterForType(type, status) {
  if (!status) return null;
  const s = String(status).toLowerCase();

  if (type === 'indent') {
    if (s === 'pending') return { $in: ['Submitted', 'Under Review'] };
    if (s === 'approved') return 'Approved';
    if (s === 'draft') return 'Draft';
    if (s === 'returned') return { $regex: /return/i };
    if (s === 'rejected') return { $in: ['Rejected', 'Rejected in Procurement', 'Cancelled'] };
  }
  if (type === 'purchase_order' || type === 'cash_approval') {
    if (s === 'pending') {
      return {
        $regex: /pending|forwarded|send to|awaiting|under review/i
      };
    }
    if (s === 'approved') return { $in: ['Approved', 'Completed', 'Payment Settled', 'Ordered', 'Received'] };
    if (s === 'draft') return 'Draft';
    if (s === 'returned') return { $regex: /return/i };
    if (s === 'rejected') return { $in: ['Rejected', 'Cancelled'] };
  }
  if (type === 'bill') {
    if (s === 'unpaid' || s === 'pending') {
      return { $nin: ['paid', 'cancelled'] };
    }
    if (s === 'paid' || s === 'approved') return s === 'paid' ? 'paid' : { $in: ['approved', 'paid'] };
    if (s === 'draft') return 'draft';
    if (s === 'returned') return { $regex: /return/i };
    if (s === 'rejected') return 'cancelled';
  }
  if (type === 'voucher') {
    if (s === 'pending' || s === 'draft') return 'draft';
    if (s === 'approved' || s === 'paid') return 'posted';
    if (s === 'rejected') return 'reversed';
  }
  if (type === 'grn') {
    if (s === 'draft') return 'Draft';
    if (s === 'pending') return { $in: ['Draft', 'Partial'] };
    if (s === 'approved' || s === 'paid') return { $in: ['Received', 'Complete'] };
  }
  if (type === 'utility_bill') {
    if (s === 'unpaid' || s === 'pending') return { $in: ['Pending', 'Overdue', 'Partial'] };
    if (s === 'paid' || s === 'approved') return 'Paid';
    if (s === 'draft') return { approvalStatus: 'Draft' };
    if (s === 'returned') return { auditStatus: { $regex: /return/i } };
    if (s === 'rejected') return { approvalStatus: 'Rejected' };
  }
  return null;
}

async function resolveOptionalCompany(req) {
  try {
    return await resolveCompanyFromRequest(req, { required: false });
  } catch {
    return null;
  }
}

async function searchIndents(intent, limit) {
  let filter = { isActive: { $ne: false } };
  const or = [];
  if (intent.number) {
    or.push({ indentNumber: new RegExp(escapeRegex(intent.number), 'i') });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push({ indentNumber: rx }, { title: rx }, { description: rx });
  }
  if (or.length) filter.$or = or;
  const st = statusFilterForType('indent', intent.status);
  if (st) filter.status = st;
  filter = withOwnerScope(filter, intent, ['createdBy', 'requestedBy']);

  const docs = await Indent.find(filter)
    .populate('companyId', 'name companyCode')
    .populate('createdBy', USER_POPULATE)
    .populate('requestedBy', USER_POPULATE)
    .populate('approvalChain.approver', USER_POPULATE)
    .select('indentNumber title status companyId totalEstimatedCost createdAt updatedAt createdBy requestedBy approvalChain')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) =>
    formatCard({
      type: 'indent',
      id: d._id,
      number: d.indentNumber,
      status: d.status,
      company: companyName(d),
      amount: d.totalEstimatedCost,
      date: d.updatedAt || d.createdAt,
      path: `/general/indents/${d._id}`,
      subtitle: d.title,
      location: locationForIndent(d)
    })
  );
}

async function searchPurchaseOrders(intent, limit) {
  let filter = {};
  const or = [];
  if (intent.number) {
    const n = String(intent.number).replace(/^P\.?O\.?/i, '').replace(/^[-/\s]+/, '');
    const fullRx = new RegExp(escapeRegex(intent.number), 'i');
    const looseRx = n ? new RegExp(escapeRegex(n), 'i') : null;
    or.push({ orderNumber: fullRx });
    if (looseRx && n.length >= 2) or.push({ orderNumber: looseRx });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push({ orderNumber: rx }, { notes: rx }, { 'items.description': rx });
  }
  if (or.length) filter.$or = or;
  const st = statusFilterForType('purchase_order', intent.status);
  if (st) filter.status = st;
  filter = withOwnerScope(filter, intent, ['createdBy']);

  const docs = await PurchaseOrder.find(filter)
    .populate('companyId', 'name companyCode')
    .populate('vendor', 'name')
    .populate('createdBy', USER_POPULATE)
    .select('orderNumber status companyId totalAmount orderDate createdAt updatedAt vendor createdBy')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  // Optional vendor-name filter when keyword search returned nothing via field $or alone
  let results = docs;
  if (intent.searchText && !results.length && !intent.mine) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    results = await PurchaseOrder.find({ ...(st ? { status: st } : {}) })
      .populate('companyId', 'name companyCode')
      .populate('vendor', 'name')
      .populate('createdBy', USER_POPULATE)
      .select('orderNumber status companyId totalAmount orderDate createdAt updatedAt vendor createdBy')
      .sort({ updatedAt: -1 })
      .limit(Math.max(limit * 5, 40))
      .lean();
    results = results.filter((d) => rx.test(d.vendor?.name || '')).slice(0, limit);
  }

  return results.map((d) =>
    formatCard({
      type: 'purchase_order',
      id: d._id,
      number: d.orderNumber,
      status: d.status,
      company: companyName(d),
      amount: d.totalAmount,
      date: d.orderDate || d.updatedAt,
      path: `/procurement/purchase-orders`,
      subtitle: d.vendor?.name || null,
      location: locationForPurchaseOrder(d)
    })
  );
}

async function searchCashApprovals(intent, limit) {
  let filter = {};
  const or = [];
  if (intent.number) {
    or.push({ caNumber: new RegExp(escapeRegex(intent.number), 'i') });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push({ caNumber: rx }, { notes: rx }, { purpose: rx }, { requestingDepartment: rx });
  }
  if (or.length) filter.$or = or;
  const st = statusFilterForType('cash_approval', intent.status);
  if (st) filter.status = st;
  filter = withOwnerScope(filter, intent, ['createdBy']);

  const docs = await CashApproval.find(filter)
    .populate('companyId', 'name companyCode')
    .populate('createdBy', USER_POPULATE)
    .populate('departmentApprovalChain.approver', USER_POPULATE)
    .select(
      'caNumber status companyId totalAmount approvalDate createdAt updatedAt originatingModule purpose createdBy departmentApprovalStatus departmentApprovalChain'
    )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) => {
    const isGeneral = d.originatingModule === 'general';
    return formatCard({
      type: 'cash_approval',
      id: d._id,
      number: d.caNumber,
      status: d.status,
      company: companyName(d),
      amount: d.totalAmount,
      date: d.approvalDate || d.updatedAt,
      path: isGeneral ? `/general/cash-approvals/${d._id}` : `/cash-approvals/${d._id}/view`,
      subtitle: d.purpose || null,
      location: locationForCashApproval(d)
    });
  });
}

async function searchBills(intent, limit, company) {
  let base = {};
  const or = [];
  if (intent.number) {
    const rx = new RegExp(escapeRegex(intent.number), 'i');
    or.push({ billNumber: rx }, { vendorInvoiceNumber: rx });
  }
  if (intent.vendor) {
    const rx = new RegExp(escapeRegex(intent.vendor), 'i');
    or.push({ 'vendor.name': rx }, { vendorInvoiceNumber: rx });
  }
  if (intent.relatedPo) {
    const rx = new RegExp(escapeRegex(intent.relatedPo), 'i');
    or.push({ 'linkedGRNs.poNumber': rx });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push(
      { billNumber: rx },
      { vendorInvoiceNumber: rx },
      { 'vendor.name': rx },
      { notes: rx }
    );
  }
  if (or.length) base.$or = or;
  const st = statusFilterForType('bill', intent.status);
  if (st) base.status = st;
  base = withOwnerScope(base, intent, ['createdBy']);

  const filter = company && !intent.mine ? companyQuery(base, company) : base;

  const docs = await AccountsPayable.find(filter)
    .populate('companyId', 'name companyCode')
    .populate('createdBy', USER_POPULATE)
    .select('billNumber status companyId totalAmount billDate createdAt updatedAt vendor createdBy')
    .sort({ billDate: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) =>
    formatCard({
      type: 'bill',
      id: d._id,
      number: d.billNumber,
      status: d.status,
      company: companyName(d),
      amount: d.totalAmount,
      date: d.billDate || d.updatedAt,
      path: `/finance/accounts-payable`,
      subtitle: d.vendor?.name || null,
      location: locationForSimpleStatus(d.status, 'Accounts Payable', d.createdBy)
    })
  );
}

async function searchVouchers(intent, limit, company) {
  let base = {};
  const or = [];
  if (intent.number) {
    const rx = new RegExp(escapeRegex(intent.number), 'i');
    or.push({ entryNumber: rx }, { reference: rx });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push({ entryNumber: rx }, { description: rx }, { reference: rx });
  }
  if (or.length) base.$or = or;
  const st = statusFilterForType('voucher', intent.status);
  if (st) base.status = st;
  base = withOwnerScope(base, intent, ['createdBy']);

  const filter = company && !intent.mine ? voucherCompanyQuery(base, company) : base;

  const docs = await JournalEntry.find(filter)
    .populate('companyId', 'name companyCode')
    .populate('createdBy', USER_POPULATE)
    .select('entryNumber status companyId totalDebits date createdAt updatedAt description voucherSeries createdBy')
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) =>
    formatCard({
      type: 'voucher',
      id: d._id,
      number: d.entryNumber,
      status: d.status,
      company: companyName(d),
      amount: d.totalDebits,
      date: d.date || d.updatedAt,
      path: `/finance/vouchers/${d._id}`,
      subtitle: d.description || d.voucherSeries || null,
      location: locationForSimpleStatus(d.status, 'Voucher', d.createdBy)
    })
  );
}

async function searchGrns(intent, limit) {
  let filter = {};
  const or = [];
  if (intent.relatedPo) {
    const rx = new RegExp(escapeRegex(intent.relatedPo), 'i');
    or.push({ poNumber: rx });
  }
  if (intent.number) {
    const raw = String(intent.number).replace(/^GRIN/i, 'GRN');
    const digits = raw.replace(/^GRN?/i, '').replace(/^[-/\s]+/, '');
    const fullRx = new RegExp(escapeRegex(raw), 'i');
    or.push({ receiveNumber: fullRx }, { poNumber: fullRx }, { gatePassNo: fullRx });
    if (digits && digits.length >= 2) {
      const looseRx = new RegExp(escapeRegex(digits), 'i');
      or.push({ receiveNumber: looseRx }, { poNumber: looseRx });
    }
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push(
      { receiveNumber: rx },
      { poNumber: rx },
      { supplierName: rx },
      { gatePassNo: rx },
      { narration: rx },
      { prNumber: rx }
    );
  }
  if (or.length) filter.$or = or;
  const st = statusFilterForType('grn', intent.status);
  if (st) filter.status = st;
  filter = withOwnerScope(filter, intent, ['receivedBy']);

  const docs = await GoodsReceive.find(filter)
    .populate('supplier', 'name')
    .populate('receivedBy', USER_POPULATE)
    .select(
      'receiveNumber status billingStatus receiveDate createdAt updatedAt supplier supplierName poNumber gatePassNo billedAmount receivedBy'
    )
    .sort({ receiveDate: -1, updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) => {
    let location = formatWorkflowLocation({
      stage: d.status,
      person: userLabel(d.receivedBy),
      department: userDept(d.receivedBy) || 'Store',
      role: 'Received by',
      queue: !d.receivedBy ? 'Store team' : null
    });
    if (d.billingStatus && d.billingStatus !== 'nothing_to_bill') {
      location = `${location} — billing: ${String(d.billingStatus).replace(/_/g, ' ')}`;
    }
    return formatCard({
      type: 'grn',
      id: d._id,
      number: d.receiveNumber,
      status: d.status,
      company: null,
      amount: d.billedAmount,
      date: d.receiveDate || d.updatedAt,
      path: `/procurement/store/goods-receive`,
      subtitle: d.supplier?.name || d.supplierName || d.poNumber || null,
      location
    });
  });
}

async function searchUtilityBills(intent, limit) {
  let filter = {};
  const or = [];
  if (intent.number) {
    const rx = new RegExp(escapeRegex(intent.number), 'i');
    or.push({ billId: rx }, { provider: rx });
  }
  if (intent.vendor) {
    const rx = new RegExp(escapeRegex(intent.vendor), 'i');
    or.push({ provider: rx }, { site: rx });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push(
      { billId: rx },
      { provider: rx },
      { site: rx },
      { utilityType: rx },
      { accountHead: rx },
      { 'billLines.itemName': rx },
      { 'billLines.meterNumber': rx }
    );
  }
  if (or.length) filter.$or = or;

  const st = statusFilterForType('utility_bill', intent.status);
  if (st) {
    if (st.approvalStatus) filter.approvalStatus = st.approvalStatus;
    else if (st.auditStatus) filter.auditStatus = st.auditStatus;
    else filter.status = st;
  }
  filter = withOwnerScope(filter, intent, ['createdBy']);

  const docs = await UtilityBill.find(filter)
    .populate('createdBy', USER_POPULATE)
    .populate('approvalChain.approver', USER_POPULATE)
    .select(
      'billId status approvalStatus auditStatus approvalChain utilityType provider site accountHead amount grandTotal billDate dueDate createdAt updatedAt useCentralizedStore createdBy'
    )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) => {
    const path = d.useCentralizedStore
      ? `/general/centralized-store/bills/${d._id}`
      : `/finance/utility-bills/${d._id}`;
    const location = locationForUtilityBill(d);
    return formatCard({
      type: 'utility_bill',
      id: d._id,
      number: d.billId,
      status: d.auditStatus && d.auditStatus !== 'Not Sent' ? d.auditStatus : d.approvalStatus || d.status,
      company: d.accountHead || null,
      amount: d.grandTotal ?? d.amount,
      date: d.billDate || d.dueDate || d.updatedAt,
      path,
      subtitle: [d.utilityType, d.provider, d.site].filter(Boolean).join(' · ') || null,
      location
    });
  });
}

const TYPE_LABELS = {
  indent: 'Indent',
  purchase_order: 'Purchase Order',
  cash_approval: 'Cash Approval',
  bill: 'Bill / AP',
  voucher: 'Voucher',
  grn: 'GRN',
  utility_bill: 'Utility Bill'
};

function nextStepAdvice(card) {
  const loc = String(card?.location || '').toLowerCase();
  const status = String(card?.status || '').toLowerCase();
  const blob = `${loc} ${status}`;
  if (/draft/.test(blob)) {
    return 'Next: submit it for approval when the details are ready.';
  }
  if (/returned|sent back/.test(blob)) {
    return 'Next: open it, fix the return comments, then resubmit / resend to Audit.';
  }
  if (/reject/.test(blob)) {
    return 'Next: review the rejection reason; correct and recreate/resubmit if needed.';
  }
  if (/waiting on|department approval|with .*approver|procurement approvers/.test(blob)) {
    return 'Next: wait for the current approver, or follow up with them if it is urgent.';
  }
  if (/pre-audit|send to audit|pending audit|sent to audit/.test(blob)) {
    return 'Next: it is with Pre-Audit — wait for audit action, or contact Pre-Audit if urgent.';
  }
  if (/audit director/.test(blob)) {
    return 'Next: wait for Audit Director final approval.';
  }
  if (/ceo/.test(blob)) {
    return 'Next: wait for CEO Office / Secretariat action.';
  }
  if (/finance|pending finance|partially paid/.test(blob) && !/paid \(complete\)|payment settled/.test(blob)) {
    return 'Next: it is with Finance for payment / posting.';
  }
  if (/paid|complete|settled|received\b/.test(blob) && !/partially|pending|awaiting/.test(blob)) {
    return 'Next: no action needed — this looks complete.';
  }
  if (/store/.test(blob)) {
    return 'Next: check Store / GRN progress, or follow up with Store.';
  }
  return 'Next: open the document and check the latest workflow history for the required action.';
}

function filterStuckResults(results, stuckDays) {
  if (!stuckDays || !Array.isArray(results)) return results;
  const cutoff = Date.now() - stuckDays * 86400000;
  return results.filter((r) => {
    if (!r?.date) return false;
    const t = new Date(r.date).getTime();
    return !Number.isNaN(t) && t <= cutoff;
  });
}

/**
 * Related document trail for a PO (Indent → PO → GRN → Bill).
 */
async function searchRelatedTrail(intent, limit, company) {
  const poRef = intent.relatedPo || intent.number;
  if (!poRef) return [];

  const trailIntent = {
    ...intent,
    mine: false,
    userId: null,
    number: poRef,
    relatedPo: poRef,
    searchText: null,
    status: null,
    vendor: null,
    stuckDays: null,
    focus: 'related'
  };

  const [pos, grns, bills] = await Promise.all([
    searchPurchaseOrders({ ...trailIntent, relatedPo: null }, Math.min(3, limit)),
    searchGrns(trailIntent, Math.min(5, limit)),
    searchBills(trailIntent, Math.min(5, limit), company)
  ]);

  let indents = [];
  if (pos.length) {
    try {
      const poDoc = await PurchaseOrder.findOne({
        orderNumber: new RegExp(escapeRegex(poRef), 'i')
      })
        .select('indent')
        .lean();
      if (poDoc?.indent) {
        const indentDoc = await Indent.findById(poDoc.indent)
          .populate('createdBy', USER_POPULATE)
          .populate('requestedBy', USER_POPULATE)
          .populate('approvalChain.approver', USER_POPULATE)
          .select(
            'indentNumber title status companyId totalEstimatedCost createdAt updatedAt createdBy requestedBy approvalChain'
          )
          .lean();
        if (indentDoc) {
          indents = [
            formatCard({
              type: 'indent',
              id: indentDoc._id,
              number: indentDoc.indentNumber,
              status: indentDoc.status,
              company: null,
              amount: indentDoc.totalEstimatedCost,
              date: indentDoc.updatedAt || indentDoc.createdAt,
              path: `/general/indents/${indentDoc._id}`,
              subtitle: indentDoc.title,
              location: locationForIndent(indentDoc)
            })
          ];
        }
      }
    } catch (err) {
      console.warn('[aiAssistant] related indent lookup failed:', err.message);
    }
  }

  // Prefer trail order: Indent → PO → GRN → Bill
  return [...indents, ...pos, ...grns, ...bills].slice(0, limit);
}

const TOVUS_HELP =
  'Here’s how I can help you in SGC ERP:\n\n' +
  '1. Find your documents — bills, utility bills, POs, GRNs, indents, cash approvals, vouchers\n' +
  '2. Tell you where each one is / who has it in the workflow\n' +
  '3. Suggest the next step on a document\n' +
  '4. Find related docs for a PO (indent → PO → GRN → bill)\n' +
  '5. Find bills by vendor, or docs stuck more than N days\n\n' +
  'Try asking:\n' +
  '• “where are my bills?” / “who has my bill OTH325450?”\n' +
  '• “where is PO-000275 right now?”\n' +
  '• “what should I do next on this bill?”\n' +
  '• “find GRN for PO-000275” / “related documents for PO-000275”\n' +
  '• “bills for vendor Ali Traders”\n' +
  '• “my documents stuck more than 7 days”\n' +
  '• “my returned bills” / “pending GRNs”';

/** Honest fallback when Tovus cannot answer the question. */
const TOVUS_UNKNOWN =
  'I’m not sure about that yet.\n\n' +
  'I’m Tovus AI — I specialize in finding SGC ERP documents (PO, GRN, bills, utility bills, indents, cash approvals, vouchers).\n\n' +
  'Try asking with a document number or type, for example:\n' +
  '• “find PO-000275”\n' +
  '• “where is my bill OTH325450?”\n' +
  '• “pending GRNs”\n' +
  '• “unpaid utility bills”\n\n' +
  'Or say “help” to see everything I can do.';

function tovusUnknownReply(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return TOVUS_UNKNOWN;
  const short = q.length > 80 ? `${q.slice(0, 77)}…` : q;
  return (
    `I’m not sure how to answer “${short}” yet.\n\n` +
    'I’m Tovus AI — I specialize in finding SGC ERP documents (PO, GRN, bills, utility bills, indents, cash approvals, vouchers).\n\n' +
    'Try a document number or type, e.g. “find PO-000275”, “where is my bill OTH325450?”, or “pending GRNs”.\n' +
    'Say “help” if you want the full list.'
  );
}

/**
 * Small-talk / identity replies for Tovus AI.
 * Only when the message is conversational (not a document find request).
 * @returns {string|null}
 */
function tryTovusConversation(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return null;
  const lower = q.toLowerCase().replace(/[?!.,]+$/g, '').trim();

  // Pure greetings
  if (
    /^(hi|hii|hiii|hello|helloo|hey|hey there|hi there|hola|assalam[o\s]*alaikum|assalamualaikum|salam|aoa|good\s*(morning|afternoon|evening|day))$/i.test(
      lower
    )
  ) {
    return (
      'Hi — I’m Tovus AI, your SGC ERP document assistant.\n\n' +
      'Ask “where are my bills?” and I’ll list your documents with their current workflow location. ' +
      'You can also search by number, e.g. “find PO-000275”.'
    );
  }

  if (/^(how are you|how r u|how’re you|how are u|whats up|what’s up|sup)$/i.test(lower)) {
    return 'I’m doing well, thanks! Ready to help you find documents in SGC ERP. What should we look up?';
  }

  if (
    /^(who are you|what(?:'s| is) your name|what are you|are you (an? )?ai|introduce yourself)$/i.test(
      lower
    ) ||
    /\b(who are you|your name|what is tovus)\b/i.test(lower)
  ) {
    return (
      'I’m Tovus AI — the document assistant built into SGC ERP. ' +
      'I help you locate Indents, POs, GRNs, Cash Approvals, vendor bills, utility bills, and vouchers based on your permissions.'
    );
  }

  if (
    /^(help|help me|what can you do|what do you do|how (do|can) (i|you) (use|work|help)|how can you help me|how can u help me|capabilities|commands)$/i.test(
      lower
    ) ||
    /\b(what can you do|what do you do|how can you help|how can u help|how (do|can) i use you|how do you help)\b/i.test(
      lower
    )
  ) {
    return TOVUS_HELP;
  }

  if (/^(thanks|thank you|thx|ty|ok thanks|thankyou)$/i.test(lower)) {
    return 'You’re welcome! Ask anytime if you need another document.';
  }

  if (/^(bye|goodbye|see you|ok bye|Allah hafiz|allah hafiz)$/i.test(lower)) {
    return 'Goodbye! Tovus AI is here whenever you need to find a document.';
  }

  if (/^(ok|okay|k|cool|great|nice|got it)$/i.test(lower)) {
    return 'Sounds good. Send a document number or ask something like “pending purchase orders”.';
  }

  return null;
}

/**
 * Run permission-aware search for a user query.
 * @returns {{ intent, results, message, llmUsed }}
 */
async function searchDocuments(req, rawQuery, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  // Greetings / basic chat first (skip LLM + DB when it's just "hi")
  const chatReply = tryTovusConversation(rawQuery);
  if (chatReply) {
    return {
      intent: { types: [], number: null, status: null, searchText: null, source: 'tovus_chat' },
      results: [],
      message: chatReply,
      llmUsed: false
    };
  }

  const intent = await parseIntent(rawQuery);
  const userId = req.user?._id || req.user?.id || null;
  if (intent.mine && userId) {
    intent.userId = userId;
  } else {
    intent.mine = false;
    intent.userId = null;
  }

  const hasSignal = Boolean(
    intent.mine ||
    intent.number ||
    intent.searchText ||
    intent.status ||
    intent.vendor ||
    intent.relatedPo ||
    intent.stuckDays ||
    intent.focus ||
    (intent.types.length > 0 && intent.types.length < DOC_TYPES.length)
  );
  if (!hasSignal) {
    return {
      intent: {
        types: intent.types,
        number: intent.number,
        status: intent.status,
        searchText: intent.searchText,
        mine: false,
        focus: intent.focus || null,
        source: 'tovus_unknown'
      },
      results: [],
      message: tovusUnknownReply(rawQuery),
      llmUsed: Boolean(intent.source && String(intent.source).includes('llm'))
    };
  }

  const canFinance =
    hasFinanceAccess(req.user) ||
    (await tryAuthorize(req, 'super_admin', 'admin', 'finance_manager'));
  const canProcurement =
    hasProcurementAccess(req.user) ||
    (await tryAuthorize(req, 'super_admin', 'admin', 'procurement_manager'));
  const canUtility =
    canFinance ||
    (await tryAuthorize(req, 'super_admin', 'admin', 'hr_manager', 'finance_manager'));

  const allowed = new Set();
  // Indents & cash approvals: any authenticated user (same as list screens)
  allowed.add('indent');
  allowed.add('cash_approval');
  if (canProcurement || canFinance || intent.mine || intent.relatedPo || intent.focus === 'related') {
    allowed.add('purchase_order');
    allowed.add('grn');
  }
  if (canFinance || intent.mine || intent.vendor || intent.relatedPo) {
    allowed.add('bill');
    allowed.add('voucher');
  }
  // Own utility bills: always allowed when asking "my …"
  if (canUtility || intent.mine || intent.vendor) allowed.add('utility_bill');

  const typesToSearch = intent.types.filter((t) => allowed.has(t));
  // If user asked only for denied types, fall back to what they can see when number is present
  const effectiveTypes =
    typesToSearch.length > 0
      ? typesToSearch
      : intent.number || intent.mine || intent.vendor || intent.relatedPo || intent.stuckDays
        ? [...allowed]
        : [...allowed].slice(0, 3);

  const company = canFinance ? await resolveOptionalCompany(req) : null;
  const searchLimit =
    intent.mine || intent.stuckDays || intent.focus === 'related'
      ? Math.max(limit, 12)
      : limit;
  const perType = Math.max(3, Math.ceil(searchLimit / Math.max(effectiveTypes.length, 1)));

  let results = [];
  if (intent.focus === 'related' && (intent.relatedPo || intent.number)) {
    results = await searchRelatedTrail(intent, searchLimit, company);
  } else {
    const tasks = [];
    if (effectiveTypes.includes('indent')) tasks.push(searchIndents(intent, perType));
    if (effectiveTypes.includes('purchase_order')) tasks.push(searchPurchaseOrders(intent, perType));
    if (effectiveTypes.includes('cash_approval')) tasks.push(searchCashApprovals(intent, perType));
    if (effectiveTypes.includes('bill')) tasks.push(searchBills(intent, perType, company));
    if (effectiveTypes.includes('voucher')) tasks.push(searchVouchers(intent, perType, company));
    if (effectiveTypes.includes('grn')) tasks.push(searchGrns(intent, perType));
    if (effectiveTypes.includes('utility_bill')) tasks.push(searchUtilityBills(intent, perType));

    const batches = await Promise.all(tasks);
    results = batches.flat();
  }

  // Prefer exact number matches first
  if (intent.number) {
    const numRx = new RegExp(escapeRegex(intent.number), 'i');
    results.sort((a, b) => {
      const aHit = numRx.test(a.number) ? 0 : 1;
      const bHit = numRx.test(b.number) ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  } else {
    results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  if (intent.stuckDays) {
    results = filterStuckResults(results, intent.stuckDays);
  }

  results = results.slice(0, searchLimit);

  let message;
  if (!results.length) {
    if (intent.stuckDays) {
      message = `I couldn’t find documents stuck for more than ${intent.stuckDays} days that match your request.`;
    } else if (intent.vendor) {
      message = `I couldn’t find bills for vendor “${intent.vendor}” that you can access.`;
    } else if (intent.relatedPo || intent.focus === 'related') {
      message = `I couldn’t find related documents for ${intent.relatedPo || intent.number || 'that PO'}.`;
    } else if (intent.mine) {
      message =
        'I couldn’t find documents created by you for that request. ' +
        'Try “where are my bills?”, “my returned bills”, or a document number.';
    } else if (intent.number) {
      message =
        `I couldn’t find “${intent.number}” in documents you can access. ` +
        'Double-check the number, or try another keyword (vendor name, status, etc.).';
    } else if (intent.searchText && !intent.status && intent.types.length >= DOC_TYPES.length) {
      message = tovusUnknownReply(rawQuery);
    } else {
      message =
        'No matching documents found. Try “where are my bills?”, “find PO-000275”, or “help”.';
    }
  } else if (intent.focus === 'related') {
    const lines = results.map(
      (r, i) =>
        `${i + 1}. ${TYPE_LABELS[r.type] || r.type} ${r.number} — ${r.location || r.status || '—'}`
    );
    message =
      `Related document trail${intent.relatedPo || intent.number ? ` for ${intent.relatedPo || intent.number}` : ''}:\n` +
      `${lines.join('\n')}\n\nTap a card to open.`;
  } else if (intent.focus === 'next') {
    const lines = results.slice(0, 5).map((r, i) => {
      const title = `${TYPE_LABELS[r.type] || r.type} ${r.number}`;
      return `${i + 1}. ${title}\n   Now with: ${r.location || r.status || '—'}\n   ${nextStepAdvice(r)}`;
    });
    message = `Here’s what you should do next:\n${lines.join('\n')}\n\nTap a card to open.`;
  } else if (intent.focus === 'who') {
    const lines = results
      .slice(0, 8)
      .map(
        (r, i) =>
          `${i + 1}. ${TYPE_LABELS[r.type] || r.type} ${r.number} — ${r.location || r.status || '—'}`
      );
    message =
      `Here’s who currently has ${intent.mine ? 'your ' : ''}document${results.length === 1 ? '' : 's'}:\n` +
      `${lines.join('\n')}\n\nTap a card to open.`;
  } else if (intent.focus === 'where' || intent.mine) {
    const lines = results
      .slice(0, 8)
      .map(
        (r, i) =>
          `${i + 1}. ${TYPE_LABELS[r.type] || r.type} ${r.number} — ${r.location || r.status || '—'}`
      );
    const heading = intent.number
      ? `Here’s where ${intent.number} is right now:`
      : intent.mine
        ? 'Here are your documents and where they are right now:'
        : 'Here are the current locations:';
    message =
      `${heading}\n${lines.join('\n')}` +
      (results.length > 8 ? `\n…and ${results.length - 8} more.` : '') +
      '\n\nTap a card to open.';
  } else if (intent.stuckDays) {
    message =
      `Found ${results.length} document${results.length === 1 ? '' : 's'} older than ${intent.stuckDays} days. ` +
      'Each card shows the current workflow location — tap to open.';
  } else if (intent.vendor) {
    message =
      `Found ${results.length} bill${results.length === 1 ? '' : 's'} for “${intent.vendor}”. Tap a card to open.`;
  } else if (intent.relatedPo) {
    message =
      `Found ${results.length} GRN/document${results.length === 1 ? '' : 's'} for ${intent.relatedPo}. Tap a card to open.`;
  } else if (results.length === 1) {
    const r = results[0];
    message =
      `Found ${TYPE_LABELS[r.type] || r.type} ${r.number}.\n` +
      `Now with: ${r.location || r.status}.\n` +
      `${nextStepAdvice(r)}\n` +
      'Tap the card to open it.';
  } else {
    message = `Found ${results.length} documents. Each card shows the current workflow location — tap to open.`;
  }

  return {
    intent: {
      types: effectiveTypes,
      number: intent.number,
      status: intent.status,
      searchText: intent.searchText,
      mine: Boolean(intent.mine),
      focus: intent.focus || null,
      vendor: intent.vendor || null,
      relatedPo: intent.relatedPo || null,
      stuckDays: intent.stuckDays || null,
      source: intent.source
    },
    results,
    message,
    llmUsed: Boolean(intent.source && String(intent.source).includes('llm'))
  };
}

module.exports = {
  DOC_TYPES,
  parseIntentRules,
  parseIntent,
  searchDocuments,
  tryTovusConversation,
  tovusUnknownReply,
  hasFinanceAccess,
  hasProcurementAccess
};
