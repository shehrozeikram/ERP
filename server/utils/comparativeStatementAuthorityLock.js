/**
 * After Prepared By has saved an approval chain, only that user (or procurement GM / super admin)
 * may change authority user assignments — enforced on comparative-statement-approvals and comparative-approvers.
 */

const normalizeUserRole = (role) =>
  String(role || '')
    .toLowerCase()
    .replace(/\s+/g, '_');

const preparedByUserId = (indent) => {
  const prep = indent?.comparativeStatementApprovals?.preparedByUser;
  if (!prep) return '';
  return String(prep._id || prep);
};

const otherAuthorityUserKeys = ['verifiedByUser', 'authorisedRepUser', 'financeRepUser', 'managerProcurementUser'];

const hasOtherAuthorityUser = (indent) =>
  otherAuthorityUserKeys.some((k) => Boolean(indent?.comparativeStatementApprovals?.[k]));

/** Lock applies once Prepared By is set and at least one other authority is chosen and/or a comparative workflow row exists. */
const comparativeAuthorityUserLockActive = (indent) => {
  const pb = preparedByUserId(indent);
  if (!pb) return false;
  const ca = indent?.comparativeApproval;
  if (hasOtherAuthorityUser(indent)) return true;
  if (!ca) return false;
  if (Array.isArray(ca.approvers) && ca.approvers.length > 0) return true;
  if (['draft', 'submitted', 'approved', 'rejected'].includes(ca.status || '')) return true;
  return false;
};

const normalizeRoleLabel = (value) => String(value || '').trim().toLowerCase();

/** Same intent as PROCUREMENT_ASSIGNMENT_MANAGER_ROLE_NAMES in procurement routes */
const GM_PROCUREMENT_ROLE_LABELS = ['gm procurement', 'general manager procurement'];

const userMatchesGmProcurementRoleDoc = (user) => {
  const labels = [];
  if (user?.roleRef) {
    labels.push(normalizeRoleLabel(user.roleRef.name), normalizeRoleLabel(user.roleRef.displayName));
  }
  if (Array.isArray(user?.roles)) {
    for (const r of user.roles) {
      labels.push(normalizeRoleLabel(r?.name), normalizeRoleLabel(r?.displayName));
    }
  }
  return labels.some((l) => l && GM_PROCUREMENT_ROLE_LABELS.includes(l));
};

/** Super Admin, Admin, Procurement Manager slug, or GM Procurement (role display / roleRef). */
const canBypassPreparedByAuthorityLock = (user) => {
  if (!user) return false;
  const r = normalizeUserRole(user.role);
  if (['super_admin', 'admin', 'procurement_manager'].includes(r)) return true;
  return userMatchesGmProcurementRoleDoc(user);
};

const canMutateComparativeAuthorityUsers = (user, indent) => {
  if (!comparativeAuthorityUserLockActive(indent)) return true;
  if (canBypassPreparedByAuthorityLock(user)) return true;
  const pb = preparedByUserId(indent);
  const uid = String(user.id || user._id || '');
  return Boolean(pb && uid === pb);
};

const authorityUserFieldKeys = [
  'preparedByUser',
  'verifiedByUser',
  'authorisedRepUser',
  'financeRepUser',
  'managerProcurementUser'
];

const stringifyRef = (v) => {
  if (v == null || v === '') return '';
  return String(v._id || v);
};

/** True if request body would change any stored *User authority reference. */
const authorityUserRefsChanged = (indent, body) => {
  const cur = indent.comparativeStatementApprovals || {};
  for (const k of authorityUserFieldKeys) {
    if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
    const incoming = body[k] ? stringifyRef(body[k]) : '';
    const existing = cur[k] ? stringifyRef(cur[k]) : '';
    if (incoming !== existing) return true;
  }
  return false;
};

module.exports = {
  comparativeAuthorityUserLockActive,
  canBypassPreparedByAuthorityLock,
  canMutateComparativeAuthorityUsers,
  authorityUserRefsChanged,
  preparedByUserId
};
