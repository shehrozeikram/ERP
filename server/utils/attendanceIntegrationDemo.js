/**
 * Example demonstration of attendance integration with payroll
 * This shows how the system works with a hypothetical employee
 */
const demonstrateAttendanceIntegration = () => {
  console.log('📊 ATTENDANCE INTEGRATION DEMONSTRATION');
  console.log('=====================================');
  
  // Example: Mansoor Zareen
  const employee = {
    name: 'Mansoor Zareen',
    employeeId: '1001',
    grossSalary: 50000,
    basicSalary: 33330, // 66.66% of gross
    medicalAllowance: 5000, // 10% of gross
    houseRentAllowance: 11670 // 23.34% of gross
  };
  
  // Monthly attendance (January 2025)
  const attendance = {
    totalWorkingDays: 26,
    presentDays: 22,
    absentDays: 3,
    leaveDays: 1
  };
  
  // Calculations
  const dailyRate = employee.grossSalary / attendance.totalWorkingDays;
  const attendanceDeduction = (attendance.absentDays + attendance.leaveDays) * dailyRate;
  
  // Tax calculation (simplified)
  const totalEarnings = employee.grossSalary;
  const medicalAllowanceForTax = Math.round(totalEarnings * 0.10);
  const taxableIncome = totalEarnings - medicalAllowanceForTax;
  const monthlyTax = 2500; // Simplified for example
  
  // Other deductions
  const eobi = 370; // Fixed EOBI amount
  
  // Total deductions
  const totalDeductions = monthlyTax + eobi + attendanceDeduction;
  
  // Net salary
  const netSalary = totalEarnings - totalDeductions;
  
  console.log(`👤 Employee: ${employee.name} (${employee.employeeId})`);
  console.log(`💰 Gross Salary: Rs. ${employee.grossSalary.toLocaleString()}`);
  console.log(`📅 Monthly Attendance (January 2025):`);
  console.log(`   Total Working Days: ${attendance.totalWorkingDays}`);
  console.log(`   Present Days: ${attendance.presentDays}`);
  console.log(`   Absent Days: ${attendance.absentDays}`);
  console.log(`   Leave Days: ${attendance.leaveDays}`);
  console.log(`💸 Daily Rate: Rs. ${dailyRate.toFixed(2)} (${employee.grossSalary} ÷ ${attendance.totalWorkingDays})`);
  console.log(`📉 Attendance Deduction: Rs. ${attendanceDeduction.toFixed(2)} (${attendance.absentDays + attendance.leaveDays} days × Rs. ${dailyRate.toFixed(2)})`);
  console.log(`🧮 Total Deductions:`);
  console.log(`   Income Tax: Rs. ${monthlyTax.toLocaleString()}`);
  console.log(`   EOBI: Rs. ${eobi}`);
  console.log(`   Attendance Deduction: Rs. ${attendanceDeduction.toFixed(2)}`);
  console.log(`   Total: Rs. ${totalDeductions.toFixed(2)}`);
  console.log(`💵 Net Salary: Rs. ${netSalary.toFixed(2)}`);
  console.log(`📊 Attendance Percentage: ${((attendance.presentDays / attendance.totalWorkingDays) * 100).toFixed(1)}%`);
  console.log('=====================================');
  
  return {
    employee,
    attendance,
    calculations: {
      dailyRate,
      attendanceDeduction,
      totalDeductions,
      netSalary
    }
  };
};

module.exports = {
  demonstrateAttendanceIntegration
};
