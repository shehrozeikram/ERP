import api from './api';
import { userOptionLabel } from './financeApprovalAuthorityService';

export const PAYROLL_AUTHORITY_SLOTS = [
  { key: 'accountsOfficerUser', label: 'Deputy Manager Payroll HR' },
  { key: 'financeControllerUser', label: 'GM HR' }
];

export async function fetchPayrollAuthorityCandidates(search = '') {
  try {
    const res = await api.get('/payroll/hr-authority-candidates', {
      params: { limit: 150, search: search || undefined, _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    });
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    if (list.length) return list;
  } catch {
    /* fall through */
  }

  try {
    const fallback = await api.get('/indents/approver-candidates', {
      params: {
        limit: 100,
        departmentLike: 'hr,human resource',
        search: search || undefined,
        _ts: Date.now()
      },
      headers: { 'Cache-Control': 'no-cache' }
    });
    return Array.isArray(fallback.data?.data) ? fallback.data.data : [];
  } catch {
    return [];
  }
}

export function buildPayrollApprovalAuthoritiesPayload(gmHrUser, preparerUserId) {
  const gmHrId = gmHrUser?._id || gmHrUser;
  if (!gmHrId || !preparerUserId) return null;
  return {
    accountsOfficerUser: String(preparerUserId),
    financeControllerUser: String(gmHrId)
  };
}

export function validatePayrollAuthoritySelection(gmHrUser) {
  if (!gmHrUser) return 'Select GM HR before saving.';
  return null;
}

export { userOptionLabel };
