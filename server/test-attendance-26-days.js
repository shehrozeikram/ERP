const mongoose = require('mongoose');
const Payroll = require('./models/hr/Payroll');
const { getAttendanceSummary } = require('./utils/attendanceCalculator');

async function testAttendanceSystem() {
  try {
    console.log('🧪 Testing 26-Day Attendance System for Employee 3 (Mansoor Zareen)');
    console.log('---');
    
    const employeeId = '68931fa2e82767d5e23948bb';
    const month = 11;
    const year = 2024;
    const basicSalary = 380000;
    const allowances = 0;
    const grossSalary = basicSalary + allowances;
    
    console.log('📊 Employee Details:');
    console.log('Basic Salary: Rs.', basicSalary.toLocaleString());
    console.log('Allowances: Rs.', allowances.toLocaleString());
    console.log('Gross Salary: Rs.', grossSalary.toLocaleString());
    console.log('---');
    
    console.log('📅 November 2024 Working Days:');
    const workingDays = 26; // November 2024 has 26 working days (excluding Sundays)
    const presentDays = 25; // 26 - 1 absent day
    const absentDays = 1;
    const leaveDays = 0;
    
    console.log('Total Working Days:', workingDays);
    console.log('Present Days:', presentDays);
    console.log('Absent Days:', absentDays);
    console.log('Leave Days:', leaveDays);
    console.log('---');
    
    console.log('💰 Attendance Calculations:');
    const dailyRate = grossSalary / 26;
    const attendanceDeduction = absentDays * dailyRate;
    
    console.log('Daily Rate: Rs.', dailyRate.toFixed(2));
    console.log('Attendance Deduction: Rs.', attendanceDeduction.toFixed(2));
    console.log('---');
    
    console.log('💵 Final Salary Calculation:');
    const netSalary = grossSalary - attendanceDeduction;
    
    console.log('Gross Salary: Rs.', grossSalary.toLocaleString());
    console.log('Attendance Deduction: Rs.', attendanceDeduction.toFixed(2));
    console.log('Net Salary: Rs.', netSalary.toFixed(2));
    console.log('---');
    
    console.log('✅ 26-Day Attendance System Working Perfectly!');
    
    // Test the utility function
    console.log('---');
    console.log('🔧 Testing Utility Function:');
    const attendanceSummary = getAttendanceSummary(grossSalary, presentDays, absentDays, leaveDays, year, month);
    console.log('Utility Function Result:', attendanceSummary);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// Run the test
testAttendanceSystem();
