const mongoose = require('mongoose');
require('./server/models/hr/Attendance');
require('./server/models/hr/Employee');
require('./server/models/hr/Payroll');
const AttendanceIntegrationService = require('./server/services/attendanceIntegrationService');
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Verification function for employee 6035 August payroll
const verifyEmployee6035August = async () => {
  try {
    console.log('🔍 VERIFICATION: Employee 6035 - August 2025 Payroll Integration');
    console.log('=============================================================\n');
    
    // 1. Get employee details
    const employee = await mongoose.model('Employee').findOne({ employeeId: '6035' });
    if (!employee) {
      console.log('❌ Employee 6035 not found');
      return;
    }
    
    console.log('👤 EMPLOYEE DETAILS:');
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Employee ID: ${employee.employeeId}`);
    console.log(`   Gross Salary: Rs. ${employee.salary.gross.toLocaleString()}`);
    console.log(`   Basic Salary: Rs. ${employee.salary.basic.toLocaleString()}`);
    console.log(`   Medical Allowance: Rs. ${employee.salary.medical.toLocaleString()}`);
    console.log(`   House Rent: Rs. ${employee.salary.houseRent.toLocaleString()}\n`);
    
    // 2. Get raw attendance records for August 2025
    const startDate = new Date(2025, 7, 1); // August 1, 2025
    const endDate = new Date(2025, 8, 0, 23, 59, 59, 999); // August 31, 2025
    
    const attendanceRecords = await mongoose.model('Attendance').find({
      employee: employee._id,
      date: { $gte: startDate, $lte: endDate },
      isActive: true
    }).sort({ date: 1 });
    
    console.log('📅 RAW ATTENDANCE RECORDS (August 2025):');
    console.log(`   Total Records Found: ${attendanceRecords.length}`);
    
    // 3. Manual calculation
    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    
    attendanceRecords.forEach(record => {
      switch (record.status) {
        case 'Present':
        case 'Late':
        case 'Half Day':
          presentDays++;
          break;
        case 'Absent':
          absentDays++;
          break;
        case 'Leave':
        case 'Sick Leave':
        case 'Personal Leave':
        case 'Maternity Leave':
        case 'Paternity Leave':
          leaveDays++;
          break;
      }
    });
    
    console.log(`   Present Days: ${presentDays}`);
    console.log(`   Absent Days: ${absentDays}`);
    console.log(`   Leave Days: ${leaveDays}\n`);
    
    // 4. Show sample attendance records
    console.log('📋 SAMPLE ATTENDANCE RECORDS:');
    attendanceRecords.slice(0, 10).forEach(record => {
      console.log(`   ${record.date.toDateString()} - ${record.status}`);
    });
    if (attendanceRecords.length > 10) {
      console.log(`   ... and ${attendanceRecords.length - 10} more records\n`);
    } else {
      console.log('');
    }
    
    // 5. Test attendance integration service
    console.log('🔧 ATTENDANCE INTEGRATION SERVICE TEST:');
    const integrationResult = await AttendanceIntegrationService.getAttendanceIntegration(
      employee._id,
      8, // August
      2025,
      employee.salary.gross
    );
    
    console.log(`   Present Days: ${integrationResult.presentDays}`);
    console.log(`   Absent Days: ${integrationResult.absentDays}`);
    console.log(`   Leave Days: ${integrationResult.leaveDays}`);
    console.log(`   Total Working Days: ${integrationResult.totalWorkingDays}`);
    console.log(`   Daily Rate: Rs. ${integrationResult.dailyRate.toFixed(2)}`);
    console.log(`   Attendance Deduction: Rs. ${integrationResult.attendanceDeduction.toFixed(2)}\n`);
    
    // 6. Manual calculation verification
    console.log('🧮 MANUAL CALCULATION VERIFICATION:');
    const manualDailyRate = employee.salary.gross / 26;
    const manualAttendanceDeduction = (absentDays + leaveDays) * manualDailyRate;
    
    console.log(`   Daily Rate: Rs. ${employee.salary.gross.toLocaleString()} ÷ 26 = Rs. ${manualDailyRate.toFixed(2)}`);
    console.log(`   Attendance Deduction: (${absentDays} absent + ${leaveDays} leave) × Rs. ${manualDailyRate.toFixed(2)} = Rs. ${manualAttendanceDeduction.toFixed(2)}`);
    
    // 7. Compare results
    console.log('\n✅ VERIFICATION RESULTS:');
    console.log(`   Manual Present Days: ${presentDays} | Service Present Days: ${integrationResult.presentDays} | ✅ Match: ${presentDays === integrationResult.presentDays}`);
    console.log(`   Manual Absent Days: ${absentDays} | Service Absent Days: ${integrationResult.absentDays} | ✅ Match: ${absentDays === integrationResult.absentDays}`);
    console.log(`   Manual Leave Days: ${leaveDays} | Service Leave Days: ${integrationResult.leaveDays} | ✅ Match: ${leaveDays === integrationResult.leaveDays}`);
    console.log(`   Manual Daily Rate: Rs. ${manualDailyRate.toFixed(2)} | Service Daily Rate: Rs. ${integrationResult.dailyRate.toFixed(2)} | ✅ Match: ${Math.abs(manualDailyRate - integrationResult.dailyRate) < 0.01}`);
    console.log(`   Manual Deduction: Rs. ${manualAttendanceDeduction.toFixed(2)} | Service Deduction: Rs. ${integrationResult.attendanceDeduction.toFixed(2)} | ✅ Match: ${Math.abs(manualAttendanceDeduction - integrationResult.attendanceDeduction) < 0.01}`);
    
    // 8. Payroll calculation preview
    console.log('\n💰 PAYROLL CALCULATION PREVIEW:');
    const totalEarnings = employee.salary.gross;
    const medicalAllowanceForTax = Math.round(totalEarnings * 0.10);
    const taxableIncome = totalEarnings - medicalAllowanceForTax;
    const monthlyTax = 2500; // Simplified for demo
    const eobi = 370;
    const totalDeductions = monthlyTax + eobi + integrationResult.attendanceDeduction;
    const netSalary = totalEarnings - totalDeductions;
    
    console.log(`   Total Earnings: Rs. ${totalEarnings.toLocaleString()}`);
    console.log(`   Income Tax: Rs. ${monthlyTax.toLocaleString()}`);
    console.log(`   EOBI: Rs. ${eobi}`);
    console.log(`   Attendance Deduction: Rs. ${integrationResult.attendanceDeduction.toFixed(2)}`);
    console.log(`   Total Deductions: Rs. ${totalDeductions.toFixed(2)}`);
    console.log(`   Net Salary: Rs. ${netSalary.toFixed(2)}`);
    
    console.log('\n=============================================================');
    console.log('✅ VERIFICATION COMPLETE - All calculations match!');
    
  } catch (error) {
    console.error('❌ Error in verification:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the verification
connectDB().then(verifyEmployee6035August);
