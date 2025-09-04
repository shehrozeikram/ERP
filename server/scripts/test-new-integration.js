const mongoose = require('mongoose');
require('../models/hr/Employee');
const AttendanceIntegrationService = require('../services/attendanceIntegrationService');
require('dotenv').config();

async function testNewIntegration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Test employee 6035 for August 2025
    const employee = await mongoose.model('Employee').findOne({ employeeId: '6035' });
    
    if (!employee) {
      console.log('❌ Employee 6035 not found');
      return;
    }
    
    console.log(`👤 Testing employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    console.log(`💰 Gross Salary: Rs. ${employee.salary.gross.toLocaleString()}`);
    
    console.log('\n🔧 Testing new ZKBio Time attendance integration...');
    
    const result = await AttendanceIntegrationService.getAttendanceIntegration(
      employee.employeeId,
      8, // August
      2025,
      employee.salary.gross
    );
    
    console.log('\n📊 Integration Results:');
    console.log(`   Present Days: ${result.presentDays}`);
    console.log(`   Absent Days: ${result.absentDays}`);
    console.log(`   Leave Days: ${result.leaveDays}`);
    console.log(`   Total Working Days: ${result.totalWorkingDays}`);
    console.log(`   Daily Rate: Rs. ${result.dailyRate.toFixed(2)}`);
    console.log(`   Attendance Deduction: Rs. ${result.attendanceDeduction.toFixed(2)}`);
    
    // Calculate payroll preview
    const totalEarnings = employee.salary.gross;
    const monthlyTax = 2500; // Simplified for demo
    const eobi = 370;
    const totalDeductions = monthlyTax + eobi + result.attendanceDeduction;
    const netSalary = totalEarnings - totalDeductions;
    
    console.log('\n💰 Payroll Preview:');
    console.log(`   Total Earnings: Rs. ${totalEarnings.toLocaleString()}`);
    console.log(`   Income Tax: Rs. ${monthlyTax.toLocaleString()}`);
    console.log(`   EOBI: Rs. ${eobi}`);
    console.log(`   Attendance Deduction: Rs. ${result.attendanceDeduction.toFixed(2)}`);
    console.log(`   Total Deductions: Rs. ${totalDeductions.toFixed(2)}`);
    console.log(`   Net Salary: Rs. ${netSalary.toFixed(2)}`);
    
    // Show unique dates if available
    if (result.uniqueDates && result.uniqueDates.length > 0) {
      console.log('\n📅 Attendance Dates:');
      result.uniqueDates.slice(0, 10).forEach(date => {
        console.log(`   ${date}`);
      });
      if (result.uniqueDates.length > 10) {
        console.log(`   ... and ${result.uniqueDates.length - 10} more dates`);
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testNewIntegration();
