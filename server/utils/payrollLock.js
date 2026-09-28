/**
 * Monthly payroll lock: once status leaves Draft, the record is immutable
 * (salary / attendance / regenerates must not rewrite past months).
 */
const isPayrollDraftStatus = (status) => String(status || 'Draft').trim() === 'Draft';

const isPayrollRecordLocked = (payrollOrStatus) => {
  if (payrollOrStatus == null) return false;
  const status =
    typeof payrollOrStatus === 'string'
      ? payrollOrStatus
      : payrollOrStatus.status;
  return !isPayrollDraftStatus(status);
};

const payrollLockMessage = (payroll) => {
  const month = payroll?.month;
  const year = payroll?.year;
  const status = payroll?.status || 'unknown';
  const period =
    month && year ? ` for ${month}/${year}` : '';
  return `Payroll${period} is locked (status: ${status}). Only Draft payrolls can be changed.`;
};

const assertPayrollEditable = (payroll) => {
  if (isPayrollRecordLocked(payroll)) {
    const err = new Error(payrollLockMessage(payroll));
    err.code = 'PAYROLL_LOCKED';
    err.statusCode = 400;
    throw err;
  }
};

module.exports = {
  isPayrollDraftStatus,
  isPayrollRecordLocked,
  payrollLockMessage,
  assertPayrollEditable
};
