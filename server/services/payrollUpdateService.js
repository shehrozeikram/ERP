const mongoose = require('mongoose');

/**
 * Service to automatically update payroll when attendance records change
 * This ensures the 26-day system stays synchronized between attendance and payroll
 */
class PayrollUpdateService {
  
  /**
   * Update payroll for a specific employee and month when attendance changes
   * @param {string} employeeId - Employee ID
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   */
  static async updatePayrollForMonth(employeeId, month, year) {
    try {
      console.log(`🔄 Updating payroll for employee ${employeeId}, ${month + 1}/${year}`);
      
      const Attendance = mongoose.model('Attendance');
      const Payroll = mongoose.model('Payroll');
      
      // Get all attendance records for the month
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      const attendanceRecords = await Attendance.find({
        employee: employeeId,
        date: { $gte: monthStart, $lte: monthEnd }
      }).sort({ date: 1 });
      
      if (attendanceRecords.length === 0) {
        console.log(`⚠️ No attendance records found for ${month + 1}/${year}`);
        return null;
      }
      
      // Calculate monthly attendance summary
      const attendanceSummary = this.calculateMonthlyAttendance(attendanceRecords);
      
      console.log(`📊 Monthly Attendance Summary for ${month + 1}/${year}:`);
      console.log(`   Total Records: ${attendanceRecords.length}`);
      console.log(`   Present Days: ${attendanceSummary.presentDays}`);
      console.log(`   Absent Days: ${attendanceSummary.absentDays}`);
      console.log(`   Leave Days: ${attendanceSummary.leaveDays}`);
      console.log(`   Total Working Days: ${attendanceSummary.totalWorkingDays}`);
      
      // Find existing payroll or create new one
      let payroll = await Payroll.findOne({
        employee: employeeId,
        month: month,
        year: year
      });
      
      if (payroll) {
        // Update existing payroll
        console.log(`🔄 Updating existing payroll for ${month + 1}/${year}`);
        
        // Update attendance fields
        // Note: Only update if payroll hasn't been manually modified recently
        // This prevents overriding manual attendance updates
        const lastManualUpdate = payroll.updatedAt || payroll.createdAt;
        const hoursSinceLastUpdate = (Date.now() - lastManualUpdate.getTime()) / (1000 * 60 * 60);
        
        // Only auto-update if more than 1 hour has passed since last manual update
        if (hoursSinceLastUpdate > 1) {
          console.log(`🔄 Auto-updating attendance from individual records (last manual update: ${hoursSinceLastUpdate.toFixed(1)} hours ago)`);
          payroll.presentDays = attendanceSummary.presentDays;
          payroll.absentDays = attendanceSummary.absentDays;
          payroll.leaveDays = attendanceSummary.leaveDays;
          payroll.totalWorkingDays = attendanceSummary.totalWorkingDays;
        } else {
          console.log(`⏸️  Skipping auto-update (last manual update: ${hoursSinceLastUpdate.toFixed(1)} hours ago)`);
          console.log(`📊 Keeping manual values: ${payroll.presentDays} present, ${payroll.absentDays} absent`);
        }
        
        // 🔧 Force 26-day system recalculation
        // Clear daily rate and attendance deduction to force recalculation
        payroll.dailyRate = undefined;
        payroll.attendanceDeduction = undefined;
        
        // Trigger 26-day system recalculation via pre-save middleware
        await payroll.save();
        
        console.log(`✅ Payroll updated successfully`);
        
      } else {
        // Create new payroll
        console.log(`🆕 Creating new payroll for ${month + 1}/${year}`);
        
        const Employee = mongoose.model('Employee');
        const employee = await Employee.findById(employeeId);
        
        if (!employee) {
          throw new Error('Employee not found');
        }
        
        // Create payroll with attendance data
        const payrollData = {
          employee: employeeId,
          month: month,
          year: year,
          basicSalary: employee.salary?.basic || 0,
          totalWorkingDays: attendanceSummary.totalWorkingDays,
          presentDays: attendanceSummary.presentDays,
          absentDays: attendanceSummary.absentDays,
          leaveDays: attendanceSummary.leaveDays,
          createdBy: employeeId
        };
        
        payroll = new Payroll(payrollData);
        await payroll.save();
        
        console.log(`✅ New payroll created successfully`);
      }
      
      // Fetch updated payroll to show final values
      const updatedPayroll = await Payroll.findById(payroll._id);
      
      console.log(`📊 Final Payroll Values for ${month + 1}/${year}:`);
      console.log(`   Total Working Days: ${updatedPayroll.totalWorkingDays}`);
      console.log(`   Present Days: ${updatedPayroll.presentDays}`);
      console.log(`   Absent Days: ${updatedPayroll.absentDays}`);
      console.log(`   Daily Rate: Rs. ${updatedPayroll.dailyRate?.toFixed(2) || 'N/A'}`);
      console.log(`   Attendance Deduction: Rs. ${updatedPayroll.attendanceDeduction?.toFixed(2) || 'N/A'}`);
      console.log(`   Total Deductions: Rs. ${updatedPayroll.totalDeductions?.toFixed(2) || 'N/A'}`);
      
      return updatedPayroll;
      
    } catch (error) {
      console.error(`❌ Error updating payroll for ${month + 1}/${year}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Calculate monthly attendance summary from attendance records
   * @param {Array} attendanceRecords - Array of attendance records
   * @returns {Object} Summary with presentDays, absentDays, leaveDays, totalWorkingDays
   */
  static calculateMonthlyAttendance(attendanceRecords) {
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
        // Holiday, Weekend, etc. are not counted
      }
    });
    
    // Calculate total working days (excluding Sundays)
    const firstRecord = attendanceRecords[0];
    if (firstRecord) {
      const year = firstRecord.date.getFullYear();
      const month = firstRecord.date.getMonth();
      const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month);
      
      return {
        presentDays,
        absentDays,
        leaveDays,
        totalWorkingDays
      };
    }
    
    return {
      presentDays,
      absentDays,
      leaveDays,
      totalWorkingDays: 26 // Default fallback
    };
  }
  
  /**
   * Calculate working days in a month (excluding Sundays)
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {number} Number of working days
   */
  static calculateWorkingDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      
      // Sunday = 0, so exclude Sundays
      if (dayOfWeek !== 0) {
        workingDays++;
      }
    }
    
    return workingDays;
  }
}

module.exports = PayrollUpdateService;
