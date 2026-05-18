/**
 * Admin workflow documents in the Pre-Audit / audit-director path must not be edited until returned.
 * Matches client `isWorkflowAuditBlockingEditStatus`.
 */
function isWorkflowAuditBlockingEditStatus(status) {
  const s = String(status || '');
  if (!s) return false;
  if (['Send to Audit', 'Forwarded to Audit Director'].includes(s)) return true;
  if (/^Approved \(from Send to Audit/.test(s)) return true;
  if (/^Approved \(from Forwarded to Audit Director/.test(s)) return true;
  return false;
}

module.exports = {
  isWorkflowAuditBlockingEditStatus
};
