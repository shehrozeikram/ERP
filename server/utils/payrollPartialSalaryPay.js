const { prorateEmployeeAllowances } = require('./allowanceHelpers');
const {
  applyJoiningProration,
  buildProrationRemarksSuffix: buildJoiningProrationRemarksSuffix,
  adjustAttendanceForJoiningProration
} = require('./payrollJoiningProration');

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const normalizePeriods = (periods = []) =>
  periods
    .map((p) => ({
      month: Number(p.month),
      year: Number(p.year)
    }))
    .filter((p) => p.month >= 1 && p.month <= 12 && p.year >= 2020);

const matchesPartialSalaryPeriod = (employee, month, year) => {
  const config = employee?.partialSalaryPay;
  if (!config?.isActive) return false;
  const payableDays = Number(config.payableDaysPerMonth);
  if (!payableDays || payableDays < 1) return false;

  return normalizePeriods(config.periods).some(
    (p) => p.month === Number(month) && p.year === Number(year)
  );
};

const getPartialSalaryProration = (employee, month, year) => {
  if (!matchesPartialSalaryPeriod(employee, month, year)) return null;

  const payableDaysPerMonth = Number(employee.partialSalaryPay.payableDaysPerMonth);
  const daysInMonth = new Date(year, month, 0).getDate();
  const payableDays = Math.min(payableDaysPerMonth, daysInMonth);
  const factor = payableDays / daysInMonth;
  const monthLabel = MONTH_NAMES[month] || `Month ${month}`;

  return {
    factor,
    isProrated: factor < 1,
    skipPayroll: false,
    payableDays,
    daysInMonth,
    type: 'partial_salary',
    workingDaysFromJoining: payableDays,
    reason: `Partial pay: ${payableDays}/${daysInMonth} days salary for ${monthLabel} ${year}`
  };
};

const buildPartialSalaryRemarksSuffix = (proration) => {
  if (!proration?.isProrated || proration.type !== 'partial_salary') return '';
  return ` (Partial pay ${proration.payableDays}/${proration.daysInMonth} days)`;
};

const buildPayrollProrationRemarksSuffix = (proration) => {
  if (!proration?.isProrated) return '';
  if (proration.type === 'partial_salary') {
    return buildPartialSalaryRemarksSuffix(proration);
  }
  return buildJoiningProrationRemarksSuffix(proration);
};

/**
 * Joining-date proration, overridden by employee partial-salary schedule for matching months.
 */
const applyPayrollProration = (employee, month, year, monthlyGross) => {
  const joiningResult = applyJoiningProration(employee, month, year, monthlyGross);
  if (joiningResult.skipPayroll) return joiningResult;

  const partialProration = getPartialSalaryProration(employee, month, year);
  if (!partialProration) return joiningResult;

  const factor = partialProration.factor;
  return {
    skipPayroll: false,
    proration: partialProration,
    joiningDate: joiningResult.joiningDate,
    grossSalary: Math.round((Number(monthlyGross) || 0) * factor),
    allowances: prorateEmployeeAllowances(employee?.allowances, factor)
  };
};

module.exports = {
  normalizePeriods,
  matchesPartialSalaryPeriod,
  getPartialSalaryProration,
  buildPartialSalaryRemarksSuffix,
  buildPayrollProrationRemarksSuffix,
  applyPayrollProration,
  adjustAttendanceForJoiningProration
};
