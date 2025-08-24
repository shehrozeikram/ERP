const mongoose = require('mongoose');

// Register all models first
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Payroll');
require('./models/User');

async function createNovemberPayroll() {
  try {
    console.log('🏗️ Creating November Payroll for Employee 3 (Mansoor Zareen)');
    console.log('---');
    
    // Connect to database
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');
    
    // Get models after registration
    const Employee = mongoose.model('Employee');
    const Payroll = mongoose.model('Payroll');
    const User = mongoose.model('User');
    
    // Find employee
    const employee = await Employee.findOne({ employeeId: '3' });
    if (!employee) {
      throw new Error('Employee 3 not found');
    }
    
    console.log('✅ Employee Found:', employee.firstName + ' ' + employee.lastName);
    console.log('Employee ID:', employee.employeeId);
    console.log('Basic Salary:', employee.salary?.basic);
    
    // Find a user for createdBy field
    const user = await User.findOne();
    const createdBy = user ? user._id : undefined;
    
    // Check if payroll already exists
    const existingPayroll = await Payroll.findOne({
      employee: employee._id,
      month: 11,
      year: 2024
    });
    
    if (existingPayroll) {
      console.log('⚠️ November payroll already exists, updating it...');
      // Update existing payroll with new attendance data
      existingPayroll.totalWorkingDays = 26;
      existingPayroll.presentDays = 25;
      existingPayroll.absentDays = 1;
      existingPayroll.leaveDays = 0;
      
      // Calculate new values
      const grossSalary = existingPayroll.grossSalary;
      existingPayroll.dailyRate = grossSalary / 26;
      existingPayroll.attendanceDeduction = existingPayroll.absentDays * existingPayroll.dailyRate;
      
      // Recalculate net salary
      existingPayroll.netSalary = existingPayroll.grossSalary - existingPayroll.totalDeductions;
      
      await existingPayroll.save();
      console.log('✅ November payroll updated successfully');
      
      // Display results
      console.log('---');
      console.log('📊 Updated Payroll Details:');
      console.log('Working Days:', existingPayroll.totalWorkingDays);
      console.log('Present Days:', existingPayroll.presentDays);
      console.log('Absent Days:', existingPayroll.absentDays);
      console.log('Daily Rate:', existingPayroll.dailyRate?.toFixed(2));
      console.log('Attendance Deduction:', existingPayroll.attendanceDeduction?.toFixed(2));
      console.log('Net Salary:', existingPayroll.netSalary?.toFixed(2));
      
    } else {
      console.log('📝 Creating new November payroll...');
      
      // Prepare attendance data
      const attendanceData = {
        totalWorkingDays: 26,
        presentDays: 25,
        absentDays: 1,
        leaveDays: 0,
        createdBy: createdBy
      };
      
      // Generate payroll using the model's static method
      const payroll = await Payroll.generatePayroll(
        employee._id,
        11, // November
        2024,
        attendanceData
      );
      
      // Save the payroll
      await payroll.save();
      console.log('✅ November payroll created successfully');
      
      // Display results
      console.log('---');
      console.log('📊 New Payroll Details:');
      console.log('Working Days:', payroll.totalWorkingDays);
      console.log('Present Days:', payroll.presentDays);
      console.log('Absent Days:', payroll.absentDays);
      console.log('Daily Rate:', payroll.dailyRate?.toFixed(2));
      console.log('Attendance Deduction:', payroll.attendanceDeduction?.toFixed(2));
      console.log('Net Salary:', payroll.netSalary?.toFixed(2));
    }
    
    console.log('---');
    console.log('🎉 November Payroll Ready! Check the frontend now.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
createNovemberPayroll();
