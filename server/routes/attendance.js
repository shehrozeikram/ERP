const express = require('express');
const router = express.Router();
const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { authMiddleware } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');

// Get all attendance records with pagination and filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('=== ATTENDANCE GET REQUEST ===');
    console.log('Query params:', req.query);
    
    const {
      page = 1,
      limit = 10,
      employee,
      department,
      status,
      startDate,
      endDate,
      isApproved,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Add filters
    if (employee) {
      query.employee = employee;
    }
    if (status) {
      query.status = status;
    }
    if (isApproved !== undefined && isApproved !== '') {
      query.isApproved = isApproved === 'true';
    }
    if (startDate && endDate && startDate !== 'null' && endDate !== 'null') {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
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
          'employeeData.department': department
        }
      });
    }

    // Add sorting
    pipeline.push({
      $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
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

    console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

    const attendance = await Attendance.aggregate(pipeline);
    console.log('Found attendance records:', attendance.length);

    // Get total count for pagination
    const countPipeline = [
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
      countPipeline.push({
        $match: {
          'employeeData.department': department
        }
      });
    }

    countPipeline.push({ $count: 'total' });

    const countResult = await Attendance.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    console.log('Total records count:', total);

    res.json({
      success: true,
      data: attendance,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        totalRecords: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get single attendance record
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Create new attendance record
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('=== ATTENDANCE CREATE REQUEST ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const {
      employee,
      date,
      checkIn,
      checkOut,
      status,
      notes
    } = req.body;

    // Check if attendance record already exists for this employee and date
    const existingAttendance = await Attendance.findOne({
      employee,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lt: new Date(date).setHours(23, 59, 59, 999)
      },
      isActive: true
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance record already exists for this employee on this date'
      });
    }

    // Validate employee exists
    const employeeExists = await Employee.findById(employee);
    if (!employeeExists) {
      return res.status(400).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const attendanceData = {
      employee,
      date,
      checkIn,
      checkOut,
      status,
      notes,
      createdBy: req.user ? req.user.id : null
    };

    console.log('Creating attendance with data:', attendanceData);

    const attendance = new Attendance(attendanceData);
    await attendance.save();

    console.log('Attendance saved successfully with ID:', attendance._id);

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employee', 'firstName lastName employeeId department position');

    res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      data: populatedAttendance
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Update attendance record
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('=== ATTENDANCE UPDATE REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Attendance ID:', req.params.id);
    
    const {
      employee,
      date,
      checkIn,
      checkOut,
      status,
      notes,
      isApproved,
      workHours,
      overtimeHours,
      breakTime
    } = req.body;

    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Validate employee exists if being updated
    if (employee) {
      const employeeExists = await Employee.findById(employee);
      if (!employeeExists) {
        return res.status(400).json({
          success: false,
          message: 'Employee not found'
        });
      }
      attendance.employee = employee;
    }
    if (date) attendance.date = date;
    if (checkIn) attendance.checkIn = checkIn;
    if (checkOut) attendance.checkOut = checkOut;
    if (status) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;
    if (workHours !== undefined) attendance.workHours = workHours;
    if (overtimeHours !== undefined) attendance.overtimeHours = overtimeHours;
    if (breakTime !== undefined) attendance.breakTime = breakTime;
    if (isApproved !== undefined) {
      attendance.isApproved = isApproved;
      if (isApproved) {
        attendance.approvedBy = req.user.id;
        attendance.approvedAt = new Date();
      }
    }

    attendance.updatedBy = req.user ? req.user.id : null;
    
    // Recalculate work hours and overtime based on check-in/out times and break time
    if (attendance.checkIn.time && attendance.checkOut.time) {
      const diffMs = attendance.checkOut.time - attendance.checkIn.time;
      const diffHours = diffMs / (1000 * 60 * 60);
      const totalHours = Math.round(diffHours * 100) / 100;
      
      // Subtract break time from total hours to get actual work hours
      const breakTime = attendance.breakTime || 0;
      attendance.workHours = Math.max(0, Math.round((totalHours - breakTime) * 100) / 100);
      
      // Calculate overtime (assuming 8 hours is standard work day)
      attendance.overtimeHours = attendance.workHours > 8 ? Math.round((attendance.workHours - 8) * 100) / 100 : 0;
    }
    
    console.log('Updating attendance with data:', attendance);
    await attendance.save();
    console.log('Attendance updated successfully');

    const updatedAttendance = await Attendance.findById(attendance._id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      data: updatedAttendance
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Delete attendance record (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    attendance.isActive = false;
    attendance.updatedBy = req.user ? req.user.id : null;
    await attendance.save();

    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Bulk create attendance records
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required and cannot be empty'
      });
    }

    const createdRecords = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        const { employee, date, checkIn, checkOut, status, notes } = record;

        // Check if attendance record already exists
        const existingAttendance = await Attendance.findOne({
          employee,
          date: {
            $gte: new Date(date).setHours(0, 0, 0, 0),
            $lt: new Date(date).setHours(23, 59, 59, 999)
          },
          isActive: true
        });

        if (existingAttendance) {
          errors.push({
            index: i,
            error: 'Attendance record already exists for this employee on this date'
          });
          continue;
        }

        // Validate employee exists
        const employeeExists = await Employee.findById(employee);
        if (!employeeExists) {
          errors.push({
            index: i,
            error: 'Employee not found'
          });
          continue;
        }

        const attendanceData = {
          employee,
          date,
          checkIn,
          checkOut,
          status,
          notes,
          createdBy: req.user ? req.user.id : null
        };

        const attendance = new Attendance(attendanceData);
        await attendance.save();

        const populatedAttendance = await Attendance.findById(attendance._id)
          .populate('employee', 'firstName lastName employeeId department position');

        createdRecords.push(populatedAttendance);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdRecords.length} attendance records`,
      data: {
        created: createdRecords,
        errors: errors
      }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get attendance statistics
router.get('/statistics/overview', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await Attendance.getStatistics(start, end);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get department-wise attendance
router.get('/statistics/department', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const departmentStats = await Attendance.getDepartmentAttendance(targetDate);

    res.json({
      success: true,
      data: departmentStats
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get employee attendance history
router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, limit = 30 } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const attendance = await Attendance.findByEmployeeAndDateRange(employeeId, start, end)
      .limit(parseInt(limit))
      .sort({ date: -1 });

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get today's attendance
router.get('/today/overview', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayAttendance = await Attendance.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      isActive: true
    }).populate('employee', 'firstName lastName employeeId department position');

    const stats = {
      total: todayAttendance.length,
      present: todayAttendance.filter(a => a.status === 'Present').length,
      absent: todayAttendance.filter(a => a.status === 'Absent').length,
      late: todayAttendance.filter(a => a.status === 'Late').length,
      leave: todayAttendance.filter(a => ['Leave', 'Sick Leave', 'Personal Leave'].includes(a.status)).length,
      checkedIn: todayAttendance.filter(a => a.checkIn && a.checkIn.time).length,
      checkedOut: todayAttendance.filter(a => a.checkOut && a.checkOut.time).length
    };

    res.json({
      success: true,
      data: {
        stats,
        attendance: todayAttendance
      }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Approve attendance records
router.post('/approve/:id', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    attendance.isApproved = true;
    attendance.approvedBy = req.user.id;
    attendance.approvedAt = new Date();
    attendance.updatedBy = req.user ? req.user.id : null;

    await attendance.save();

    res.json({
      success: true,
      message: 'Attendance record approved successfully'
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Bulk approve attendance records
router.post('/approve/bulk', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IDs array is required and cannot be empty'
      });
    }

    const result = await Attendance.updateMany(
      { _id: { $in: ids }, isActive: true },
      {
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
        updatedBy: req.user ? req.user.id : null
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} attendance records approved successfully`
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Test route to check if attendance is working (no auth required for testing)
router.get('/test/create', async (req, res) => {
  try {
    console.log('=== TEST ATTENDANCE CREATE ===');
    
    // Find first employee
    const employee = await Employee.findOne();
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'No employees found in database'
      });
    }

    console.log('Using employee:', employee._id);

    const testAttendance = new Attendance({
      employee: employee._id,
      date: new Date(),
      checkIn: {
        time: new Date(),
        location: 'Office',
        method: 'Manual'
      },
      checkOut: {
        time: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours later
        location: 'Office',
        method: 'Manual'
      },
      status: 'Present',
      notes: 'Test attendance record',
      createdBy: null // No user for test
    });

    console.log('Test attendance data:', testAttendance);

    await testAttendance.save();
    console.log('Test attendance saved with ID:', testAttendance._id);

    // Try to fetch it
    const savedAttendance = await Attendance.findById(testAttendance._id)
      .populate('employee', 'firstName lastName employeeId department position');

    console.log('Retrieved test attendance:', savedAttendance);

    res.json({
      success: true,
      message: 'Test attendance created successfully',
      data: savedAttendance
    });
  } catch (error) {
    console.error('Test attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 