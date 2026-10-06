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
const getCalendarDaysInMonth = (dateInput) => {
  const d = parseSettlementDate(dateInput);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

/**
 * Prefer last working date, then settlement date, then today —
 * the month that drives daily rate for final settlement.
 */
const resolveSettlementRateDate = ({ lastWorkingDate, settlementDate } = {}) =>
  lastWorkingDate || settlementDate || new Date();

const getSettlementDailyRate = (grossSalary, dateInput) => {
  const days = getCalendarDaysInMonth(dateInput);
  const safeDays = days > 0 ? days : 30;
  return (Number(grossSalary) || 0) / safeDays;
};

const getSettlementDailyRateRounded = (grossSalary, dateInput) =>
  Math.round(getSettlementDailyRate(grossSalary, dateInput));

/** Actual salary for days served — always from GROSS daily rate. */
const getSettlementActualSalary = (grossSalary, servedDays, dateInput) => {
  const rate = getSettlementDailyRate(grossSalary, dateInput);
  return Math.round(rate * Math.max(0, Number(servedDays) || 0));
};

/** Notice shortfall deduction — always from GROSS daily rate × shortfall days. */
const getSettlementShortfallDeduction = (grossSalary, noticePeriod, servedDays, dateInput) => {
  const shortfall = Math.max(0, (Number(noticePeriod) || 0) - (Number(servedDays) || 0));
  const rate = getSettlementDailyRate(grossSalary, dateInput);
  return Math.round(rate * shortfall);
};

module.exports = {
  getCalendarDaysInMonth,
  resolveSettlementRateDate,
  getSettlementDailyRate,
  getSettlementDailyRateRounded,
  getSettlementActualSalary,
  getSettlementShortfallDeduction
};
