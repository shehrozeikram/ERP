/**
 * Simple Attendance Calculator for 26 Working Days
 * Excludes Sundays from working days
 */

/**
 * Calculate daily rate for salary deduction
 * @param {number} grossSalary - Employee's gross salary
 * @returns {number} Daily rate (Gross Salary ÷ 26)
 */
const calculateDailyRate = (grossSalary) => {
  return grossSalary / 26;
};

/**
 * Calculate attendance deduction for absent days
 * @param {number} grossSalary - Employee's gross salary
 * @param {number} absentDays - Number of absent days
 * @returns {number} Total deduction amount
 */
const calculateAttendanceDeduction = (grossSalary, absentDays) => {
  const dailyRate = calculateDailyRate(grossSalary);
  return absentDays * dailyRate;
};

/**
 * Calculate working days for a given month (excluding Sundays)
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {number} Total working days (excluding Sundays)
 */
const calculateWorkingDaysInMonth = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    
    // Sunday = 0, exclude Sundays
    if (dayOfWeek !== 0) {
      workingDays++;
    }
  }
  
  return workingDays;
};

/**
 * Get attendance summary for payroll
 * @param {number} grossSalary - Employee's gross salary
 * @param {number} presentDays - Days employee was present
 * @param {number} absentDays - Days employee was absent
 * @param {number} leaveDays - Days employee was on leave
 * @param {number} year - Year for calculation
 * @param {number} month - Month for calculation (1-12)
 * @returns {object} Attendance summary with calculations
 */
const getAttendanceSummary = (grossSalary, presentDays, absentDays, leaveDays, year, month) => {
  const totalWorkingDays = calculateWorkingDaysInMonth(year, month);
  const dailyRate = calculateDailyRate(grossSalary);
  const attendanceDeduction = calculateAttendanceDeduction(grossSalary, absentDays);
  
  return {
    totalWorkingDays,
    presentDays,
    absentDays,
    leaveDays,
    dailyRate,
    attendanceDeduction,
    attendancePercentage: ((presentDays / totalWorkingDays) * 100).toFixed(2)
  };
};

module.exports = {
  calculateDailyRate,
  calculateAttendanceDeduction,
  calculateWorkingDaysInMonth,
  getAttendanceSummary
};
