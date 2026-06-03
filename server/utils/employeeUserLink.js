const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

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

/**
 * Find HR Employee for a login user. Tries user ref, employeeId (padded/plain), and email.
 * Optionally links employee.user when a match is found without a user ref.
 */
async function findEmployeeForAuthUser(userDoc, options = {}) {
  const {
    select = '_id reportingLine employeeId email firstName lastName user',
    autoLink = true,
    includeDeleted = false
  } = options;

  const userId = userRefId(userDoc);
  if (!userId && !userDoc?.employeeId && !userDoc?.email) return null;

  const baseFilter = includeDeleted ? {} : { isDeleted: { $ne: true } };
  const or = [];

  if (userId) or.push({ user: userId });

  const idVariants = employeeIdVariants(userDoc?.employeeId);
  if (idVariants.length) or.push({ employeeId: { $in: idVariants } });

  const email = String(userDoc?.email || '').trim().toLowerCase();
  if (email) or.push({ email });

  if (!or.length) return null;

  let employee = await Employee.findOne({ ...baseFilter, $or: or }).select(select);

  if (!employee && email) {
    employee = await Employee.findOne({
      ...baseFilter,
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).select(select);
  }

  if (!employee) return null;

  if (autoLink && userId) {
    const linkedUser = employee.user ? String(employee.user) : null;
    if (!linkedUser || linkedUser !== String(userId)) {
      employee.user = userId;
      await employee.save();
    }
  }

  return employee;
}

module.exports = {
  employeeIdVariants,
  findEmployeeForAuthUser,
  userRefId
};
