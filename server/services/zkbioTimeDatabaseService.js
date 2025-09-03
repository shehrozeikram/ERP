const mongoose = require('mongoose');

/**
 * ZKBio Time Employee Schema
 */
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

/**
 * ZKBio Time Attendance Schema
 */
const zkbioTimeAttendanceSchema = new mongoose.Schema({
  zkbioId: { type: Number, required: true },
  empCode: { type: String, required: true },
  empId: { type: Number, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  department: { type: String },
  position: { type: String },
  punchTime: { type: Date, required: true },
  punchState: { type: String, required: true }, // Check In, Check Out
  punchStateDisplay: { type: String, required: true },
  verifyType: { type: Number },
  verifyTypeDisplay: { type: String },
  areaAlias: { type: String },
  terminalSn: { type: String },
  temperature: { type: Number },
  isMask: { type: String },
  terminalAlias: { type: String },
  uploadTime: { type: Date },
  date: { type: String, required: true }, // YYYY-MM-DD format
  isProcessed: { type: Boolean, default: false }
}, { timestamps: true, collection: 'zkbiotimeattendances' });

// Create indexes for better performance
zkbioTimeEmployeeSchema.index({ empCode: 1 });
zkbioTimeEmployeeSchema.index({ isActive: 1 });

zkbioTimeAttendanceSchema.index({ empCode: 1, date: 1 });
zkbioTimeAttendanceSchema.index({ punchTime: 1 });
zkbioTimeAttendanceSchema.index({ isProcessed: 1 });
// Additional indexes for optimized aggregation
zkbioTimeAttendanceSchema.index({ empCode: 1, punchTime: -1 });
zkbioTimeAttendanceSchema.index({ firstName: 1 });
zkbioTimeAttendanceSchema.index({ lastName: 1 });

const ZKBioTimeEmployee = mongoose.model('ZKBioTimeEmployee', zkbioTimeEmployeeSchema);
const ZKBioTimeAttendance = mongoose.model('ZKBioTimeAttendance', zkbioTimeAttendanceSchema);

/**
 * ZKBio Time Database Service
 */
class ZKBioTimeDatabaseService {
  /**
   * Save or update employee
   */
  async saveEmployee(employeeData) {
    try {
      const employee = await ZKBioTimeEmployee.findOneAndUpdate(
        { empCode: employeeData.emp_code?.trim() },
        {
          zkbioId: employeeData.id,
          empCode: employeeData.emp_code?.trim(),
          firstName: employeeData.first_name,
          lastName: employeeData.last_name,
          fullName: employeeData.full_name,
          department: employeeData.department,
          position: employeeData.position,
          areas: employeeData.area,
          hireDate: employeeData.hire_date,
          enrollSn: employeeData.enroll_sn,
          updateTime: employeeData.update_time,
          isActive: true
        },
        { upsert: true, new: true }
      );
      
      return employee;
    } catch (error) {
      console.error('❌ Error saving employee:', error.message);
      throw error;
    }
  }

  /**
   * Save multiple employees
   */
  async saveEmployees(employeesData) {
    try {
      const results = await Promise.allSettled(
        employeesData.map(emp => this.saveEmployee(emp))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Saved ${successful} employees, ${failed} failed`);
      
      return {
        success: true,
        saved: successful,
        failed: failed,
        total: employeesData.length
      };
    } catch (error) {
      console.error('❌ Error saving employees:', error.message);
      throw error;
    }
  }

  /**
   * Save attendance record
   */
  async saveAttendanceRecord(attendanceData) {
    try {
      const attendance = await ZKBioTimeAttendance.findOneAndUpdate(
        { 
          zkbioId: attendanceData.id,
          empCode: attendanceData.emp_code?.trim(),
          punchTime: attendanceData.punch_time
        },
        {
          zkbioId: attendanceData.id,
          empCode: attendanceData.emp_code?.trim(),
          empId: attendanceData.emp,
          firstName: attendanceData.first_name,
          lastName: attendanceData.last_name,
          department: attendanceData.department,
          position: attendanceData.position,
          punchTime: attendanceData.punch_time,
          punchState: attendanceData.punch_state,
          punchStateDisplay: attendanceData.punch_state_display,
          verifyType: attendanceData.verify_type,
          verifyTypeDisplay: attendanceData.verify_type_display,
          areaAlias: attendanceData.area_alias,
          terminalSn: attendanceData.terminal_sn,
          temperature: attendanceData.temperature,
          isMask: attendanceData.is_mask,
          terminalAlias: attendanceData.terminal_alias,
          uploadTime: attendanceData.upload_time,
          date: attendanceData.punch_time?.split(' ')[0],
          isProcessed: false
        },
        { upsert: true, new: true }
      );
      
      return attendance;
    } catch (error) {
      console.error('❌ Error saving attendance:', error.message);
      throw error;
    }
  }

  /**
   * Save multiple attendance records
   */
  async saveAttendanceRecords(attendanceData) {
    try {
      const results = await Promise.allSettled(
        attendanceData.map(att => this.saveAttendanceRecord(att))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Saved ${successful} attendance records, ${failed} failed`);
      
      return {
        success: true,
        saved: successful,
        failed: failed,
        total: attendanceData.length
      };
    } catch (error) {
      console.error('❌ Error saving attendance records:', error.message);
      throw error;
    }
  }

  /**
   * Get today's attendance from database
   */
  async getTodayAttendance() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const attendance = await ZKBioTimeAttendance.find({
        date: today
      }).sort({ punchTime: -1 });
      
      return {
        success: true,
        data: attendance,
        count: attendance.length
      };
    } catch (error) {
      console.error('❌ Error fetching today\'s attendance:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get attendance by date range
   */
  async getAttendanceByDateRange(startDate, endDate) {
    try {
      const attendance = await ZKBioTimeAttendance.find({
        date: { $gte: startDate, $lte: endDate }
      }).sort({ punchTime: -1 });
      
      return {
        success: true,
        data: attendance,
        count: attendance.length
      };
    } catch (error) {
      console.error('❌ Error fetching attendance by date range:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get all employees
   */
  async getAllEmployees() {
    try {
      const employees = await ZKBioTimeEmployee.find({ isActive: true });
      
      return {
        success: true,
        data: employees,
        count: employees.length
      };
    } catch (error) {
      console.error('❌ Error fetching employees:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get employee by code
   */
  async getEmployeeByCode(empCode) {
    try {
      const employee = await ZKBioTimeEmployee.findOne({ 
        empCode: empCode?.trim(),
        isActive: true 
      });
      
      return employee;
    } catch (error) {
      console.error('❌ Error fetching employee:', error.message);
      return null;
    }
  }

  /**
   * Get all employees with their latest attendance activity (optimized with pagination)
   */
  async getEmployeesWithLatestAttendance(page = 0, limit = 10, searchQuery = '') {
    try {
      const skip = page * limit;
      
      // Build aggregation pipeline
      const pipeline = [
        // Sort by punch time to get latest records first
        { $sort: { punchTime: -1 } },
        // Group by employee to get latest record per employee
        {
          $group: {
            _id: '$empCode',
            latestRecord: { $first: '$$ROOT' }
          }
        },
        // Sort by employee ID ascending
        { $sort: { '_id': 1 } }
      ];

      // Add search filter if provided
      if (searchQuery && searchQuery.trim()) {
        pipeline.unshift({
          $match: {
            $or: [
              { empCode: { $regex: searchQuery.trim(), $options: 'i' } },
              { firstName: { $regex: searchQuery.trim(), $options: 'i' } },
              { lastName: { $regex: searchQuery.trim(), $options: 'i' } }
            ]
          }
        });
      }

      // Get total count for pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await ZKBioTimeAttendance.aggregate(countPipeline);
      const totalCount = countResult.length > 0 ? countResult[0].total : 0;

      // Add pagination to main pipeline
      pipeline.push({ $skip: skip }, { $limit: limit });

      // Add lookup for employee details
      pipeline.push({
        $lookup: {
          from: 'zkbiotimeemployees',
          localField: '_id',
          foreignField: 'empCode',
          as: 'employee'
        }
      });

      // Unwind employee array
      pipeline.push({
        $unwind: {
          path: '$employee',
          preserveNullAndEmptyArrays: true
        }
      });

      // Project final result
      pipeline.push({
        $project: {
          employeeId: '$_id',
          firstName: '$employee.firstName',
          lastName: '$employee.lastName',
          fullName: {
            $concat: [
              { $ifNull: ['$employee.firstName', '$latestRecord.firstName', ''] },
              ' ',
              { $ifNull: ['$employee.lastName', '$latestRecord.lastName', ''] }
            ]
          },
          department: { $ifNull: ['$employee.department', '$latestRecord.department', ''] },
          latestActivity: '$latestRecord.punchStateDisplay',
          latestTime: '$latestRecord.punchTime',
          latestDate: '$latestRecord.punchTime',
          status: 'Present'
        }
      });

      // Execute aggregation
      const result = await ZKBioTimeAttendance.aggregate(pipeline);

      return {
        success: true,
        data: result,
        count: result.length,
        totalCount: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit)
      };
    } catch (error) {
      console.error('Error getting employees with latest attendance:', error);
      return { 
        success: false, 
        data: [], 
        count: 0, 
        totalCount: 0,
        page: page,
        limit: limit,
        totalPages: 0,
        error: error.message 
      };
    }
  }

  /**
   * Get specific employee's complete attendance history from ZKBio Time API
   */
  async getEmployeeAttendanceHistoryFromAPI(employeeId) {
    try {
      console.log(`🔍 Fetching attendance history from ZKBio Time API for employee: ${employeeId}`);
      
      // Import the API service
      const zkbioTimeApiService = require('./zkbioTimeApiService');
      
      // Get complete attendance history from API
      const apiResult = await zkbioTimeApiService.getCompleteEmployeeAttendanceHistory(employeeId);
      
      if (!apiResult.success) {
        console.error('❌ Failed to fetch from API:', apiResult.error);
        return { success: false, error: apiResult.error };
      }
      
      console.log(`📊 API returned ${apiResult.data.length} attendance records for employee ${employeeId}`);
      
      if (apiResult.data.length === 0) {
        return { success: false, error: 'No attendance records found' };
      }
      
      // Get employee details from the latest attendance record
      const latestRecord = apiResult.data[0];
      
      // Group attendance records by date
      const groupedByDate = {};
      
      apiResult.data.forEach(record => {
        const date = record.punch_time?.split(' ')[0]; // YYYY-MM-DD format
        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            date: date,
            checkIn: null,
            checkOut: null,
            location: record.area_alias || 'N/A'
          };
        }
        
        // Determine if it's check-in or check-out based on punch state
        if (record.punch_state_display === 'Check In') {
          groupedByDate[date].checkIn = record.punch_time;
        } else if (record.punch_state_display === 'Check Out') {
          groupedByDate[date].checkOut = record.punch_time;
        }
        
        // Update location if not set
        if (!groupedByDate[date].location || groupedByDate[date].location === 'N/A') {
          groupedByDate[date].location = record.area_alias || 'N/A';
        }
      });

      // Convert grouped data to array and sort by date (newest first)
      const groupedAttendance = Object.values(groupedByDate)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        success: true,
        employee: {
          employeeId: employeeId,
          firstName: latestRecord.first_name || '',
          lastName: latestRecord.last_name || '',
          fullName: `${latestRecord.first_name || ''} ${latestRecord.last_name || ''}`.trim(),
          department: latestRecord.department || ''
        },
        attendance: groupedAttendance,
        totalRecords: apiResult.data.length,
        source: 'ZKBio Time API'
      };
    } catch (error) {
      console.error('Error getting employee attendance history from API:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get specific employee's complete attendance history grouped by date
   */
  async getEmployeeAttendanceHistory(employeeId) {
    try {
      console.log(`🔍 Fetching attendance history for employee: ${employeeId}`);
      
      // Get all attendance records for this employee
      const attendance = await ZKBioTimeAttendance
        .find({ empCode: employeeId })
        .sort({ punchTime: -1 }) // Latest first
        .lean();

      console.log(`📊 Found ${attendance.length} attendance records in database for employee ${employeeId}`);
      
      if (attendance.length > 0) {
        console.log('📅 Sample records:');
        attendance.slice(0, 5).forEach((record, index) => {
          console.log(`${index + 1}. Date: ${record.date}, Time: ${record.punchTime}, Type: ${record.punchStateDisplay}`);
        });
      }

      if (!attendance || attendance.length === 0) {
        return { success: false, error: 'Employee not found' };
      }

      // Get employee details from the latest attendance record
      const latestRecord = attendance[0];
      
      // Try to get employee from employee collection first
      let employee = await ZKBioTimeEmployee.findOne({ empCode: employeeId }).lean();
      
      // If not found in employee collection, use data from attendance record
      if (!employee) {
        employee = {
          empCode: employeeId,
          firstName: latestRecord.firstName || '',
          lastName: latestRecord.lastName || '',
          department: latestRecord.department || ''
        };
      }

      // Group attendance records by date
      const groupedByDate = {};
      
      attendance.forEach(record => {
        const date = record.date; // YYYY-MM-DD format
        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            date: date,
            checkIn: null,
            checkOut: null,
            location: record.areaAlias || 'N/A'
          };
        }
        
        // Determine if it's check-in or check-out based on punch state
        if (record.punchStateDisplay === 'Check In') {
          groupedByDate[date].checkIn = record.punchTime;
        } else if (record.punchStateDisplay === 'Check Out') {
          groupedByDate[date].checkOut = record.punchTime;
        }
        
        // Update location if not set
        if (!groupedByDate[date].location || groupedByDate[date].location === 'N/A') {
          groupedByDate[date].location = record.areaAlias || 'N/A';
        }
      });

      // Convert grouped data to array and sort by date (newest first)
      const groupedAttendance = Object.values(groupedByDate)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        success: true,
        employee: {
          employeeId: employee.empCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
          department: employee.department
        },
        attendance: groupedAttendance
      };
    } catch (error) {
      console.error('Error getting employee attendance history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process attendance data (group check-ins and check-outs)
   */
  processAttendanceData(attendanceData) {
    const grouped = new Map();

    attendanceData.forEach(record => {
      const key = `${record.empCode}-${record.date}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          employee: {
            _id: record.empId,
            employeeId: record.empCode,
            firstName: record.firstName,
            lastName: record.lastName,
            fullName: record.firstName + (record.lastName ? ' ' + record.lastName : ''),
            department: record.department,
            position: record.position
          },
          date: record.date,
          checkIns: [],
          checkOuts: [],
          status: 'Present',
          latestActivityTime: 0
        });
      }

      const group = grouped.get(key);
      
      if (record.punchStateDisplay === 'Check In') {
        group.checkIns.push({
          time: record.punchTime,
          location: record.areaAlias,
          method: record.verifyTypeDisplay,
          deviceId: record.terminalSn
        });
      } else if (record.punchStateDisplay === 'Check Out') {
        group.checkOuts.push({
          time: record.punchTime,
          location: record.areaAlias,
          method: record.verifyTypeDisplay,
          deviceId: record.terminalSn
        });
      }

      // Update latest activity time
      const activityTime = new Date(record.punchTime).getTime();
      if (activityTime > group.latestActivityTime) {
        group.latestActivityTime = activityTime;
      }
    });

    const result = Array.from(grouped.values()).map(group => {
      const latestCheckIn = group.checkIns.length > 0 ? 
        group.checkIns.sort((a, b) => new Date(b.time) - new Date(a.time))[0] : null;
      const latestCheckOut = group.checkOuts.length > 0 ? 
        group.checkOuts.sort((a, b) => new Date(b.time) - new Date(a.time))[0] : null;

      return {
        _id: `zkbio-${group.employee.employeeId}-${group.date}`,
        employee: group.employee,
        date: group.date,
        checkIn: latestCheckIn,
        checkOut: latestCheckOut,
        status: latestCheckIn ? 'Present' : 'Absent',
        deviceType: 'ZKBio Time',
        totalCheckIns: group.checkIns.length,
        totalCheckOuts: group.checkOuts.length,
        allCheckIns: group.checkIns,
        allCheckOuts: group.checkOuts,
        latestActivityTime: group.latestActivityTime
      };
    });

    // Sort by latest activity time - newest first
    return result.sort((a, b) => b.latestActivityTime - a.latestActivityTime);
  }
}

module.exports = new ZKBioTimeDatabaseService();
