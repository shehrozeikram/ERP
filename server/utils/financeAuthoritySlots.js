/**
 * Shared 3-slot finance document authority (same keys as CashApproval.financeApprovalAuthorities).
 */

const FINANCE_AUTHORITY_SLOT_CONFIG = [
  { key: 'accountsOfficerUser', label: 'Accounts Officer / AM' },
  { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
  { key: 'financeControllerUser', label: 'GM Finance' }
];

const getRequiredFinanceAuthoritySlots = (doc) => {
  const authorities = doc?.financeApprovalAuthorities || {};
  return FINANCE_AUTHORITY_SLOT_CONFIG.map((slot) => ({
    ...slot,
    userId: String(authorities?.[slot.key] || '').trim()
  })).filter((slot) => Boolean(slot.userId));
};

const matchUserToFinanceSlots = (slots, user) => {
  const uid = String(user?.id || user?._id || '').trim();
  return slots.filter((slot) => slot.userId && slot.userId === uid);
};

module.exports = {
  FINANCE_AUTHORITY_SLOT_CONFIG,
  getRequiredFinanceAuthoritySlots,
  matchUserToFinanceSlots
};
