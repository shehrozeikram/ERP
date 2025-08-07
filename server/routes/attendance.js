const express = require('express');
const router = express.Router();
const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const { authMiddleware } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');
const attendanceService = require('../services/attendanceService');
const zktecoService = require('../services/zktecoService');

// Get all attendance records with pagination and filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await attendanceService.getAttendanceRecords(req.query);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    errorHandler(error, req, res);
  }
});

// Get real-time attendance status
router.get('/realtime', authMiddleware, async (req, res) => {
  try {
    const result = await attendanceService.getRealTimeAttendance();
    res.json(result);
  } catch (error) {
    console.error('Error fetching real-time attendance:', error);
    errorHandler(error, req, res);
  }
});

// Get attendance statistics for all records
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const filters = {
      department: req.query.department,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await attendanceService.getAttendanceStatisticsAll(filters);
    res.json(result);
  } catch (error) {
    console.error('Error fetching attendance statistics:', error);
    errorHandler(error, req, res);
  }
});

// Get single attendance record
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId placementDepartment placementDesignation')
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
    const attendanceData = {
      ...req.body,
      createdBy: req.user.id
    };

    const result = await attendanceService.createOrUpdateAttendance(attendanceData);
    
    res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      data: result.data
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Update attendance record
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'createdBy') {
        attendance[key] = req.body[key];
      }
    });

    attendance.updatedBy = req.user.id;
    await attendance.save();

    const updatedAttendance = await Attendance.findById(attendance._id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('approvedBy', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      data: updatedAttendance
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Delete attendance record
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
    attendance.updatedBy = req.user.id;
    await attendance.save();

    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Approval functionality removed - attendance is automatically approved based on biometric data

// Sync attendance from biometric devices
router.post('/sync-biometric', authMiddleware, async (req, res) => {
  try {
    const { integrationId, startDate, endDate } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({
        success: false,
        message: 'Integration ID is required'
      });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const result = await attendanceService.syncBiometricAttendance(integrationId, start, end);
    
    res.json({
      success: true,
      message: 'Biometric attendance sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error syncing biometric attendance:', error);
    errorHandler(error, req, res);
  }
});

// Sync ZKTeco attendance specifically
router.post('/sync-zkteco', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const result = await attendanceService.syncZKTecoAttendance(start, end);
    
    res.json({
      success: true,
      message: 'ZKTeco attendance sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error syncing ZKTeco attendance:', error);
    errorHandler(error, req, res);
  }
});

// Start automatic sync for biometric integration
router.post('/auto-sync/start/:integrationId', authMiddleware, async (req, res) => {
  try {
    const { integrationId } = req.params;
    
    const result = await attendanceService.startAutoSync(integrationId);
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error starting auto-sync:', error);
    errorHandler(error, req, res);
  }
});

// Stop automatic sync for biometric integration
router.post('/auto-sync/stop/:integrationId', authMiddleware, async (req, res) => {
  try {
    const { integrationId } = req.params;
    
    const result = await attendanceService.stopAutoSync(integrationId);
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error stopping auto-sync:', error);
    errorHandler(error, req, res);
  }
});

// Get attendance by employee and date range
router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const attendance = await Attendance.findByEmployeeAndDateRange(employeeId, start, end);

    res.json({
      success: true,
      data: attendance,
      period: { startDate: start, endDate: end }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get attendance history for a specific employee
router.get('/employee/:employeeId/history', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { limit = 30 } = req.query;

    const result = await attendanceService.getEmployeeAttendanceHistory(employeeId, limit);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching employee attendance history:', error);
    errorHandler(error, req, res);
  }
});

// Get attendance by department and date
router.get('/department/:department', authMiddleware, async (req, res) => {
  try {
    const { department } = req.params;
    const { date } = req.query;

    const attendanceDate = date ? new Date(date) : new Date();
    const attendance = await Attendance.findByDepartmentAndDate(department, attendanceDate);

    res.json({
      success: true,
      data: attendance,
      date: attendanceDate
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
        message: 'Records array is required and must not be empty'
      });
    }

    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: []
    };

    for (const record of records) {
      try {
        const result = await attendanceService.createOrUpdateAttendance({
          ...record,
          createdBy: req.user.id
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

    res.json({
      success: true,
      message: 'Bulk attendance creation completed',
      data: results
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

module.exports = router; 