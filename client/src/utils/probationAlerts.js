/** Days before end-of-probation when HR should see the alert popup */
export const PROBATION_ALERT_DAYS_BEFORE = 7;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Probation end date: stored endOfProbationDate, else appointment + months.
 */
export function getProbationEndDate(employee) {
  if (employee?.endOfProbationDate) {
    const stored = new Date(employee.endOfProbationDate);
    if (!Number.isNaN(stored.getTime())) return stored;
  }

  const baseDate = employee?.appointmentDate || employee?.hireDate || employee?.joiningDate;
  if (!baseDate) return null;
  const startDate = new Date(baseDate);
  if (Number.isNaN(startDate.getTime())) return null;

  const months = Number(employee?.probationPeriodMonths ?? employee?.probationPeriod ?? 0);
  if (!Number.isFinite(months) || months <= 0) return null;

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  return Number.isNaN(endDate.getTime()) ? null : endDate;
}

export function getDaysUntilProbationEnd(employee, referenceDate = new Date()) {
  const end = getProbationEndDate(employee);
  if (!end) return null;
  const today = startOfDay(referenceDate);
  const endDay = startOfDay(end);
  return Math.round((endDay - today) / MS_PER_DAY);
}

export function isEmployeeEligibleForProbationAlert(employee) {
  if (!employee) return false;
  if (employee.confirmationDate) return false;
  if (['Draft', 'Resigned', 'Terminated', 'Retired'].includes(employee.employmentStatus)) {
    return false;
  }
  return true;
}

/** True when probation ends in 0..daysBefore days (inclusive). */
export function isProbationEndingWithinDays(employee, daysBefore = PROBATION_ALERT_DAYS_BEFORE) {
  if (!isEmployeeEligibleForProbationAlert(employee)) return false;
  const daysLeft = getDaysUntilProbationEnd(employee);
  if (daysLeft === null) return false;
  return daysLeft >= 0 && daysLeft <= daysBefore;
}

export function getEmployeesProbationEndingSoon(
  employees = [],
  daysBefore = PROBATION_ALERT_DAYS_BEFORE
) {
  return employees
    .filter((emp) => isProbationEndingWithinDays(emp, daysBefore))
    .sort((a, b) => getProbationEndDate(a) - getProbationEndDate(b));
}

export function formatProbationEndLabel(employee) {
  const end = getProbationEndDate(employee);
  if (!end) return '—';
  return end.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatProbationDaysLeftLabel(employee) {
  const days = getDaysUntilProbationEnd(employee);
  if (days === null) return '';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends in 1 day';
  return `Ends in ${days} days`;
}
