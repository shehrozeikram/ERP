/**
 * Final settlement day-rate helpers — use calendar month length, not fixed 30.
 */

const parseSettlementDate = (dateInput) => {
  if (!dateInput) return new Date();
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
};

/** Days in the calendar month of the given date (28–31). */
export const getCalendarDaysInMonth = (dateInput) => {
  const d = parseSettlementDate(dateInput);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

/**
 * Prefer last working date, then settlement date, then today —
 * the month that drives daily rate for final settlement.
 */
export const resolveSettlementRateDate = ({ lastWorkingDate, settlementDate } = {}) =>
  lastWorkingDate || settlementDate || new Date();

export const getSettlementDailyRate = (grossSalary, dateInput) => {
  const days = getCalendarDaysInMonth(dateInput);
  const safeDays = days > 0 ? days : 30;
  return (Number(grossSalary) || 0) / safeDays;
};

export const getSettlementDailyRateRounded = (grossSalary, dateInput) =>
  Math.round(getSettlementDailyRate(grossSalary, dateInput));
