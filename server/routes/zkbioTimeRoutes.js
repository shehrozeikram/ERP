const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const zkbioTimeApiService = require('../services/zkbioTimeApiService');

/**
 * GET /api/attendance/zkbio/today
 * Get today's attendance from ZKBio Time API
 */
router.get('/zkbio/today', async (req, res) => {
  try {
    const apiResult = await zkbioTimeApiService.getTodayAttendance();
    
    if (apiResult.success && apiResult.data.length > 0) {
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
        results.employees = {
          success: true,
          count: employeeResult.data.length,
          failed: 0
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
        results.attendance = {
          success: true,
          count: attendanceResult.data.length,
          failed: 0
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
 * GET /api/zkbio/zkbio/employees/attendance
 * Get all employees with their latest attendance activity (with pagination)
 */
router.get('/zkbio/employees/attendance', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const searchQuery = req.query.search || '';
    
    // Get employees from ZKBio Time API
    const employeeResult = await zkbioTimeApiService.getEmployees();
    
    if (!employeeResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch employees from ZKBio Time'
      });
    }
    
    let employees = employeeResult.data;
    
    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      employees = employees.filter(emp => 
        (emp.emp_code || '').toLowerCase().includes(searchLower) ||
        (emp.first_name || '').toLowerCase().includes(searchLower) ||
        (emp.last_name || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    const totalCount = employees.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedEmployees = employees.slice(startIndex, endIndex);
    
    // Transform data for frontend
    const transformedData = paginatedEmployees.map(emp => ({
      employeeId: emp.emp_code,
      firstName: emp.first_name || '',
      lastName: emp.last_name || '',
      fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      department: emp.department?.dept_name || 'N/A',
      latestActivity: 'Check In', // Default since we don't have real-time data here
      latestTime: new Date().toLocaleTimeString(),
      latestDate: new Date().toLocaleDateString(),
      status: 'Present'
    }));
    
    res.json({
      success: true,
      data: transformedData,
      count: transformedData.length,
      totalCount: totalCount,
      page: page,
      limit: limit,
      totalPages: totalPages
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
    const result = await zkbioTimeApiService.getCompleteEmployeeAttendanceHistory(employeeId);
    
    if (result.success && result.data.length > 0) {
      // Get employee details from the latest attendance record
      const latestRecord = result.data[0];
      
      // Group attendance records by date
      const groupedByDate = {};
      
      result.data.forEach(record => {
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

      res.json({
        success: true,
        data: {
          employee: {
            employeeId: employeeId,
            firstName: latestRecord.first_name || '',
            lastName: latestRecord.last_name || '',
            fullName: `${latestRecord.first_name || ''} ${latestRecord.last_name || ''}`.trim(),
            department: latestRecord.department || ''
          },
          attendance: groupedAttendance
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Employee not found or no attendance records'
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

module.exports = router;
