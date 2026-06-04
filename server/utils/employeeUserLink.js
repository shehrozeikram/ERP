const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');

function employeeIdVariants(code) {
  const s = String(code || '').trim();
  if (!s) return [];
  const n = s.replace(/^0+/, '') || s;
  const out = new Set([s]);
  if (/^\d+$/.test(n)) {
    out.add(n);
    out.add(n.padStart(5, '0'));
  }
  return [...out];
}

function userIdOf(userDoc) {
  return userDoc?._id || userDoc?.id || null;
}

/**
 * Persist only linkedEmployee when HR already has user = this login (no employeeId overwrite).
 */
async function ensureLinkedEmployeeCache(uid, employeeDocId) {
  if (!uid || !employeeDocId) return;
  await User.findByIdAndUpdate(uid, { linkedEmployee: employeeDocId });
}

/**
 * Explicit admin (or user-create) link: sets linkedEmployee, optional employeeId sync, and employee.user.
 */
async function linkUserToEmployee(userId, employeeDocId, options = {}) {
  const { syncEmployeeId = true } = options;
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(employeeDocId)) {
    throw new Error('Invalid user or employee id');
  }

  const emp = await Employee.findOne({ _id: employeeDocId, isDeleted: { $ne: true } });
  if (!emp) throw new Error('Employee not found');

  if (emp.user && String(emp.user) !== String(userId)) {
    const other = await User.findById(emp.user).select('_id isActive');
    if (other) {
      throw new Error('Employee is already linked to another user account');
    }
  }

  const userUpdate = { linkedEmployee: emp._id };
  if (syncEmployeeId && emp.employeeId) {
    userUpdate.employeeId = String(emp.employeeId);
  }
  await User.findByIdAndUpdate(userId, userUpdate);

  if (!emp.user || String(emp.user) !== String(userId)) {
    emp.user = userId;
    await emp.save();
  }

  return emp;
}

async function unlinkUserFromEmployee(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  const user = await User.findById(userId).select('linkedEmployee');
  if (!user) return;

  if (user.linkedEmployee) {
    const emp = await Employee.findById(user.linkedEmployee);
    if (emp && String(emp.user) === String(userId)) {
      emp.user = undefined;
      await emp.save();
    }
  }
  await User.findByIdAndUpdate(userId, { $unset: { linkedEmployee: 1 } });
}

/**
 * Find HR employee for logged-in user (read-only by default).
 * Resolution order: linkedEmployee → employee.user === login → single exact employeeId match.
 * Does not use email/name guessing. Does not mutate user.employeeId on read.
 */
async function findEmployeeForAuthUser(userDoc, options = {}) {
  const {
    select = '_id reportingLine employeeId email firstName lastName user',
    autoLink = false
  } = options;
  const uid = userIdOf(userDoc);
  if (!uid) return null;

  const dbUser = await User.findById(uid)
    .select('email employeeId linkedEmployee')
    .lean();
  if (!dbUser) return null;

  const base = { isDeleted: { $ne: true } };

  if (dbUser.linkedEmployee) {
    const cached = await Employee.findOne({ _id: dbUser.linkedEmployee, ...base }).select(select);
    if (cached) return cached;
  }

  const byUserField = await Employee.findOne({ ...base, user: uid }).select(select);
  if (byUserField) {
    if (autoLink) await ensureLinkedEmployeeCache(uid, byUserField._id);
    return byUserField;
  }

  const ids = [...new Set(employeeIdVariants(dbUser.employeeId))];
  if (ids.length) {
    const matches = await Employee.find({ ...base, employeeId: { $in: ids } })
      .select(select)
      .limit(2);
    if (matches.length === 1) return matches[0];
  }

  return null;
}

async function loadReportingLineForProfile(userDoc) {
  const emp = await findEmployeeForAuthUser(userDoc, { select: 'reportingLine', autoLink: false });
  if (emp?.reportingLine) {
    await emp.populate('reportingLine', 'firstName lastName employeeId');
    return emp.reportingLine;
  }
  const u = await User.findById(userIdOf(userDoc))
    .select('reportingLine')
    .populate('reportingLine', 'firstName lastName employeeId')
    .lean();
  return u?.reportingLine || null;
}

async function saveReportingLineForUser(userDoc, reportingLineId) {
  const uid = userIdOf(userDoc);
  const empty = reportingLineId === '' || reportingLineId == null;

  const resolveTarget = async (selfEmpId) => {
    if (empty) return null;
    if (!mongoose.Types.ObjectId.isValid(reportingLineId)) throw new Error('Invalid reporting line');
    if (selfEmpId && String(reportingLineId) === String(selfEmpId)) {
      throw new Error('Reporting line cannot be yourself');
    }
    const t = await Employee.findOne({
      _id: reportingLineId,
      isDeleted: { $ne: true },
      isActive: true
    }).select('_id');
    if (!t) throw new Error('Reporting line employee not found or inactive');
    return t._id;
  };

  const emp = await findEmployeeForAuthUser(userDoc, { select: '_id', autoLink: false });
  const targetId = await resolveTarget(emp?._id);

  if (emp) {
    emp.reportingLine = targetId;
    await emp.save();
    if (uid) await User.findByIdAndUpdate(uid, { $unset: { reportingLine: 1 } });
    return;
  }

  if (!uid) throw Object.assign(new Error('Not logged in'), { code: 'NO_EMPLOYEE_LINK' });
  await User.findByIdAndUpdate(uid, { reportingLine: targetId });
}

/** Link developer@tovus.net (Sardar Shehroze Ikram) user ↔ HR employee. */
async function linkDeveloperShehrozeAccount() {
  const email = 'developer@tovus.net';
  const user = await User.findOne({ email }).select('_id email employeeId firstName lastName');
  if (!user) return { ok: false, message: 'User not found' };

  const base = { isDeleted: { $ne: true } };
  let emp =
    (await Employee.findOne({ ...base, user: user._id }).select('_id employeeId firstName lastName user')) ||
    (await Employee.findOne({
      ...base,
      firstName: /^Sardar$/i,
      lastName: /Shehroze/i
    }).select('_id employeeId firstName lastName user'));

  if (!emp) {
    return { ok: false, message: 'HR employee Sardar Shehroze Ikram not found' };
  }

  await linkUserToEmployee(user._id, emp._id);

  return {
    ok: true,
    userId: String(user._id),
    employeeId: emp.employeeId,
    employeeDocId: String(emp._id)
  };
}

module.exports = {
  findEmployeeForAuthUser,
  loadReportingLineForProfile,
  saveReportingLineForUser,
  linkUserToEmployee,
  unlinkUserFromEmployee,
  linkDeveloperShehrozeAccount,
  employeeIdVariants,
  userIdOf
};
