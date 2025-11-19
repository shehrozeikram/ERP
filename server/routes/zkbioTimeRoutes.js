const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');
const zkbioTimeApiService = require('../services/zkbioTimeApiService');
const zkbioTimeDatabaseService = require('../services/zkbioTimeDatabaseService');
const { getPakistanDayRange } = require('../utils/timezoneHelper');

const IS_PROD = process.env.NODE_ENV === 'production';
const log = IS_PROD ? () => {} : console.log;
const logError = console.error;

// Safe route handler wrapper
const safeRouteHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    logError('❌ Route error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'An unexpected error occurred', error: error.message });
    }
  }
};

// Validation helpers
const validatePagination = (page, page_size) => ({
  pageNum: Math.max(parseInt(page) || 1, 1),
  pageSizeNum: Math.min(Math.max(parseInt(page_size) || 20, 1), 200)
});

const validateDate = (date) => date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);

// Reusable helpers
const createFilterSet = (str) => str ? new Set(str.split(',').map(s => s.trim()).filter(Boolean)) : null;

const formatPaginatedResponse = (data, pageNum, pageSizeNum, extra = {}) => {
  const totalCount = data.length;
  const startIndex = (pageNum - 1) * pageSizeNum;
  const pagedData = data.slice(startIndex, startIndex + pageSizeNum);
  return {
    success: true,
    data: pagedData,
    count: pagedData.length,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSizeNum),
    page: pageNum,
    page_size: pageSizeNum,
    ...extra
  };
};

const fetchEmployeesAndAttendance = async (dateStr) => {
  const results = await Promise.allSettled([
    zkbioTimeApiService.getEmployees(),
    zkbioTimeApiService.getAttendanceForDate(dateStr)
  ]);
  
  return {
    employeeResult: results[0].status === 'fulfilled' 
      ? results[0].value 
      : { success: false, data: [], error: results[0].reason?.message },
    attendanceResult: results[1].status === 'fulfilled'
      ? results[1].value
      : { success: false, data: [], error: results[1].reason?.message }
  };
};

const getDateString = () => {
  try {
    return getPakistanDayRange()?.dateString || new Date().toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const buildEmployeeResponse = (employee, employeeId) => {
  const firstName = employee?.firstName || employee?.first_name || '';
  const lastName = employee?.lastName || employee?.last_name || '';
  const department = employee?.department?.deptName || employee?.department?.dept_name || employee?.department || '';
  const fullName = employee?.fullName || employee?.full_name || `${firstName} ${lastName}`.trim() || `Employee ${employeeId}`;
  
  return { employeeId, firstName, lastName, fullName, department };
};

const resolveEmployeeProfile = async (employeeId) => {
  try {
    const dbEmployee = await zkbioTimeDatabaseService.getEmployeeByCode(employeeId);
    if (dbEmployee) return buildEmployeeResponse(dbEmployee, employeeId);
  } catch {}

  try {
    const employeeResult = await zkbioTimeApiService.getEmployees();
    if (employeeResult.success && Array.isArray(employeeResult.data)) {
      const employee = employeeResult.data.find(emp => String(emp.emp_code || emp.empCode || '').trim() === employeeId);
      if (employee) return buildEmployeeResponse(employee, employeeId);
    }
  } catch {}

  return buildEmployeeResponse(null, employeeId);
};

/**
 * GET /api/attendance/zkbio/today
 * Get today's attendance from ZKBio Time API
 */
router.get('/zkbio/today', authMiddleware, safeRouteHandler(async (req, res) => {
  const apiResult = await zkbioTimeApiService.getTodayAttendance();
  
  if (apiResult.success && apiResult.data?.length > 0) {
    const employeeResult = await zkbioTimeApiService.getEmployees();
    const processedData = zkbioTimeApiService.processAttendanceData(apiResult.data, employeeResult.success ? employeeResult.data : []);
    res.json({ success: true, data: processedData, count: processedData.length, source: apiResult.source });
  } else {
    res.json({ success: false, data: [], count: 0, source: 'None' });
  }
}));

/**
 * GET /api/zkbio/zkbio/present-by-punch
 * Returns list of employees who are present today, with punch times
 * Optional query: departments (comma-separated names), areas (comma-separated names)
 */
router.get('/zkbio/present-by-punch', authMiddleware, safeRouteHandler(async (req, res) => {
  const { departments = '', areas = '', page = '1', page_size = '20' } = req.query;
  const dateStr = getDateString();
  const { employeeResult, attendanceResult } = await fetchEmployeesAndAttendance(dateStr);

  if (!employeeResult?.success) {
    return res.status(500).json({ success: false, message: 'Failed to fetch employees', error: employeeResult?.error });
  }

  const employees = Array.isArray(employeeResult.data) ? employeeResult.data : [];
  const attendance = attendanceResult?.success && Array.isArray(attendanceResult.data) ? attendanceResult.data : [];

  // Build present map
  const presentMap = new Map();
  attendance.forEach(rec => {
    const empCode = (rec?.emp_code || rec?.originalRecord?.emp_code || '').trim();
    if (!empCode) return;
    
    if (!presentMap.has(empCode)) {
      presentMap.set(empCode, {
        emp_code: empCode,
        first_name: rec?.first_name || rec?.originalRecord?.first_name || '',
        last_name: rec?.last_name || rec?.originalRecord?.last_name || '',
        dept_name: rec?.department || rec?.department_name || rec?.originalRecord?.department || '',
        area: rec?.area_alias || rec?.area || rec?.originalRecord?.area_alias || '',
        punches: []
      });
    }
    const punch = rec?.punch_time || rec?.originalRecord?.punch_time;
    if (punch) presentMap.get(empCode).punches.push(punch);
  });

  // Apply filters
  const deptFilter = createFilterSet(departments);
  const areaFilter = createFilterSet(areas);
  let presentList = Array.from(presentMap.values());
  if (deptFilter?.size) presentList = presentList.filter(p => p.dept_name && deptFilter.has(p.dept_name));
  if (areaFilter?.size) presentList = presentList.filter(p => p.area && areaFilter.has(p.area));

  // Enrich with employee data
  const empByCode = new Map(employees.map(e => [String(e.emp_code || '').trim(), e]));
  presentList.forEach(p => {
    const emp = empByCode.get(p.emp_code);
    if (emp) {
      p.first_name = p.first_name || emp.first_name || '';
      p.last_name = p.last_name || emp.last_name || '';
      p.dept_name = p.dept_name || emp.department?.dept_name || '';
    }
  });

  // Format response
  const fullData = presentList.map(p => ({
    emp_code: p.emp_code,
    first_name: p.first_name,
    last_name: p.last_name,
    dept_name: p.dept_name,
    att_date: dateStr,
    punch_set: p.punches.sort((a, b) => new Date(a) - new Date(b)).map(ts => new Date(ts).toTimeString().slice(0, 8)).join(',')
  }));

  const { pageNum, pageSizeNum } = validatePagination(page, page_size);
  return res.json(formatPaginatedResponse(fullData, pageNum, pageSizeNum, { date: dateStr }));
}));

/**
 * GET /api/zkbio/zkbio/absent-by-punch
 * Returns list of employees who are absent today
 * Optional query: departments (comma-separated names), areas (comma-separated names), page, page_size
 */
router.get('/zkbio/absent-by-punch', authMiddleware, safeRouteHandler(async (req, res) => {
  const { departments = '', areas = '', page = '1', page_size = '20' } = req.query;
  const dateStr = getDateString();
  const { employeeResult, attendanceResult } = await fetchEmployeesAndAttendance(dateStr);

  if (!employeeResult?.success) {
    return res.status(500).json({ success: false, message: 'Failed to fetch employees', error: employeeResult?.error });
  }

  const employees = Array.isArray(employeeResult.data) ? employeeResult.data : [];
  const attendance = attendanceResult?.success && Array.isArray(attendanceResult.data) ? attendanceResult.data : [];

  // Build present set
  const presentSet = new Set();
  attendance.forEach(rec => {
    const empCode = (rec?.emp_code || rec?.originalRecord?.emp_code || '').trim();
    if (empCode) presentSet.add(empCode);
  });

  // Filter absent employees
  let absentEmployees = employees.filter(e => {
    const empCode = String(e?.emp_code || '').trim();
    return empCode && !presentSet.has(empCode);
  });

  // Apply filters
  const deptFilter = createFilterSet(departments);
  const areaFilter = createFilterSet(areas);
  if (deptFilter?.size) absentEmployees = absentEmployees.filter(e => e?.department?.dept_name && deptFilter.has(e.department.dept_name));
  if (areaFilter?.size) absentEmployees = absentEmployees.filter(e => e?.area && areaFilter.has(e.area));

  // Map to response format
  const fullData = absentEmployees.map(emp => ({
    emp_code: String(emp?.emp_code || '').trim(),
    first_name: emp?.first_name || '',
    last_name: emp?.last_name || '',
    dept_name: emp?.department?.dept_name || '',
    att_date: dateStr,
    punch_set: '-'
  }));

  const { pageNum, pageSizeNum } = validatePagination(page, page_size);
  return res.json(formatPaginatedResponse(fullData, pageNum, pageSizeNum, { date: dateStr }));
}));

/**
 * GET /api/zkbio/zkbio/devices
 * Query params: status=online|offline, areas, page, page_size
 * Returns normalized device list with pagination
 */
// Helper to normalize device data
const normalizeDevice = (row) => {
  const getArea = (area) => {
    if (typeof area === 'object') return area?.area_name || area?.name || area?.title || '-';
    return area || '-';
  };
  
  return {
    sn: row?.sn || row?.serial || row?.serial_number || '-',
    alias: row?.alias || row?.device_name || '-',
    area_alias: getArea(row?.area_alias) || getArea(row?.area) || '-',
    ip: row?.ip_address || row?.ip || '-',
    fw_version: row?.fw_version || row?.firmware || '-',
    last_activity: row?.last_activity || row?.last_sync || row?.lastActivity || row?.last_seen || row?.last_time || null,
    online_state: row?.online_state || row?.state || row?.status || null
  };
};

router.get('/zkbio/devices', authMiddleware, safeRouteHandler(async (req, res) => {
  const { status = 'online', areas = '', page = '1', page_size = '20' } = req.query;
  const isOffline = String(status).toLowerCase() === 'offline';

  const deviceResult = await zkbioTimeApiService.getDevices();
  if (!deviceResult.success) {
    return res.status(503).json({ 
      success: false, 
      message: 'Attendance system authentication failed. Please try again in a moment.',
      error: 'External API authentication error'
    });
  }

  if (!Array.isArray(deviceResult.data)) {
    return res.status(500).json({ success: false, message: 'Invalid device data format received' });
  }

  let devices = deviceResult.data.map(normalizeDevice);

  // Filter by areas
  const areaFilter = createFilterSet(areas);
  if (areaFilter?.size) devices = devices.filter(d => d.area_alias && areaFilter.has(d.area_alias));

  // Determine online/offline
  const now = Date.now();
  const isOnline = (d) => {
    if (d.online_state != null) {
      const val = String(d.online_state).toLowerCase();
      return val === 'online' || val === '1' || val === 'true';
    }
    if (!d.last_activity) return false;
    const ts = new Date(d.last_activity).getTime();
    return !isNaN(ts) && (now - ts) < 600000; // 10 minutes
  };

  devices = devices.filter(d => isOffline ? !isOnline(d) : isOnline(d));
  const { pageNum, pageSizeNum } = validatePagination(page, page_size);
  return res.json(formatPaginatedResponse(devices, pageNum, pageSizeNum));
}));

/**
 * GET /api/zkbio/zkbio/departments
 * Returns ZKBio department list
 */
router.get('/zkbio/departments', authMiddleware, safeRouteHandler(async (_req, res) => {
  const result = await zkbioTimeApiService.getDepartments();
  res.json(result.success ? { success: true, data: result.data, count: result.count } : { success: false, data: [], count: 0 });
}));

/**
 * GET /api/zkbio/zkbio/monthly-punch
 * Params: page, page_size, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), departments (csv of ids or -1), areas, groups, employees
 */
// Helper to expand department IDs
const expandDepartments = async (departments) => {
  if (String(departments).trim() !== '-1') return String(departments);
  try {
    const deptResult = await zkbioTimeApiService.getDepartments();
    if (deptResult.success && Array.isArray(deptResult.data) && deptResult.data.length > 0) {
      const ids = deptResult.data
        .map(d => d.id || d.dept_id || d.code || d.dept_code)
        .filter(Boolean)
        .map(String);
      return ids.length > 0 ? ids.join(',') : '-1';
    }
  } catch {}
  return '-1';
};

// Helper for monthly report routes
const fetchMonthlyReport = async (url, params, headers) => {
  let response = await axios.get(url, { headers, params, timeout: 20000, validateStatus: s => s < 500 });
  const contentType = response.headers['content-type'] || '';
  if (typeof response.data === 'string' && (response.data.trim().startsWith('<!DOCTYPE') || contentType.includes('text/html'))) {
    return { authError: true };
  }
  return { payload: response.data || {}, response };
};

router.get('/zkbio/monthly-punch', authMiddleware, safeRouteHandler(async (req, res) => {
  const { page = '1', page_size = '10', start_date, end_date, departments = '-1', areas = '-1', groups = '-1', employees = '-1' } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'start_date and end_date are required (YYYY-MM-DD)' });
  }

  const authed = await zkbioTimeApiService.ensureAuth();
  if (!authed) {
    return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
  }

  const headers = zkbioTimeApiService.getAuthHeaders();
  const url = 'http://45.115.86.139:85/att/api/monthlyPunchReport/';
  const departmentsCsv = await expandDepartments(departments);

  const params = {
    page: parseInt(page) || 1,
    page_size: parseInt(page_size) || 10,
    start_date,
    end_date,
    departments: departmentsCsv,
    areas,
    groups,
    employees
  };

  const { payload, authError } = await fetchMonthlyReport(url, params, headers);
  if (authError) {
    return res.status(401).json({ success: false, message: 'Authentication required (monthly report)' });
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  const list = data.map(row => ({
    emp_id: row.emp_id,
    emp_code: row.emp_code,
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    dept_name: row.dept_name || '',
    position_name: row.position_name || '',
    ...row
  }));

  // Retry if count is 0
  if ((!payload.count || payload.count === 0) && departmentsCsv === '-1') {
    const retryDepts = await expandDepartments('-1');
    if (retryDepts !== '-1') {
      const retryResult = await fetchMonthlyReport(url, { ...params, departments: retryDepts }, headers);
      if (!retryResult.authError && Array.isArray(retryResult.payload?.data)) {
        return res.json({
          success: true,
          data: retryResult.payload.data,
          count: retryResult.payload.data.length,
          totalCount: retryResult.payload.count || retryResult.payload.data.length,
          next: retryResult.payload.next || null,
          previous: retryResult.payload.previous || null,
          page: params.page,
          page_size: params.page_size
        });
      }
    }
  }

  return res.json({
    success: true,
    data: list,
    count: list.length,
    totalCount: payload.count || list.length,
    next: payload.next || null,
    previous: payload.previous || null,
    page: params.page,
    page_size: params.page_size
  });
}));

/**
 * GET /api/zkbio/zkbio/monthly-absent
 * Params: page, page_size, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), departments (csv of ids or -1), areas, groups, employees
 */
router.get('/zkbio/monthly-absent', authMiddleware, safeRouteHandler(async (req, res) => {
  const { page = '1', page_size = '20', start_date, end_date, departments = '-1', areas = '-1', groups = '-1', employees = '-1' } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'start_date and end_date are required (YYYY-MM-DD)' });
  }

  const authed = await zkbioTimeApiService.ensureAuth();
  if (!authed) {
    return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
  }

  const headers = zkbioTimeApiService.getAuthHeaders();
  const url = 'http://45.115.86.139:85/att/api/monthlyAbsenceReport/';
  const departmentsCsv = await expandDepartments(departments);

  const params = {
    page: parseInt(page) || 1,
    page_size: parseInt(page_size) || 20,
    start_date,
    end_date,
    departments: departmentsCsv,
    areas,
    groups,
    employees
  };

  const { payload, authError } = await fetchMonthlyReport(url, params, headers);
  if (authError) {
    return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
  }

  const list = Array.isArray(payload?.data) ? payload.data : [];
  return res.json({
    success: true,
    data: list,
    count: list.length,
    totalCount: payload.count || list.length,
    next: payload.next || null,
    previous: payload.previous || null,
    page: params.page,
    page_size: params.page_size
  });
}));

/**
 * GET /api/zkbio/zkbio/total-timecard
 * Params: page, page_size, start_date, end_date, departments, areas, groups, employees
 */
router.get('/zkbio/total-timecard', authMiddleware, safeRouteHandler(async (req, res) => {
  const { page = '1', page_size = '20', start_date, end_date, departments = '-1', areas = '-1', groups = '-1', employees = '-1' } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'start_date and end_date are required (YYYY-MM-DD)' });
  }

  const authed = await zkbioTimeApiService.ensureAuth();
  if (!authed) {
    return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
  }

  const headers = zkbioTimeApiService.getAuthHeaders();
  const url = 'http://45.115.86.139:85/att/api/totalTimeCardReportV2/';
  const params = {
    page: parseInt(page) || 1,
    page_size: parseInt(page_size) || 20,
    start_date,
    end_date,
    departments,
    areas,
    groups,
    employees
  };

  const response = await axios.get(url, { headers, params, timeout: 20000, validateStatus: s => s < 500 });
  const payload = response.data || {};
  const list = Array.isArray(payload?.data) ? payload.data : [];

  return res.json({
    success: true,
    data: list,
    count: list.length,
    totalCount: payload.count || list.length,
    next: payload.next || null,
    previous: payload.previous || null,
    page: params.page,
    page_size: params.page_size
  });
}));

/**
 * POST /api/attendance/zkbio/sync
 * Sync employees and attendance from ZKBio Time
 */
router.post('/zkbio/sync', authMiddleware, safeRouteHandler(async (req, res) => {
  const { syncEmployees = true, syncAttendance = true, dateRange } = req.body;
  
  const results = {
    employees: { success: false, count: 0 },
    attendance: { success: false, count: 0 }
  };

  if (syncEmployees) {
    const employeeResult = await zkbioTimeApiService.getEmployees();
    if (employeeResult.success) {
      results.employees = { success: true, count: employeeResult.data?.length || 0 };
    }
  }

  if (syncAttendance) {
    const attendanceResult = dateRange?.startDate && dateRange?.endDate
      ? await zkbioTimeApiService.getAttendanceByDateRange(dateRange.startDate, dateRange.endDate)
      : await zkbioTimeApiService.getTodayAttendance();
    
    if (attendanceResult.success) {
      results.attendance = { success: true, count: attendanceResult.data?.length || 0 };
    }
  }

  res.json({ success: true, message: 'Sync completed successfully', results });
}));

/**
 * GET /api/attendance/zkbio/employees
 * Get all employees from ZKBio Time
 */
router.get('/zkbio/employees', authMiddleware, safeRouteHandler(async (req, res) => {
  const dbResult = await zkbioTimeDatabaseService.getAllEmployees();
  if (dbResult.success && dbResult.count > 0) {
    return res.json({ success: true, data: dbResult.data, count: dbResult.count, source: 'Database' });
  }

  const apiResult = await zkbioTimeApiService.getEmployees();
  if (apiResult.success) {
    await zkbioTimeDatabaseService.saveEmployees(apiResult.data);
    res.json({ success: true, data: apiResult.data, count: apiResult.count, source: 'ZKBio Time API' });
  } else {
    res.json({ success: false, data: [], count: 0, message: 'Failed to fetch employees' });
  }
}));

/**
 * GET /api/attendance/zkbio/departments
 * Get departments from ZKBio Time
 */
router.get('/zkbio/departments', authMiddleware, safeRouteHandler(async (req, res) => {
  const result = await zkbioTimeApiService.getDepartments();
  res.json(result);
}));

/**
 * GET /api/zkbio/zkbio/areas
 * Returns ZKBio area list
 */
router.get('/zkbio/areas', authMiddleware, safeRouteHandler(async (_req, res) => {
  const result = await zkbioTimeApiService.getAreas();
  res.json(result.success ? { success: true, data: result.data, count: result.count } : { success: false, data: [], count: 0 });
}));

/**
 * GET /api/attendance/zkbio/date-range
 * Get attendance by date range
 */
router.get('/zkbio/date-range', authMiddleware, safeRouteHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
  }

  const dbResult = await zkbioTimeDatabaseService.getAttendanceByDateRange(startDate, endDate);
  if (dbResult.success && dbResult.count > 0) {
    const processedData = zkbioTimeDatabaseService.processAttendanceData(dbResult.data);
    return res.json({ success: true, data: processedData, count: processedData.length, source: 'Database' });
  }

  const apiResult = await zkbioTimeApiService.getAttendanceByDateRange(startDate, endDate);
  if (apiResult.success) {
    await zkbioTimeDatabaseService.saveAttendanceRecords(apiResult.data);
    const employeeResult = await zkbioTimeApiService.getEmployees();
    const processedData = zkbioTimeApiService.processAttendanceData(apiResult.data, employeeResult.success ? employeeResult.data : []);
    res.json({ success: true, data: processedData, count: processedData.length, source: 'ZKBio Time API' });
  } else {
    res.json({ success: false, data: [], count: 0, message: 'No attendance data found for the specified date range' });
  }
}));

/**
 * GET /api/zkbio/zkbio/employees/attendance
 * Get all employees with their latest attendance activity (with pagination)
 */
router.get('/zkbio/employees/attendance', authMiddleware, safeRouteHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 10;
  const searchQuery = (req.query.search || '').toLowerCase();
  
  const employeeResult = await zkbioTimeApiService.getEmployees();
  if (!employeeResult.success) {
    return res.status(500).json({ success: false, message: 'Failed to fetch employees from ZKBio Time' });
  }
  
  let employees = employeeResult.data;
  if (searchQuery) {
    employees = employees.filter(emp => 
      (emp.emp_code || '').toLowerCase().includes(searchQuery) ||
      (emp.first_name || '').toLowerCase().includes(searchQuery) ||
      (emp.last_name || '').toLowerCase().includes(searchQuery)
    );
  }
  
  const totalCount = employees.length;
  const totalPages = Math.ceil(totalCount / limit);
  const startIndex = (page - 1) * limit;
  const paginatedEmployees = employees.slice(startIndex, startIndex + limit);
  
  const transformedData = paginatedEmployees.map(emp => ({
    employeeId: emp.emp_code,
    firstName: emp.first_name || '',
    lastName: emp.last_name || '',
    fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
    department: emp.department?.dept_name || 'N/A',
    latestActivity: 'Check In',
    latestTime: new Date().toLocaleTimeString(),
    latestDate: new Date().toLocaleDateString(),
    status: 'Present'
  }));
  
  res.json({ success: true, data: transformedData, count: transformedData.length, totalCount, page, limit, totalPages });
}));

/**
 * GET /api/zkbio/zkbio/employees/:employeeId/attendance
 * Get specific employee's complete attendance history
 */
router.get('/zkbio/employees/:employeeId/attendance', authMiddleware, safeRouteHandler(async (req, res) => {
  const normalizedEmployeeId = String(req.params.employeeId).trim();
  const result = await zkbioTimeApiService.getCompleteEmployeeAttendanceHistory(normalizedEmployeeId);
  
  if (!result.success && result.error) {
    const errorMap = {
      'ECONNREFUSED': { message: 'Attendance system is not accessible. Please check network connectivity.', status: 503 },
      'ETIMEDOUT': { message: 'Attendance system request timed out. Please try again.', status: 504 },
      'ENOTFOUND': { message: 'Attendance system host not found. Please check configuration.', status: 502 }
    };
    const errorInfo = Object.entries(errorMap).find(([key]) => result.error.includes(key))?.[1] || { message: 'Failed to fetch employee attendance history', status: 500 };
    return res.status(errorInfo.status).json({ success: false, message: errorInfo.message, error: result.error });
  }

  if (result.success && result.data?.length > 0) {
    const latestRecord = result.data[0];
    const groupedByDate = {};
    
    result.data.forEach(record => {
      const date = record.punch_time?.split(' ')[0];
      if (!date) return;
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = { date, checkIn: null, checkOut: null, location: record.area_alias || 'N/A' };
      }
      
      if (record.punch_state_display === 'Check In') groupedByDate[date].checkIn = record.punch_time;
      else if (record.punch_state_display === 'Check Out') groupedByDate[date].checkOut = record.punch_time;
      
      if (groupedByDate[date].location === 'N/A') groupedByDate[date].location = record.area_alias || 'N/A';
    });

    const groupedAttendance = Object.values(groupedByDate).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({
      success: true,
      data: {
        employee: {
          employeeId: normalizedEmployeeId,
          firstName: latestRecord.first_name || '',
          lastName: latestRecord.last_name || '',
          fullName: `${latestRecord.first_name || ''} ${latestRecord.last_name || ''}`.trim(),
          department: latestRecord.department || ''
        },
        attendance: groupedAttendance
      },
      message: `Fetched ${groupedAttendance.length} attendance records`
    });
  } else {
    const employeeProfile = await resolveEmployeeProfile(normalizedEmployeeId);
    res.json({ success: true, data: { employee: employeeProfile, attendance: [] }, message: 'No attendance records found' });
  }
}));

/**
 * GET /api/zkbio/absent-employees
 * Get absent employees for a specific date
 */
router.get('/absent-employees', authMiddleware, safeRouteHandler(async (req, res) => {
  const { date, excludeWeekends = 'true', excludeHolidays = 'true', onlyActiveEmployees = 'true', clearCache = 'false' } = req.query;
  
  if (!date || !validateDate(date)) {
    return res.status(400).json({ success: false, message: 'Date parameter is required (YYYY-MM-DD format)' });
  }

  if (clearCache === 'true') zkbioTimeApiService.clearCache();
  
  const options = {
    excludeWeekends: excludeWeekends === 'true',
    excludeHolidays: excludeHolidays === 'true',
    onlyActiveEmployees: onlyActiveEmployees === 'true'
  };

  const result = await zkbioTimeApiService.getAbsentEmployees(date, options);
  
  if (result.success) {
    res.json({
      success: true,
      data: result.data,
      summary: result.summary,
      count: result.data?.length || 0,
      source: result.source,
      message: result.message
    });
  } else {
    res.status(500).json({
      success: false,
      data: [],
      summary: result.summary,
      count: 0,
      message: 'Failed to fetch absent employees',
      error: result.error
    });
  }
}));

module.exports = router;
