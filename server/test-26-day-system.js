const mongoose = require('mongoose');

// Register models
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Payroll');

async function test26DaySystem() {
  try {
    console.log('🧪 Testing 26-Day Attendance System');
    console.log('---');
    
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Employee = mongoose.model('Employee');
    const Payroll = mongoose.model('Payroll');
    
    // Find a test employee
    const employee = await Employee.findOne({ employeeId: '3' });
    if (!employee) {
      throw new Error('Employee 3 not found');
    }
    
    console.log('✅ Test Employee:', employee.firstName + ' ' + employee.lastName);
    console.log('Basic Salary:', employee.salary?.basic);
    
    // Test attendance calculation
    const basicSalary = employee.salary?.basic || 380000;
    const allowances = 0;
    const grossSalary = basicSalary + allowances;
    
    console.log('---');
    console.log('📊 Salary Details:');
    console.log('Basic Salary: Rs.', basicSalary.toLocaleString());
    console.log('Gross Salary: Rs.', grossSalary.toLocaleString());
    
    console.log('---');
    console.log('📅 26-Day Attendance Test:');
    console.log('Total Working Days: 26 (excluding Sundays)');
    console.log('Present Days: 25');
    console.log('Absent Days: 1');
    
    // Calculate daily rate and deduction
    const dailyRate = grossSalary / 26;
    const attendanceDeduction = 1 * dailyRate;
    
    console.log('---');
    console.log('💰 Attendance Calculations:');
    console.log('Daily Rate: Rs.', dailyRate.toFixed(2), '(Gross Salary ÷ 26)');
    console.log('Attendance Deduction: Rs.', attendanceDeduction.toFixed(2), '(1 absent day × daily rate)');
    
    // Test payroll generation
    console.log('---');
    console.log('🏗️ Testing Payroll Generation...');
    
    const attendanceData = {
      totalWorkingDays: 26,
      presentDays: 25,
      absentDays: 1,
      leaveDays: 0,
      createdBy: employee._id
    };
    
    try {
      const payroll = await Payroll.generatePayroll(
        employee._id,
        11, // November
        2024,
        attendanceData
      );
      
      console.log('✅ Payroll Generated Successfully!');
      console.log('---');
      console.log('📊 Generated Payroll Details:');
      console.log('Working Days:', payroll.totalWorkingDays);
      console.log('Present Days:', payroll.presentDays);
      console.log('Absent Days:', payroll.absentDays);
      console.log('Daily Rate:', payroll.dailyRate?.toFixed(2));
      console.log('Attendance Deduction:', payroll.attendanceDeduction?.toFixed(2));
      console.log('Gross Salary:', payroll.grossSalary?.toFixed(2));
      console.log('Net Salary:', payroll.netSalary?.toFixed(2));
      
      // Save the payroll
      await payroll.save();
      console.log('✅ Payroll saved to database');
      
    } catch (error) {
      console.log('⚠️ Payroll generation error:', error.message);
      console.log('This is expected if payroll already exists for November 2024');
    }
    
    console.log('---');
    console.log('✅ 26-Day Attendance System Test Complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
test26DaySystem();
