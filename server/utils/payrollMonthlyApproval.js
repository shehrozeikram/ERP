const PayrollMonthlyApproval = require('../models/hr/PayrollMonthlyApproval');
const { matchUserToFinanceSlots } = require('./financeAuthoritySlots');

/** Payroll monthly summary uses HR titles; keys match stored financeApprovalAuthorities fields (sequential order). */
const PAYROLL_AUTHORITY_SLOT_CONFIG = [
  { key: 'accountsOfficerUser', label: 'Deputy Manager Payroll HR' },
  { key: 'financeControllerUser', label: 'GM HR' },
  { key: 'accountsManagerUser', label: 'AVP' }
];

const getRequiredPayrollAuthoritySlots = (doc) => {
  const authorities = doc?.financeApprovalAuthorities || {};
  return PAYROLL_AUTHORITY_SLOT_CONFIG.map((slot) => ({
    ...slot,
    userId: String(authorities?.[slot.key] || '').trim()
  })).filter((slot) => Boolean(slot.userId));
};

const populateMonthlyApproval = (query) => query
  .populate('financeApprovalAuthorities.accountsOfficerUser', 'firstName lastName email employeeId digitalSignature')
  .populate('financeApprovalAuthorities.accountsManagerUser', 'firstName lastName email employeeId digitalSignature')
  .populate('financeApprovalAuthorities.financeControllerUser', 'firstName lastName email employeeId digitalSignature')
  .populate('financeAuthorityApprovals.approver', 'firstName lastName email employeeId digitalSignature')
  .populate('financeAuthoritiesAssignedBy', 'firstName lastName email employeeId digitalSignature');

const getApprovedAuthorityKeys = (doc) => new Set(
  (doc?.financeAuthorityApprovals || [])
    .filter((a) => String(a?.decision || 'approved').trim() !== 'rejected')
    .map((a) => String(a?.authorityKey || '').trim())
    .filter(Boolean)
);

const allPayrollAuthoritiesApproved = (doc) => {
  const slots = getRequiredPayrollAuthoritySlots(doc);
  if (slots.length < PAYROLL_AUTHORITY_SLOT_CONFIG.length) return false;
  const approved = getApprovedAuthorityKeys(doc);
  return slots.every((slot) => approved.has(slot.key));
};

/** First authority slot that has not approved yet (enforces sequential chain). */
const getNextPendingPayrollAuthoritySlot = (doc) => {
  const slots = getRequiredPayrollAuthoritySlots(doc);
  const approved = getApprovedAuthorityKeys(doc);
  return slots.find((slot) => !approved.has(slot.key)) || null;
};

const syncAuthorityStatus = (doc) => {
  if (allPayrollAuthoritiesApproved(doc)) {
    doc.authorityStatus = 'approved';
  } else if ((doc.financeAuthorityApprovals || []).some((a) => a.decision === 'rejected')) {
    doc.authorityStatus = 'rejected';
  } else {
    doc.authorityStatus = 'pending';
  }
};

const getOrCreateMonthlyApproval = async (month, year) => {
  let doc = await PayrollMonthlyApproval.findOne({ month, year });
  if (!doc) {
    doc = await PayrollMonthlyApproval.create({ month, year });
  }
  return doc;
};

const assertMonthlyPayrollAuthoritiesApproved = async (month, year) => {
  const doc = await PayrollMonthlyApproval.findOne({ month, year });
  if (!doc || !allPayrollAuthoritiesApproved(doc)) {
    const error = new Error(
      'All monthly payroll approval authorities must approve before draft payrolls can be approved'
    );
    error.statusCode = 400;
    throw error;
  }
  return doc;
};

module.exports = {
  PAYROLL_AUTHORITY_SLOT_CONFIG,
  populateMonthlyApproval,
  getApprovedAuthorityKeys,
  allPayrollAuthoritiesApproved,
  syncAuthorityStatus,
  getOrCreateMonthlyApproval,
  assertMonthlyPayrollAuthoritiesApproved,
  getRequiredPayrollAuthoritySlots,
  getNextPendingPayrollAuthoritySlot,
  matchUserToFinanceSlots
};
