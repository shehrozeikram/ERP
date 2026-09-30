/**
 * Executive / CEO access helpers for personal approval inboxes.
 * Designated CEO is env-driven so higher_management is not auto-CEO.
 */

const normalizeToken = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const getUserIdentityTokens = (user) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return [...new Set([
    normalizeToken(fullName),
    normalizeToken(user?.email),
    normalizeToken(user?.employeeId)
  ].filter(Boolean))];
};

const parseEnvList = (raw) => String(raw || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Admin/developer overrides may act on CEO queue when needed. */
const isExecutiveOverride = (user) => {
  if (!user) return false;
  return ['super_admin', 'admin', 'developer'].includes(String(user.role || ''));
};

/**
 * Designated CEO approver(s) for "Forwarded to CEO".
 * Configure via CEO_USER_IDS and/or CEO_USER_EMAILS (comma-separated).
 */
const isDesignatedCeoApprover = (user) => {
  if (!user) return false;
  if (isExecutiveOverride(user)) return true;

  const uid = String(user._id || user.id || '');
  const email = String(user.email || '').trim().toLowerCase();
  const ids = parseEnvList(process.env.CEO_USER_IDS);
  const emails = parseEnvList(process.env.CEO_USER_EMAILS).map((e) => e.toLowerCase());

  if (uid && ids.some((id) => String(id) === uid)) return true;
  if (email && emails.includes(email)) return true;
  if (String(user.role || '') === 'ceo') return true;
  return false;
};

const collectRoleLabels = (user) => {
  const labels = [];
  const add = (value) => {
    const text = String(value || '').trim().toLowerCase();
    if (text) labels.push(text);
  };
  add(user?.role);
  add(user?.roleRef?.name);
  add(user?.roleRef?.displayName);
  if (Array.isArray(user?.roles)) {
    user.roles.forEach((role) => {
      add(typeof role === 'string' ? role : role?.name);
      add(role?.displayName);
    });
  }
  if (Array.isArray(user?.subRoles)) {
    user.subRoles.forEach((role) => {
      add(typeof role === 'string' ? role : role?.name);
      add(role?.displayName);
    });
  }
  return labels;
};

const roleDocHasModule = (roleDoc, moduleKey) => {
  if (!roleDoc?.isActive || !Array.isArray(roleDoc.permissions)) return false;
  return roleDoc.permissions.some((p) => p?.module === moduleKey);
};

/**
 * PS / CEO Secretariat role from User Management (name "PS", Personal Secretary,
 * CEO Secretariat, or ceo_secretariat module permission).
 */
const isCeoSecretariatPsRole = (user) => {
  if (!user) return false;
  const labels = collectRoleLabels(user);
  if (labels.some((label) => (
    label === 'ps'
    || label.includes('personal secretary')
    || label === 'ceo secretariat'
    || label.includes('ceo secretariat')
  ))) {
    return true;
  }
  if (roleDocHasModule(user.roleRef, 'ceo_secretariat')) return true;
  if (Array.isArray(user.roles) && user.roles.some((role) => roleDocHasModule(role, 'ceo_secretariat'))) {
    return true;
  }
  return false;
};

/**
 * CEO Secretariat coordinators (forward to CEO, Send to CEO Office queue).
 * Does NOT include every higher_management user.
 */
const hasCeoSecretariatCoordinatorAccess = (user) => {
  if (!user) return false;
  if (['super_admin', 'admin', 'hr_manager', 'developer'].includes(user.role)) return true;
  if (isCeoSecretariatPsRole(user)) return true;
  if (roleDocHasModule(user.roleRef, 'hr') || roleDocHasModule(user.roleRef, 'general')) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => roleDocHasModule(r, 'hr') || roleDocHasModule(r, 'general'))) {
    return true;
  }
  return false;
};

/**
 * Legacy name used across procurement/cash-approvals.
 * Coordinators OR designated CEO (or override).
 * higher_management alone is NOT enough for the full CEO secretariat list.
 */
const hasCeoSecretariatAccess = (user) =>
  hasCeoSecretariatCoordinatorAccess(user) || isDesignatedCeoApprover(user);

/** See Forwarded-to-CEO queue (CEO can act; PS/coordinators view only). */
const canViewCeoForwardedQueue = (user) =>
  isDesignatedCeoApprover(user) || hasCeoSecretariatCoordinatorAccess(user);

const userMatchesText = (user, text) => {
  const token = normalizeToken(text);
  if (!token) return false;
  return getUserIdentityTokens(user).some((t) => t === token || token.includes(t) || t.includes(token));
};

const sameUserId = (a, b) => {
  const left = String(a?._id || a?.id || a || '').trim();
  const right = String(b?._id || b?.id || b || '').trim();
  return Boolean(left && right && left === right);
};

module.exports = {
  normalizeToken,
  getUserIdentityTokens,
  parseEnvList,
  isExecutiveOverride,
  isDesignatedCeoApprover,
  isCeoSecretariatPsRole,
  hasCeoSecretariatCoordinatorAccess,
  hasCeoSecretariatAccess,
  canViewCeoForwardedQueue,
  userMatchesText,
  sameUserId
};
