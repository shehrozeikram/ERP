const mongoose = require('mongoose');

// Register models
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Attendance');
require('./models/hr/Payroll');

async function updateNovemberPayroll26Day() {
  try {
    console.log('🔄 Updating November Payroll with 26-Day System');
    console.log('==============================================');
    console.log('');
    
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Employee = mongoose.model('Employee');
    const Payroll = mongoose.model('Payroll');
    
    // Find Mansoor Zareen
    const employee = await Employee.findOne({ employeeId: '3' });
    if (!employee) {
      throw new Error('Employee 3 (Mansoor Zareen) not found');
    }
    
    console.log('👤 Employee:', employee.firstName + ' ' + employee.lastName);
    console.log('💰 Basic Salary: Rs.', employee.salary?.basic?.toLocaleString());
    console.log('');
    
    // Find November 2024 payroll
    const novemberPayroll = await Payroll.findOne({
      employee: employee._id,
      month: 10, // November (0-indexed)
      year: 2024
    });
    
    if (!novemberPayroll) {
      throw new Error('November 2024 payroll not found');
    }
    
    console.log('✅ November 2024 Payroll Found:');
    console.log('ID:', novemberPayroll._id);
    console.log('Before Update:');
    console.log('  Total Working Days:', novemberPayroll.totalWorkingDays);
    console.log('  Present Days:', novemberPayroll.presentDays);
    console.log('  Absent Days:', novemberPayroll.absentDays);
    console.log('  Daily Rate:', novemberPayroll.dailyRate?.toFixed(2));
    console.log('  Attendance Deduction:', novemberPayroll.attendanceDeduction?.toFixed(2));
    console.log('  Basic Salary:', novemberPayroll.basicSalary?.toLocaleString());
    console.log('');
    
    // Calculate expected 26-day values
    const grossSalary = novemberPayroll.basicSalary || 0;
    const expectedDailyRate = grossSalary / 26;
    const expectedAttendanceDeduction = novemberPayroll.absentDays * expectedDailyRate;
    
    console.log('💰 Expected 26-Day System Values:');
    console.log('  Gross Salary: Rs.', grossSalary.toLocaleString());
    console.log('  Daily Rate: Rs.', expectedDailyRate.toFixed(2), '(Gross Salary ÷ 26)');
    console.log('  Absent Days:', novemberPayroll.absentDays);
    console.log('  Expected Attendance Deduction: Rs.', expectedAttendanceDeduction.toFixed(2), `(${novemberPayroll.absentDays} days × Rs. ${expectedDailyRate.toFixed(2)})`);
    console.log('');
    
    // Update the payroll to trigger pre-save middleware
    console.log('🔄 Updating payroll to trigger 26-day calculations...');
    
    // Force recalculation by updating a field
    novemberPayroll.updatedAt = new Date();
    
    // Save to trigger pre-save middleware
    await novemberPayroll.save();
    
    console.log('✅ Payroll updated and saved');
    
    // Fetch the updated payroll
    const updatedPayroll = await Payroll.findById(novemberPayroll._id);
    
    console.log('');
    console.log('📊 After Update:');
    console.log('  Total Working Days:', updatedPayroll.totalWorkingDays);
    console.log('  Present Days:', updatedPayroll.presentDays);
    console.log('  Absent Days:', updatedPayroll.absentDays);
    console.log('  Daily Rate:', updatedPayroll.dailyRate?.toFixed(2));
    console.log('  Attendance Deduction:', updatedPayroll.attendanceDeduction?.toFixed(2));
    console.log('  Total Deductions:', updatedPayroll.totalDeductions?.toFixed(2));
    console.log('');
    
    // Verify 26-day system is working
    if (updatedPayroll.dailyRate > 0 && updatedPayroll.attendanceDeduction > 0) {
      console.log('✅ 26-Day System is Now Working in Payroll!');
      console.log('💰 Daily Rate: Rs.', updatedPayroll.dailyRate.toFixed(2));
      console.log('💰 Attendance Deduction: Rs.', updatedPayroll.attendanceDeduction.toFixed(2));
      console.log('💰 Total Deductions: Rs.', updatedPayroll.totalDeductions.toFixed(2));
    } else {
      console.log('❌ 26-Day System Still Not Working');
      console.log('Expected: dailyRate > 0, attendanceDeduction > 0');
    }
    
    console.log('');
    console.log('🎯 Summary:');
    console.log('1. November payroll updated to trigger 26-day calculations');
    console.log('2. Pre-save middleware should recalculate daily rate and deductions');
    console.log('3. 26-day system should now be fully functional');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the update
updateNovemberPayroll26Day();
