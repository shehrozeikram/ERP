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
 * Find HR employee for logged-in user.
 */
async function findEmployeeForAuthUser(userDoc, options = {}) {
  const { select = '_id reportingLine employeeId email firstName lastName user', autoLink = true } = options;
  const uid = userIdOf(userDoc);
  if (!uid) return null;

  const dbUser = await User.findById(uid)
    .select('email employeeId firstName lastName linkedEmployee')
    .lean();
  if (!dbUser) return null;

  const base = { isDeleted: { $ne: true } };

  if (dbUser.linkedEmployee) {
    const cached = await Employee.findOne({ _id: dbUser.linkedEmployee, ...base }).select(select);
    if (cached) return cached;
  }

  const email = String(dbUser.email || userDoc?.email || '').trim().toLowerCase();
  const ids = [...new Set(employeeIdVariants(dbUser.employeeId || userDoc?.employeeId))];
  const or = [{ user: uid }];
  if (ids.length) or.push({ employeeId: { $in: ids } });
  if (email) or.push({ email });

  let emp = or.length ? await Employee.findOne({ ...base, $or: or }).select(select) : null;

  if (!emp && email) {
    const esc = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    emp = await Employee.findOne({ ...base, email: { $regex: new RegExp(`^${esc}$`, 'i') } }).select(select);
  }

  if (!emp && dbUser.firstName) {
    const q = { ...base, firstName: new RegExp(`^${String(dbUser.firstName).trim()}$`, 'i') };
    const last = String(dbUser.lastName || '').trim();
    if (last) q.lastName = new RegExp(`^${last}$`, 'i');
    const list = await Employee.find(q).select(select).limit(2);
    if (list.length === 1) emp = list[0];
  }

  if (!emp) return null;

  if (autoLink) {
    if (!emp.user) {
      emp.user = uid;
      await emp.save();
    }
    await User.findByIdAndUpdate(uid, {
      linkedEmployee: emp._id,
      ...(emp.employeeId ? { employeeId: String(emp.employeeId) } : {})
    });
  }

  return emp;
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
    const t = await Employee.findOne({ _id: reportingLineId, isDeleted: { $ne: true }, isActive: true }).select('_id');
    if (!t) throw new Error('Reporting line employee not found or inactive');
    return t._id;
  };

  const emp = await findEmployeeForAuthUser(userDoc, { select: '_id', autoLink: true });
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

  emp.user = user._id;
  await emp.save();
  user.linkedEmployee = emp._id;
  user.employeeId = String(emp.employeeId);
  await user.save();

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
  linkDeveloperShehrozeAccount,
  employeeIdVariants,
  userIdOf
};
