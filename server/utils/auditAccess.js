const { isAuditDirectorUser, normalizeRoleLabel } = require('./auditDirectorRole');

const hasModuleAccess = (roleDoc, moduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((permission) => permission?.module === moduleKey);
};

const hasAuditSubRoleAccess = (subRoleDoc) => {
  if (!subRoleDoc) return false;
  const moduleKey = normalizeRoleLabel(subRoleDoc.module);
  if (moduleKey === 'audit') return true;
  if (Array.isArray(subRoleDoc.permissions)) {
    return subRoleDoc.permissions.some((p) => {
      const sm = normalizeRoleLabel(p?.submodule);
      return sm === 'pre_audit' || sm === 'audit_management';
    });
  }
  return false;
};

/** Any user who can work in the Audit module (incl. custom roles like General Audit). */
const hasAuditAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'audit_manager', 'auditor', 'audit_director'].includes(user.role)) return true;
  if (hasModuleAccess(user.roleRef, 'audit')) return true;
  if (Array.isArray(user.roles) && user.roles.some((roleDoc) => hasModuleAccess(roleDoc, 'audit'))) return true;
  if (Array.isArray(user.subRoles) && user.subRoles.some((subRoleDoc) => hasAuditSubRoleAccess(subRoleDoc))) {
    return true;
  }
  return false;
};

/** Initial pre-audit approve + forward: audit staff, not Audit Director (super_admin exempt). */
const canPerformInitialPreAuditActions = (user) => {
  if (!user) return false;
  if (['super_admin', 'developer'].includes(String(user.role || '').trim())) return true;
  if (!hasAuditAccess(user)) return false;
  return !isAuditDirectorUser(user);
};

module.exports = {
  hasModuleAccess,
  hasAuditAccess,
  canPerformInitialPreAuditActions
};
