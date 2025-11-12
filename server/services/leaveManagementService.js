const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeavePolicy = require('../models/hr/LeavePolicy');
const Employee = require('../models/hr/Employee');
const LeaveBalance = require('../models/hr/LeaveBalance');
const Attendance = require('../models/hr/Attendance');
const Payroll = require('../models/hr/Payroll');
const mongoose = require('mongoose');
const LeaveIntegrationService = require('./leaveIntegrationService');

class LeaveManagementService {
  // Initialize default leave types
  static async initializeDefaultLeaveTypes() {
    const defaultLeaveTypes = [
      {
        name: 'Annual Leave',
        code: 'ANNUAL',
        description: 'Annual vacation leave',
        daysPerYear: 20,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 20,
        advanceNoticeDays: 1,
        carryForwardAllowed: true,
        maxCarryForwardDays: 10,
        color: '#3B82F6'
      },
      {
        name: 'Casual Leave',
        code: 'CASUAL',
        description: 'Casual leave for personal matters',
        daysPerYear: 10,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 5,
        advanceNoticeDays: 1,
        carryForwardAllowed: false,
        color: '#10B981'
      },
      {
        name: 'Sick Leave',
        code: 'SICK',
        description: 'Sick leave for medical reasons',
        daysPerYear: 10,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 10,
        advanceNoticeDays: 0,
        carryForwardAllowed: false,
        requiresMedicalCertificate: true,
        color: '#EF4444'
      },
      {
        name: 'Medical Leave',
        code: 'MEDICAL',
        description: 'Medical leave for health issues',
        daysPerYear: 10,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 10,
        advanceNoticeDays: 0,
        carryForwardAllowed: false,
        requiresMedicalCertificate: true,
        color: '#DC2626'
      },
      {
        name: 'Maternity Leave',
        code: 'MATERNITY',
        description: 'Maternity leave for female employees',
        daysPerYear: 90,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 90,
        advanceNoticeDays: 30,
        carryForwardAllowed: false,
        color: '#F59E0B'
      },
      {
        name: 'Paternity Leave',
        code: 'PATERNITY',
        description: 'Paternity leave for male employees',
        daysPerYear: 7,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 7,
        advanceNoticeDays: 7,
        carryForwardAllowed: false,
        color: '#8B5CF6'
      }
    ];

    for (const leaveTypeData of defaultLeaveTypes) {
      const existingType = await LeaveType.findOne({ code: leaveTypeData.code });
      if (!existingType) {
        await LeaveType.create(leaveTypeData);
        console.log(`✅ Created default leave type: ${leaveTypeData.name}`);
      }
    }
  }

  // Initialize default leave policy
  static async initializeDefaultLeavePolicy() {
    const existingPolicy = await LeavePolicy.findOne({ isDefault: true });
    if (!existingPolicy) {
      const defaultPolicy = {
        name: 'Default Leave Policy',
        description: 'Default leave policy for all employees',
        leaveAllocation: {
          annual: {
            days: 20,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: true,
              maxDays: 10,
              expiryMonths: 12
            }
          },
          casual: {
            days: 10,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: false,
              maxDays: 0
            }
          },
          medical: {
            days: 10,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: false,
              maxDays: 0
            },
            requiresCertificate: true,
            certificateRequiredAfterDays: 3
          }
        },
        probationRules: {
          duration: 3,
          leaveEligibility: 'reduced_leave',
          reducedLeavePercentage: 50
        },
        applicationRules: {
          advanceNoticeDays: 1,
          emergencyLeaveAllowed: true,
          maxConsecutiveDays: 30,
          maxLeaveDaysPerMonth: 5,
          requireManagerApproval: true,
          requireHRApproval: false,
          autoApproveDays: 0
        },
        workingDays: {
          daysPerWeek: 6,
          workingDaysPerMonth: 26,
          excludeWeekends: true,
          excludeHolidays: true
        },
        effectiveFrom: new Date(),
        applicableTo: {
          employmentTypes: ['permanent', 'contract', 'probation'],
          departments: [],
          designations: []
        },
        isDefault: true,
        isActive: true
      };

      await LeavePolicy.create(defaultPolicy);
      console.log('✅ Created default leave policy');
    }
  }

  // Apply for leave
  static async applyForLeave(leaveData, userId) {
    try {
      // Validate employee
      const employee = await Employee.findById(leaveData.employee);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Validate leave type
      const leaveType = await LeaveType.findById(leaveData.leaveType);
      if (!leaveType) {
        throw new Error('Leave type not found');
      }

      // Normalize dates
      const leaveStartDate = new Date(leaveData.startDate);
      const leaveEndDate = new Date(leaveData.endDate);
      if (Number.isNaN(leaveStartDate.getTime()) || Number.isNaN(leaveEndDate.getTime())) {
        throw new Error('Invalid leave start or end date');
      }

      // Determine work year based on leave period (anniversary-based)
      const leaveWorkYear = LeaveIntegrationService.calculateWorkYear(employee.hireDate, leaveStartDate);
      const hireDateObj = new Date(employee.hireDate);
      const leaveYear = Math.max(hireDateObj.getFullYear() + 1, hireDateObj.getFullYear() + leaveWorkYear + 1);

      // Check leave balance using the appropriate work year
      const leaveBalance = await LeaveIntegrationService.getWorkYearBalance(leaveData.employee, leaveWorkYear);
      
      // Calculate if this will result in advance leaves
      let willBeAdvance = false;
      let advanceDays = 0;
      let availableDays = 0;
      
      if (leaveType.code === 'ANNUAL' || leaveType.code === 'AL') {
        availableDays = leaveBalance.annual.remaining;
        if (leaveBalance.annual.remaining < leaveData.totalDays) {
          willBeAdvance = true;
          advanceDays = leaveData.totalDays - leaveBalance.annual.remaining;
        }
      } else if (leaveType.code === 'CASUAL' || leaveType.code === 'CL') {
        availableDays = leaveBalance.casual.remaining;
        if (leaveBalance.casual.remaining < leaveData.totalDays) {
          willBeAdvance = true;
          advanceDays = leaveData.totalDays - leaveBalance.casual.remaining;
        }
      } else if (leaveType.code === 'MEDICAL' || leaveType.code === 'SICK' || leaveType.code === 'ML' || leaveType.code === 'SL') {
        availableDays = leaveBalance.sick.remaining;
        if (leaveBalance.sick.remaining < leaveData.totalDays) {
          willBeAdvance = true;
          advanceDays = leaveData.totalDays - leaveBalance.sick.remaining;
        }
      }
      
      // Log warning if advance leaves will be created, but don't reject
      if (willBeAdvance) {
        console.log(`⚠️ Leave request will create ${advanceDays} advance days (${advanceDays} days beyond available ${availableDays} days)`);
      }

      // Check for overlapping leaves
      const overlappingLeaves = await this.checkOverlappingLeaves(leaveData.employee, leaveStartDate, leaveEndDate);
      if (overlappingLeaves.length > 0) {
        throw new Error('Leave request overlaps with existing approved leave');
      }

      // Create leave request
      const leaveRequest = new LeaveRequest({
        ...leaveData,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        createdBy: userId,
        leaveYear,
        workYear: leaveWorkYear
      });

      await leaveRequest.save();

      // Update employee leave requests
      await Employee.findByIdAndUpdate(leaveData.employee, {
        $push: { leaveRequests: leaveRequest._id }
      });

      return leaveRequest;
    } catch (error) {
      throw error;
    }
  }

  // Get employee leave balance
  static async getEmployeeLeaveBalance(employeeId, year = new Date().getFullYear()) {
    try {
      // Use the new LeaveIntegrationService to get proper anniversary-based balance
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      const currentWorkYear = LeaveIntegrationService.calculateWorkYear(employee.hireDate);
      const balance = await LeaveIntegrationService.getWorkYearBalance(employeeId, currentWorkYear);
      
      // Return the balance in the format expected by the frontend
      return balance.getSummary();
    } catch (error) {
      console.error(`Error getting leave balance for employee ${employeeId}:`, error);
      
      // Return default balance if calculation fails
      return {
        annual: { allocated: 20, used: 0, remaining: 20, carriedForward: 0, advance: 0 },
        casual: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 },
        sick: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 },
        medical: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 }
      };
    }
  }

  // Update leave balance when leave is approved
  static async updateLeaveBalance(employeeId, leaveTypeId, days, year) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get leave type
      const leaveType = await LeaveType.findById(leaveTypeId);
      if (!leaveType) {
        throw new Error('Leave type not found');
      }

      // Update employee leave balance based on leave type name
      const leaveTypeName = leaveType.name.toLowerCase();
      
      if (leaveTypeName.includes('annual')) {
        employee.leaveBalance.annual.used += days;
        employee.leaveBalance.annual.remaining = Math.max(0, 
          employee.leaveBalance.annual.allocated - 
          employee.leaveBalance.annual.used + 
          employee.leaveBalance.annual.carriedForward
        );
      } else if (leaveTypeName.includes('casual')) {
        employee.leaveBalance.casual.used += days;
        employee.leaveBalance.casual.remaining = Math.max(0,
          employee.leaveBalance.casual.allocated - 
          employee.leaveBalance.casual.used + 
          employee.leaveBalance.casual.carriedForward
        );
      } else if (leaveTypeName.includes('medical')) {
        employee.leaveBalance.medical.used += days;
        employee.leaveBalance.medical.remaining = Math.max(0,
          employee.leaveBalance.medical.allocated - 
          employee.leaveBalance.medical.used + 
          employee.leaveBalance.medical.carriedForward
        );
      }

      employee.lastLeaveBalanceUpdate = new Date();
      
      // Save only the leave balance fields to avoid validation errors
      await Employee.findByIdAndUpdate(employeeId, {
        $set: {
          'leaveBalance.annual.used': employee.leaveBalance.annual.used,
          'leaveBalance.annual.remaining': employee.leaveBalance.annual.remaining,
          'leaveBalance.casual.used': employee.leaveBalance.casual.used,
          'leaveBalance.casual.remaining': employee.leaveBalance.casual.remaining,
          'leaveBalance.medical.used': employee.leaveBalance.medical.used,
          'leaveBalance.medical.remaining': employee.leaveBalance.medical.remaining,
          lastLeaveBalanceUpdate: employee.lastLeaveBalanceUpdate
        }
      });
    } catch (error) {
      throw error;
    }
  }

  // Initialize leave balance for new employee
  static async initializeEmployeeLeaveBalance(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get active leave policy
      const policy = await LeavePolicy.getActivePolicy();
      if (!policy) {
        throw new Error('No active leave policy found');
      }

      // Calculate prorated allocation based on joining date
      const joiningDate = new Date(employee.joiningDate);
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);
      
      const calculateProratedAllocation = (annualDays) => {
        if (joiningDate <= yearStart) {
          return annualDays;
        } else if (joiningDate <= yearEnd) {
          const monthsRemaining = 12 - joiningDate.getMonth();
          return Math.round((annualDays / 12) * monthsRemaining);
        } else {
          return 0;
        }
      };

      // Initialize leave balance
      employee.leaveBalance = {
        annual: {
          allocated: calculateProratedAllocation(policy.leaveAllocation.annual.days),
          used: 0,
          remaining: calculateProratedAllocation(policy.leaveAllocation.annual.days),
          carriedForward: 0
        },
        casual: {
          allocated: calculateProratedAllocation(policy.leaveAllocation.casual.days),
          used: 0,
          remaining: calculateProratedAllocation(policy.leaveAllocation.casual.days),
          carriedForward: 0
        },
        medical: {
          allocated: calculateProratedAllocation(policy.leaveAllocation.medical.days),
          used: 0,
          remaining: calculateProratedAllocation(policy.leaveAllocation.medical.days),
          carriedForward: 0
        },
        maternity: {
          allocated: 0, // Maternity leave not in policy, set to 0
          used: 0,
          remaining: 0
        },
        paternity: {
          allocated: 0, // Paternity leave not in policy, set to 0
          used: 0,
          remaining: 0
        }
      };

      employee.lastLeaveBalanceUpdate = new Date();
      
      // Save only the leave balance fields to avoid validation errors
      await Employee.findByIdAndUpdate(employeeId, {
        $set: {
          'leaveBalance.annual.allocated': employee.leaveBalance.annual.allocated,
          'leaveBalance.annual.used': employee.leaveBalance.annual.used,
          'leaveBalance.annual.remaining': employee.leaveBalance.annual.remaining,
          'leaveBalance.annual.carriedForward': employee.leaveBalance.annual.carriedForward,
          'leaveBalance.casual.allocated': employee.leaveBalance.casual.allocated,
          'leaveBalance.casual.used': employee.leaveBalance.casual.used,
          'leaveBalance.casual.remaining': employee.leaveBalance.casual.remaining,
          'leaveBalance.casual.carriedForward': employee.leaveBalance.casual.carriedForward,
          'leaveBalance.medical.allocated': employee.leaveBalance.medical.allocated,
          'leaveBalance.medical.used': employee.leaveBalance.medical.used,
          'leaveBalance.medical.remaining': employee.leaveBalance.medical.remaining,
          'leaveBalance.medical.carriedForward': employee.leaveBalance.medical.carriedForward,
          'leaveBalance.maternity.allocated': employee.leaveBalance.maternity.allocated,
          'leaveBalance.maternity.used': employee.leaveBalance.maternity.used,
          'leaveBalance.maternity.remaining': employee.leaveBalance.maternity.remaining,
          'leaveBalance.paternity.allocated': employee.leaveBalance.paternity.allocated,
          'leaveBalance.paternity.used': employee.leaveBalance.paternity.used,
          'leaveBalance.paternity.remaining': employee.leaveBalance.paternity.remaining,
          lastLeaveBalanceUpdate: employee.lastLeaveBalanceUpdate
        }
      });
    } catch (error) {
      throw error;
    }
  }

  // Check for overlapping leaves
  static async checkOverlappingLeaves(employeeId, startDate, endDate, excludeLeaveId = null) {
    const query = {
      employee: employeeId,
      status: 'approved',
      isActive: true,
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ]
    };

    if (excludeLeaveId) {
      query._id = { $ne: excludeLeaveId };
    }

    return await LeaveRequest.find(query);
  }

  // Approve leave request
  static async approveLeaveRequest(leaveRequestId, userId, comments = '') {
    try {
      const leaveRequest = await LeaveRequest.findById(leaveRequestId);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.status !== 'pending') {
        throw new Error('Leave request is not pending');
      }

      // Update leave request
      leaveRequest.status = 'approved';
      leaveRequest.approvedBy = userId;
      leaveRequest.approvedDate = new Date();
      leaveRequest.approvalComments = comments;
      leaveRequest.updatedBy = userId;

      await leaveRequest.save();

      // Update employee leave balance (backward compatibility)
      await this.updateLeaveBalance(
        leaveRequest.employee, 
        leaveRequest.leaveType, 
        leaveRequest.totalDays, 
        leaveRequest.startDate.getFullYear()
      );

      // Update leave balance using new integration service
      await LeaveIntegrationService.updateBalanceOnApproval(leaveRequestId);

      // Create attendance records for leave days
      await this.createLeaveAttendanceRecords(leaveRequest);

      return leaveRequest;
    } catch (error) {
      throw error;
    }
  }

  // Reject leave request
  static async rejectLeaveRequest(leaveRequestId, userId, reason = '') {
    try {
      const leaveRequest = await LeaveRequest.findById(leaveRequestId);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.status !== 'pending') {
        throw new Error('Leave request is not pending');
      }

      leaveRequest.status = 'rejected';
      leaveRequest.rejectedBy = userId;
      leaveRequest.rejectedDate = new Date();
      leaveRequest.rejectionReason = reason;
      leaveRequest.updatedBy = userId;

      await leaveRequest.save();

      return leaveRequest;
    } catch (error) {
      throw error;
    }
  }

  // Update employee leave balance
  static async updateEmployeeLeaveBalance(employeeId, year) {
    try {
      const balance = await this.getEmployeeLeaveBalance(employeeId, year);
      
      await Employee.findByIdAndUpdate(employeeId, {
        $set: {
          'leaveBalance.annual': balance.annual,
          'leaveBalance.casual': balance.casual,
          'leaveBalance.medical': balance.medical,
          lastLeaveBalanceUpdate: new Date()
        }
      });
    } catch (error) {
      throw error;
    }
  }

  // Create attendance records for leave days
  static async createLeaveAttendanceRecords(leaveRequest) {
    try {
      const employee = await Employee.findById(leaveRequest.employee);
      const leaveType = await LeaveType.findById(leaveRequest.leaveType);

      const startDate = new Date(leaveRequest.startDate);
      const endDate = new Date(leaveRequest.endDate);

      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        // Skip weekends if policy excludes them
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) continue; // Skip Sunday

        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        // Check if attendance record already exists
        const existingAttendance = await Attendance.findOne({
          employee: leaveRequest.employee,
          date: attendanceDate,
          isActive: true
        });

        if (!existingAttendance) {
          // Create new attendance record for leave
          const attendance = new Attendance({
            employee: leaveRequest.employee,
            date: attendanceDate,
            status: 'Leave',
            notes: `${leaveType.name} - ${leaveRequest.reason}`,
            isActive: true,
            createdBy: leaveRequest.createdBy
          });

          await attendance.save();

          // Add attendance record reference to leave request
          leaveRequest.attendanceRecords.push(attendance._id);
        }
      }

      await leaveRequest.save();
    } catch (error) {
      throw error;
    }
  }

  // Get leave requests with filters
  static async getLeaveRequests(filters = {}) {
    try {
      const {
        employee,
        status,
        leaveType,
        startDate,
        endDate,
        year,
        page = 1,
        limit = 100,
        sortBy = 'appliedDate',
        sortOrder = 'desc'
      } = filters;

      const query = { isActive: true };

      if (employee) query.employee = employee;
      if (status) query.status = status;
      if (leaveType) query.leaveType = leaveType;
      if (year) query.leaveYear = year;
      if (startDate && endDate) {
        query.$or = [
          {
            startDate: { $gte: startDate, $lte: endDate }
          },
          {
            endDate: { $gte: startDate, $lte: endDate }
          },
          {
            startDate: { $lte: startDate },
            endDate: { $gte: endDate }
          }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const leaveRequests = await LeaveRequest.find(query)
        .populate('employee', 'firstName lastName employeeId email')
        .populate('leaveType', 'name code color')
        .populate('approvedBy', 'firstName lastName')
        .populate('rejectedBy', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const total = await LeaveRequest.countDocuments(query);

      return {
        leaveRequests,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get leave calendar data
  static async getLeaveCalendar(year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const leaveRequests = await LeaveRequest.find({
        status: 'approved',
        isActive: true,
        $or: [
          {
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
          }
        ]
      })
        .populate('employee', 'firstName lastName employeeId')
        .populate('leaveType', 'name code color');

      return leaveRequests;
    } catch (error) {
      throw error;
    }
  }

  // Process leave carry forward
  static async processLeaveCarryForward(year) {
    try {
      const employees = await Employee.find({ isActive: true });
      const policy = await LeavePolicy.getActivePolicy();

      for (const employee of employees) {
        const balance = await this.getEmployeeLeaveBalance(employee._id, year);
        
        // Process carry forward for annual leave
        if (policy.leaveAllocation.annual.carryForward.allowed) {
          const carryForwardDays = Math.min(
            balance.annual.remaining,
            policy.leaveAllocation.annual.carryForward.maxDays
          );

          if (carryForwardDays > 0) {
            await Employee.findByIdAndUpdate(employee._id, {
              $set: {
                'leaveBalance.annual.carriedForward': carryForwardDays,
                lastLeaveBalanceUpdate: new Date()
              }
            });
          }
        }
      }

      console.log(`✅ Processed leave carry forward for year ${year}`);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = LeaveManagementService;
