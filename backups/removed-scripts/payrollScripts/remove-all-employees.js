const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const Employee = require('../models/hr/Employee');
const User = require('../models/User');
const Payroll = require('../models/hr/Payroll');
const Payslip = require('../models/hr/Payslip');
const Attendance = require('../models/hr/Attendance');
const EmployeeOnboarding = require('../models/hr/EmployeeOnboarding');
const FinalSettlement = require('../models/hr/FinalSettlement');
const Loan = require('../models/hr/Loan');
const Enrollment = require('../models/hr/Enrollment');

// ZKBioTime models - need to create them directly since they're not exported

// ZKBioTime Employee Schema
const zkbioTimeEmployeeSchema = new mongoose.Schema({
  zkbioId: { type: Number, required: true, unique: true },
  empCode: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  fullName: { type: String },
  department: {
    id: Number,
    deptCode: String,
    deptName: String
  },
  position: {
    id: Number,
    positionCode: String,
    positionName: String
  },
  areas: [{
    id: Number,
    areaCode: String,
    areaName: String
  }],
  hireDate: { type: Date },
  enrollSn: { type: String },
  updateTime: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ZKBioTime Attendance Schema
const zkbioTimeAttendanceSchema = new mongoose.Schema({
  zkbioId: { type: Number, required: true },
  empCode: { type: String, required: true },
  empId: { type: Number, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  department: { type: String },
  position: { type: String },
  punchTime: { type: Date, required: true },
  punchState: { type: String, required: true },
  punchStateDisplay: { type: String, required: true },
  verifyType: { type: Number },
  verifyTypeDisplay: { type: String },
  areaAlias: { type: String },
  terminalSn: { type: String },
  temperature: { type: Number },
  isMask: { type: String },
  terminalAlias: { type: String },
  uploadTime: { type: Date },
  date: { type: String, required: true },
  isProcessed: { type: Boolean, default: false }
}, { timestamps: true, collection: 'zkbiotimeattendances' });

const ZKBioTimeEmployee = mongoose.model('ZKBioTimeEmployee', zkbioTimeEmployeeSchema);
const ZKBioTimeAttendance = mongoose.model('ZKBioTimeAttendance', zkbioTimeAttendanceSchema);

async function removeAllEmployees() {
  try {
    console.log('🚀 Starting comprehensive employee removal process...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to MongoDB\n');

    // Get counts before deletion
    const employeeCount = await Employee.countDocuments();
    const userCount = await User.countDocuments();
    const payrollCount = await Payroll.countDocuments();
    const payslipCount = await Payslip.countDocuments();
    const attendanceCount = await Attendance.countDocuments();
    const onboardingCount = await EmployeeOnboarding.countDocuments();
    const settlementCount = await FinalSettlement.countDocuments();
    const loanCount = await Loan.countDocuments();
    const enrollmentCount = await Enrollment.countDocuments();

    console.log('📊 Current data counts:');
    console.log(`   Employees: ${employeeCount}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Payrolls: ${payrollCount}`);
    console.log(`   Payslips: ${payslipCount}`);
    console.log(`   Attendance: ${attendanceCount}`);
    console.log(`   Onboarding: ${onboardingCount}`);
    console.log(`   Settlements: ${settlementCount}`);
    console.log(`   Loans: ${loanCount}`);
    console.log(`   Enrollments: ${enrollmentCount}\n`);

    // Check ZKBioTime collections
    try {
      const zkbioEmployeeCount = await ZKBioTimeEmployee.countDocuments();
      const zkbioAttendanceCount = await ZKBioTimeAttendance.countDocuments();
      console.log(`   ZKBioTime Employees: ${zkbioEmployeeCount}`);
      console.log(`   ZKBioTime Attendance: ${zkbioAttendanceCount}\n`);
    } catch (error) {
      console.log('   ZKBioTime collections not found or accessible\n');
    }

    // Confirmation prompt
    console.log('⚠️  WARNING: This will permanently delete ALL employee data!');
    console.log('   This includes:');
    console.log('   - All employee records');
    console.log('   - All user accounts');
    console.log('   - All payroll and payslip data');
    console.log('   - All attendance records');
    console.log('   - All onboarding records');
    console.log('   - All final settlements');
    console.log('   - All loan records');
    console.log('   - All enrollment records');
    console.log('   - All ZKBioTime data\n');

    // Start deletion process
    console.log('🗑️  Starting deletion process...\n');

    // 1. Delete ZKBioTime data first (if exists)
    try {
      console.log('1. Deleting ZKBioTime attendance records...');
      const zkbioAttendanceResult = await ZKBioTimeAttendance.deleteMany({});
      console.log(`   ✅ Deleted ${zkbioAttendanceResult.deletedCount} ZKBioTime attendance records`);

      console.log('2. Deleting ZKBioTime employee records...');
      const zkbioEmployeeResult = await ZKBioTimeEmployee.deleteMany({});
      console.log(`   ✅ Deleted ${zkbioEmployeeResult.deletedCount} ZKBioTime employee records\n`);
    } catch (error) {
      console.log('   ⚠️  ZKBioTime collections not found or already empty\n');
    }

    // 2. Delete attendance records
    console.log('3. Deleting attendance records...');
    const attendanceResult = await Attendance.deleteMany({});
    console.log(`   ✅ Deleted ${attendanceResult.deletedCount} attendance records`);

    // 3. Delete payslips
    console.log('4. Deleting payslip records...');
    const payslipResult = await Payslip.deleteMany({});
    console.log(`   ✅ Deleted ${payslipResult.deletedCount} payslip records`);

    // 4. Delete payrolls
    console.log('5. Deleting payroll records...');
    const payrollResult = await Payroll.deleteMany({});
    console.log(`   ✅ Deleted ${payrollResult.deletedCount} payroll records`);

    // 5. Delete loans
    console.log('6. Deleting loan records...');
    const loanResult = await Loan.deleteMany({});
    console.log(`   ✅ Deleted ${loanResult.deletedCount} loan records`);

    // 6. Delete final settlements
    console.log('7. Deleting final settlement records...');
    const settlementResult = await FinalSettlement.deleteMany({});
    console.log(`   ✅ Deleted ${settlementResult.deletedCount} final settlement records`);

    // 7. Delete enrollments
    console.log('8. Deleting enrollment records...');
    const enrollmentResult = await Enrollment.deleteMany({});
    console.log(`   ✅ Deleted ${enrollmentResult.deletedCount} enrollment records`);

    // 8. Delete employee onboarding records
    console.log('9. Deleting employee onboarding records...');
    const onboardingResult = await EmployeeOnboarding.deleteMany({});
    console.log(`   ✅ Deleted ${onboardingResult.deletedCount} onboarding records`);

    // 9. Delete employees
    console.log('10. Deleting employee records...');
    const employeeResult = await Employee.deleteMany({});
    console.log(`   ✅ Deleted ${employeeResult.deletedCount} employee records`);

    // 10. Delete users
    console.log('11. Deleting user records...');
    const userResult = await User.deleteMany({});
    console.log(`   ✅ Deleted ${userResult.deletedCount} user records`);

    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const finalEmployeeCount = await Employee.countDocuments();
    const finalUserCount = await User.countDocuments();
    const finalPayrollCount = await Payroll.countDocuments();
    const finalPayslipCount = await Payslip.countDocuments();
    const finalAttendanceCount = await Attendance.countDocuments();
    const finalOnboardingCount = await EmployeeOnboarding.countDocuments();
    const finalSettlementCount = await FinalSettlement.countDocuments();
    const finalLoanCount = await Loan.countDocuments();
    const finalEnrollmentCount = await Enrollment.countDocuments();

    console.log('📊 Final counts after deletion:');
    console.log(`   Employees: ${finalEmployeeCount}`);
    console.log(`   Users: ${finalUserCount}`);
    console.log(`   Payrolls: ${finalPayrollCount}`);
    console.log(`   Payslips: ${finalPayslipCount}`);
    console.log(`   Attendance: ${finalAttendanceCount}`);
    console.log(`   Onboarding: ${finalOnboardingCount}`);
    console.log(`   Settlements: ${finalSettlementCount}`);
    console.log(`   Loans: ${finalLoanCount}`);
    console.log(`   Enrollments: ${finalEnrollmentCount}`);

    // Check if all counts are zero
    const allZero = finalEmployeeCount === 0 && 
                   finalUserCount === 0 && 
                   finalPayrollCount === 0 && 
                   finalPayslipCount === 0 && 
                   finalAttendanceCount === 0 && 
                   finalOnboardingCount === 0 && 
                   finalSettlementCount === 0 && 
                   finalLoanCount === 0 && 
                   finalEnrollmentCount === 0;

    if (allZero) {
      console.log('\n🎉 SUCCESS: All employee data has been successfully removed!');
    } else {
      console.log('\n⚠️  WARNING: Some data may still remain. Please check the counts above.');
    }

  } catch (error) {
    console.error('❌ Error during employee removal:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  removeAllEmployees()
    .then(() => {
      console.log('\n✅ Employee removal process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Employee removal process failed:', error);
      process.exit(1);
    });
}

module.exports = { removeAllEmployees };
