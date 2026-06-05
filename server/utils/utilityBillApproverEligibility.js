/**
 * Shared approver rules: User Management `User.department` must match Administration department.
 * Used by Utility Bills, Rental Management, and Payment Settlement approval pickers and API validation.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/hr/Department');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ADMINISTRATION_NAME_PATTERN = /^administration$/i;

/**
 * True when User.department (User Management) refers to the Administration department.
 * Does not use Employee / HR placement.
 */
function userDepartmentMatchesAdministration(userDepartment, admin) {
  if (!userDepartment || !admin) return false;
  const s = String(userDepartment).trim();
  if (!s) return false;
  // Legacy: users may still have "ADMIN" stored from when departments used codes
  if (s.toUpperCase() === 'ADMIN') return true;
  if (mongoose.Types.ObjectId.isValid(s) && s === String(admin._id)) return true;
  const name = String(admin.name || '').trim();
  if (name && s.toLowerCase() === name.toLowerCase()) return true;
  return false;
}

let adminDeptCache = { doc: null, until: 0 };
const ADMIN_DEPT_CACHE_MS = 10 * 60 * 1000;

/** Department master row for Administration (User.department matching). */
async function getAdministrationDepartment() {
  const now = Date.now();
  if (adminDeptCache.doc && now < adminDeptCache.until) {
    return adminDeptCache.doc;
  }
  let doc = await Department.findOne({ name: ADMINISTRATION_NAME_PATTERN })
    .select('_id name')
    .lean();
  if (!doc) {
    doc = await Department.findOne({ name: { $regex: /administration/i } })
      .select('_id name')
      .lean();
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
  if (admin.name) {
    deptOr.push({ department: new RegExp(`^${escapeRegex(String(admin.name))}$`, 'i') });
  }
  deptOr.push({ department: String(admin._id) });
  // Legacy user records that still reference ADMIN
  deptOr.push({ department: /^ADMIN$/i });

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
          'Approvers must be active users whose department in User Management is Administration.'
      };
    }
  }
  return { ok: true };
}

async function assertActiveUserApproversEligible(approverIds = []) {
  const unique = [...new Set(approverIds.map(String).filter(Boolean))];
  if (!unique.length) return { ok: true };
  const activeCount = await User.countDocuments({ _id: { $in: unique }, isActive: true });
  if (activeCount !== unique.length) {
    return { ok: false, message: 'Approvers must be active users.' };
  }
  return { ok: true };
}

/** Active users for Manager / HOD pickers when allUsers=true (centralized store bills, general cash approval). */
async function queryApproverCandidateUsers({ search = '', limit = 50, allUsers = false } = {}) {
  const cap = Math.min(Math.max(parseInt(limit, 10) || 50, 1), allUsers ? 500 : 100);
  const filter = { isActive: true };

  if (!allUsers) {
    const eligibleIds = await getEligibleUtilityBillApproverUserIds();
    filter._id = { $in: [...eligibleIds] };
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const searchOr = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { employeeId: rx }
    ];
    if (allUsers) {
      filter.$or = searchOr;
    } else {
      const eligibleIds = await getEligibleUtilityBillApproverUserIds();
      filter.$and = [{ _id: { $in: [...eligibleIds] } }, { $or: searchOr }];
      delete filter._id;
    }
  }

  return User.find(filter)
    .select('firstName lastName email employeeId department')
    .sort({ firstName: 1, lastName: 1 })
    .limit(cap)
    .lean();
}

module.exports = {
  getAdministrationDepartment,
  userDepartmentMatchesAdministration,
  getEligibleUtilityBillApproverUserIds,
  isUserEligibleAsUtilityBillApprover,
  assertUtilityBillApproversEligible,
  assertActiveUserApproversEligible,
  queryApproverCandidateUsers
};
