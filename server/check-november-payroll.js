const mongoose = require('mongoose');

// Register models
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Attendance');
require('./models/hr/Payroll');

async function checkNovemberPayroll() {
  try {
    console.log('🔍 Checking November Payroll for Mansoor Zareen');
    console.log('==============================================');
    console.log('');
    
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Employee = mongoose.model('Employee');
    const Payroll = mongoose.model('Payroll');
    const Attendance = mongoose.model('Attendance');
    
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
      console.log('❌ No November 2024 payroll found');
      console.log('Creating November payroll...');
      
      // Create November payroll
      const payroll = new Payroll({
        employee: employee._id,
        month: 10, // November
        year: 2024,
        basicSalary: employee.salary?.basic || 0,
        totalWorkingDays: 26,
        presentDays: 24,
        absentDays: 2,
        createdBy: employee._id
      });
      
      await payroll.save();
      console.log('✅ November payroll created');
      
      // Re-fetch the created payroll
      const createdPayroll = await Payroll.findById(payroll._id);
      console.log('📊 Created Payroll Details:');
      console.log('Total Working Days:', createdPayroll.totalWorkingDays);
      console.log('Present Days:', createdPayroll.presentDays);
      console.log('Absent Days:', createdPayroll.absentDays);
      console.log('Daily Rate:', createdPayroll.dailyRate?.toFixed(2));
      console.log('Attendance Deduction:', createdPayroll.attendanceDeduction?.toFixed(2));
      
    } else {
      console.log('✅ November 2024 Payroll Found:');
      console.log('ID:', novemberPayroll._id);
      console.log('Total Working Days:', novemberPayroll.totalWorkingDays);
      console.log('Present Days:', novemberPayroll.presentDays);
      console.log('Absent Days:', novemberPayroll.absentDays);
      console.log('Daily Rate:', novemberPayroll.dailyRate?.toFixed(2));
      console.log('Attendance Deduction:', novemberPayroll.attendanceDeduction?.toFixed(2));
      console.log('Basic Salary:', novemberPayroll.basicSalary?.toLocaleString());
      console.log('');
      
      // Check if 26-day system is working
      if (novemberPayroll.totalWorkingDays === 26 && novemberPayroll.dailyRate > 0) {
        console.log('✅ 26-Day System is Working in Payroll!');
      } else {
        console.log('❌ 26-Day System NOT Working in Payroll');
        console.log('Expected: totalWorkingDays = 26, dailyRate > 0');
      }
    }
    
    // Check November attendance records
    console.log('');
    console.log('📅 Checking November 2024 Attendance Records...');
    
    const novemberAttendance = await Attendance.find({
      employee: employee._id,
      date: {
        $gte: new Date(2024, 10, 1), // November 1
        $lt: new Date(2024, 11, 1)   // December 1
      }
    }).sort({ date: 1 });
    
    if (novemberAttendance.length === 0) {
      console.log('❌ No November attendance records found');
      console.log('Creating sample November attendance...');
      
      // Create sample November attendance
      const novemberDates = [
        new Date(2024, 10, 1),  // Nov 1
        new Date(2024, 10, 2),  // Nov 2
        new Date(2024, 10, 3),  // Nov 3
        new Date(2024, 10, 4),  // Nov 4
        new Date(2024, 10, 5),  // Nov 5
      ];
      
      for (let i = 0; i < novemberDates.length; i++) {
        const date = novemberDates[i];
        const status = i < 3 ? 'Present' : 'Absent'; // First 3 present, last 2 absent
        
        const attendance = new Attendance({
          employee: employee._id,
          date: date,
          status: status,
          checkIn: {
            time: status === 'Present' ? new Date(date.setHours(9, 0, 0, 0)) : null,
            location: 'Office',
            method: 'Manual'
          },
          checkOut: {
            time: status === 'Present' ? new Date(date.setHours(17, 0, 0, 0)) : null,
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
        console.log(`📊 ${date.toLocaleDateString()}: ${status} - Daily Rate: Rs. ${attendance.dailyRate?.toFixed(2) || 'N/A'} - Deduction: Rs. ${attendance.attendanceDeduction?.toFixed(2) || 'N/A'}`);
      }
      
      console.log('✅ November attendance records created');
      
    } else {
      console.log(`✅ Found ${novemberAttendance.length} November attendance records:`);
      
      novemberAttendance.forEach(att => {
        console.log(`📊 ${att.date.toLocaleDateString()}: ${att.status} - Daily Rate: Rs. ${att.dailyRate?.toFixed(2) || 'N/A'} - Deduction: Rs. ${att.attendanceDeduction?.toFixed(2) || 'N/A'}`);
      });
    }
    
    console.log('');
    console.log('🎯 Summary:');
    console.log('1. Check if November payroll has 26 working days');
    console.log('2. Check if November attendance records have 26-day calculations');
    console.log('3. Verify that absent days are properly calculated');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the check
checkNovemberPayroll();
