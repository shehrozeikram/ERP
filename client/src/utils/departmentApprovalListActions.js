/** Shared list-row helpers for Manager / HOD approval workflows. */

export function getActorUserId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || value.userId || '');
}

export function getFirstPendingChainStep(chain = []) {
  return (chain || []).find((step) => step?.status === 'pending') || null;
}

export function canApproveCashApprovalRow(row, user) {
  const uid = getActorUserId(user);
  if (!uid || !row) return false;
  if (row.status !== 'Pending Approval') return false;
  if (row.departmentApprovalStatus !== 'Submitted') return false;
  const creatorId = getActorUserId(row.createdBy);
  if (creatorId && creatorId === uid) return false;
  const pendingStep = getFirstPendingChainStep(row.departmentApprovalChain);
  const pendingApproverId = getActorUserId(pendingStep?.approver);
  return Boolean(pendingApproverId && pendingApproverId === uid);
}

export function isCashApprovalDeptApproved(row) {
  if (!row) return false;
  if (row.departmentApprovalStatus === 'Approved') return true;
  const chain = row.departmentApprovalChain || [];
  return chain.length > 0 && chain.every((step) => step?.status === 'approved');
}

export function canApproveUtilityBillRow(bill, user) {
  const uid = getActorUserId(user);
  if (!uid || !bill) return false;
  if (bill.approvalStatus !== 'Submitted') return false;
  const requesterId = getActorUserId(bill.createdBy);
  if (requesterId && requesterId === uid) return false;
  const pendingStep = getFirstPendingChainStep(bill.approvalChain);
  const pendingApproverId = getActorUserId(pendingStep?.approver);
  return Boolean(pendingApproverId && pendingApproverId === uid);
}

export function isUtilityBillDeptApproved(bill) {
  return bill?.approvalStatus === 'Approved';
}
