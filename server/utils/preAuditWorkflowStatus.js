/**
 * Map admin workflow documents (utility bills, payment settlement, rental) to Pre-Audit queue tabs.
 */

/** Index of the latest workflow step that moved the document to Send to Audit. */
function findLastSendToAuditIndex(workflowHistory) {
  if (!Array.isArray(workflowHistory) || !workflowHistory.length) return -1;
  for (let i = workflowHistory.length - 1; i >= 0; i -= 1) {
    if (String(workflowHistory[i]?.toStatus || '') === 'Send to Audit') return i;
  }
  return -1;
}

/** True when initial pre-audit approval exists for the current Send to Audit cycle (ignores older cycles after resubmit). */
function hasWorkflowInitialAuditApproval(workflowDocument) {
  const history = Array.isArray(workflowDocument?.workflowHistory) ? workflowDocument.workflowHistory : [];
  const sendIdx = findLastSendToAuditIndex(history);
  const searchFrom = sendIdx >= 0 ? sendIdx : 0;
  for (let i = searchFrom; i < history.length; i += 1) {
    if (String(history[i]?.toStatus || '').toLowerCase() === 'initial audit approval') return true;
  }
  return false;
}

/**
 * @param {object} doc - Lean workflow document
 * @param {string} workflowStatusField - e.g. auditStatus or workflowStatus
 */
function mapWorkflowDocumentToPreAuditStatus(doc, workflowStatusField = 'auditStatus') {
  const workflowStatus = doc?.[workflowStatusField] || 'Draft';
  const workflowHistory = doc?.workflowHistory || [];

  if (
    workflowStatus &&
    (workflowStatus === 'Approved (from Send to Audit)' ||
      workflowStatus === 'Approved (from Forwarded to Audit Director)' ||
      workflowStatus.startsWith('Approved (from Send to Audit)') ||
      workflowStatus.startsWith('Approved (from Forwarded to Audit Director)'))
  ) {
    return 'approved';
  }

  if (workflowStatus === 'Forwarded to Audit Director') {
    return 'forwarded_to_director';
  }

  if (
    workflowStatus === 'Returned from Audit' ||
    (workflowStatus && workflowStatus.startsWith('Rejected (from Send to Audit)'))
  ) {
    return 'returned_with_observations';
  }

  if (workflowStatus === 'Send to Audit') {
    const lastStatusChange =
      workflowHistory.length > 0 ? workflowHistory[workflowHistory.length - 1] : null;

    const wasJustResubmitted =
      lastStatusChange &&
      lastStatusChange.toStatus === 'Send to Audit' &&
      (lastStatusChange.fromStatus === 'Returned from Audit' ||
        lastStatusChange.fromStatus === 'Draft' ||
        lastStatusChange.fromStatus === 'Rejected (from Send to Audit)');

    if (wasJustResubmitted) {
      return 'pending';
    }

    if (hasWorkflowInitialAuditApproval(doc)) {
      return 'under_review';
    }

    const hasObservations = workflowHistory.some(
      (h) =>
        h.comments &&
        (h.comments.toLowerCase().includes('observation') ||
          h.comments.toLowerCase().includes('observation:'))
    );
    if (hasObservations) {
      return 'under_review';
    }

    return 'pending';
  }

  return 'pending';
}

module.exports = {
  findLastSendToAuditIndex,
  hasWorkflowInitialAuditApproval,
  mapWorkflowDocumentToPreAuditStatus
};
