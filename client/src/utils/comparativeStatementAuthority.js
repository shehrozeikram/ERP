const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '_');
const normLabel = (s) => String(s || '').trim().toLowerCase();

const GM_PROCUREMENT_LABELS = ['gm procurement', 'general manager procurement'];

function userMatchesGmProcurement(user) {
  const labels = [];
  if (user?.roleRef) {
    labels.push(normLabel(user.roleRef.name), normLabel(user.roleRef.displayName));
  }
  if (Array.isArray(user?.roles)) {
    for (const r of user.roles) {
      labels.push(normLabel(r?.name), normLabel(r?.displayName));
    }
  }
  return labels.some((l) => l && GM_PROCUREMENT_LABELS.includes(l));
}

export function canBypassPreparedByAuthorityLock(user) {
  if (!user) return false;
  const r = norm(user.role);
  if (['super_admin', 'developer', 'admin', 'procurement_manager'].includes(r)) return true;
  return userMatchesGmProcurement(user);
}

const otherAuthorityUserKeys = ['verifiedByUser', 'authorisedRepUser', 'financeRepUser', 'managerProcurementUser'];

const hasOtherAuthorityUser = (requisition) =>
  otherAuthorityUserKeys.some((k) => Boolean(requisition?.comparativeStatementApprovals?.[k]));

/** True once Prepared By is set and another authority is chosen and/or a comparative workflow exists (matches server). */
export function comparativeAuthoritySelectionLocked(requisition) {
  if (!requisition) return false;
  const prep = requisition.comparativeStatementApprovals?.preparedByUser;
  const preparedById = prep?._id ? String(prep._id) : prep ? String(prep) : '';
  if (!preparedById) return false;
  if (hasOtherAuthorityUser(requisition)) return true;
  const ca = requisition.comparativeApproval || {};
  if (Array.isArray(ca.approvers) && ca.approvers.length > 0) return true;
  if (['draft', 'submitted', 'approved', 'rejected'].includes(ca.status || '')) return true;
  return false;
}

/** Who may change approval authority user pickers after lock is active. */
export function canEditComparativeAuthorityUsers(user, requisition) {
  if (!user || !requisition) return false;
  if (canBypassPreparedByAuthorityLock(user)) return true;
  if (!comparativeAuthoritySelectionLocked(requisition)) return true;
  const prep = requisition.comparativeStatementApprovals?.preparedByUser;
  const preparedById = prep?._id ? String(prep._id) : prep ? String(prep) : '';
  const uid = String(user.id || user._id || '');
  return Boolean(preparedById && uid === preparedById);
}
