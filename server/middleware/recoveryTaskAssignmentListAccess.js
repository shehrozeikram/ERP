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

/**
 * Full list: super_admin / admin / finance_manager (same as authorize on these routes).
 * Otherwise: active RecoveryMember may read only rows assigned to them (assignedTo = their RecoveryMember id).
 */
const recoveryTaskAssignmentListAccess = asyncHandler(async (req, res, next) => {
  const allowedAll = await tryAuthorize(req, 'super_admin', 'admin', 'finance_manager');
  if (allowedAll) {
    req.recoveryTaskAssignmentListScope = 'all';
    return next();
  }

  const selfMember = await getActiveRecoveryMemberForUser(req);
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
