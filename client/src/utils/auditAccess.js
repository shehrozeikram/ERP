const normalizeRole = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const collapseRepeatedChars = (value) => String(value || '').replace(/(.)\1+/g, '$1');

const isAuditDirectorLabel = (value) => {
  const normalized = normalizeRole(value);
  const collapsed = collapseRepeatedChars(normalized);
  return collapsed.includes('audit') && collapsed.includes('director');
};

const hasModuleAccess = (roleDoc, moduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((permission) => permission?.module === moduleKey);
};

const hasAuditSubRoleAccess = (subRoleDoc) => {
  if (!subRoleDoc) return false;
  if (normalizeRole(subRoleDoc.module) === 'audit') return true;
  if (Array.isArray(subRoleDoc.permissions)) {
    return subRoleDoc.permissions.some((p) => {
      const sm = normalizeRole(p?.submodule);
      return sm === 'pre_audit' || sm === 'audit_management';
    });
  }
  return false;
};

export const hasAuditAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'audit_manager', 'auditor', 'audit_director'].includes(user.role)) return true;
  if (hasModuleAccess(user.roleRef, 'audit')) return true;
  if (Array.isArray(user.roles) && user.roles.some((roleDoc) => hasModuleAccess(roleDoc, 'audit'))) return true;
  if (Array.isArray(user.subRoles) && user.subRoles.some((subRoleDoc) => hasAuditSubRoleAccess(subRoleDoc))) {
    return true;
  }
  return false;
};

const userHasRoleByPredicate = (user, predicate) => {
  if (typeof predicate !== 'function') return false;
  if (predicate(user?.role)) return true;
  const roleRefNames = [user?.roleRef?.name, user?.roleRef?.displayName];
  if (roleRefNames.some((n) => predicate(n))) return true;
  const roleNames = Array.isArray(user?.roles)
    ? user.roles.flatMap((r) => [r?.name, r?.displayName]).filter(Boolean)
    : [];
  if (roleNames.some((n) => predicate(n))) return true;
  const subRoleNames = Array.isArray(user?.subRoles)
    ? user.subRoles.flatMap((r) => [r?.name, r?.displayName]).filter(Boolean)
    : [];
  return subRoleNames.some((n) => predicate(n));
};

export const canPerformInitialPreAuditActions = (user) => {
  if (!user) return false;
  if (['super_admin', 'developer'].includes(normalizeRole(user.role))) return true;
  if (!hasAuditAccess(user)) return false;
  return !userHasRoleByPredicate(user, isAuditDirectorLabel);
};
