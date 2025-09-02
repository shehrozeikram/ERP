const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const zkbioTimeApiService = require('../services/zkbioTimeApiService');
const zkbioTimeDatabaseService = require('../services/zkbioTimeDatabaseService');
const zkbioTimeBackgroundService = require('../services/zkbioTimeBackgroundService');

/**
 * GET /api/attendance/zkbio/today
 * Get today's attendance from ZKBio Time API
 */
router.get('/zkbio/today', async (req, res) => {
  try {
    const apiResult = await zkbioTimeApiService.getTodayAttendance();
    
    if (apiResult.success && apiResult.data.length > 0) {
      await zkbioTimeDatabaseService.saveAttendanceRecords(apiResult.data);
      
      const employeeResult = await zkbioTimeApiService.getEmployees();
      const employees = employeeResult.success ? employeeResult.data : [];
      
      const processedData = zkbioTimeApiService.processAttendanceData(apiResult.data, employees);
      
      res.json({
        success: true,
        data: processedData,
        count: processedData.length,
        source: apiResult.source,
        message: `Loaded ${processedData.length} latest attendance records from ZKBio Time API (${apiResult.source})`
      });
    } else {
      res.json({
        success: false,
        data: [],
        count: 0,
        source: 'None',
        message: 'No attendance data found for today'
      });
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance data',
      error: error.message
    });
  }
});

/**
 * POST /api/attendance/zkbio/sync
 * Sync employees and attendance from ZKBio Time
 */
router.post('/zkbio/sync', authMiddleware, async (req, res) => {
  try {
    console.log('🔄 API: Starting ZKBio Time sync...');
    
    const { syncEmployees = true, syncAttendance = true, dateRange } = req.body;
    
    let results = {
      employees: { success: false, count: 0 },
      attendance: { success: false, count: 0 }
    };

    // Sync employees
    if (syncEmployees) {
      console.log('👥 Syncing employees...');
      const employeeResult = await zkbioTimeApiService.getEmployees();
      
      if (employeeResult.success) {
        const saveResult = await zkbioTimeDatabaseService.saveEmployees(employeeResult.data);
        results.employees = {
          success: true,
          count: saveResult.saved,
          failed: saveResult.failed
        };
      }
    }

    // Sync attendance
    if (syncAttendance) {
      console.log('📊 Syncing attendance...');
      
      let attendanceResult;
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        attendanceResult = await zkbioTimeApiService.getAttendanceByDateRange(
          dateRange.startDate, 
          dateRange.endDate
        );
      } else {
        attendanceResult = await zkbioTimeApiService.getTodayAttendance();
      }
      
      if (attendanceResult.success) {
        const saveResult = await zkbioTimeDatabaseService.saveAttendanceRecords(attendanceResult.data);
        results.attendance = {
          success: true,
          count: saveResult.saved,
          failed: saveResult.failed
        };
      }
    }

    res.json({
      success: true,
      message: 'Sync completed successfully',
      results
    });
  } catch (error) {
    console.error('❌ Sync Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    });
  }
});

/**
 * GET /api/attendance/zkbio/employees
 * Get all employees from ZKBio Time
 */
router.get('/zkbio/employees', async (req, res) => {
  try {
    console.log('👥 API: Fetching ZKBio Time employees...');
    
    // First try database
    const dbResult = await zkbioTimeDatabaseService.getAllEmployees();
    
    if (dbResult.success && dbResult.count > 0) {
      res.json({
        success: true,
        data: dbResult.data,
        count: dbResult.count,
        source: 'Database'
      });
      return;
    }

    // If no database data, fetch from API
    const apiResult = await zkbioTimeApiService.getEmployees();
    
    if (apiResult.success) {
      // Save to database
      await zkbioTimeDatabaseService.saveEmployees(apiResult.data);
      
      res.json({
        success: true,
        data: apiResult.data,
        count: apiResult.count,
        source: 'ZKBio Time API'
      });
    } else {
      res.json({
        success: false,
        data: [],
        count: 0,
        message: 'Failed to fetch employees'
      });
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

/**
 * GET /api/attendance/zkbio/departments
 * Get departments from ZKBio Time
 */
router.get('/zkbio/departments', async (req, res) => {
  try {
    console.log('🏢 API: Fetching ZKBio Time departments...');
    
    const result = await zkbioTimeApiService.getDepartments();
    
    res.json(result);
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
});

/**
 * GET /api/attendance/zkbio/areas
 * Get areas from ZKBio Time
 */
router.get('/zkbio/areas', async (req, res) => {
  try {
    console.log('📍 API: Fetching ZKBio Time areas...');
    
    const result = await zkbioTimeApiService.getAreas();
    
    res.json(result);
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch areas',
      error: error.message
    });
  }
});

/**
 * GET /api/attendance/zkbio/date-range
 * Get attendance by date range
 */
router.get('/zkbio/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    console.log(`📊 API: Fetching ZKBio Time attendance from ${startDate} to ${endDate}...`);
    
    // First try database
    const dbResult = await zkbioTimeDatabaseService.getAttendanceByDateRange(startDate, endDate);
    
    if (dbResult.success && dbResult.count > 0) {
      const processedData = zkbioTimeDatabaseService.processAttendanceData(dbResult.data);
      
      res.json({
        success: true,
        data: processedData,
        count: processedData.length,
        source: 'Database'
      });
      return;
    }

    // If no database data, fetch from API
    const apiResult = await zkbioTimeApiService.getAttendanceByDateRange(startDate, endDate);
    
    if (apiResult.success) {
      // Save to database
      await zkbioTimeDatabaseService.saveAttendanceRecords(apiResult.data);
      
      // Get employees for better data
      const employeeResult = await zkbioTimeApiService.getEmployees();
      const employees = employeeResult.success ? employeeResult.data : [];
      
      // Process data for frontend
      const processedData = zkbioTimeApiService.processAttendanceData(apiResult.data, employees);
      
      res.json({
        success: true,
        data: processedData,
        count: processedData.length,
        source: 'ZKBio Time API'
      });
    } else {
      res.json({
        success: false,
        data: [],
        count: 0,
        message: 'No attendance data found for the specified date range'
      });
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance data',
      error: error.message
    });
  }
});

/**
 * GET /api/zkbio/zkbio/background/status
 * Get background service status
 */
router.get('/zkbio/background/status', async (req, res) => {
  try {
    const status = zkbioTimeBackgroundService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting background service status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get background service status'
    });
  }
});

/**
 * POST /api/zkbio/zkbio/background/start
 * Start background service
 */
router.post('/zkbio/background/start', async (req, res) => {
  try {
    zkbioTimeBackgroundService.start();
    res.json({
      success: true,
      message: 'Background service started successfully'
    });
  } catch (error) {
    console.error('Error starting background service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start background service'
    });
  }
});

/**
 * POST /api/zkbio/zkbio/background/stop
 * Stop background service
 */
router.post('/zkbio/background/stop', async (req, res) => {
  try {
    zkbioTimeBackgroundService.stop();
    res.json({
      success: true,
      message: 'Background service stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping background service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop background service'
    });
  }
});

/**
 * POST /api/zkbio/zkbio/background/sync
 * Force immediate sync
 */
router.post('/zkbio/background/sync', async (req, res) => {
  try {
    await zkbioTimeBackgroundService.forceSync();
    res.json({
      success: true,
      message: 'Force sync completed successfully'
    });
  } catch (error) {
    console.error('Error during force sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform force sync'
    });
  }
});

/**
 * PUT /api/zkbio/zkbio/background/interval
 * Update sync interval
 */
router.put('/zkbio/background/interval', async (req, res) => {
  try {
    const { minutes } = req.body;
    if (!minutes || minutes < 1 || minutes > 60) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interval. Must be between 1 and 60 minutes.'
      });
    }
    
    zkbioTimeBackgroundService.updateSyncInterval(minutes);
    res.json({
      success: true,
      message: `Sync interval updated to ${minutes} minutes`
    });
  } catch (error) {
    console.error('Error updating sync interval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sync interval'
    });
  }
});

/**
 * GET /api/zkbio/zkbio/employees/attendance
 * Get all employees with their latest attendance activity (with pagination)
 */
router.get('/zkbio/employees/attendance', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const searchQuery = req.query.search || '';
    
    const result = await zkbioTimeDatabaseService.getEmployeesWithLatestAttendance(page, limit, searchQuery);
    
    res.json({
      success: true,
      data: result.data,
      count: result.count,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    console.error('Error fetching employees with attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee attendance data'
    });
  }
});

/**
 * GET /api/zkbio/zkbio/employees/:employeeId/attendance
 * Get specific employee's complete attendance history
 */
router.get('/zkbio/employees/:employeeId/attendance', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const result = await zkbioTimeDatabaseService.getEmployeeAttendanceHistory(employeeId);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          employee: result.employee,
          attendance: result.attendance
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
  } catch (error) {
    console.error('Error fetching employee attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee attendance history'
    });
  }
});

/**
 * GET /api/zkbio/zkbio/debug/attendance
 * Debug endpoint to check database content
 */
router.get('/zkbio/debug/attendance', async (req, res) => {
  try {
    const count = await zkbioTimeDatabaseService.zkbioTimeAttendanceModel.countDocuments();
    const sample = await zkbioTimeDatabaseService.zkbioTimeAttendanceModel.findOne().lean();
    const empCodes = await zkbioTimeDatabaseService.zkbioTimeAttendanceModel.distinct('empCode');
    
    res.json({
      success: true,
      data: {
        totalRecords: count,
        sampleRecord: sample,
        uniqueEmployeeIds: empCodes,
        employeeCount: empCodes.length
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Debug endpoint failed'
    });
  }
});

module.exports = router;
