import { getActorUserId } from './departmentApprovalListActions';

export const GENERAL_CA_RETURN_OR_REJECT_STATUSES = [
  'Rejected',
  'Returned from Audit',
  'Returned from CEO Office',
  'Returned from CEO Secretariat'
];

export const GENERAL_CA_EDITABLE_STATUSES = [
  'Draft',
  'Pending Approval',
  ...GENERAL_CA_RETURN_OR_REJECT_STATUSES
];

/** Rejected or returned — initiator may edit & resubmit. */
export const isGeneralCashApprovalRejected = (ca) =>
  GENERAL_CA_RETURN_OR_REJECT_STATUSES.includes(ca?.status)
  || ca?.departmentApprovalStatus === 'Rejected';

export const canEditGeneralCashApproval = (ca, user) => {
  if (!ca || !user) return false;
  if (getActorUserId(user) !== getActorUserId(ca.createdBy)) return false;
  if (!GENERAL_CA_EDITABLE_STATUSES.includes(ca.status)) return false;
  if (GENERAL_CA_RETURN_OR_REJECT_STATUSES.includes(ca.status)) return true;
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
  'Pending Finance': { stage: 'finance', label: 'Finance' },
  'Returned from Audit': { stage: 'audit', label: 'Pre-Audit' },
  'Returned from CEO Office': { stage: 'ceo', label: 'CEO' },
  'Returned from CEO Secretariat': { stage: 'ceo_secretariat', label: 'CEO Secretariat' }
};

const RETURN_STATUS_DEFAULT_FROM = {
  'Returned from Audit': 'Pending Audit',
  'Returned from CEO Office': 'Forwarded to CEO',
  'Returned from CEO Secretariat': 'Send to CEO Office'
};

export const getRejectedFromWorkflowStatus = (ca) => {
  if (ca?.returnedFromStatus && RESUBMIT_TARGET_BY_FROM_STATUS[ca.returnedFromStatus]) {
    return ca.returnedFromStatus;
  }
  if (RETURN_STATUS_DEFAULT_FROM[ca?.status]) {
    return RETURN_STATUS_DEFAULT_FROM[ca.status];
  }
  const history = ca?.workflowHistory || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const toStatus = history[i]?.toStatus;
    const fromStatus = history[i]?.fromStatus || '';
    if (toStatus === 'Rejected') return fromStatus || 'Pending Approval';
    if (RETURN_STATUS_DEFAULT_FROM[toStatus]) {
      return fromStatus || RETURN_STATUS_DEFAULT_FROM[toStatus];
    }
  }
  const dated = [
    { at: ca?.financeRejectedAt, from: 'Pending Finance' },
    { at: ca?.auditRejectedAt, from: 'Pending Audit' },
    { at: ca?.ceoReturnedAt, from: 'Forwarded to CEO' },
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
