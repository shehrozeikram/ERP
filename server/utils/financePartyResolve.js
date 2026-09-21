/**
 * Resolve finance party refs to display labels.
 * partyType values (Vendor/Customer/Employee/Company) do NOT match mongoose
 * model names (Supplier/SalesCustomer/…), so refPath populate fails and the
 * UI sees raw ObjectIds — resolve manually instead.
 */
const mongoose = require('mongoose');

const isOid = (v) => {
  if (!v) return false;
  if (v instanceof mongoose.Types.ObjectId) return true;
  if (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) && String(v).length === 24) return true;
  return false;
};

const oidStr = (v) => {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
};

const employeeLabel = (doc) => {
  if (!doc) return null;
  const name = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
  if (name && doc.employeeId) return `${name} (${doc.employeeId})`;
  return name || doc.employeeId || null;
};

const partyLabelFromDoc = (partyType, doc) => {
  if (!doc) return null;
  if (partyType === 'Employee') return employeeLabel(doc);
  return doc.name || doc.companyName || doc.title || doc.code || null;
};

/**
 * Batch-resolve party ObjectIds on row-like objects that have { partyType, party }.
 * Replaces `party` with { _id, name, partyType } (or leaves populated object).
 */
const enrichPartyFields = async (rows = []) => {
  if (!rows.length) return rows;

  const byType = {
    Vendor: new Set(),
    Customer: new Set(),
    Employee: new Set(),
    Company: new Set()
  };

  for (const row of rows) {
    const type = row?.partyType;
    const party = row?.party;
    if (!type || !byType[type]) continue;
    // Already a populated label object
    if (party && typeof party === 'object' && (party.name || party.firstName)) continue;
    if (!isOid(party)) continue;
    byType[type].add(oidStr(party));
  }

  const maps = {
    Vendor: new Map(),
    Customer: new Map(),
    Employee: new Map(),
    Company: new Map()
  };

  if (byType.Vendor.size) {
    const Supplier = require('../models/hr/Supplier');
    const docs = await Supplier.find({ _id: { $in: [...byType.Vendor] } })
      .select('name supplierId')
      .lean();
    docs.forEach((d) => maps.Vendor.set(String(d._id), d));
  }
  if (byType.Customer.size) {
    const SalesCustomer = require('../models/sales/SalesCustomer');
    const docs = await SalesCustomer.find({ _id: { $in: [...byType.Customer] } })
      .select('name company')
      .lean();
    docs.forEach((d) => maps.Customer.set(String(d._id), d));
  }
  if (byType.Employee.size) {
    const Employee = require('../models/hr/Employee');
    const docs = await Employee.find({ _id: { $in: [...byType.Employee] } })
      .select('firstName lastName employeeId')
      .lean();
    docs.forEach((d) => maps.Employee.set(String(d._id), d));
  }
  if (byType.Company.size) {
    let docs = [];
    try {
      const Company = mongoose.model('Company');
      docs = await Company.find({ _id: { $in: [...byType.Company] } })
        .select('name companyName companyCode')
        .lean();
    } catch (_) {
      /* Company model may be absent in some boots */
    }
    docs.forEach((d) => maps.Company.set(String(d._id), d));
  }

  for (const row of rows) {
    const type = row?.partyType;
    const party = row?.party;
    if (!type || !maps[type]) continue;
    if (party && typeof party === 'object' && (party.name || party.firstName)) {
      const label = partyLabelFromDoc(type, party);
      row.party = {
        _id: party._id,
        name: label || party.name,
        partyType: type
      };
      continue;
    }
    if (!isOid(party)) continue;
    const doc = maps[type].get(oidStr(party));
    const label = partyLabelFromDoc(type, doc);
    row.party = label
      ? { _id: party, name: label, partyType: type }
      : { _id: party, name: null, partyType: type };
  }

  return rows;
};

/**
 * Resolve department fields that are stored as ObjectIds (string or ObjectId)
 * into { _id, name, code }.
 */
const enrichDepartmentFields = async (rows = [], field = 'department') => {
  if (!rows.length) return rows;
  const ids = new Set();
  for (const row of rows) {
    const d = row?.[field];
    if (d && typeof d === 'object' && d.name) continue;
    if (isOid(d)) ids.add(oidStr(d));
  }
  if (!ids.size) return rows;

  let docs = [];
  try {
    const Department = mongoose.model('Department');
    docs = await Department.find({ _id: { $in: [...ids] } }).select('name code').lean();
  } catch (_) {
    return rows;
  }
  const map = new Map(docs.map((d) => [String(d._id), d]));
  for (const row of rows) {
    const d = row?.[field];
    if (d && typeof d === 'object' && d.name) continue;
    if (!isOid(d)) continue;
    const doc = map.get(oidStr(d));
    if (doc) row[field] = { _id: doc._id, name: doc.name, code: doc.code };
  }
  return rows;
};

module.exports = {
  enrichPartyFields,
  enrichDepartmentFields,
  partyLabelFromDoc,
  isOid
};
