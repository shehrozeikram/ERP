/**
 * Shared approver rules: User Management `User.department` must match Administration (master dept code ADMIN).
 * Used by Utility Bills, Rental Management, and Payment Settlement approval pickers and API validation.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/hr/Department');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when User.department (User Management) refers to the Administration department with code ADMIN.
 * Does not use Employee / HR placement.
 */
function userDepartmentMatchesAdministration(userDepartment, admin) {
  if (!userDepartment || !admin) return false;
  if (String(admin.code || '').trim().toUpperCase() !== 'ADMIN') return false;
  const s = String(userDepartment).trim();
  if (!s) return false;
  if (s.toUpperCase() === 'ADMIN') return true;
  if (mongoose.Types.ObjectId.isValid(s) && s === String(admin._id)) return true;
  const name = String(admin.name || '').trim();
  if (name && s.toLowerCase() === name.toLowerCase()) return true;
  if (admin.code && s.toUpperCase() === String(admin.code).toUpperCase().trim()) return true;
  return false;
}

let adminDeptCache = { doc: null, until: 0 };
const ADMIN_DEPT_CACHE_MS = 10 * 60 * 1000;

/** Department master row with code ADMIN (canonical Administration for User.department matching). */
async function getAdministrationDepartment() {
  const now = Date.now();
  if (adminDeptCache.doc && now < adminDeptCache.until) {
    return adminDeptCache.doc;
  }
  let doc = await Department.findOne({ code: 'ADMIN' }).select('_id name code').lean();
  if (!doc) {
    doc = await Department.findOne({ code: { $regex: /^ADMIN$/i } }).select('_id name code').lean();
  }
  if (doc && String(doc.code || '').trim().toUpperCase() !== 'ADMIN') {
    doc = null;
  }
  adminDeptCache = { doc, until: now + ADMIN_DEPT_CACHE_MS };
  return doc;
}

let eligibleIdCache = { value: null, until: 0 };
const ELIGIBLE_CACHE_MS = 45_000;

async function computeEligibleUtilityBillApproverUserIds() {
  const admin = await getAdministrationDepartment();
  if (!admin) {
    return new Set();
  }

  const deptOr = [];
  if (admin.code) {
    deptOr.push({ department: new RegExp(`^${escapeRegex(String(admin.code))}$`, 'i') });
  }
  if (admin.name) {
    deptOr.push({ department: new RegExp(`^${escapeRegex(String(admin.name))}$`, 'i') });
  }
  deptOr.push({ department: String(admin._id) });

  const users = await User.find({ isActive: true, $or: deptOr })
    .select('_id department')
    .lean();

  const eligible = new Set();
  for (const u of users) {
    if (userDepartmentMatchesAdministration(u.department, admin)) {
      eligible.add(String(u._id));
    }
  }
  return eligible;
}

async function getEligibleUtilityBillApproverUserIds() {
  const now = Date.now();
  if (eligibleIdCache.value && now < eligibleIdCache.until) {
    return eligibleIdCache.value;
  }
  const ids = await computeEligibleUtilityBillApproverUserIds();
  eligibleIdCache = { value: ids, until: now + ELIGIBLE_CACHE_MS };
  return ids;
}

async function isUserEligibleAsUtilityBillApprover(userId) {
  const uid = String(userId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(uid)) return false;

  const admin = await getAdministrationDepartment();
  if (!admin) return false;

  const user = await User.findById(uid).select('department isActive').lean();
  if (!user || !user.isActive) return false;

  return userDepartmentMatchesAdministration(user.department, admin);
}

async function assertUtilityBillApproversEligible(approverIds = []) {
  const unique = [...new Set(approverIds.map(String).filter(Boolean))];
  for (const id of unique) {
    const ok = await isUserEligibleAsUtilityBillApprover(id);
    if (!ok) {
      return {
        ok: false,
        message:
          'Approvers must be active users whose department in User Management is Administration (department code ADMIN).'
      };
    }
  }
  return { ok: true };
}

module.exports = {
  getAdministrationDepartment,
  userDepartmentMatchesAdministration,
  getEligibleUtilityBillApproverUserIds,
  isUserEligibleAsUtilityBillApprover,
  assertUtilityBillApproversEligible
};
