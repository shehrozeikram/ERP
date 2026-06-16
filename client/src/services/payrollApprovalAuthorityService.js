import api from './api';
import { userOptionLabel } from './financeApprovalAuthorityService';

export const PAYROLL_AUTHORITY_SLOTS = [
  { key: 'accountsOfficerUser', label: 'Deputy Manager Payroll HR' },
  { key: 'financeControllerUser', label: 'GM HR' },
  { key: 'accountsManagerUser', label: 'AVP' }
];

export async function fetchPayrollAuthorityCandidates(search = '') {
  try {
    const res = await api.get('/payroll/hr-authority-candidates', {
      params: {
        limit: 500,
        allUsers: true,
        search: search || undefined,
        _ts: Date.now()
      },
      headers: { 'Cache-Control': 'no-cache' }
    });
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch {
    return [];
  }
}

export function buildPayrollApprovalAuthoritiesPayload(gmHrUser, avpUser, preparerUserId) {
  const gmHrId = gmHrUser?._id || gmHrUser;
  const avpId = avpUser?._id || avpUser;
  if (!gmHrId || !avpId || !preparerUserId) return null;
  return {
    accountsOfficerUser: String(preparerUserId),
    financeControllerUser: String(gmHrId),
    accountsManagerUser: String(avpId)
  };
}

export function validatePayrollAuthoritySelection(gmHrUser, avpUser) {
  if (!gmHrUser) return 'Select GM HR before saving.';
  if (!avpUser) return 'Select AVP before saving.';
  const gmHrId = String(gmHrUser?._id || gmHrUser || '');
  const avpId = String(avpUser?._id || avpUser || '');
  if (gmHrId && avpId && gmHrId === avpId) {
    return 'GM HR and AVP must be different users.';
  }
  return null;
}

export function getNextPendingPayrollAuthorityKey(approvalDoc) {
  const assigned = approvalDoc?.financeApprovalAuthorities || {};
  const approvedKeys = new Set(
    (approvalDoc?.financeAuthorityApprovals || [])
      .filter((a) => String(a?.decision || 'approved') !== 'rejected')
      .map((a) => String(a?.authorityKey || '').trim())
      .filter(Boolean)
  );
  for (const slot of PAYROLL_AUTHORITY_SLOTS) {
    const userRef = assigned[slot.key];
    const userId = String(userRef?._id || userRef || '');
    if (userId && !approvedKeys.has(slot.key)) return slot.key;
  }
  return null;
}

export { userOptionLabel };
