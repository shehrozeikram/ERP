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

  // Get attendance records with filters
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
        latestOnly = true // New parameter to show only latest records
      } = filters;

      const query = { isActive: true };

      // Add filters
      if (employee) {
        // If employee is a string (name search), we'll filter after the lookup
        // If it's an ObjectId, we'll filter before the lookup
        if (mongoose.Types.ObjectId.isValid(employee)) {
          query.employee = new mongoose.Types.ObjectId(employee);
        }
        // For name search, we'll handle it in the pipeline
      }
      
      // Handle absent status differently - don't add it to the query
      if (status && status !== 'Absent') {
        query.status = status;
      }
      
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else {
        // Default to last 30 days if no date range is specified to show more data
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        query.date = {
          $gte: thirtyDaysAgo,
          $lte: endOfToday
        };
      }

      // If status is 'Absent', we need to handle it differently
      if (status === 'Absent') {
        return await this.getAbsentEmployees(filters);
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        { $unwind: '$employeeData' }
      ];

      // Add department filter if specified
      if (department) {
        pipeline.push({
          $match: {
            'employeeData.department': new mongoose.Types.ObjectId(department)
          }
        });
      }

      // Add employee name filter if specified (and not an ObjectId)
      if (employee && !mongoose.Types.ObjectId.isValid(employee)) {
        pipeline.push({
          $match: {
            $or: [
              { 'employeeData.firstName': { $regex: employee, $options: 'i' } },
              { 'employeeData.lastName': { $regex: employee, $options: 'i' } },
              { 'employeeData.employeeId': { $regex: employee, $options: 'i' } }
            ]
          }
        });
      }

      // If latestOnly is true, get only the latest record per employee per day
      if (latestOnly) {
        pipeline.push(
          {
            $sort: { date: -1, updatedAt: -1, createdAt: -1 } // Sort by date, then by most recently updated/created
          },
          {
            $group: {
              _id: {
                employee: '$employee',
                date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }
              },
              latestRecord: { $first: '$$ROOT' }
            }
          },
          {
            $replaceRoot: { newRoot: '$latestRecord' }
          }
        );
      }

      // Add sorting - prioritize most recently updated/recorded attendance
      const sortObject = {};
      
      // Primary sort by updatedAt (most recently updated first)
      sortObject['updatedAt'] = -1;
      
      // Secondary sort by createdAt
      sortObject['createdAt'] = -1;
      
      // Tertiary sort by date if specified
      if (sortBy === 'date') {
        sortObject['date'] = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy !== 'date') {
        const sortField = sortBy;
        sortObject[sortField] = sortOrder === 'desc' ? -1 : 1;
      }
      
      pipeline.push({
        $sort: sortObject
      });

      // Add pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push(
        { $skip: skip },
        { $limit: parseInt(limit) }
      );

      // Add projection
      pipeline.push({
        $project: {
          _id: 1,
          date: 1,
          status: 1,
          checkIn: 1,
          checkOut: 1,
          workHours: 1,
          overtimeHours: 1,
          notes: 1,
          isApproved: 1,
          createdAt: 1,
          employee: {
            _id: '$employeeData._id',
            firstName: '$employeeData.firstName',
            lastName: '$employeeData.lastName',
            employeeId: '$employeeData.employeeId',
            department: '$employeeData.department',
            position: '$employeeData.position'
          }
        }
      });

      const attendance = await Attendance.aggregate(pipeline);
      
      // Calculate total for pagination
      let total;
      if (latestOnly) {
        // Count unique employees with attendance records
        const totalPipeline = [
          { $match: query },
          {
            $lookup: {
              from: 'employees',
              localField: 'employee',
              foreignField: '_id',
              as: 'employeeData'
            }
          },
          { $unwind: '$employeeData' }
        ];

        if (department) {
          totalPipeline.push({
            $match: {
              'employeeData.department': new mongoose.Types.ObjectId(department)
            }
          });
        }

        // Add employee name filter if specified (and not an ObjectId)
        if (employee && !mongoose.Types.ObjectId.isValid(employee)) {
          totalPipeline.push({
            $match: {
              $or: [
                { 'employeeData.firstName': { $regex: employee, $options: 'i' } },
                { 'employeeData.lastName': { $regex: employee, $options: 'i' } },
                { 'employeeData.employeeId': { $regex: employee, $options: 'i' } }
              ]
            }
          });
        }

        totalPipeline.push(
          {
            $sort: { date: -1, 'checkIn.time': -1 }
          },
          {
            $group: {
              _id: {
                employee: '$employee',
                date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }
              }
            }
          },
          {
            $count: 'total'
          }
        );

        const totalResult = await Attendance.aggregate(totalPipeline);
        total = totalResult.length > 0 ? totalResult[0].total : 0;
      } else {
        total = await Attendance.countDocuments(query);
      }

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

  // Create or update attendance record
  async createOrUpdateAttendance(attendanceData) {
    try {
      const {
        employeeId,
        date,
        checkInTime,
        checkOutTime,
        deviceId = 'Biometric Device',
        method = 'Biometric',
        location = 'Office'
      } = attendanceData;

      // Find employee
      const employee = await Employee.findOne({ 
        $or: [
          { employeeId: employeeId },
          { _id: employeeId }
        ],
        isDeleted: false
      });

      if (!employee) {
        throw new Error(`Employee not found: ${employeeId}`);
      }

      // Set date to start of day
      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      // Find existing attendance record for this employee and date
      let attendance = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: attendanceDate,
          $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
        },
        isActive: true
      });

      if (!attendance) {
        // Create new attendance record
        attendance = new Attendance({
          employee: employee._id,
          date: attendanceDate,
          status: 'Present',
          checkIn: checkInTime ? {
            time: new Date(checkInTime),
            location,
            method,
            deviceId
          } : {},
          checkOut: checkOutTime ? {
            time: new Date(checkOutTime),
            location,
            method,
            deviceId
          } : {}
        });
      } else {
        // Update existing attendance record
        if (checkInTime) {
          attendance.checkIn = {
            time: new Date(checkInTime),
            location,
            method,
            deviceId
          };
        }
        if (checkOutTime) {
          attendance.checkOut = {
            time: new Date(checkOutTime),
            location,
            method,
            deviceId
          };
        }
      }

      // Calculate work hours if both check-in and check-out times are available
      if (attendance.checkIn?.time && attendance.checkOut?.time) {
        const checkInTime = new Date(attendance.checkIn.time);
        const checkOutTime = new Date(attendance.checkOut.time);
        
        // Calculate total hours worked
        const diffMs = checkOutTime - checkInTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        const totalHours = Math.round(diffHours * 100) / 100;
        
        // Set work hours (assuming 8 hours is standard work day)
        attendance.workHours = Math.max(0, totalHours);
        attendance.overtimeHours = totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0;
        
        // Determine status based on check-in time
        const checkInHour = checkInTime.getHours();
        const checkInMinute = checkInTime.getMinutes();
        const totalMinutes = checkInHour * 60 + checkInMinute;
        
        // Consider late if check-in is after 9:30 AM (570 minutes)
        if (totalMinutes > 570) {
          attendance.status = 'Late';
        } else {
          attendance.status = 'Present';
        }
      } else if (attendance.checkIn?.time) {
        // Only check-in time available
        const checkInTime = new Date(attendance.checkIn.time);
        const checkInHour = checkInTime.getHours();
        const checkInMinute = checkInTime.getMinutes();
        const totalMinutes = checkInHour * 60 + checkInMinute;
        
        // Consider late if check-in is after 9:30 AM (570 minutes)
        if (totalMinutes > 570) {
          attendance.status = 'Late';
        } else {
          attendance.status = 'Present';
        }
      }

      await attendance.save();
      return {
        success: true,
        data: attendance,
        action: attendance.isNew ? 'created' : 'updated'
      };
    } catch (error) {
      console.error('Error creating/updating attendance:', error);
      throw error;
    }
  }

  // Sync attendance from biometric devices
  async syncBiometricAttendance(integrationId, startDate, endDate) {
    try {
      const integration = await BiometricIntegration.findById(integrationId);
      if (!integration || !integration.isActive) {
        throw new Error('Biometric integration not found or inactive');
      }

      let rawData = [];
      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        errorDetails: []
      };

      // Fetch data based on integration type
      switch (integration.systemName) {
        case 'ZKTeco':
          rawData = await this.syncZKTecoAttendance(startDate, endDate);
          break;
        case 'Hikvision':
          rawData = await this.syncHikvisionAttendance(integration, startDate, endDate);
          break;
        case 'Suprema':
          rawData = await this.syncSupremaAttendance(integration, startDate, endDate);
          break;
        default:
          rawData = await this.syncGenericAttendance(integration, startDate, endDate);
      }

      // Process attendance data
      for (const record of rawData) {
        try {
          const result = await this.createOrUpdateAttendance({
            employeeId: record.employeeId || record.uid || record.userId,
            date: record.date || record.timestamp,
            checkInTime: record.direction === 'IN' ? record.time || record.timestamp : null,
            checkOutTime: record.direction === 'OUT' ? record.time || record.timestamp : null,
            deviceId: record.deviceId || 'Biometric Device',
            method: 'Biometric',
            location: 'Office'
          });

          results.processed++;
          if (result.action === 'created') {
            results.created++;
          } else {
            results.updated++;
          }
        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            record,
            error: error.message
          });
        }
      }

      // Update integration sync status
      integration.syncConfig.lastSyncAt = new Date();
      integration.syncConfig.syncStatus = 'completed';
      await integration.save();

      return {
        success: true,
        data: results,
        syncPeriod: { startDate, endDate },
        biometricRecords: rawData.length
      };
    } catch (error) {
      console.error('Error syncing biometric attendance:', error);
      throw error;
    }
  }

  // Sync ZKTeco attendance specifically
  async syncZKTecoAttendance(startDate, endDate) {
    try {
      console.log('🔄 Starting ZKTeco attendance sync...');
      
      await zktecoService.connect('splaza.nayatel.net', 4370);
      console.log('✅ Connected to ZKTeco device');
      
      const attendanceData = await zktecoService.getAttendanceData();
      await zktecoService.disconnect();
      console.log('🔌 Disconnected from ZKTeco device');

      if (!attendanceData.success || !attendanceData.data) {
        console.log('❌ No attendance data received from device');
        return {
          success: false,
          message: 'No attendance data received from device',
          data: {
            processed: 0,
            created: 0,
            updated: 0,
            errors: 0,
            errorDetails: []
          }
        };
      }

      console.log(`📊 Found ${attendanceData.data.length} records from ZKTeco device`);

      // Group attendance records by employee and date
      const employeeAttendance = new Map();

      // Filter out invalid records first
      const validRecords = attendanceData.data.filter(record => {
        const employeeId = record.uid || record.userId || record.deviceUserId;
        const timestamp = record.timestamp || record.recordTime;
        
        // Skip records with no employee ID or timestamp
        if (!employeeId || !timestamp || timestamp === undefined) {
          return false;
        }
        
        // Check if timestamp can be converted to valid date
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          return false;
        }
        
        return true;
      });

      console.log(`📊 Filtered ${validRecords.length} valid records out of ${attendanceData.data.length} total records`);

      // Group records by employee and date
      validRecords.forEach(record => {
        try {
          const employeeId = record.uid || record.userId || record.deviceUserId;
          const rawTimestamp = record.timestamp || record.recordTime;
          const timestamp = new Date(rawTimestamp);
          
          if (!timestamp || isNaN(timestamp.getTime())) {
            console.warn(`⚠️ Invalid timestamp for employee ${employeeId}: ${rawTimestamp}`);
            return;
          }
          
          // Use Pakistan timezone for date key generation
          const dateKey = timestamp.toLocaleDateString('en-CA', { 
            timeZone: 'Asia/Karachi' 
          }); // YYYY-MM-DD format in Pakistan timezone
          const key = `${employeeId}-${dateKey}`;
          
          if (!employeeAttendance.has(key)) {
            employeeAttendance.set(key, {
              employeeId,
              date: timestamp,
              checkInTime: null,
              checkOutTime: null,
              deviceId: 'ZKTeco Device',
              method: 'Biometric',
              location: 'Office',
              times: []
            });
          }

          const attendance = employeeAttendance.get(key);
          attendance.times.push(timestamp);
        } catch (error) {
          console.error(`Error processing attendance record for employee ${record.uid || record.userId}:`, error);
        }
      });

      // Process each employee's attendance
      let processed = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;
      const errorDetails = [];

      for (const [key, attendanceData] of employeeAttendance) {
        try {
          // Sort times for this date
          attendanceData.times.sort((a, b) => a - b);
          
          // First time is check-in, last time is check-out
          const checkInTime = attendanceData.times[0];
          const checkOutTime = attendanceData.times.length > 1 ? attendanceData.times[attendanceData.times.length - 1] : null;

          // Find employee
          const employee = await Employee.findOne({ 
            $or: [
              { employeeId: attendanceData.employeeId.toString() },
              { employeeId: attendanceData.employeeId }
            ],
            isDeleted: false
          });

          if (!employee) {
            console.warn(`⚠️ Employee not found: ${attendanceData.employeeId}`);
            errors++;
            errorDetails.push({
              employeeId: attendanceData.employeeId,
              error: 'Employee not found'
            });
            continue;
          }

          // Set date to start of day in Pakistan timezone
          const attendanceDate = new Date(checkInTime);
          attendanceDate.setHours(0, 0, 0, 0);

          // Find existing attendance record for this employee and date
          let attendance = await Attendance.findOne({
            employee: employee._id,
            date: {
              $gte: attendanceDate,
              $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
            },
            isActive: true
          });

          if (!attendance) {
            // Create new attendance record
            attendance = new Attendance({
              employee: employee._id,
              date: attendanceDate,
              status: 'Present',
              checkIn: {
                time: checkInTime,
                location: attendanceData.location,
                method: attendanceData.method,
                deviceId: attendanceData.deviceId
              },
              checkOut: checkOutTime ? {
                time: checkOutTime,
                location: attendanceData.location,
                method: attendanceData.method,
                deviceId: attendanceData.deviceId
              } : {},
              isActive: true
            });

            await attendance.save();
            created++;
            console.log(`✅ Created attendance for ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${checkInTime.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })}`);
          } else {
            // Update existing attendance record
            let needsUpdate = false;

            // Update check-in if earlier time found
            if (!attendance.checkIn?.time || checkInTime < attendance.checkIn.time) {
              attendance.checkIn = {
                time: checkInTime,
                location: attendanceData.location,
                method: attendanceData.method,
                deviceId: attendanceData.deviceId
              };
              needsUpdate = true;
            }

            // Update check-out if later time found
            if (checkOutTime && (!attendance.checkOut?.time || checkOutTime > attendance.checkOut.time)) {
              attendance.checkOut = {
                time: checkOutTime,
                location: attendanceData.location,
                method: attendanceData.method,
                deviceId: attendanceData.deviceId
              };
              needsUpdate = true;
            }

            if (needsUpdate) {
              await attendance.save();
              updated++;
              console.log(`🔄 Updated attendance for ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
            }
          }

          processed++;
        } catch (error) {
          console.error(`❌ Error processing attendance for employee ${attendanceData.employeeId}:`, error);
          errors++;
          errorDetails.push({
            employeeId: attendanceData.employeeId,
            error: error.message
          });
        }
      }

      console.log(`\n📊 ZKTeco sync completed:`);
      console.log(`   Processed: ${processed} records`);
      console.log(`   Created: ${created} new records`);
      console.log(`   Updated: ${updated} existing records`);
      console.log(`   Errors: ${errors} errors`);

      return {
        success: true,
        message: 'ZKTeco attendance data synced successfully',
        data: {
          processed,
          created,
          updated,
          errors,
          errorDetails
        }
      };

    } catch (error) {
      console.error('❌ Error syncing ZKTeco attendance:', error);
      return {
        success: false,
        message: error.message,
        data: {
          processed: 0,
          created: 0,
          updated: 0,
          errors: 1,
          errorDetails: [{ error: error.message }]
        }
      };
    }
  }

  // Sync Hikvision attendance
  async syncHikvisionAttendance(integration, startDate, endDate) {
    // Implementation for Hikvision devices
    // This would use the integration configuration to connect to Hikvision devices
    return [];
  }

  // Sync Suprema attendance
  async syncSupremaAttendance(integration, startDate, endDate) {
    // Implementation for Suprema devices
    // This would use the integration configuration to connect to Suprema devices
    return [];
  }

  // Sync generic attendance
  async syncGenericAttendance(integration, startDate, endDate) {
    // Implementation for generic devices
    // This would use the integration configuration to connect to generic devices
    return [];
  }

  // Get attendance statistics
  async getAttendanceStatistics(startDate, endDate, department = null) {
    try {
      const matchStage = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        isActive: true
      };

      if (department) {
        matchStage['employeeData.department'] = department;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        { $unwind: '$employeeData' },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Present'] }, 1, 0]
              }
            },
            absentCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0]
              }
            },
            lateCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Late'] }, 1, 0]
              }
            },
            leaveCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['Leave', 'Sick Leave', 'Personal Leave']] }, 1, 0]
              }
            },
            totalWorkHours: { $sum: '$workHours' },
            totalOvertimeHours: { $sum: '$overtimeHours' },
            averageWorkHours: { $avg: '$workHours' }
          }
        }
      ];

      const stats = await Attendance.aggregate(pipeline);
      return stats[0] || {
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        leaveCount: 0,
        totalWorkHours: 0,
        totalOvertimeHours: 0,
        averageWorkHours: 0
      };
    } catch (error) {
      console.error('Error getting attendance statistics:', error);
      throw error;
    }
  }

  // Get attendance statistics for all records (not just current page)
  async getAttendanceStatisticsAll(filters = {}) {
    try {
      const { department, status, startDate, endDate } = filters;

      // Get today's date (start and end of day)
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const query = { 
        isActive: true,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      };

      // Add filters
      if (status) {
        query.status = status;
      }
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Build aggregation pipeline for statistics
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        { $unwind: '$employeeData' }
      ];

      // Add department filter if specified
      if (department) {
        pipeline.push({
          $match: {
            'employeeData.department': new mongoose.Types.ObjectId(department)
          }
        });
      }

      // Get latest record per employee for today's statistics
      pipeline.push(
        {
          $sort: { date: -1 }
        },
        {
          $group: {
            _id: '$employee',
            latestRecord: { $first: '$$ROOT' }
          }
        },
        {
          $replaceRoot: { newRoot: '$latestRecord' }
        }
      );

      // Add projection for statistics
      pipeline.push({
        $project: {
          status: 1,
          checkIn: 1,
          checkOut: 1,
          employee: {
            _id: '$employeeData._id',
            firstName: '$employeeData.firstName',
            lastName: '$employeeData.lastName',
            employeeId: '$employeeData.employeeId',
            department: '$employeeData.department'
          }
        }
      });

      const attendanceRecords = await Attendance.aggregate(pipeline);

      // Get total active employees for absent calculation
      const employeeQuery = { isDeleted: false };
      if (department) {
        employeeQuery.placementDepartment = new mongoose.Types.ObjectId(department);
      }

      const totalEmployees = await Employee.countDocuments(employeeQuery);
      const employeesWithAttendance = attendanceRecords.length;

      // Calculate statistics from today's unique employee records
      const totalRecords = employeesWithAttendance;
      const presentToday = attendanceRecords.filter(record => record.status === 'Present').length;
      const lateToday = attendanceRecords.filter(record => record.status === 'Late').length;
      const absentToday = totalEmployees - employeesWithAttendance;
      const biometricRecords = attendanceRecords.filter(record => 
        record.checkIn?.method === 'Biometric' || record.checkOut?.method === 'Biometric'
      ).length;

      return {
        success: true,
        data: {
          totalRecords,
          presentToday,
          lateToday,
          absentToday,
          biometricRecords,
          totalEmployees
        }
      };
    } catch (error) {
      console.error('Error getting attendance statistics:', error);
      throw error;
    }
  }

  // Start automatic sync for an integration
  async startAutoSync(integrationId) {
    try {
      const integration = await BiometricIntegration.findById(integrationId);
      if (!integration || !integration.syncConfig.autoSync) {
        return { success: false, message: 'Integration not found or auto-sync not enabled' };
      }

      // Clear existing interval if any
      if (this.syncIntervals.has(integrationId)) {
        clearInterval(this.syncIntervals.get(integrationId));
      }

      // Start new interval
      const interval = setInterval(async () => {
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours
          
          await this.syncBiometricAttendance(integrationId, startDate, endDate);
        } catch (error) {
          console.error(`Auto-sync error for integration ${integrationId}:`, error);
        }
      }, integration.syncConfig.syncInterval * 60 * 1000);

      this.syncIntervals.set(integrationId, interval);

      return { success: true, message: 'Auto-sync started successfully' };
    } catch (error) {
      console.error('Error starting auto-sync:', error);
      throw error;
    }
  }

  // Stop automatic sync for an integration
  async stopAutoSync(integrationId) {
    try {
      if (this.syncIntervals.has(integrationId)) {
        clearInterval(this.syncIntervals.get(integrationId));
        this.syncIntervals.delete(integrationId);
        return { success: true, message: 'Auto-sync stopped successfully' };
      }
      return { success: false, message: 'No auto-sync running for this integration' };
    } catch (error) {
      console.error('Error stopping auto-sync:', error);
      throw error;
    }
  }

  // Get real-time attendance status
  async getRealTimeAttendance() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await Attendance.find({
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        isActive: true
      }).populate('employee', 'firstName lastName employeeId department');

      const present = attendance.filter(a => a.status === 'Present').length;
      const absent = attendance.filter(a => a.status === 'Absent').length;
      const late = attendance.filter(a => a.status === 'Late').length;
      const onLeave = attendance.filter(a => ['Leave', 'Sick Leave', 'Personal Leave'].includes(a.status)).length;

      return {
        success: true,
        data: {
          total: attendance.length,
          present,
          absent,
          late,
          onLeave,
          attendance: attendance.map(a => ({
            employee: a.employee,
            checkIn: a.checkIn?.time,
            checkOut: a.checkOut?.time,
            status: a.status,
            workHours: a.workHours
          }))
        }
      };
    } catch (error) {
      console.error('Error getting real-time attendance:', error);
      throw error;
    }
  }

  // Get all attendance records for a specific employee
  async getEmployeeAttendanceHistory(employeeId, limit = 30) {
    try {
      const pipeline = [
        {
          $match: {
            employee: new mongoose.Types.ObjectId(employeeId),
            isActive: true
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        { $unwind: '$employeeData' },
        {
          $sort: { date: -1 }
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            _id: 1,
            date: 1,
            status: 1,
            checkIn: 1,
            checkOut: 1,
            workHours: 1,
            overtimeHours: 1,
            notes: 1,
            createdAt: 1,
            employee: {
              _id: '$employeeData._id',
              firstName: '$employeeData.firstName',
              lastName: '$employeeData.lastName',
              employeeId: '$employeeData.employeeId',
              department: '$employeeData.department',
              position: '$employeeData.position'
            }
          }
        }
      ];

      const attendanceHistory = await Attendance.aggregate(pipeline);

      return {
        success: true,
        data: attendanceHistory,
        total: attendanceHistory.length
      };
    } catch (error) {
      console.error('Error fetching employee attendance history:', error);
      throw error;
    }
  }

  // Get employees who are absent today
  async getAbsentEmployees(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        department,
        employee,
        sortBy = 'firstName',
        sortOrder = 'asc'
      } = filters;

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      // Build employee query
      const employeeQuery = { isDeleted: false };
      if (department) {
        employeeQuery.placementDepartment = new mongoose.Types.ObjectId(department);
      }

      // Get all employees
      const allEmployees = await Employee.find(employeeQuery)
        .populate('placementDepartment', 'name')
        .populate('placementDesignation', 'title')
        .lean();

      // Get employees who have attendance today
      const attendanceQuery = {
        isActive: true,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      };

      const employeesWithAttendance = await Attendance.distinct('employee', attendanceQuery);

      // Find employees who don't have attendance (absent)
      const absentEmployees = allEmployees.filter(emp => 
        !employeesWithAttendance.some(attendanceId => 
          attendanceId.toString() === emp._id.toString()
        )
      );

      // Apply employee name filter if specified
      let filteredAbsentEmployees = absentEmployees;
      if (employee) {
        filteredAbsentEmployees = absentEmployees.filter(emp => 
          emp.firstName?.toLowerCase().includes(employee.toLowerCase()) ||
          emp.lastName?.toLowerCase().includes(employee.toLowerCase()) ||
          emp.employeeId?.toLowerCase().includes(employee.toLowerCase())
        );
      }

      // Sort the results
      filteredAbsentEmployees.sort((a, b) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        if (sortOrder === 'desc') {
          return bValue.localeCompare(aValue);
        }
        return aValue.localeCompare(bValue);
      });

      // Apply pagination
      const total = filteredAbsentEmployees.length;
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedEmployees = filteredAbsentEmployees.slice(startIndex, endIndex);

      // Convert to attendance-like format for consistency
      const absentRecords = paginatedEmployees.map(emp => ({
        _id: `absent_${emp._id}`,
        date: today,
        status: 'Absent',
        checkIn: null,
        checkOut: null,
        workHours: 0,
        overtimeHours: 0,
        notes: 'No attendance record for today',
        createdAt: today,
        employee: {
          _id: emp._id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeId: emp.employeeId,
          department: emp.placementDepartment,
          position: emp.placementDesignation
        }
      }));

      return {
        success: true,
        data: absentRecords,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error('Error fetching absent employees:', error);
      throw error;
    }
  }
}

module.exports = new AttendanceService(); 