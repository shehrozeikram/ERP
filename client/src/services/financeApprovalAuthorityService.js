import api from './api';

export const FINANCE_AUTHORITY_SLOTS = [
  { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
  { key: 'financeControllerUser', label: 'GM Finance' }
];

/**
 * Users eligible for Sr Manager Accounts / GM Finance on settlement vouchers.
 */
export async function fetchFinanceAuthorityCandidates(search = '') {
  try {
    const res = await api.get('/finance/finance-authority-candidates', {
      params: { limit: 150, search: search || undefined, _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    });
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    if (list.length) return list;
  } catch {
    /* fall through */
  }

  // Fallback: broad active-user list (same as Vendor Advance page)
  const fallback = await api.get('/indents/approver-candidates', {
    params: { limit: 100, _ts: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  });
  const all = Array.isArray(fallback.data?.data) ? fallback.data.data : [];
  const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const financeOnly = all.filter((u) => {
    const dept = norm(u?.department);
    return dept.includes('finance') || dept.includes('account');
  });
  return financeOnly.length >= 2 ? financeOnly : all;
}

export function userOptionLabel(u) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || u?.employeeId || 'User';
}

export function userOptionSecondary(u) {
  const parts = [u?.department, u?.employeeId].filter(Boolean);
  return parts.length ? parts.join(' · ') : '';
}

/** API body: accountsOfficer = preparer (current user), AM + GM from pickers. */
export function buildFinanceApprovalAuthoritiesPayload(finAuth, preparerUserId) {
  const am = finAuth?.accountsManagerUser?._id || finAuth?.accountsManagerUser;
  const fc = finAuth?.financeControllerUser?._id || finAuth?.financeControllerUser;
  if (!am || !fc) return null;
  return {
    accountsManagerUser: String(am),
    financeControllerUser: String(fc),
    accountsOfficerUser: String(preparerUserId || '')
  };
}

export function validateFinanceAuthoritySelection(finAuth) {
  if (!finAuth?.accountsManagerUser || !finAuth?.financeControllerUser) {
    return 'Select Sr Manager Accounts and GM Finance before submitting.';
  }
  return null;
}
