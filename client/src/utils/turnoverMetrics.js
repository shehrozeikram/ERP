import { isEmployedEmployee, isSeparatedEmployee } from './employeeStatus';

function getEmployeeHireDate(employee) {
  if (!employee?.hireDate) return null;
  const date = new Date(employee.hireDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

const PERIOD_START_BUILDERS = {
  month: (now) => new Date(now.getFullYear(), now.getMonth(), 1),
  '3months': (now) => new Date(now.getFullYear(), now.getMonth() - 2, 1),
  '6months': (now) => new Date(now.getFullYear(), now.getMonth() - 5, 1),
  year: (now) => new Date(now.getFullYear(), 0, 1)
};

export function getTurnoverPeriodStart(period, now = new Date()) {
  if (period === 'all') return null;
  const build = PERIOD_START_BUILDERS[period] || PERIOD_START_BUILDERS.month;
  return build(now);
}

export function getTurnoverPeriodLabel(period) {
  const labels = {
    month: 'This month',
    '3months': 'Last 3 months',
    '6months': 'Last 6 months',
    year: 'This year',
    all: 'All time'
  };
  return labels[period] || labels.month;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

/** Best separation date: terminationDate, else updatedAt for already-separated records. */
export function getSeparationDate(employee) {
  if (employee?.terminationDate) {
    const date = new Date(employee.terminationDate);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (isSeparatedEmployee(employee) && employee?.updatedAt) {
    const date = new Date(employee.updatedAt);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function isSeparationInPeriod(separationDate, period, now = new Date()) {
  if (period === 'all') return true;
  if (!separationDate) return false;
  const periodStart = getTurnoverPeriodStart(period, now);
  if (!periodStart) return false;
  const start = startOfDay(periodStart);
  const end = endOfDay(now);
  const time = separationDate.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export function getNewHiresInPeriod(employees, period, now = new Date()) {
  return employees.filter((employee) => {
    const hireDate = getEmployeeHireDate(employee);
    if (!hireDate) return false;
    if (period === 'all') return true;
    return isSeparationInPeriod(hireDate, period, now);
  });
}

export function getEmployeesLeftInPeriod(employees, period, now = new Date()) {
  return employees.filter((employee) => {
    if (!isSeparatedEmployee(employee)) return false;
    if (period === 'all') return true;
    const separationDate = getSeparationDate(employee);
    return isSeparationInPeriod(separationDate, period, now);
  });
}

/**
 * Turnover rate = separations / average headcount × 100
 * Average headcount = (start of period + end of period) / 2
 * Start headcount = end + separations − new hires
 */
export function computeTurnoverMetrics(employees, period = 'month', now = new Date()) {
  const roster = Array.isArray(employees) ? employees.filter((row) => row?.employmentStatus !== 'Draft') : [];
  const endHeadcount = roster.filter(isEmployedEmployee).length;
  const leftInPeriod = getEmployeesLeftInPeriod(roster, period, now);
  const separations = leftInPeriod.length;
  const newHires = getNewHiresInPeriod(roster, period, now).length;

  if (period === 'all') {
    const separatedTotal = roster.filter(isSeparatedEmployee).length;
    const avgHeadcount = separatedTotal > 0
      ? (endHeadcount + (endHeadcount + separatedTotal)) / 2
      : endHeadcount;
    const turnoverRate = avgHeadcount > 0
      ? Number(((separatedTotal / avgHeadcount) * 100).toFixed(2))
      : 0;
    return {
      turnoverRate,
      employeesLeftInPeriod: separatedTotal,
      endHeadcount,
      averageHeadcount: Number(avgHeadcount.toFixed(1))
    };
  }

  const startHeadcount = Math.max(0, endHeadcount + separations - newHires);
  const averageHeadcount = startHeadcount > 0 || endHeadcount > 0
    ? (startHeadcount + endHeadcount) / 2
    : 0;
  const turnoverRate = averageHeadcount > 0
    ? Number(((separations / averageHeadcount) * 100).toFixed(2))
    : 0;

  return {
    turnoverRate,
    employeesLeftInPeriod: separations,
    endHeadcount,
    averageHeadcount: Number(averageHeadcount.toFixed(1))
  };
}
