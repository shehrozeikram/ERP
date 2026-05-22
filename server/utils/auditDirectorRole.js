/**
 * Detect Audit Director from primary role, roleRef, roles[], or subRoles[].
 * Handles display names like "Director Audit", "director audit", and typos "diirector".
 */

const normalizeRoleLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

/** Collapse repeated letters: diirector → director */
const collapseRepeatedChars = (value) => String(value || '').replace(/(.)\1+/gi, '$1');

const slugifyRoleLabel = (value) =>
  collapseRepeatedChars(normalizeRoleLabel(value)).replace(/\s+/g, '_');

const looksLikeAuditDirectorLabel = (value) => {
  const slug = slugifyRoleLabel(value);
  if (!slug) return false;
  return slug.includes('audit') && slug.includes('director');
};

const collectRoleLabels = (user) => {
  if (!user) return [];
  const labels = new Set();
  const add = (v) => {
    const t = String(v || '').trim();
    if (t) labels.add(t);
  };

  add(user.role);
  add(user?.roleRef?.name);
  add(user?.roleRef?.displayName);

  const roleDocs = [...(user.roles || []), ...(user.subRoles || [])];
  for (const roleDoc of roleDocs) {
    if (!roleDoc) continue;
    if (typeof roleDoc === 'string') {
      add(roleDoc);
      continue;
    }
    add(roleDoc.name);
    add(roleDoc.displayName);
  }

  return [...labels];
};

const isAuditDirectorUser = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin'].includes(String(user.role || '').trim())) return false;

  const labels = collectRoleLabels(user);
  return labels.some((label) => looksLikeAuditDirectorLabel(label));
};

/** Super admin may act as Audit Director for approvals */
const canActAsAuditDirector = (user) => {
  if (!user) return false;
  if (String(user.role || '').trim() === 'super_admin') return true;
  return isAuditDirectorUser(user);
};

module.exports = {
  normalizeRoleLabel,
  looksLikeAuditDirectorLabel,
  isAuditDirectorUser,
  canActAsAuditDirector
};
