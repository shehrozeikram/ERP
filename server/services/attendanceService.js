const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Designation = require('../models/hr/Designation');
const BiometricIntegration = require('../models/hr/BiometricIntegration');
const zktecoService = require('./zktecoService');
const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');
const mongoose = require('mongoose');

class AttendanceService {
  constructor() {
    this.syncIntervals = new Map();
  }

  // Get attendance records with filters - SIMPLIFIED VERSION
  async getAttendanceRecords(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        employee,
        department,
        status,
        startDate,
        endDate,
        sortBy = 'date',
        sortOrder = 'desc',
        latestOnly = true
      } = filters;

      const query = { isActive: true };

      // Add filters
      if (employee) {
        if (mongoose.Types.ObjectId.isValid(employee)) {
          query.employee = new mongoose.Types.ObjectId(employee);
        }
      }
      
      // Exclude absent records by default - only show actual attendance records
      query.status = { $ne: 'Absent' };
      
      // If a specific status is requested (other than Absent), use that instead
      if (status && status !== 'Absent') {
        query.status = status;
      }
      
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else {
        // Default to last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        query.date = {
          $gte: thirtyDaysAgo,
          $lte: endOfToday
        };
      }

      // SIMPLE APPROACH: Use find() instead of complex aggregation
      let attendanceQuery = Attendance.find(query)
        .populate('employee', 'firstName lastName employeeId department position')
        .lean();

      // Apply sorting
      if (sortBy === 'date') {
        attendanceQuery = attendanceQuery.sort({ date: sortOrder === 'desc' ? -1 : 1, updatedAt: -1, createdAt: -1 });
      } else if (sortBy === 'updatedAt') {
        attendanceQuery = attendanceQuery.sort({ updatedAt: sortOrder === 'desc' ? -1 : 1, date: -1, createdAt: -1 });
      } else if (sortBy === 'createdAt') {
        attendanceQuery = attendanceQuery.sort({ createdAt: sortOrder === 'desc' ? -1 : 1, date: -1, updatedAt: -1 });
      } else {
        attendanceQuery = attendanceQuery.sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1, date: -1, updatedAt: -1 });
      }

      // Apply pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      attendanceQuery = attendanceQuery.skip(skip).limit(parseInt(limit));

      // Execute query
      const attendance = await attendanceQuery;

      // Get total count
      const total = await Attendance.countDocuments(query);

      return {
        success: true,
        data: attendance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      throw error;
    }
  }



  // Get attendance statistics for dashboard
  async getAttendanceStatisticsAll(filters = {}) {
    try {
      const { department, status, startDate, endDate } = filters;
      
      // Build base query
      const baseQuery = { isActive: true };
      
      // Add department filter if specified
      if (department) {
        const employeesInDept = await Employee.find({ 
          placementDepartment: department,
          isDeleted: false 
        }).select('_id');
        baseQuery.employee = { $in: employeesInDept.map(emp => emp._id) };
      }

      // Get today's date range (Pakistan timezone)
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      // Get date range for filters
      let dateQuery = {};
      if (startDate && endDate) {
        dateQuery = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else {
        // Default to today
        dateQuery = {
          $gte: todayStart,
          $lte: todayEnd
        };
      }

      // Total records in the date range (excluding absent records)
      const totalRecords = await Attendance.countDocuments({
        ...baseQuery,
        date: dateQuery,
        status: { $ne: 'Absent' } // Exclude absent records
      });

      // Present today (has check-in or check-out, excluding absent)
      const presentToday = await Attendance.countDocuments({
        ...baseQuery,
        date: dateQuery,
        status: { $ne: 'Absent' }, // Exclude absent records
        $or: [
          { 'checkIn.time': { $exists: true } },
          { 'checkOut.time': { $exists: true } }
        ]
      });

      // Late today (check-in after 7:00 AM, excluding absent)
      const lateToday = await Attendance.countDocuments({
        ...baseQuery,
        date: dateQuery,
        status: { $ne: 'Absent' }, // Exclude absent records
        'checkIn.time': {
          $gt: new Date(todayStart.getTime() + (7 * 60 * 60 * 1000)) // 7:00 AM
        }
      });

      // Absent today - set to 0 since we're excluding absent records
      const absentToday = 0;

      // Biometric records (from ZKTeco or other biometric devices, excluding absent)
      const biometricRecords = await Attendance.countDocuments({
        ...baseQuery,
        date: dateQuery,
        status: { $ne: 'Absent' }, // Exclude absent records
        $or: [
          { 'checkIn.method': 'Biometric' },
          { 'checkOut.method': 'Biometric' },
          { 'checkIn.location': { $regex: /ZKTeco|Device/i } },
          { 'checkOut.location': { $regex: /ZKTeco|Device/i } }
        ]
      });

      return {
        success: true,
        data: {
          totalRecords,
          presentToday,
          lateToday,
          absentToday,
          biometricRecords
        }
      };
    } catch (error) {
      console.error('Error fetching attendance statistics:', error);
      throw error;
    }
  }

  // Add other methods as needed...
}

module.exports = new AttendanceService();
