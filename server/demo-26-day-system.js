const mongoose = require('mongoose');

// Register models
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Attendance');
require('./models/hr/Payroll');

async function demo26DaySystem() {
  try {
    console.log('🎯 Demonstrating 26-Day Attendance System');
    console.log('==========================================');
    console.log('');
    
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Employee = mongoose.model('Employee');
    const Attendance = mongoose.model('Attendance');
    
    // Find test employee
    const employee = await Employee.findOne({ employeeId: '3' });
    if (!employee) {
      throw new Error('Employee 3 not found');
    }
    
    console.log('👤 Employee:', employee.firstName + ' ' + employee.lastName);
    console.log('💰 Basic Salary: Rs.', employee.salary?.basic?.toLocaleString());
    console.log('');
    
    // Create multiple attendance records for demonstration
    console.log('📅 Creating Sample Attendance Records for August 2024...');
    console.log('');
    
    const augustDates = [
      new Date(2024, 7, 1), // August 1
      new Date(2024, 7, 2), // August 2
      new Date(2024, 7, 3), // August 3
      new Date(2024, 7, 4), // August 4
      new Date(2024, 7, 5), // August 5
    ];
    
    const attendanceRecords = [];
    
    for (let i = 0; i < augustDates.length; i++) {
      const date = augustDates[i];
      const status = i < 3 ? 'Present' : 'Absent'; // First 3 days present, last 2 absent
      
      const attendance = new Attendance({
        employee: employee._id,
        date: date,
        status: status,
        checkIn: status === 'Present' ? {
          time: new Date(date.setHours(9, 0, 0, 0)),
          location: 'Office',
          method: 'Manual'
        } : {
          time: null,
          location: 'Office',
          method: 'Manual'
        },
        checkOut: status === 'Present' ? {
          time: new Date(date.setHours(17, 0, 0, 0)),
          location: 'Office',
          method: 'Manual'
        } : {
          time: null,
          location: 'Office',
          method: 'Manual'
        },
        createdBy: employee._id
      });
      
      // Calculate 26-day system for absent days
      if (status === 'Absent') {
        const grossSalary = employee.salary?.basic || 0;
        attendance.dailyRate = grossSalary / 26;
        attendance.attendanceDeduction = attendance.dailyRate;
      }
      
      await attendance.save();
      attendanceRecords.push(attendance);
      
      console.log(`📊 ${date.toLocaleDateString()}: ${status} - Daily Rate: Rs. ${attendance.dailyRate?.toFixed(2) || 'N/A'} - Deduction: Rs. ${attendance.attendanceDeduction?.toFixed(2) || 'N/A'}`);
    }
    
    console.log('');
    console.log('📊 Summary of Created Records:');
    console.log('Present Days:', attendanceRecords.filter(a => a.status === 'Present').length);
    console.log('Absent Days:', attendanceRecords.filter(a => a.status === 'Absent').length);
    console.log('Total Working Days: 26 (August 2024 excluding Sundays)');
    
    // Calculate monthly totals
    const presentDays = attendanceRecords.filter(a => a.status === 'Present').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'Absent').length;
    const grossSalary = employee.salary?.basic || 0;
    const dailyRate = grossSalary / 26;
    const totalDeduction = absentDays * dailyRate;
    
    console.log('');
    console.log('💰 26-Day System Monthly Calculation:');
    console.log('Gross Salary: Rs.', grossSalary.toLocaleString());
    console.log('Daily Rate: Rs.', dailyRate.toFixed(2), '(Gross Salary ÷ 26)');
    console.log('Present Days:', presentDays);
    console.log('Absent Days:', absentDays);
    console.log('Total Deduction: Rs.', totalDeduction.toFixed(2), `(${absentDays} days × Rs. ${dailyRate.toFixed(2)})`);
    
    console.log('');
    console.log('🎯 How to Use This System:');
    console.log('1. Edit individual attendance records (status: Present/Absent)');
    console.log('2. System automatically calculates daily rate and deductions');
    console.log('3. Generate payroll to see monthly absent/present day counts');
    console.log('4. 26-day system ensures accurate salary calculations');
    
    console.log('');
    console.log('✅ 26-Day Attendance System Demonstration Complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the demonstration
demo26DaySystem();
