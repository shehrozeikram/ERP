/**
 * Stamp metadata for audit workflow history entries (when user opts in via useStamp).
 */
function resolveAuditStampMeta(req) {
  const wantsStamp = req.body?.useStamp === true || req.body?.useStamp === 'true';
  if (!wantsStamp || !req.user?.approvalStamp) {
    return { stampUsed: false };
  }
  return { stampUsed: true, stampImage: req.user.approvalStamp };
}

module.exports = { resolveAuditStampMeta };
