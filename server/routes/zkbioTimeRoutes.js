const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');
const zkbioTimeApiService = require('../services/zkbioTimeApiService');
const zkbioTimeDatabaseService = require('../services/zkbioTimeDatabaseService');
const { getPakistanDayRange } = require('../utils/timezoneHelper');

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
 * GET /api/zkbio/zkbio/present-by-punch
 * Returns list of employees who are present today, with punch times
 * Optional query: departments (comma-separated names), areas (comma-separated names)
 */
router.get('/zkbio/present-by-punch', async (req, res) => {
  try {
    const { departments = '', areas = '', page = '1', page_size = '20' } = req.query;

    // Determine today's date in Pakistan timezone (YYYY-MM-DD)
    const { dateString: dateStr } = getPakistanDayRange();

    // Fetch employees and today's attendance
    const [employeeResult, attendanceResult] = await Promise.all([
      zkbioTimeApiService.getEmployees(),
      zkbioTimeApiService.getAttendanceForDate(dateStr)
    ]);

    if (!employeeResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to fetch employees' });
    }

    const employees = employeeResult.data || [];
    const attendance = attendanceResult.success ? (attendanceResult.data || []) : [];

    // Build map of emp_code to punches (times) and last department/area
    const presentMap = new Map();
    attendance.forEach((rec) => {
      const empCode = (rec.emp_code || rec.originalRecord?.emp_code || '').trim();
      if (!empCode) return;
      const firstName = rec.first_name || rec.originalRecord?.first_name;
      const lastName = rec.last_name || rec.originalRecord?.last_name;
      const dept = rec.department || rec.department_name || rec.originalRecord?.department || rec.originalRecord?.department_name;
      const area = rec.area_alias || rec.area || rec.originalRecord?.area_alias || rec.originalRecord?.area;
      const punch = rec.punch_time || rec.originalRecord?.punch_time;

      if (!presentMap.has(empCode)) {
        presentMap.set(empCode, {
          emp_code: empCode,
          first_name: firstName || '',
          last_name: lastName || '',
          dept_name: dept || '',
          punches: [],
          area: area || ''
        });
      }
      const entry = presentMap.get(empCode);
      if (punch) entry.punches.push(punch);
      if (dept && !entry.dept_name) entry.dept_name = dept;
      if (area && !entry.area) entry.area = area;
    });

    // If departments/areas filters provided, apply them
    const deptFilter = departments ? new Set(departments.split(',').map(s => s.trim()).filter(Boolean)) : null;
    const areaFilter = areas ? new Set(areas.split(',').map(s => s.trim()).filter(Boolean)) : null;

    let presentList = Array.from(presentMap.values());
    if (deptFilter && deptFilter.size > 0) {
      presentList = presentList.filter(p => p.dept_name && deptFilter.has(p.dept_name));
    }
    if (areaFilter && areaFilter.size > 0) {
      presentList = presentList.filter(p => p.area && areaFilter.has(p.area));
    }

    // Attach employee names from employees list if missing
    const empByCode = new Map(employees.map(e => [String(e.emp_code || '').trim(), e]));
    presentList.forEach(p => {
      if (!p.first_name || !p.last_name) {
        const emp = empByCode.get(p.emp_code);
        if (emp) {
          p.first_name = p.first_name || emp.first_name || '';
          p.last_name = p.last_name || emp.last_name || '';
          p.dept_name = p.dept_name || emp.department?.dept_name || '';
        }
      }
    });

    // Format punch_set similar to external UI (comma-separated times)
    const fullData = presentList.map(p => ({
      emp_code: p.emp_code,
      first_name: p.first_name,
      last_name: p.last_name,
      dept_name: p.dept_name,
      att_date: dateStr,
      punch_set: (p.punches || [])
        .sort((a, b) => new Date(a) - new Date(b))
        .map(ts => (new Date(ts).toTimeString().slice(0,8)))
        .join(',')
    }));

    // Apply pagination on server
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageSizeNum = Math.min(Math.max(parseInt(page_size) || 20, 1), 200);
    const totalCount = fullData.length;
    const startIndex = (pageNum - 1) * pageSizeNum;
    const pagedData = fullData.slice(startIndex, startIndex + pageSizeNum);
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    return res.json({ 
      success: true, 
      data: pagedData, 
      count: pagedData.length, 
      totalCount, 
      totalPages, 
      page: pageNum, 
      page_size: pageSizeNum,
      date: dateStr 
    });
  } catch (error) {
    console.error('❌ Error building present-by-punch:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to compute present employees', error: error.message });
  }
});

/**
 * GET /api/zkbio/zkbio/absent-by-punch
 * Returns list of employees who are absent today
 * Optional query: departments (comma-separated names), areas (comma-separated names), page, page_size
 */
router.get('/zkbio/absent-by-punch', async (req, res) => {
  try {
    const { departments = '', areas = '', page = '1', page_size = '20' } = req.query;

    const { dateString: dateStr } = getPakistanDayRange();

    // Fetch employees and today's attendance
    const [employeeResult, attendanceResult] = await Promise.all([
      zkbioTimeApiService.getEmployees(),
      zkbioTimeApiService.getAttendanceForDate(dateStr)
    ]);

    if (!employeeResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to fetch employees' });
    }

    const employees = employeeResult.data || [];
    const attendance = attendanceResult.success ? (attendanceResult.data || []) : [];

    // Build present Set
    const presentSet = new Set();
    attendance.forEach((rec) => {
      const empCode = (rec.emp_code || rec.originalRecord?.emp_code || '').trim();
      if (empCode) presentSet.add(empCode);
    });

    // Filter absent employees
    let absentEmployees = employees.filter(e => !presentSet.has(String(e.emp_code || '').trim()));

    // Apply department/area filters if provided
    const deptFilter = departments ? new Set(departments.split(',').map(s => s.trim()).filter(Boolean)) : null;
    const areaFilter = areas ? new Set(areas.split(',').map(s => s.trim()).filter(Boolean)) : null;

    if (deptFilter && deptFilter.size > 0) {
      absentEmployees = absentEmployees.filter(e => e.department?.dept_name && deptFilter.has(e.department.dept_name));
    }
    if (areaFilter && areaFilter.size > 0) {
      absentEmployees = absentEmployees.filter(e => e.area && areaFilter.has(e.area));
    }

    // Map to UI shape (no punches)
    const fullData = absentEmployees.map(emp => ({
      emp_code: String(emp.emp_code || '').trim(),
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      dept_name: emp.department?.dept_name || '',
      att_date: dateStr,
      punch_set: '-' // no punches for absent
    }));

    // Pagination
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageSizeNum = Math.min(Math.max(parseInt(page_size) || 20, 1), 200);
    const totalCount = fullData.length;
    const startIndex = (pageNum - 1) * pageSizeNum;
    const pagedData = fullData.slice(startIndex, startIndex + pageSizeNum);
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    return res.json({
      success: true,
      data: pagedData,
      count: pagedData.length,
      totalCount,
      totalPages,
      page: pageNum,
      page_size: pageSizeNum,
      date: dateStr
    });
  } catch (error) {
    console.error('❌ Error building absent-by-punch:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to compute absent employees', error: error.message });
  }
});

/**
 * GET /api/zkbio/zkbio/devices
 * Query params: status=online|offline, areas, page, page_size
 * Returns normalized device list with pagination
 */
router.get('/zkbio/devices', async (req, res) => {
  try {
    const { status = 'online', areas = '', page = '1', page_size = '20' } = req.query;
    const isOffline = String(status).toLowerCase() === 'offline';

    // Fetch devices via authenticated API
    const deviceResult = await zkbioTimeApiService.getDevices();
    if (!deviceResult.success) {
      return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
    }

    // Normalize
    let devices = deviceResult.data.map(row => ({
      sn: row.sn || row.serial || row.serial_number || '-',
      alias: row.alias || row.device_name || '-',
      area_alias: (typeof row.area_alias === 'object') ? (row.area_alias.area_name || row.area_alias.name || row.area_alias.title || '-') :
                  (typeof row.area === 'object') ? (row.area.area_name || row.area.name || row.area.title || '-') :
                  (row.area_alias || row.area || '-'),
      ip: row.ip_address || row.ip || '-',
      fw_version: row.fw_version || row.firmware || '-',
      last_activity: row.last_activity || row.last_sync || row.lastActivity || row.last_seen || row.last_time || null,
      online_state: row.online_state || row.state || row.status || null
    }));

    // Filter by areas if provided
    const areaSet = areas ? new Set(areas.split(',').map(s => s.trim()).filter(Boolean)) : null;
    if (areaSet && areaSet.size > 0) {
      devices = devices.filter(d => d.area_alias && areaSet.has(d.area_alias));
    }

    // Determine online/offline
    const now = Date.now();
    const isOnline = (d) => {
      if (d.online_state !== null && d.online_state !== undefined) {
        const val = String(d.online_state).toLowerCase();
        return val === 'online' || val === '1' || val === 'true';
      }
      if (!d.last_activity) return false;
      const ts = new Date(d.last_activity).getTime();
      if (isNaN(ts)) return false;
      // consider online if last activity within 10 minutes
      return (now - ts) < 10 * 60 * 1000;
    };

    devices = devices.filter(d => isOffline ? !isOnline(d) : isOnline(d));

    // Pagination
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageSizeNum = Math.min(Math.max(parseInt(page_size) || 20, 1), 200);
    const totalCount = devices.length;
    const start = (pageNum - 1) * pageSizeNum;
    const paged = devices.slice(start, start + pageSizeNum);
    const totalPages = Math.ceil((totalCount || 0) / (pageSizeNum || 1));

    return res.json({
      success: true,
      data: paged,
      count: paged.length,
      totalCount,
      totalPages,
      page: pageNum,
      page_size: pageSizeNum
    });
  } catch (error) {
    console.error('❌ Error fetching devices:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch devices', error: error.message });
  }
});

/**
 * GET /api/zkbio/zkbio/departments
 * Returns ZKBio department list
 */
router.get('/zkbio/departments', async (_req, res) => {
  try {
    const result = await zkbioTimeApiService.getDepartments();
    return res.json(result.success ? { success: true, data: result.data, count: result.count } : { success: false, data: [], count: 0 });
  } catch (error) {
    console.error('❌ Error fetching ZKBio departments route:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
});

/**
 * GET /api/zkbio/zkbio/monthly-punch
 * Params: page, page_size, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), departments (csv of ids or -1), areas, groups, employees
 */
router.get('/zkbio/monthly-punch', async (req, res) => {
  try {
    const {
      page = '1',
      page_size = '10',
      start_date,
      end_date,
      departments = '-1',
      areas = '-1',
      groups = '-1',
      employees = '-1'
    } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'start_date and end_date are required (YYYY-MM-DD)' });
    }

    // Ensure authentication first (as used by Present/Absent/Devices)
    const authed = await zkbioTimeApiService.ensureAuth();
    if (!authed) {
      return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
    }

    const headers = zkbioTimeApiService.getAuthHeaders();
    const baseUrl = 'http://45.115.86.139:85';
    const url = `${baseUrl}/att/api/monthlyPunchReport/`;

    // If departments is -1, expand to all department IDs from ZKBio (to match example behavior)
    let departmentsCsv = String(departments || '-1');
    if (departmentsCsv === '-1') {
      try {
        const deptResult = await zkbioTimeApiService.getDepartments();
        if (deptResult.success && Array.isArray(deptResult.data) && deptResult.data.length > 0) {
          const ids = deptResult.data
            .map(d => d.id || d.dept_id || d.code || d.dept_code)
            .filter(Boolean)
            .map(String);
          if (ids.length > 0) {
            departmentsCsv = ids.join(',');
          }
        }
      } catch (e) {
        // Fallback to -1 if department fetch fails
      }
    }

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

    let response = await axios.get(url, { headers, params, timeout: 20000, validateStatus: s => s < 500 });
    const contentType = response.headers['content-type'] || '';
    if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE') || contentType.includes('text/html')) {
      return res.status(401).json({ success: false, message: 'Authentication required (monthly report)' });
    }
    let payload = response.data || {};
    const rawList = Array.isArray(payload?.data) ? payload.data : [];

    // Normalize minimal fields; keep dynamic day columns as-is
    const data = rawList.map(row => ({
      emp_id: row.emp_id,
      emp_code: row.emp_code,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      dept_name: row.dept_name || '',
      position_name: row.position_name || '',
      // include all day/time and paycode fields as received
      ...row
    }));

    // Retry strategy: if count is 0, re-fetch with explicit departments list derived from ZKBio departments
    if ((!payload.count || payload.count === 0) && String(departments).trim() === '-1') {
      try {
        const deptResult = await zkbioTimeApiService.getDepartments();
        if (deptResult.success && Array.isArray(deptResult.data) && deptResult.data.length > 0) {
          const ids = deptResult.data
            .map(d => d.id || d.dept_id || d.code || d.dept_code)
            .filter(v => v !== undefined && v !== null)
            .map(String);
          const unique = Array.from(new Set(ids));
          if (unique.length > 0) {
            const retryParams = { ...params, departments: unique.join(',') };
            response = await axios.get(url, { headers, params: retryParams, timeout: 20000, validateStatus: s => s < 500 });
            payload = response.data || payload;
          }
        }
      } catch (e) {
        // ignore retry errors, fall back to original payload
      }
    }

    return res.json({
      success: true,
      data: Array.isArray(payload?.data) ? payload.data : data,
      count: Array.isArray(payload?.data) ? payload.data.length : data.length,
      totalCount: payload.count || (Array.isArray(payload?.data) ? payload.data.length : data.length),
      next: payload.next || null,
      previous: payload.previous || null,
      page: params.page,
      page_size: params.page_size
    });
  } catch (error) {
    console.error('❌ Error fetching monthly punch report:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch monthly punch report', error: error.message });
  }
});

/**
 * GET /api/zkbio/zkbio/monthly-absent
 * Params: page, page_size, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), departments (csv of ids or -1), areas, groups, employees
 */
router.get('/zkbio/monthly-absent', async (req, res) => {
  try {
    const {
      page = '1',
      page_size = '20',
      start_date,
      end_date,
      departments = '-1',
      areas = '-1',
      groups = '-1',
      employees = '-1'
    } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'start_date and end_date are required (YYYY-MM-DD)' });
    }

    // Ensure authentication first
    const authed = await zkbioTimeApiService.ensureAuth();
    if (!authed) {
      return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
    }

    const headers = zkbioTimeApiService.getAuthHeaders();
    const baseUrl = 'http://45.115.86.139:85';
    const url = `${baseUrl}/att/api/monthlyAbsenceReport/`;

    // If departments is -1, expand to all department IDs from ZKBio
    let departmentsCsv = String(departments || '-1');
    if (departmentsCsv === '-1') {
      try {
        const deptResult = await zkbioTimeApiService.getDepartments();
        if (deptResult.success && Array.isArray(deptResult.data) && deptResult.data.length > 0) {
          const ids = deptResult.data
            .map(d => d.id || d.dept_id || d.code || d.dept_code)
            .filter(Boolean)
            .map(String);
          if (ids.length > 0) {
            departmentsCsv = ids.join(',');
          }
        }
      } catch (e) {
        // Fallback to -1 if department fetch fails
      }
    }

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

    let response = await axios.get(url, {
      headers,
      params,
      timeout: 20000,
      validateStatus: (status) => status < 500
    });

    // Check if response is HTML (login page)
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
    }

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
  } catch (error) {
    console.error('❌ Error fetching monthly absence report:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch monthly absence report', error: error.message });
  }
});

/**
 * GET /api/zkbio/zkbio/total-timecard
 * Params: page, page_size, start_date, end_date, departments, areas, groups, employees
 */
router.get('/zkbio/total-timecard', async (req, res) => {
  try {
    const {
      page = '1',
      page_size = '20',
      start_date,
      end_date,
      departments = '-1',
      areas = '-1',
      groups = '-1',
      employees = '-1'
    } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'start_date and end_date are required (YYYY-MM-DD)' });
    }

    const authed = await zkbioTimeApiService.ensureAuth();
    if (!authed) {
      return res.status(401).json({ success: false, message: 'Authentication to attendance system failed' });
    }

    const headers = zkbioTimeApiService.getAuthHeaders();
    const baseUrl = 'http://45.115.86.139:85';
    const url = `${baseUrl}/att/api/totalTimeCardReportV2/`;

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
  } catch (error) {
    console.error('❌ Error fetching total timecard:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch total timecard', error: error.message });
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
 * GET /api/zkbio/zkbio/areas
 * Returns ZKBio area list
 */
router.get('/zkbio/areas', async (_req, res) => {
  try {
    const result = await zkbioTimeApiService.getAreas();
    return res.json(result.success ? { success: true, data: result.data, count: result.count } : { success: false, data: [], count: 0 });
  } catch (error) {
    console.error('❌ Error fetching ZKBio areas route:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch areas' });
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
    const startIndex = (page - 1) * limit; // Fix: page starts from 1, not 0
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
    console.log(`🔍 Fetching attendance history for employee: ${employeeId}`);
    
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

      console.log(`✅ Successfully fetched ${groupedAttendance.length} attendance records for employee ${employeeId}`);
      
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
      console.log(`⚠️ No attendance records found for employee ${employeeId}`);
      res.status(404).json({
        success: false,
        message: 'Employee not found or no attendance records'
      });
    }
  } catch (error) {
    console.error('❌ Error fetching employee attendance history:', error);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to fetch employee attendance history';
    let statusCode = 500;
    
    if (error.message && error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Attendance system is not accessible from this server. Please check network connectivity.';
      statusCode = 503;
    } else if (error.message && error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Attendance system request timed out. Please try again.';
      statusCode = 504;
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      errorMessage = 'Attendance system host not found. Please check configuration.';
      statusCode = 502;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: 'This error typically occurs when the server cannot connect to the attendance system. Please check if the attendance system is accessible from your server.'
    });
  }
});

/**
 * GET /api/zkbio/absent-employees
 * Get absent employees for a specific date
 */
router.get('/absent-employees', async (req, res) => {
  try {
    const { date, excludeWeekends = 'true', excludeHolidays = 'true', onlyActiveEmployees = 'true', clearCache = 'false' } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (YYYY-MM-DD format)'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    console.log(`📊 API: Fetching absent employees for ${date}...`);
    
    // Clear cache if requested
    if (clearCache === 'true') {
      zkbioTimeApiService.clearCache();
    }
    
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
        count: result.data.length,
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
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch absent employees',
      error: error.message
    });
  }
});

module.exports = router;
