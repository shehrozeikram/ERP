/** Inclusive: POs created on/after this instant may use Sr Manager Procurement (matches server). */
export const SR_MANAGER_PROCUREMENT_EFFECTIVE_AT = new Date('2026-10-02T00:00:00+05:00');

export const isSrManagerProcurementApplicable = (createdAt) => {
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created >= SR_MANAGER_PROCUREMENT_EFFECTIVE_AT;
};

/** Authority text for UI / matching — blanks Sr Manager on legacy POs. */
export const sanitizeApprovalAuthorities = (approvalAuthorities, createdAt) => {
  const authorities = { ...(approvalAuthorities || {}) };
  if (!isSrManagerProcurementApplicable(createdAt)) {
    authorities.srManagerProcurement = '';
  }
  return authorities;
};
