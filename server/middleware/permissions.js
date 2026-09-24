const { hasPermission, checkSubRoleAccess } = require('../config/permissions');

/** Collect all role identity strings on a user (legacy role + RBAC roleRef/roles). */
const getUserRoleIdentityCandidates = (user) => {
  if (!user) return [];
  const candidates = [
    user.role,
    user.roleTitle,
    user.roleRef?.name,
    user.roleRef?.displayName,
    user.roleRef?.roleKey,
    user.roleRef?.key
  ];
  if (Array.isArray(user.roles)) {
    user.roles.forEach((roleDoc) => {
      if (!roleDoc) return;
      if (typeof roleDoc === 'string') {
        candidates.push(roleDoc);
        return;
      }
      candidates.push(roleDoc.name, roleDoc.displayName, roleDoc.roleKey, roleDoc.key);
    });
  }
  return [...new Set(candidates.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
};

/** True if RBAC role doc grants HR loan approve/update. */
const roleDocAllowsLoanApprove = (roleDoc) => {
  if (!roleDoc?.permissions || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((p) => {
    if (!p || p.module !== 'hr') return false;
    const sub = String(p.submodule || p.subModule || '').toLowerCase();
    if (!['loan_management', 'loans', 'loan'].includes(sub)) return false;
    const actions = Array.isArray(p.actions) ? p.actions.map((a) => String(a).toLowerCase()) : [];
    return (
      actions.includes('approve') ||
      actions.includes('update') ||
      actions.includes('manage') ||
      actions.includes('all') ||
      p.approve === true ||
      p.update === true
    );
  });
};

const userAllowsLoanApproveViaRoleDocs = (user) => {
  if (!user) return false;
  if (roleDocAllowsLoanApprove(user.roleRef)) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => roleDocAllowsLoanApprove(r))) return true;
  return false;
};

const isPayrollManagerIdentity = (value) => {
  const n = String(value || '').toLowerCase().replace(/\s+/g, '_');
  return n === 'payroll_manager' || n.includes('payroll_manager') || n === 'payrollmanager';
};

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const roleCandidates = getUserRoleIdentityCandidates(user);

      // 1. Check primary role / title / RBAC role names using centralized config
      if (roleCandidates.some((role) => hasPermission(role, permission))) {
        return next();
      }

      // 2. Loan approve/reject: payroll manager by identity, or HR loan_management on roleRef
      if (permission === 'hr.loan.approve') {
        if (roleCandidates.some(isPayrollManagerIdentity) || userAllowsLoanApproveViaRoleDocs(user)) {
          return next();
        }
      }

      // 3. Fallback check for active sub-roles
      try {
        const UserSubRole = require('../models/UserSubRole');
        const userSubRoles = await UserSubRole.findActiveByUser(user.id || user._id);
        if (userSubRoles && userSubRoles.length > 0) {
          for (const usr of userSubRoles) {
            if (usr.subRole && (hasPermission(usr.subRole.name, permission) || hasPermission(usr.subRole.roleKey, permission))) {
              return next();
            }
          }
        }
      } catch (subErr) {
        console.error('Sub-role check error:', subErr);
      }

      return res.status(403).json({ 
        message: 'Insufficient permissions to perform this action' 
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

const checkSubRolePermission = (module, submodule, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check sub-role access
      const hasAccess = await checkSubRoleAccess(user.id, module, submodule, action);
      
      if (hasAccess) {
        return next();
      }

      return res.status(403).json({ 
        message: 'Insufficient sub-role permissions to perform this action' 
      });
    } catch (error) {
      console.error('Sub-role permission check error:', error);
      return res.status(500).json({ message: 'Error checking sub-role permissions' });
    }
  };
};

module.exports = {
  checkPermission,
  checkSubRolePermission
}; 