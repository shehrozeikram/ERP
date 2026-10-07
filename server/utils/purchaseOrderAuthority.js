/**
 * Shared PO / procurement authority slot logic (mirrors procurement approve route).
 */

const Indent = require('../models/general/Indent');

const normalizeToken = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const tokenMatchesAuthorityText = (token, authorityText) => {
  const normalizedToken = normalizeToken(token);
  const normalizedAuthorityText = normalizeToken(authorityText);
  if (!normalizedToken || !normalizedAuthorityText) return false;
  return normalizedAuthorityText === normalizedToken
    || normalizedAuthorityText.includes(normalizedToken)
    || normalizedToken.includes(normalizedAuthorityText);
};

const AUTHORITY_SLOT_CONFIG = [
  { key: 'preparedBy', label: 'Prepared By', indentUserField: 'preparedByUser' },
  { key: 'managerProcurement', label: 'Manager Procurement', indentUserField: 'managerProcurementUser' },
  { key: 'srManagerProcurement', label: 'Sr Manager Procurement', indentUserField: '' },
  { key: 'chiefOperatingOfficer', label: 'Chief operating officer', indentUserField: '' },
  { key: 'avpTaj', label: 'AVP Taj', indentUserField: '' },
  { key: 'technicalDepartment', label: 'Technical Department', indentUserField: '' },
  { key: 'verifiedBy', label: 'Chief operating officer', indentUserField: '' },
  { key: 'authorisedRep', label: 'AVP Taj', indentUserField: '' },
  { key: 'financeRep', label: 'Finance Rep.', indentUserField: 'financeRepUser' }
];

const getUserIdentityTokensForAuthority = (user) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return [...new Set([
    normalizeToken(fullName),
    normalizeToken(user?.email),
    normalizeToken(user?.employeeId)
  ].filter(Boolean))];
};

const isAssignedByAuthorityText = (approvalAuthorities, user) => {
  const authorities = approvalAuthorities || {};
  const assignedTexts = [
    authorities.preparedBy,
    authorities.managerProcurement,
    authorities.srManagerProcurement,
    authorities.chiefOperatingOfficer || authorities.verifiedBy,
    authorities.avpTaj || authorities.authorisedRep,
    authorities.technicalDepartment,
    authorities.financeRep
  ].map(normalizeToken).filter(Boolean);
  if (!assignedTexts.length) return false;
  const tokens = getUserIdentityTokensForAuthority(user);
  return tokens.some((t) => assignedTexts.some((assigned) => tokenMatchesAuthorityText(t, assigned)));
};

const getRequiredAuthoritySlots = async (indentId, approvalAuthorities = {}) => {
  const indent = indentId
    ? await Indent.findById(indentId).select('comparativeStatementApprovals').lean()
    : null;
  const csa = indent?.comparativeStatementApprovals || {};
  return AUTHORITY_SLOT_CONFIG.map((slot) => {
    const textToken = normalizeToken(approvalAuthorities?.[slot.key]);
    const userId = (!textToken && slot.indentUserField) ? String(csa?.[slot.indentUserField] || '').trim() : '';
    if (!userId && !textToken) return null;
    return { ...slot, userId: userId || '', textToken: textToken || '' };
  }).filter(Boolean);
};

const matchUserToAuthoritySlots = (requiredSlots, user) => {
  const uid = String(user?.id || user?._id || '').trim();
  const tokens = getUserIdentityTokensForAuthority(user);
  return requiredSlots.filter((slot) => {
    if (slot.userId && uid && slot.userId === uid) return true;
    if (slot.textToken && tokens.some((token) => tokenMatchesAuthorityText(token, slot.textToken))) return true;
    return false;
  });
};

const getApprovedAuthorityKeys = (authorityApprovals) => new Set(
  (Array.isArray(authorityApprovals) ? authorityApprovals : [])
    .map((a) => String(a?.authorityKey || '').trim())
    .filter(Boolean)
);

/**
 * True when user maps to at least one required slot not yet in authorityApprovals.
 */
async function userHasPendingAuthoritySlots(indentId, approvalAuthorities, authorityApprovals, user) {
  const requiredSlots = await getRequiredAuthoritySlots(indentId, approvalAuthorities);
  if (!requiredSlots.length) return false;
  const matchedSlots = matchUserToAuthoritySlots(requiredSlots, user);
  if (!matchedSlots.length) return false;
  const approvedKeys = getApprovedAuthorityKeys(authorityApprovals);
  return matchedSlots.some((slot) => !approvedKeys.has(slot.key));
}

const getAssignedIndentIdsForUser = async (userId) => {
  if (!userId) return [];
  const uid = String(userId);
  const indents = await Indent.find({
    $or: [
      { 'comparativeStatementApprovals.preparedByUser': uid },
      { 'comparativeStatementApprovals.verifiedByUser': uid },
      { 'comparativeStatementApprovals.authorisedRepUser': uid },
      { 'comparativeStatementApprovals.financeRepUser': uid },
      { 'comparativeStatementApprovals.managerProcurementUser': uid },
      { 'comparativeApproval.approvers.approver': uid }
    ]
  }).select('_id').lean();
  return indents.map((i) => i._id);
};

module.exports = {
  AUTHORITY_SLOT_CONFIG,
  normalizeToken,
  tokenMatchesAuthorityText,
  isAssignedByAuthorityText,
  getRequiredAuthoritySlots,
  matchUserToAuthoritySlots,
  userHasPendingAuthoritySlots,
  getAssignedIndentIdsForUser,
  getUserIdentityTokensForAuthority
};
