const Employee = require('../models/hr/Employee');
const RecoveryMember = require('../models/finance/RecoveryMember');
const { asyncHandler } = require('./errorHandler');
const { tryAuthorize } = require('./auth');

async function getActiveRecoveryMemberForUser(req) {
  if (!req.user?.employeeId) return null;
  const employee = await Employee.findOne({ employeeId: req.user.employeeId }).lean();
  if (!employee) return null;
  return RecoveryMember.findOne({ employee: employee._id, isActive: true }).lean();
}

const normRole = (val) =>
  val != null ? String(val).toLowerCase().replace(/\s+/g, '_').trim() : '';

/**
 * Roles that may see every recovery task rule / time-bound task (oversight).
 * Recovery Officers often have Finance submodule read for this screen; that must NOT grant full list
 * if they are also an active RecoveryMember — they should only see their own rows.
 */
function userHasRecoveryTaskAssignmentUnrestrictedAccess(req) {
  const unrestricted = new Set([
    'super_admin',
    'admin',
    'higher_management',
    'finance_manager',
    'recovery_manager',
    'developer'
  ]);
  const candidates = [
    req.user?.role,
    req.user?.roleRef?.name,
    req.user?.roleRef?.displayName
  ];
  for (const c of candidates) {
    if (unrestricted.has(normRole(c))) return true;
  }
  const multi = req.user?.roles;
  if (Array.isArray(multi)) {
    for (const r of multi) {
      if (unrestricted.has(normRole(r?.name)) || unrestricted.has(normRole(r?.displayName))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Full list: finance oversight (tryAuthorize) and not a field-only recovery user, OR unrestricted roles above.
 * Field agents: active RecoveryMember without unrestricted role → only rows where assignedTo = their member id.
 */
const recoveryTaskAssignmentListAccess = asyncHandler(async (req, res, next) => {
  const selfMember = await getActiveRecoveryMemberForUser(req);
  const unrestricted = userHasRecoveryTaskAssignmentUnrestrictedAccess(req);

  if (selfMember && !unrestricted) {
    req.recoveryTaskAssignmentListScope = 'self';
    req.recoveryTaskAssignmentSelfMemberId = selfMember._id;
    return next();
  }

  const allowedAll = await tryAuthorize(req, 'super_admin', 'admin', 'finance_manager');
  if (allowedAll) {
    req.recoveryTaskAssignmentListScope = 'all';
    return next();
  }

  if (selfMember) {
    req.recoveryTaskAssignmentListScope = 'self';
    req.recoveryTaskAssignmentSelfMemberId = selfMember._id;
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. Insufficient permissions.'
  });
});

module.exports = {
  recoveryTaskAssignmentListAccess,
  getActiveRecoveryMemberForUser
};
