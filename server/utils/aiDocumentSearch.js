/**
 * Permission-aware document search for the AI Document Assistant.
 * Intent → structured filters → Mongo via these helpers only (never free-form LLM queries).
 */

const Indent = require('../models/general/Indent');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const CashApproval = require('../models/procurement/CashApproval');
const AccountsPayable = require('../models/finance/AccountsPayable');
const JournalEntry = require('../models/finance/JournalEntry');
const { tryAuthorize } = require('../middleware/auth');
const {
  resolveCompanyFromRequest,
  companyQuery,
  voucherCompanyQuery
} = require('./financeCompanyContext');

const DOC_TYPES = ['indent', 'purchase_order', 'cash_approval', 'bill', 'voucher'];
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

const formatCard = ({ type, id, number, status, company, amount, date, path, subtitle }) => ({
  type,
  id: String(id),
  number: number || '—',
  status: status || '—',
  company: company || null,
  amount: amount != null && !Number.isNaN(Number(amount)) ? Number(amount) : null,
  date: date ? new Date(date).toISOString() : null,
  path,
  subtitle: subtitle || null
});

/** Rule-based intent parser (works without OPENAI_API_KEY). */
function parseIntentRules(rawQuery) {
  const query = String(rawQuery || '').trim();
  const lower = query.toLowerCase();

  const numberMatchers = [
    { type: 'indent', re: /\bIND(?:ENT)?[-/\s]*[A-Z0-9][A-Z0-9\-_/]*/i },
    { type: 'purchase_order', re: /\bP\.?O\.?[-/\s]+[A-Z0-9][A-Z0-9\-_/]*/i },
    { type: 'cash_approval', re: /\bC\.?A\.?[-/\s]+[A-Z0-9][A-Z0-9\-_/]*/i },
    { type: 'voucher', re: /\b(?:BPV|CPV|JV|PV)[-/\s]+[A-Z0-9][A-Z0-9\-_/]*/i },
    // Require separator so "bills" / "invoice" do not become a number
    { type: 'bill', re: /\b(?:BILL|INV)[-/\s]+[A-Z0-9][A-Z0-9\-_/]*/i }
  ];

  let number = null;
  let typesFromNumber = [];
  for (const m of numberMatchers) {
    const match = query.match(m.re);
    if (match) {
      number = match[0].replace(/\s+/g, '').toUpperCase();
      typesFromNumber.push(m.type);
      break;
    }
  }

  // Bare alphanumeric doc-looking tokens (e.g. "ABC-2024-001")
  if (!number) {
    const bare = query.match(/\b([A-Z]{2,5}[-_/][A-Z0-9][A-Z0-9\-_/]*)\b/i);
    if (bare) number = bare[1].toUpperCase();
  }

  const types = new Set(typesFromNumber);
  if (/\b(indent|indents|requisition)\b/i.test(lower)) types.add('indent');
  if (/\b(purchase\s*orders?|\bpos\b|\bpo\b)\b/i.test(lower) || /\bpurchase\s+order\b/i.test(lower)) {
    types.add('purchase_order');
  }
  if (/\b(cash\s*approvals?|\bca\b)\b/i.test(lower)) types.add('cash_approval');
  if (/\b(bills?|accounts?\s*payable|\bap\b|invoices?)\b/i.test(lower)) types.add('bill');
  if (/\b(vouchers?|bpv|cpv|journal\s*entr)/i.test(lower)) types.add('voucher');

  let status = null;
  if (/\b(pending|awaiting|under\s*review)\b/i.test(lower)) status = 'pending';
  else if (/\b(approved|complete[d]?)\b/i.test(lower)) status = 'approved';
  else if (/\b(draft)\b/i.test(lower)) status = 'draft';
  else if (/\b(rejected|cancelled|canceled)\b/i.test(lower)) status = 'rejected';
  else if (/\b(paid|settled)\b/i.test(lower)) status = 'paid';
  else if (/\b(unpaid|outstanding|overdue)\b/i.test(lower)) status = 'unpaid';

  // Strip known number first so keyword cleanup does not mangle PO-000275 → -000275
  let remainder = query;
  if (number) {
    remainder = remainder.replace(new RegExp(escapeRegex(number), 'i'), ' ');
  }

  let searchText = remainder
    .replace(/\b(?:find|show|get|search|look\s*up|open|where\s*is|what\s*is|please|the|for|about|me)\b/gi, ' ')
    .replace(/\b(?:indent|indents|purchase\s*orders?|\bpos\b|\bpo\b|cash\s*approvals?|\bca\b|bills?|accounts?\s*payable|\bap\b|invoices?|vouchers?|bpv|cpv)\b/gi, ' ')
    .replace(/\b(?:pending|approved|draft|rejected|cancelled|canceled|paid|unpaid|outstanding|overdue|awaiting|under\s*review|complete[d]?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    types: types.size ? [...types] : [...DOC_TYPES],
    number,
    status,
    searchText: searchText && searchText.length >= 2 ? searchText : null,
    rawQuery: query
  };
}

/** Optional LLM intent enrichment — returns same shape as parseIntentRules or null. */
async function parseIntentWithLlm(rawQuery) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `You extract ERP document search filters. Reply with JSON only:
{"types":["indent"|"purchase_order"|"cash_approval"|"bill"|"voucher"],"number":string|null,"status":"pending"|"approved"|"draft"|"rejected"|"paid"|"unpaid"|null,"searchText":string|null}
types may be multiple. number is a document number if present. Never invent Mongo queries.`;

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
    return {
      types: types.length ? types : [...DOC_TYPES],
      number: parsed.number ? String(parsed.number).trim() : null,
      status: parsed.status || null,
      searchText: parsed.searchText ? String(parsed.searchText).trim() : null,
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
    if (s === 'rejected') return { $in: ['Rejected', 'Cancelled'] };
  }
  if (type === 'bill') {
    if (s === 'unpaid' || s === 'pending') {
      return { $nin: ['paid', 'cancelled'] };
    }
    if (s === 'paid' || s === 'approved') return s === 'paid' ? 'paid' : { $in: ['approved', 'paid'] };
    if (s === 'draft') return 'draft';
    if (s === 'rejected') return 'cancelled';
  }
  if (type === 'voucher') {
    if (s === 'pending' || s === 'draft') return 'draft';
    if (s === 'approved' || s === 'paid') return 'posted';
    if (s === 'rejected') return 'reversed';
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
  const filter = { isActive: { $ne: false } };
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

  const docs = await Indent.find(filter)
    .populate('companyId', 'name companyCode')
    .select('indentNumber title status companyId totalEstimatedCost createdAt updatedAt')
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
      subtitle: d.title
    })
  );
}

async function searchPurchaseOrders(intent, limit) {
  const filter = {};
  const or = [];
  if (intent.number) {
    or.push({ orderNumber: new RegExp(escapeRegex(intent.number), 'i') });
  }
  if (intent.searchText) {
    const rx = new RegExp(escapeRegex(intent.searchText), 'i');
    or.push({ orderNumber: rx }, { notes: rx }, { 'items.description': rx });
  }
  if (or.length) filter.$or = or;
  const st = statusFilterForType('purchase_order', intent.status);
  if (st) filter.status = st;

  const docs = await PurchaseOrder.find(filter)
    .populate('companyId', 'name companyCode')
    .populate('vendor', 'name')
    .select('orderNumber status companyId totalAmount orderDate createdAt updatedAt vendor')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) =>
    formatCard({
      type: 'purchase_order',
      id: d._id,
      number: d.orderNumber,
      status: d.status,
      company: companyName(d),
      amount: d.totalAmount,
      date: d.orderDate || d.updatedAt,
      path: `/procurement/purchase-orders`,
      subtitle: d.vendor?.name || null
    })
  );
}

async function searchCashApprovals(intent, limit) {
  const filter = {};
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

  const docs = await CashApproval.find(filter)
    .populate('companyId', 'name companyCode')
    .select('caNumber status companyId totalAmount approvalDate createdAt updatedAt originatingModule purpose')
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
      subtitle: d.purpose || null
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

  const filter = company ? companyQuery(base, company) : base;

  const docs = await AccountsPayable.find(filter)
    .populate('companyId', 'name companyCode')
    .select('billNumber status companyId totalAmount billDate createdAt updatedAt vendor')
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
      subtitle: d.vendor?.name || null
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

  const filter = company ? voucherCompanyQuery(base, company) : base;

  const docs = await JournalEntry.find(filter)
    .populate('companyId', 'name companyCode')
    .select('entryNumber status companyId totalDebits date createdAt updatedAt description voucherSeries')
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
      subtitle: d.description || d.voucherSeries || null
    })
  );
}

/**
 * Run permission-aware search for a user query.
 * @returns {{ intent, results, message, llmUsed }}
 */
async function searchDocuments(req, rawQuery, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const intent = await parseIntent(rawQuery);

  const hasSignal = Boolean(
    intent.number ||
    intent.searchText ||
    intent.status ||
    (intent.types.length > 0 && intent.types.length < DOC_TYPES.length)
  );
  if (!hasSignal) {
    return {
      intent: {
        types: intent.types,
        number: intent.number,
        status: intent.status,
        searchText: intent.searchText,
        source: intent.source
      },
      results: [],
      message:
        'Try a document number (PO-…, IND-…, CA-…, BPV-…) or keywords like “pending purchase orders” or “unpaid bills”.',
      llmUsed: Boolean(intent.source && String(intent.source).includes('llm'))
    };
  }

  const canFinance =
    hasFinanceAccess(req.user) ||
    (await tryAuthorize(req, 'super_admin', 'admin', 'finance_manager'));
  const canProcurement =
    hasProcurementAccess(req.user) ||
    (await tryAuthorize(req, 'super_admin', 'admin', 'procurement_manager'));

  const allowed = new Set();
  // Indents & cash approvals: any authenticated user (same as list screens)
  allowed.add('indent');
  allowed.add('cash_approval');
  if (canProcurement || canFinance) allowed.add('purchase_order');
  if (canFinance) {
    allowed.add('bill');
    allowed.add('voucher');
  }

  const typesToSearch = intent.types.filter((t) => allowed.has(t));
  // If user asked only for denied types, fall back to what they can see when number is present
  const effectiveTypes =
    typesToSearch.length > 0
      ? typesToSearch
      : intent.number
        ? [...allowed]
        : [...allowed].slice(0, 3);

  const company = canFinance ? await resolveOptionalCompany(req) : null;
  const perType = Math.max(3, Math.ceil(limit / Math.max(effectiveTypes.length, 1)));

  const tasks = [];
  if (effectiveTypes.includes('indent')) tasks.push(searchIndents(intent, perType));
  if (effectiveTypes.includes('purchase_order')) tasks.push(searchPurchaseOrders(intent, perType));
  if (effectiveTypes.includes('cash_approval')) tasks.push(searchCashApprovals(intent, perType));
  if (effectiveTypes.includes('bill')) tasks.push(searchBills(intent, perType, company));
  if (effectiveTypes.includes('voucher')) tasks.push(searchVouchers(intent, perType, company));

  const batches = await Promise.all(tasks);
  let results = batches.flat();

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

  results = results.slice(0, limit);

  const typeLabel = {
    indent: 'Indent',
    purchase_order: 'Purchase Order',
    cash_approval: 'Cash Approval',
    bill: 'Bill / AP',
    voucher: 'Voucher'
  };

  let message;
  if (!results.length) {
    message = intent.number
      ? `No documents found matching "${intent.number}" that you can access.`
      : 'No matching documents found. Try a document number (e.g. PO-000275, IND-…, CA-…) or keywords.';
  } else if (results.length === 1) {
    const r = results[0];
    message = `Found ${typeLabel[r.type] || r.type} ${r.number} (${r.status}).`;
  } else {
    message = `Found ${results.length} document${results.length === 1 ? '' : 's'}.`;
  }

  return {
    intent: {
      types: effectiveTypes,
      number: intent.number,
      status: intent.status,
      searchText: intent.searchText,
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
  hasFinanceAccess,
  hasProcurementAccess
};
