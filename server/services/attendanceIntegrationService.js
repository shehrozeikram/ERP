const mongoose = require('mongoose');
const zkbioTimeApiService = require('./zkbioTimeApiService');
const zkbioTimeService = require('./zkbioTimeService');

/**
 * Service to integrate attendance records with payroll calculations
 * This service handles the 26-day system and calculates actual attendance deductions
 * Uses ZKBio Time API for accurate attendance data
 */
class AttendanceIntegrationService {
  
  /**
   * Check if ZKBio Time server is online and accessible
   * @returns {Object} Server status result
   */
  static async checkZKBioServerStatus() {
    try {
      console.log('🔍 Checking ZKBio Time server status...');
      
      const zkbioService = zkbioTimeService;
      const connectionTest = await zkbioService.testConnection();
      
      if (connectionTest.success) {
        console.log('✅ ZKBio Time server is online');
        return {
          isOnline: true,
          message: 'ZKBio Time server is accessible',
          server: 'ZKBio Time'
        };
      } else {
        console.log('❌ ZKBio Time server is offline or unreachable');
        return {
          isOnline: false,
          message: 'ZKBio Time server is offline or unreachable',
          error: connectionTest.error
        };
      }
    } catch (error) {
      console.error('❌ Error checking ZKBio Time server status:', error.message);
      return {
        isOnline: false,
        message: 'Failed to check server status',
        error: error.message
      };
    }
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
      const dayOfWeek = new Date(year, month, day).getDay();
      if (dayOfWeek !== 0) { // 0 = Sunday
        workingDays++;
      }
    }
    
    return workingDays;
  }
  
  /**
   * Get bulk monthly attendance summary from ZKBio Time API (OPTIMIZED)
   * @param {Array} employeeIds - Array of employee IDs
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Bulk monthly attendance summary
   */
  static async getBulkMonthlyAttendanceSummary(employeeIds, month, year) {
    try {
      console.log(`🔧 Fetching bulk attendance summary for ${employeeIds.length} employees from ZKBio Time API`);
      
      // Use ZKBio Time API service for bulk data
      const zkbioService = require('./zkbioTimeApiService');
      
      // Get bulk attendance data
      const bulkAttendanceData = await zkbioService.getBulkAttendanceByMonth(
        employeeIds,
        month,
        year
      );
      
      const results = {};
      
      // Process each employee's data
      for (const employeeId of employeeIds) {
        const employeeData = bulkAttendanceData[employeeId] || { records: [] };
        
        // Calculate working days for the month
        const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
        
        // Process attendance records
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;
        
        if (employeeData.records && employeeData.records.length > 0) {
          for (const record of employeeData.records) {
            const status = record.status || 'Present';
            
            switch (status.toLowerCase()) {
              case 'present':
              case 'check-in':
              case 'check-out':
                presentDays++;
                break;
              case 'absent':
                absentDays++;
                break;
              case 'leave':
              case 'sick leave':
              case 'annual leave':
                leaveDays++;
                break;
              default:
                presentDays++; // Default to present
            }
          }
        } else {
          // No records found, assume full attendance
          presentDays = totalWorkingDays;
        }
        
        results[employeeId] = {
          presentDays,
          absentDays,
          leaveDays,
          totalWorkingDays,
          attendanceRecords: employeeData.records ? employeeData.records.length : 0
        };
      }
      
      console.log(`✅ Bulk attendance summary completed for ${employeeIds.length} employees`);
      return results;
      
    } catch (error) {
      console.error('❌ Error fetching bulk attendance summary:', error.message);
      
      // Fallback: return default data for all employees
      const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
      const results = {};
      
      for (const employeeId of employeeIds) {
        results[employeeId] = {
          presentDays: totalWorkingDays,
          absentDays: 0,
          leaveDays: 0,
          totalWorkingDays,
          attendanceRecords: 0
        };
      }
      
      return results;
    }
  }

  /**
   * Get attendance summary for an employee for a specific month from ZKBio Time API
   * @param {string} employeeId - Employee ID (employeeId field)
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Attendance summary with presentDays, absentDays, leaveDays, totalWorkingDays
   */
  static async getMonthlyAttendanceSummary(employeeId, month, year) {
    try {
      console.log(`📊 Fetching ZKBio Time attendance for employee ${employeeId} - ${month}/${year}`);
      
      // Get complete attendance history from ZKBio Time API
      const result = await zkbioTimeApiService.getCompleteEmployeeAttendanceHistory(employeeId);
      
      if (!result.success || !result.data || result.data.length === 0) {
        console.log(`⚠️ No ZKBio Time attendance records found for employee ${employeeId}`);
        return {
          presentDays: 26, // Assume full attendance if no records
          absentDays: 0,
          leaveDays: 0,
          totalWorkingDays: 26,
          attendanceRecords: 0
        };
      }
      
      // Filter records for the specific month
      const monthRecords = result.data.filter(record => {
        if (!record.punch_time) return false;
        const date = new Date(record.punch_time);
        return date.getFullYear() === year && date.getMonth() === (month - 1); // month is 1-12, convert to 0-11
      });
      
      console.log(`📅 Found ${monthRecords.length} ZKBio Time records for ${month}/${year}`);
      
      // Group records by date
      const dateGroups = {};
      monthRecords.forEach(record => {
        const date = record.punch_time.split(' ')[0]; // YYYY-MM-DD format
        if (!dateGroups[date]) {
          dateGroups[date] = [];
        }
        dateGroups[date].push({
          time: record.punch_time,
          state: record.punch_state_display,
          location: record.area_alias || 'N/A'
        });
      });
      
      // Count unique dates with attendance
      const uniqueDates = Object.keys(dateGroups);
      const presentDays = uniqueDates.length;
      
      // Calculate total working days for the month
      const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
      
      // Calculate absent days (working days - present days)
      const absentDays = Math.max(0, totalWorkingDays - presentDays);
      
      // For now, assume no leave days (can be enhanced later)
      const leaveDays = 0;
      
      console.log(`📊 ZKBio Time Attendance Summary for ${employeeId}:`);
      console.log(`   Month: ${month}/${year}`);
      console.log(`   Total Records: ${monthRecords.length}`);
      console.log(`   Unique Dates: ${uniqueDates.length}`);
      console.log(`   Present Days: ${presentDays}`);
      console.log(`   Absent Days: ${absentDays}`);
      console.log(`   Leave Days: ${leaveDays}`);
      console.log(`   Total Working Days: ${totalWorkingDays}`);
      
      return {
        presentDays,
        absentDays,
        leaveDays,
        totalWorkingDays,
        attendanceRecords: monthRecords.length,
        uniqueDates,
        dateGroups
      };
      
    } catch (error) {
      console.error('❌ Error getting ZKBio Time attendance summary:', error.message);
      
      // Fallback to full attendance if API fails
      const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
      return {
        presentDays: totalWorkingDays,
        absentDays: 0,
        leaveDays: 0,
        totalWorkingDays,
        attendanceRecords: 0
      };
    }
  }
  
  /**
   * Calculate attendance deduction based on actual attendance
   * @param {number} grossSalary - Employee's gross salary
   * @param {number} absentDays - Days employee was absent
   * @param {number} leaveDays - Days employee was on leave
   * @param {number} totalWorkingDays - Total working days in month
   * @returns {Object} Attendance deduction details
   */
  static calculateAttendanceDeduction(grossSalary, absentDays, leaveDays, totalWorkingDays) {
    const dailyRate = grossSalary / totalWorkingDays;
    const attendanceDeduction = (absentDays + leaveDays) * dailyRate;
    
    console.log(`💰 Attendance Deduction Calculation:`);
    console.log(`   Daily Rate: Rs. ${dailyRate.toFixed(2)} (${grossSalary} ÷ ${totalWorkingDays})`);
    console.log(`   Absent Days: ${absentDays}, Leave Days: ${leaveDays}`);
    console.log(`   Attendance Deduction: Rs. ${attendanceDeduction.toFixed(2)}`);
    
    return {
      dailyRate,
      attendanceDeduction,
      absentDays,
      leaveDays,
      totalWorkingDays
    };
  }
  
  /**
   * Get bulk attendance integration for multiple employees (OPTIMIZED)
   * @param {Array} employeeData - Array of {employeeId, grossSalary} objects
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {boolean} zkbioServerOnline - Whether ZKBio server is online (optional)
   * @returns {Object} Bulk attendance integration data
   */
  static async getBulkAttendanceIntegration(employeeData, month, year, zkbioServerOnline = null) {
    try {
      // Check server status if not provided
      if (zkbioServerOnline === null) {
        const serverStatus = await this.checkZKBioServerStatus();
        zkbioServerOnline = serverStatus.isOnline;
      }
      
      if (!zkbioServerOnline) {
        console.log(`⚠️ ZKBio Time server is offline - using bulk fallback calculation for ${employeeData.length} employees`);
        
        // Use bulk fallback calculation when server is offline
        const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
        const results = {};
        
        for (const emp of employeeData) {
          const dailyRate = emp.grossSalary / totalWorkingDays;
          results[emp.employeeId] = {
            presentDays: totalWorkingDays,
            absentDays: 0,
            leaveDays: 0,
            totalWorkingDays,
            dailyRate,
            attendanceDeduction: 0,
            attendanceRecords: 0,
            serverStatus: 'offline'
          };
        }
        
        return results;
      }
      
      console.log(`🔧 Starting bulk ZKBio Time attendance integration for ${employeeData.length} employees - ${month}/${year}`);
      
      // Get bulk attendance summary from ZKBio Time API
      const bulkAttendanceSummary = await this.getBulkMonthlyAttendanceSummary(
        employeeData.map(emp => emp.employeeId), 
        month, 
        year
      );
      
      const results = {};
      
      // Process each employee's attendance data
      for (const emp of employeeData) {
        const attendanceData = bulkAttendanceSummary[emp.employeeId] || {
          presentDays: this.calculateWorkingDaysInMonth(year, month - 1),
          absentDays: 0,
          leaveDays: 0,
          totalWorkingDays: this.calculateWorkingDaysInMonth(year, month - 1)
        };
        
        // Calculate attendance deduction
        const deductionDetails = this.calculateAttendanceDeduction(
          emp.grossSalary,
          attendanceData.absentDays,
          attendanceData.leaveDays,
          attendanceData.totalWorkingDays
        );
        
        results[emp.employeeId] = {
          ...attendanceData,
          ...deductionDetails,
          serverStatus: 'online'
        };
      }
      
      console.log(`✅ Bulk ZKBio Time attendance integration completed for ${employeeData.length} employees`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Error in bulk ZKBio Time attendance integration:', error.message);
      
      // Fallback to bulk calculation if integration fails
      const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
      const results = {};
      
      for (const emp of employeeData) {
        const dailyRate = emp.grossSalary / totalWorkingDays;
        results[emp.employeeId] = {
          presentDays: totalWorkingDays,
          absentDays: 0,
          leaveDays: 0,
          totalWorkingDays,
          dailyRate,
          attendanceDeduction: 0,
          attendanceRecords: 0,
          serverStatus: 'error'
        };
      }
      
      return results;
    }
  }

  /**
   * Get comprehensive attendance integration for payroll using ZKBio Time API
   * @param {string} employeeId - Employee ID (employeeId field)
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {number} grossSalary - Employee's gross salary
   * @param {boolean} zkbioServerOnline - Whether ZKBio server is online (optional)
   * @returns {Object} Complete attendance integration data
   */
  static async getAttendanceIntegration(employeeId, month, year, grossSalary, zkbioServerOnline = null) {
    try {
      // Check server status if not provided
      if (zkbioServerOnline === null) {
        const serverStatus = await this.checkZKBioServerStatus();
        zkbioServerOnline = serverStatus.isOnline;
      }
      
      if (!zkbioServerOnline) {
        console.log(`⚠️ ZKBio Time server is offline - using fallback calculation for employee ${employeeId}`);
        
        // Use fallback calculation when server is offline
        const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
        const dailyRate = grossSalary / totalWorkingDays;
        
        console.log(`📊 Fallback calculation for employee ${employeeId}:`);
        console.log(`   Present Days: ${totalWorkingDays} (full attendance - server offline)`);
        console.log(`   Absent Days: 0`);
        console.log(`   Leave Days: 0`);
        console.log(`   Daily Rate: Rs. ${dailyRate.toFixed(2)}`);
        console.log(`   Attendance Deduction: Rs. 0`);
        
        return {
          presentDays: totalWorkingDays,
          absentDays: 0,
          leaveDays: 0,
          totalWorkingDays,
          dailyRate,
          attendanceDeduction: 0,
          attendanceRecords: 0,
          serverStatus: 'offline'
        };
      }
      
      console.log(`🔧 Starting ZKBio Time attendance integration for employee ${employeeId} - ${month}/${year}`);
      
      // Get attendance summary from ZKBio Time API
      const attendanceSummary = await this.getMonthlyAttendanceSummary(employeeId, month, year);
      
      // Calculate attendance deduction
      const deductionDetails = this.calculateAttendanceDeduction(
        grossSalary,
        attendanceSummary.absentDays,
        attendanceSummary.leaveDays,
        attendanceSummary.totalWorkingDays
      );
      
      const result = {
        ...attendanceSummary,
        ...deductionDetails,
        serverStatus: 'online'
      };
      
      console.log(`✅ ZKBio Time attendance integration completed for employee ${employeeId}`);
      console.log(`   Present Days: ${result.presentDays}`);
      console.log(`   Absent Days: ${result.absentDays}`);
      console.log(`   Leave Days: ${result.leaveDays}`);
      console.log(`   Daily Rate: Rs. ${result.dailyRate.toFixed(2)}`);
      console.log(`   Attendance Deduction: Rs. ${result.attendanceDeduction.toFixed(2)}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in ZKBio Time attendance integration:', error.message);
      
      // Fallback to full attendance if integration fails
      const totalWorkingDays = this.calculateWorkingDaysInMonth(year, month - 1);
      const dailyRate = grossSalary / totalWorkingDays;
      
      console.log(`⚠️ Using fallback calculation for employee ${employeeId}:`);
      console.log(`   Present Days: ${totalWorkingDays} (full attendance)`);
      console.log(`   Absent Days: 0`);
      console.log(`   Leave Days: 0`);
      console.log(`   Daily Rate: Rs. ${dailyRate.toFixed(2)}`);
      console.log(`   Attendance Deduction: Rs. 0`);
      
      return {
        presentDays: totalWorkingDays,
        absentDays: 0,
        leaveDays: 0,
        totalWorkingDays,
        dailyRate,
        attendanceDeduction: 0,
        attendanceRecords: 0,
        serverStatus: 'error'
      };
    }
  }
}

module.exports = AttendanceIntegrationService;
