const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');

/**
 * Build common employeeId variants (User "2528" vs HR "02528").
 */
function employeeIdVariants(code) {
  const s = String(code || '').trim();
  if (!s) return [];
  const variants = new Set([s]);
  const numeric = s.replace(/^0+/, '') || s;
  if (numeric && /^\d+$/.test(numeric)) {
    variants.add(numeric);
    variants.add(numeric.padStart(5, '0'));
    variants.add(numeric.padStart(4, '0'));
  }
  return [...variants];
}

function userRefId(userDoc) {
  if (!userDoc) return null;
  return userDoc._id || userDoc.id || null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namesMatch(userDoc, employee) {
  const uFirst = String(userDoc?.firstName || '').trim().toLowerCase();
  const uLast = String(userDoc?.lastName || '').trim().toLowerCase();
  const eFirst = String(employee?.firstName || '').trim().toLowerCase();
  const eLast = String(employee?.lastName || '').trim().toLowerCase();
  if (!uFirst || !eFirst) return false;
  if (uFirst !== eFirst) return false;
  if (uLast && eLast && uLast !== eLast) return false;
  return true;
}

async function findByUniqueName(userDoc, baseFilter, select) {
  const first = String(userDoc?.firstName || '').trim();
  if (!first) return null;

  const q = {
    ...baseFilter,
    firstName: new RegExp(`^${escapeRegex(first)}$`, 'i')
  };
  const last = String(userDoc?.lastName || '').trim();
  if (last) {
    q.lastName = new RegExp(`^${escapeRegex(last)}$`, 'i');
  }

  const matches = await Employee.find(q).select(select).limit(5);
  if (matches.length === 1) return matches[0];

  const email = normalizeEmail(userDoc?.email);
  if (email && matches.length > 1) {
    const byEmail = matches.find((e) => normalizeEmail(e.email) === email);
    if (byEmail) return byEmail;
  }

  const unlinked = matches.filter((e) => !e.user);
  if (unlinked.length === 1) return unlinked[0];

  return null;
}

async function canRelinkEmployeeToUser(employee, userId, userDoc) {
  if (!employee?.user) return true;
  if (String(employee.user) === String(userId)) return true;

  const linkedUser = await User.findById(employee.user).select('email employeeId isActive').lean();
  if (!linkedUser || linkedUser.isActive === false) return true;

  const myEmail = normalizeEmail(userDoc?.email);
  const linkedEmail = normalizeEmail(linkedUser?.email);
  if (myEmail && linkedEmail && myEmail === linkedEmail) return true;

  return namesMatch(userDoc, employee) && !linkedEmail;
}

/**
 * Find HR Employee for a login user. Tries user ref, employeeId (padded/plain), email, and name.
 * Optionally links employee.user when a match is found without a conflicting user ref.
 */
async function findEmployeeForAuthUser(userDoc, options = {}) {
  const {
    select = '_id reportingLine employeeId email firstName lastName user',
    autoLink = true,
    includeDeleted = false
  } = options;

  const userId = userRefId(userDoc);
  let dbUser = null;
  if (userId) {
    dbUser = await User.findById(userId).select('email employeeId firstName lastName').lean();
  }
  const mergedUser = { ...(dbUser || {}), ...(userDoc || {}) };

  if (!userId && !mergedUser.employeeId && !mergedUser.email) return null;

  const baseFilter = includeDeleted ? {} : { isDeleted: { $ne: true } };
  const or = [];

  if (userId) or.push({ user: userId });

  const idVariants = [
    ...employeeIdVariants(mergedUser.employeeId),
    ...employeeIdVariants(dbUser?.employeeId)
  ];
  const uniqueIds = [...new Set(idVariants)];
  if (uniqueIds.length) or.push({ employeeId: { $in: uniqueIds } });

  const email = normalizeEmail(mergedUser.email);
  if (email) or.push({ email });

  let employee = null;
  if (or.length) {
    employee = await Employee.findOne({ ...baseFilter, $or: or }).select(select);
  }

  if (!employee && email) {
    employee = await Employee.findOne({
      ...baseFilter,
      email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
    }).select(select);
  }

  if (!employee) {
    employee = await findByUniqueName(mergedUser, baseFilter, select);
  }

  if (!employee) return null;

  if (autoLink && userId) {
    const mayLink = await canRelinkEmployeeToUser(employee, userId, mergedUser);
    if (mayLink) {
      employee.user = userId;
      await employee.save();
    } else if (String(employee.user) !== String(userId)) {
      return null;
    }
  }

  return employee;
}

/** Load reporting line for profile (employee record first, then user-level fallback). */
async function loadReportingLineForProfile(userDoc) {
  const employee = await findEmployeeForAuthUser(userDoc, {
    select: 'reportingLine',
    autoLink: false
  });
  if (employee?.reportingLine) {
    await employee.populate('reportingLine', 'firstName lastName employeeId');
    return employee.reportingLine;
  }

  const userId = userRefId(userDoc);
  if (!userId) return null;

  const u = await User.findById(userId)
    .select('reportingLine')
    .populate('reportingLine', 'firstName lastName employeeId')
    .lean();
  return u?.reportingLine || null;
}

async function saveReportingLineForUser(userDoc, reportingLineId) {
  const employeeDoc = await findEmployeeForAuthUser(userDoc, {
    select: '_id reportingLine employeeId email firstName lastName',
    autoLink: true
  });

  const validateTarget = async (idValue, selfEmployeeId) => {
    if (idValue === '' || idValue === null || idValue === undefined) return null;
    if (!mongoose.Types.ObjectId.isValid(idValue)) {
      throw new Error('Invalid reporting line id');
    }
    if (selfEmployeeId && String(idValue) === String(selfEmployeeId)) {
      throw new Error('Reporting line cannot be yourself');
    }
    const target = await Employee.findOne({
      _id: idValue,
      isDeleted: { $ne: true },
      isActive: true
    })
      .select('_id firstName lastName employeeId')
      .lean();
    if (!target) throw new Error('Reporting line employee not found or inactive');
    return target._id;
  };

  if (employeeDoc) {
    const targetId = await validateTarget(reportingLineId, employeeDoc._id);
    employeeDoc.reportingLine = targetId;
    await employeeDoc.save();
    const userId = userRefId(userDoc);
    if (userId) {
      await User.findByIdAndUpdate(userId, { $unset: { reportingLine: 1 } });
    }
    return { storage: 'employee', employeeDoc, targetId };
  }

  const userId = userRefId(userDoc);
  if (!userId) {
    const err = new Error('NO_EMPLOYEE_LINK');
    err.code = 'NO_EMPLOYEE_LINK';
    throw err;
  }

  let selfEmployeeId = null;
  const email = normalizeEmail(userDoc?.email);
  if (email) {
    const selfCandidates = await Employee.find({
      isDeleted: { $ne: true },
      email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
    })
      .select('_id')
      .limit(2)
      .lean();
    if (selfCandidates.length === 1) selfEmployeeId = selfCandidates[0]._id;
  }

  const targetId = await validateTarget(reportingLineId, selfEmployeeId);
  await User.findByIdAndUpdate(userId, { reportingLine: targetId });
  return { storage: 'user', targetId };
}

module.exports = {
  employeeIdVariants,
  findEmployeeForAuthUser,
  loadReportingLineForProfile,
  saveReportingLineForUser,
  userRefId,
  namesMatch
};
