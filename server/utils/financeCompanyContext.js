const mongoose = require('mongoose');
const PlacementCompany = require('../models/hr/Company');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');

const HISTORICAL_COMPANY_NAME = 'SARDAR GROUP OF COMPANIES';

const STOP_WORDS = new Set(['PVT', 'LTD', 'PRIVATE', 'LIMITED', 'THE', 'OF', 'AND', 'CO', 'INC']);

const deriveCompanyCode = (name = '') => {
  const upper = String(name || '').trim().toUpperCase();
  if (!upper) return 'CO';
  if (upper.includes('SARDAR GROUP')) return 'SGC';

  const words = upper
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word));

  if (!words.length) {
    return upper.replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'CO';
  }
  if (words.length === 1) {
    return words[0].slice(0, 4);
  }
  return words
    .slice(0, 4)
    .map((word) => word[0])
    .join('')
    .slice(0, 4);
};

const normalizeCompanyId = (value) => {
  if (!value) return null;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
};

const resolveCompanyId = async (companyIdOrName) => {
  const byId = normalizeCompanyId(companyIdOrName);
  if (byId) {
    const company = await PlacementCompany.findById(byId).select('_id name companyCode isActive').lean();
    if (!company) {
      const err = new Error('Finance company not found');
      err.statusCode = 404;
      throw err;
    }
    return company;
  }

  const name = String(companyIdOrName || '').trim();
  if (!name) {
    const err = new Error('Finance company is required');
    err.statusCode = 400;
    throw err;
  }

  const company = await PlacementCompany.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  }).select('_id name companyCode isActive').lean();

  if (!company) {
    const err = new Error(`Finance company not found: ${name}`);
    err.statusCode = 404;
    throw err;
  }
  return company;
};

const requireCompanyFromRequest = async (req) => resolveCompanyFromRequest(req, { required: true });

const resolveCompanyFromRequest = async (req, { required = true } = {}) => {
  const raw =
    req.query.companyId
    || req.body?.companyId
    || req.headers['x-finance-company-id'];

  if (!raw) {
    if (!required) return null;
    const err = new Error('companyId is required for company-wise finance');
    err.statusCode = 400;
    throw err;
  }

  return resolveCompanyId(raw);
};

const findHistoricalCompany = async () => {
  let company = await PlacementCompany.findOne({
    name: { $regex: /^SARDAR GROUP OF COMPANIES$/i }
  }).lean();

  if (!company) {
    company = await PlacementCompany.findOne({
      name: { $regex: /sardar group/i }
    }).lean();
  }

  return company;
};

/** Resolve company for /finance routes (header/query/body, fallback to historical). */
const resolveCompanyForFinanceRoute = async (req) => {
  try {
    return await requireCompanyFromRequest(req);
  } catch (err) {
    const historical = await findHistoricalCompany();
    if (!historical) throw err;
    return historical;
  }
};

/** Apply companyId filter to a Mongo query object. */
const companyQuery = (filters = {}, company) => {
  const query = { ...filters };
  if (company?._id) query.companyId = company._id;
  return query;
};

/**
 * Resolve companyId from explicit id, employee placement, procurement chain, or account — historical fallback.
 */
const placementFromUserId = async (userId) => {
  if (!userId) return null;
  const user = await User.findById(userId).select('employeeId employee').lean();
  if (user?.employee) {
    const emp = await Employee.findById(user.employee).select('placementCompany').lean();
    return normalizeCompanyId(emp?.placementCompany);
  }
  const empCode = String(user?.employeeId || '').trim();
  if (empCode) {
    const emp = await Employee.findOne({ employeeId: empCode }).select('placementCompany').lean();
    return normalizeCompanyId(emp?.placementCompany);
  }
  return null;
};

const resolveDocumentCompanyId = async ({
  companyId,
  employee,
  employeeId,
  account,
  userId,
  indentId,
  purchaseOrderId,
  grnId,
  cashApprovalId
} = {}) => {
  const direct = normalizeCompanyId(companyId);
  if (direct) return direct;

  let emp = employee;
  if (!emp && employeeId) {
    emp = await Employee.findById(employeeId).select('placementCompany').lean();
  }
  const fromEmp = normalizeCompanyId(emp?.placementCompany?._id || emp?.placementCompany);
  if (fromEmp) return fromEmp;

  const fromUser = await placementFromUserId(userId);
  if (fromUser) return fromUser;

  if (indentId) {
    const Indent = require('../models/general/Indent');
    const indent = await Indent.findById(indentId).select('requestedBy').lean();
    const fromIndent = await placementFromUserId(indent?.requestedBy);
    if (fromIndent) return fromIndent;
  }

  if (purchaseOrderId) {
    const PurchaseOrder = require('../models/procurement/PurchaseOrder');
    const po = await PurchaseOrder.findById(purchaseOrderId).select('indent').lean();
    if (po?.indent) {
      const fromPo = await resolveDocumentCompanyId({ indentId: po.indent });
      if (fromPo) return fromPo;
    }
  }

  if (grnId) {
    const GoodsReceive = require('../models/procurement/GoodsReceive');
    const grn = await GoodsReceive.findById(grnId).select('purchaseOrder').lean();
    if (grn?.purchaseOrder) {
      const fromGrn = await resolveDocumentCompanyId({ purchaseOrderId: grn.purchaseOrder });
      if (fromGrn) return fromGrn;
    }
  }

  if (cashApprovalId) {
    const CashApproval = require('../models/procurement/CashApproval');
    const ca = await CashApproval.findById(cashApprovalId).select('companyId advanceToEmployee indent').lean();
    const fromCaDoc = normalizeCompanyId(ca?.companyId);
    if (fromCaDoc) return fromCaDoc;
    if (ca?.advanceToEmployee) {
      const fromPayee = await resolveDocumentCompanyId({ employeeId: ca.advanceToEmployee });
      if (fromPayee) return fromPayee;
    }
    if (ca?.indent) {
      const fromCaIndent = await resolveDocumentCompanyId({ indentId: ca.indent });
      if (fromCaIndent) return fromCaIndent;
    }
  }

  const fromAcct = normalizeCompanyId(account?.companyId);
  if (fromAcct) return fromAcct;

  const historical = await findHistoricalCompany();
  return historical?._id || null;
};

/** When finance sends companyId/header, return filter fragment. No historical fallback. */
const optionalCompanyFilterFromRequest = (req) => {
  const raw = req.query?.companyId || req.headers['x-finance-company-id'];
  const cid = normalizeCompanyId(raw);
  return cid ? { companyId: cid } : {};
};

const ensureCompanyCodes = async () => {
  const companies = await PlacementCompany.find({ isActive: { $ne: false } }).select('name companyCode').lean();
  let updated = 0;

  for (const company of companies) {
    if (company.companyCode) continue;
    const baseCode = deriveCompanyCode(company.name);
    let code = baseCode;
    let suffix = 1;
    while (await PlacementCompany.exists({ companyCode: code, _id: { $ne: company._id } })) {
      suffix += 1;
      code = `${baseCode}${suffix}`.slice(0, 8);
    }
    await PlacementCompany.updateOne({ _id: company._id }, { $set: { companyCode: code } });
    updated += 1;
  }

  return updated;
};

module.exports = {
  HISTORICAL_COMPANY_NAME,
  deriveCompanyCode,
  normalizeCompanyId,
  resolveCompanyId,
  resolveCompanyFromRequest,
  requireCompanyFromRequest,
  findHistoricalCompany,
  resolveCompanyForFinanceRoute,
  companyQuery,
  optionalCompanyFilterFromRequest,
  resolveDocumentCompanyId,
  ensureCompanyCodes
};
