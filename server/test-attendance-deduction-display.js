const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const testAttendanceDeductionDisplay = async () => {
  try {
    console.log('🔌 Connecting to cloud database...');
    await connectDB();
    
    // Find a sample employee
    const employee = await Employee.findOne({});
    if (!employee) {
      console.log('❌ No employees found in database');
      await disconnectDB();
      return;
    }
    
    console.log(`👤 Testing with employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    
    // Create a test payroll with absent days
    const currentDate = new Date();
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    console.log(`📅 Creating test payroll for ${month + 1}/${year}`);
    
    // Test payroll data with absent days
    const testPayrollData = {
      employee: employee._id,
      month: month + 1,
      year: year,
      basicSalary: 253308,
      houseRentAllowance: 88692,
      medicalAllowance: 38000,
      allowances: {
        conveyance: { isActive: false, amount: 0 },
        food: { isActive: false, amount: 0 },
        vehicleFuel: { isActive: true, amount: 35000 },
        medical: { isActive: false, amount: 0 },
        special: { isActive: false, amount: 0 },
        other: { isActive: false, amount: 0 }
      },
      overtimeAmount: 0,
      performanceBonus: 0,
      otherBonus: 0,
      totalWorkingDays: 26,
      presentDays: 24,
      absentDays: 2, // 2 absent days
      leaveDays: 0,
      incomeTax: 27180,
      eobi: 370,
      healthInsurance: 0,
      otherDeductions: 0,
      createdBy: employee._id
    };
    
    console.log('\n🧪 Creating test payroll with 2 absent days...');
    console.log('Expected calculations:');
    console.log('   Gross Salary (Base): Rs. 380,000 (253,308 + 88,692 + 38,000)');
    console.log('   Daily Rate: Rs. 14,615.38 (380,000 ÷ 26)');
    console.log('   Attendance Deduction: Rs. 29,230.77 (2 absent days × 14,615.38)');
    
    // Create the payroll
    const payroll = new Payroll(testPayrollData);
    await payroll.save();
    
    console.log('\n✅ Test payroll created successfully');
    console.log(`📊 Payroll ID: ${payroll._id}`);
    
    // Test the calculateAttendanceDeduction method
    console.log('\n🧮 Testing calculateAttendanceDeduction method...');
    const calculatedDeduction = payroll.calculateAttendanceDeduction();
    console.log(`   Calculated Deduction: Rs. ${calculatedDeduction?.toFixed(2) || 0}`);
    console.log(`   Daily Rate: Rs. ${payroll.dailyRate?.toFixed(2) || 0}`);
    console.log(`   Attendance Deduction: Rs. ${payroll.attendanceDeduction?.toFixed(2) || 0}`);
    
    // Now test fetching the payroll to see if the calculation is applied
    console.log('\n📥 Testing payroll fetch with calculation...');
    const fetchedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId');
    
    if (fetchedPayroll) {
      console.log('✅ Payroll fetched successfully');
      console.log(`   Employee: ${fetchedPayroll.employee?.firstName} ${fetchedPayroll.employee?.lastName}`);
      console.log(`   Month/Year: ${fetchedPayroll.month}/${fetchedPayroll.year}`);
      console.log(`   Absent Days: ${fetchedPayroll.absentDays}`);
      console.log(`   Daily Rate: Rs. ${fetchedPayroll.dailyRate?.toFixed(2) || 0}`);
      console.log(`   Attendance Deduction: Rs. ${fetchedPayroll.attendanceDeduction?.toFixed(2) || 0}`);
      
      // Verify the calculation
      const expectedDailyRate = 380000 / 26;
      const expectedDeduction = expectedDailyRate * 2;
      
      console.log('\n🔍 VERIFICATION:');
      if (Math.abs(fetchedPayroll.dailyRate - expectedDailyRate) < 1) {
        console.log('✅ Daily Rate calculation: CORRECT');
      } else {
        console.log(`❌ Daily Rate calculation: WRONG`);
        console.log(`   Expected: Rs. ${expectedDailyRate.toFixed(2)}, Got: Rs. ${fetchedPayroll.dailyRate?.toFixed(2) || 0}`);
      }
      
      if (Math.abs(fetchedPayroll.attendanceDeduction - expectedDeduction) < 1) {
        console.log('✅ Attendance Deduction calculation: CORRECT');
      } else {
        console.log(`❌ Attendance Deduction calculation: WRONG`);
        console.log(`   Expected: Rs. ${expectedDeduction.toFixed(2)}, Got: Rs. ${fetchedPayroll.attendanceDeduction?.toFixed(2) || 0}`);
      }
    } else {
      console.log('❌ Failed to fetch payroll');
    }
    
    // Clean up - delete the test payroll
    console.log('\n🧹 Cleaning up test payroll...');
    await Payroll.findByIdAndDelete(payroll._id);
    console.log('✅ Test payroll deleted');
    
  } catch (error) {
    console.error('❌ Error during attendance deduction display test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testAttendanceDeductionDisplay()
    .then(() => {
      console.log('🎯 Attendance deduction display test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Attendance deduction display test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAttendanceDeductionDisplay };
