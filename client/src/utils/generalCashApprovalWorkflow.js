import { getActorUserId } from './departmentApprovalListActions';

export const GENERAL_CA_EDITABLE_STATUSES = [
  'Draft',
  'Pending Approval',
  'Rejected',
  'Returned from Audit'
];

export const isGeneralCashApprovalRejected = (ca) =>
  ca?.status === 'Rejected' || ca?.departmentApprovalStatus === 'Rejected';

export const canEditGeneralCashApproval = (ca, user) => {
  if (!ca || !user) return false;
  if (getActorUserId(user) !== getActorUserId(ca.createdBy)) return false;
  if (!GENERAL_CA_EDITABLE_STATUSES.includes(ca.status)) return false;
  if (ca.status === 'Rejected' || ca.status === 'Returned from Audit') return true;
  return ['Draft', 'Submitted', 'Rejected'].includes(ca.departmentApprovalStatus || 'Draft');
};

export const canResubmitGeneralCashApproval = (ca, user) =>
  canEditGeneralCashApproval(ca, user) && isGeneralCashApprovalRejected(ca);

export const canSubmitGeneralCashApprovalDraft = (ca, user) =>
  getActorUserId(user) === getActorUserId(ca?.createdBy) && ca?.status === 'Draft';

const RESUBMIT_TARGET_BY_FROM_STATUS = {
  'Pending Approval': { stage: 'department', label: 'department approval' },
  'Pending Audit': { stage: 'audit', label: 'Pre-Audit' },
  'Forwarded to Audit Director': { stage: 'audit', label: 'Pre-Audit' },
  'Send to CEO Office': { stage: 'ceo_secretariat', label: 'CEO Secretariat' },
  'Forwarded to CEO': { stage: 'ceo', label: 'CEO' },
  'Pending Finance': { stage: 'finance', label: 'Finance' }
};

export const getRejectedFromWorkflowStatus = (ca) => {
  const history = ca?.workflowHistory || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.toStatus === 'Rejected') {
      return history[i]?.fromStatus || '';
    }
  }
  const dated = [
    { at: ca?.financeRejectedAt, from: 'Pending Finance' },
    { at: ca?.auditRejectedAt, from: 'Pending Audit' },
    { at: ca?.ceoRejectedAt, from: 'Forwarded to CEO' },
    { at: ca?.departmentRejectedAt, from: 'Pending Approval' }
  ].filter((row) => row.at);
  if (dated.length) {
    dated.sort((a, b) => new Date(b.at) - new Date(a.at));
    return dated[0].from;
  }
  if ((ca?.departmentApprovalChain || []).some((step) => step?.status === 'rejected')) {
    return 'Pending Approval';
  }
  return '';
};

export const resolveGeneralResubmitTargetClient = (ca) => {
  const fromStatus = getRejectedFromWorkflowStatus(ca) || 'Pending Approval';
  const target = RESUBMIT_TARGET_BY_FROM_STATUS[fromStatus] || RESUBMIT_TARGET_BY_FROM_STATUS['Pending Approval'];
  return { ...target, fromStatus };
};

export const isDepartmentStageRejection = (ca) =>
  resolveGeneralResubmitTargetClient(ca).stage === 'department';

export const departmentApproverRoleLabel = (index) => {
  if (index === 0) return 'Manager';
  if (index === 1) return 'Head of Department';
  return `Approver ${index + 1}`;
};

export const rejectedApproverLabel = (ca) => {
  const target = resolveGeneralResubmitTargetClient(ca);
  if (target.stage === 'audit') return 'Audit';
  if (target.stage === 'finance') return 'Finance';
  if (target.stage === 'ceo_secretariat') return 'CEO Secretariat';
  if (target.stage === 'ceo') return 'CEO';
  const idx = (ca?.departmentApprovalChain || []).findIndex((step) => step?.status === 'rejected');
  if (idx === 0) return 'Manager';
  if (idx === 1) return 'Head of Department';
  return 'approver';
};

export const getResubmitTargetDepartmentRoleLabel = (ca) => {
  const idx = (ca?.departmentApprovalChain || []).findIndex((step) => step?.status === 'rejected');
  const pendingIdx = (ca?.departmentApprovalChain || []).findIndex((step) => step?.status === 'pending');
  const stepIdx = idx >= 0 ? idx : pendingIdx;
  return stepIdx >= 0 ? departmentApproverRoleLabel(stepIdx) : 'approver';
};

export const getResubmitDestinationLabel = (ca) => {
  const target = resolveGeneralResubmitTargetClient(ca);
  if (target.stage === 'department') {
    return getResubmitTargetDepartmentRoleLabel(ca);
  }
  return target.label;
};

export const hasPreservedDepartmentApprovals = (ca) =>
  (ca?.departmentApprovalChain || []).some((step) => step?.status === 'approved');

export const resubmitCashApprovalMessage = (ca) => {
  const destination = getResubmitDestinationLabel(ca);
  const target = resolveGeneralResubmitTargetClient(ca);
  if (target.stage === 'department' && hasPreservedDepartmentApprovals(ca)) {
    return `Resubmitted — prior approvals preserved. Awaiting ${destination} only.`;
  }
  return `Resubmitted to ${destination}`;
};
