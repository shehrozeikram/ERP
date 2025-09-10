const axios = require('axios');
const { getZKBioTimeConfig, getUserAgent, updateCookies } = require('../config/zktecoConfig');

/**
 * ZKBio Time API Service
 * Optimized service for ZKBio Time integration
 */
class ZKBioTimeApiService {
  constructor() {
    this.config = getZKBioTimeConfig();
    this.baseURL = this.config.baseURL;
    this.credentials = this.config.credentials;
    this.endpoints = this.config.endpoints;
    this.isAuthenticated = false;
    this.sessionCookies = null;
    this.csrfToken = null;
    this.useProxy = false; // Flag to use proxy when direct connection fails
    
    // Add caching for better performance
    this.cache = {
      employees: {
        data: null,
        timestamp: null,
        ttl: 5 * 60 * 1000 // 5 minutes cache
      },
      attendance: {
        data: {},
        timestamp: {},
        ttl: 2 * 60 * 1000 // 2 minutes cache
      }
    };
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(cacheKey, cacheType = 'employees') {
    const cache = this.cache[cacheType];
    if (!cache) return false;
    
    if (cacheType === 'employees') {
      return cache.data && cache.timestamp && 
             (Date.now() - cache.timestamp) < cache.ttl;
    } else if (cacheType === 'attendance') {
      return cache.data[cacheKey] && cache.timestamp[cacheKey] && 
             (Date.now() - cache.timestamp[cacheKey]) < cache.ttl;
    }
    return false;
  }

  /**
   * Get cached data
   */
  getCachedData(cacheKey, cacheType = 'employees') {
    const cache = this.cache[cacheType];
    if (!cache) return null;
    
    if (cacheType === 'employees') {
      return cache.data;
    } else if (cacheType === 'attendance') {
      return cache.data[cacheKey];
    }
    return null;
  }

  /**
   * Set cached data
   */
  setCachedData(data, cacheKey, cacheType = 'employees') {
    const cache = this.cache[cacheType];
    if (!cache) return;
    
    if (cacheType === 'employees') {
      cache.data = data;
      cache.timestamp = Date.now();
    } else if (cacheType === 'attendance') {
      cache.data[cacheKey] = data;
      cache.timestamp[cacheKey] = Date.now();
    }
  }

  /**
   * Clear cache
   */
  clearCache(cacheType = 'all') {
    if (cacheType === 'all' || cacheType === 'employees') {
      this.cache.employees.data = null;
      this.cache.employees.timestamp = null;
    }
    if (cacheType === 'all' || cacheType === 'attendance') {
      this.cache.attendance.data = {};
      this.cache.attendance.timestamp = {};
    }
    console.log('🗑️ Cache cleared');
  }

  /**
   * Get authentication headers
   */
  getAuthHeaders() {
    return {
      'Cookie': this.sessionCookies,
      'User-Agent': getUserAgent(),
      'Content-Type': 'application/json'
    };
  }

  /**
   * Authenticate with ZKBio Time using session-based authentication
   */
  async authenticate() {
    try {
      console.log('🔐 Authenticating with ZKBio Time API...');
      
      // First, get the login page to extract CSRF token
      const loginPageResponse = await axios.get(`${this.baseURL}${this.endpoints.login}`, {
        headers: {
          'User-Agent': getUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Extract CSRF token from the login page
      const csrfMatch = loginPageResponse.data.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
      if (csrfMatch) {
        this.csrfToken = csrfMatch[1];
        console.log('✅ CSRF token extracted:', this.csrfToken.substring(0, 10) + '...');
      }

      // Prepare login data
      const loginData = new URLSearchParams({
        'username': this.credentials.username,
        'password': this.credentials.password,
        'csrfmiddlewaretoken': this.csrfToken
      });

      // Perform login
      const loginResponse = await axios.post(`${this.baseURL}${this.endpoints.login}`, loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': getUserAgent(),
          'Referer': `${this.baseURL}${this.endpoints.login}`,
          'Origin': this.baseURL,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cookie': `csrftoken=${this.csrfToken}`
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });

      // Extract session cookies from response
      const setCookieHeaders = loginResponse.headers['set-cookie'];
      if (setCookieHeaders) {
        this.sessionCookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
        console.log('✅ Session cookies obtained');
        
        // Update the global config with new cookies
        const cookieObj = {};
        setCookieHeaders.forEach(cookie => {
          const [name, value] = cookie.split(';')[0].split('=');
          cookieObj[name.trim()] = value.trim();
        });
        updateCookies(cookieObj);
      }

      // Verify authentication by accessing dashboard
      const dashboardResponse = await axios.get(`${this.baseURL}${this.endpoints.dashboard}`, {
        headers: {
          'Cookie': this.sessionCookies,
          'User-Agent': getUserAgent()
        }
      });

      if (dashboardResponse.status === 200 && !dashboardResponse.data.includes('login')) {
        this.isAuthenticated = true;
        console.log('✅ ZKBio Time authentication successful');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ ZKBio Time authentication failed:', error.message);
      return false;
    }
  }

  /**
   * Check if authenticated
   */
  isLoggedIn() {
    return this.isAuthenticated && this.sessionCookies;
  }

  /**
   * Ensure authentication
   */
  async ensureAuth() {
    if (!this.isLoggedIn()) {
      return await this.authenticate();
    }
    return true;
  }

  /**
   * Get the appropriate base URL (direct or proxy)
   */
  getRequestBaseURL() {
    if (this.useProxy) {
      return 'http://localhost:5001/api/attendance-proxy/zkbio-proxy';
    }
    return this.baseURL;
  }

  /**
   * Handle connection errors and switch to proxy if needed
   */
  async handleConnectionError(error, retryWithProxy = true) {
    if (retryWithProxy && !this.useProxy && 
        (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')) {
      console.log('🔄 Direct connection failed, switching to proxy...');
      this.useProxy = true;
      return true; // Retry with proxy
    }
    return false; // Don't retry
  }

  /**
   * Get all employees (with pagination to get all employees)
   */
  async getEmployees() {
    try {
      // Check cache first
      if (this.isCacheValid('employees', 'employees')) {
        console.log('👥 Returning cached employees data');
        return {
          success: true,
          data: this.getCachedData('employees', 'employees'),
          count: this.getCachedData('employees', 'employees').length,
          source: 'Cache'
        };
      }

      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log('👥 Fetching all employees from ZKBio Time...');
      
      let allEmployees = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 200; // Increased from 100 for faster fetching
      
      while (hasMore) {
        const response = await axios.get(`${this.baseURL}/personnel/api/employees/`, {
          headers: this.getAuthHeaders(),
          params: {
            page_size: pageSize,
            page: page,
            ordering: 'emp_code'
          }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
          allEmployees = allEmployees.concat(response.data.data);
          console.log(`📄 Fetched page ${page}: ${response.data.data.length} employees`);
          
          // Check if there are more pages
          hasMore = response.data.next !== null && response.data.data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Total employees fetched: ${allEmployees.length}`);
      
      // Cache the result
      this.setCachedData(allEmployees, 'employees', 'employees');
      
      return {
        success: true,
        data: allEmployees,
        count: allEmployees.length,
        source: 'ZKBio Time API'
      };

    } catch (error) {
      console.error('❌ Failed to fetch employees:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get today's attendance (optimized)
   */
  async getTodayAttendance() {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      const today = new Date();
      const startTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`;
      const endTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59`;

      console.log('📊 Fetching fresh today\'s attendance from ZKBio Time...');

      // Use larger page size for faster fetching
      const response = await axios.get(`${this.getRequestBaseURL()}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          start_time: startTime,
          end_time: endTime,
          page_size: 100, // Increased from 30
          page: 1,
          ordering: '-punch_time'
        }
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        console.log(`✅ Fetched ${response.data.data.length} fresh attendance records for today`);
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length,
          source: 'Today'
        };
      }

      // If no today's data, try without date filter to get latest data
      console.log('📊 No today\'s data found, fetching latest attendance records...');
      const latestResponse = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          page_size: 100, // Increased from 30
          page: 1,
          ordering: '-punch_time'
        }
      });

      if (latestResponse.data && latestResponse.data.data && latestResponse.data.data.length > 0) {
        console.log(`✅ Fetched ${latestResponse.data.data.length} latest attendance records`);
        return {
          success: true,
          data: latestResponse.data.data,
          count: latestResponse.data.count || latestResponse.data.data.length,
          source: 'Latest'
        };
      }

      console.log('⚠️ No attendance data found');
      return { success: false, data: [], count: 0, source: 'None' };
    } catch (error) {
      console.error('❌ Failed to fetch attendance:', error.message);
      
      // Try with proxy if direct connection failed
      if (await this.handleConnectionError(error)) {
        console.log('🔄 Retrying with proxy...');
        return await this.getTodayAttendance();
      }
      
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get attendance for a specific date
   */
  async getAttendanceForDate(targetDate) {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      const startTime = `${targetDate}T00:00:00`;
      const endTime = `${targetDate}T23:59:59`;

      console.log(`📊 Fetching attendance for ${targetDate} from ZKBio Time...`);

      // Use larger page size for faster fetching
      const response = await axios.get(`${this.getRequestBaseURL()}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          start_time: startTime,
          end_time: endTime,
          page_size: 1000, // Large page size to get all records for the date
          page: 1,
          ordering: '-punch_time'
        }
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        console.log(`✅ Fetched ${response.data.data.length} attendance records for ${targetDate}`);
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length,
          source: targetDate
        };
      }

      console.log(`⚠️ No attendance data found for ${targetDate}`);
      return { success: true, data: [], count: 0, source: targetDate };
    } catch (error) {
      console.error(`❌ Failed to fetch attendance for ${targetDate}:`, error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   */
  async getEmployeeAttendanceHistory(employeeCode, pageSize = 30, page = 1) {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log(`🔍 Fetching attendance history for employee ${employeeCode} (page_size: ${pageSize}, page: ${page})...`);
      
      const response = await axios.get(`${this.getRequestBaseURL()}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          emp_code: employeeCode,
          page_size: pageSize,
          page: page,
          ordering: '-punch_time'
        }
      });

      if (response.data && response.data.data) {
        console.log(`✅ Fetched ${response.data.data.length} attendance records for employee ${employeeCode}`);
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length,
          totalCount: response.data.count || 0,
          hasMore: !!response.data.next,
          nextPage: response.data.next ? page + 1 : null,
          previousPage: response.data.previous ? page - 1 : null
        };
      }

      return { success: false, data: [], count: 0, totalCount: 0, hasMore: false };
    } catch (error) {
      console.error('❌ Failed to fetch employee attendance history:', error.message);
      
      // Try with proxy if direct connection failed
      if (await this.handleConnectionError(error)) {
        console.log('🔄 Retrying with proxy...');
        return await this.getEmployeeAttendanceHistory(employeeCode, pageSize, page);
      }
      
      return { success: false, data: [], count: 0, totalCount: 0, hasMore: false, error: error.message };
    }
  }

  /**
   * Get complete employee attendance history (all records)
   */
  async getCompleteEmployeeAttendanceHistory(employeeCode) {
    try {
      console.log(`🔍 Fetching complete attendance history for employee ${employeeCode}...`);
      
      let allRecords = [];
      let page = 1;
      const pageSize = 30;
      let hasMore = true;
      
      while (hasMore) {
        const result = await this.getEmployeeAttendanceHistory(employeeCode, pageSize, page);
        
        if (!result.success) {
          console.error('❌ Failed to fetch attendance records');
          break;
        }
        
        allRecords = allRecords.concat(result.data);
        hasMore = result.hasMore;
        page++;
        
        console.log(`📊 Fetched ${result.data.length} records (total: ${allRecords.length})`);
        
        // Safety check to prevent infinite loops
        if (allRecords.length > 10000) {
          console.warn('⚠️ Reached maximum record limit (10,000), stopping pagination');
          break;
        }
      }
      
      console.log(`✅ Total attendance records for employee ${employeeCode}: ${allRecords.length}`);
      
      return {
        success: true,
        data: allRecords,
        count: allRecords.length,
        totalCount: allRecords.length
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch complete employee attendance history:', error.message);
      return { success: false, data: [], count: 0, totalCount: 0, error: error.message };
    }
  }

  /**
   * Get attendance by date range
   */
  async getAttendanceByDateRange(startDate, endDate) {
    try {
      const cacheKey = `${startDate}_${endDate}`;
      
      // Check cache first
      if (this.isCacheValid(cacheKey, 'attendance')) {
        console.log(`📊 Returning cached attendance data for ${startDate} to ${endDate}`);
        return {
          success: true,
          data: this.getCachedData(cacheKey, 'attendance'),
          count: this.getCachedData(cacheKey, 'attendance').length,
          source: 'Cache'
        };
      }

      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log(`📊 Fetching attendance from ${startDate} to ${endDate}...`);
      
      const response = await axios.get(`${this.getRequestBaseURL()}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          punch_time__gte: `${startDate} 00:00:00`,
          punch_time__lte: `${endDate} 23:59:59`
        }
      });

      if (response.data && response.data.data) {
        console.log(`✅ Fetched ${response.data.data.length} attendance records`);
        
        // Cache the result
        this.setCachedData(response.data.data, cacheKey, 'attendance');
        
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length,
          source: 'ZKBio Time API'
        };
      }

      return { success: false, data: [], count: 0 };
    } catch (error) {
      console.error('❌ Failed to fetch attendance by date range:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get departments
   */
  async getDepartments() {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log('🏢 Fetching departments from ZKBio Time...');
      
      const response = await axios.get(`${this.baseURL}/personnel/api/departments/`, {
        headers: this.getAuthHeaders()
      });

      if (response.data && response.data.data) {
        console.log(`✅ Fetched ${response.data.data.length} departments`);
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length
        };
      }

      return { success: false, data: [], count: 0 };
    } catch (error) {
      console.error('❌ Failed to fetch departments:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get areas/locations
   */
  async getAreas() {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log('📍 Fetching areas from ZKBio Time...');
      
      const response = await axios.get(`${this.baseURL}/personnel/api/areas/`, {
        headers: this.getAuthHeaders()
      });

      if (response.data && response.data.data) {
        console.log(`✅ Fetched ${response.data.data.length} areas`);
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length
        };
      }

      return { success: false, data: [], count: 0 };
    } catch (error) {
      console.error('❌ Failed to fetch areas:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Process attendance data for frontend
   */
  processAttendanceData(attendanceData, employeeData = []) {
    if (!Array.isArray(attendanceData)) return [];

    // Create employee lookup map
    const employeeMap = new Map();
    employeeData.forEach(emp => {
      employeeMap.set(emp.emp_code?.trim(), emp);
    });

    const processedData = attendanceData.map(record => {
      const employee = employeeMap.get(record.emp_code?.trim());
      
      return {
        _id: `zkbio-${record.id}`,
        employee: {
          _id: record.emp,
          employeeId: record.emp_code?.trim(),
          firstName: record.first_name || employee?.first_name || '',
          lastName: record.last_name || employee?.last_name || '',
          fullName: record.first_name || employee?.full_name || '',
          department: record.department || employee?.department?.dept_name || '',
          position: record.position || employee?.position?.position_name || '',
          areas: employee?.area || []
        },
        date: record.punch_time?.split(' ')[0] || new Date().toISOString().split('T')[0],
        checkIn: {
          time: record.punch_time ? new Date(record.punch_time).toISOString() : null,
          location: record.area_alias || 'Unknown',
          method: record.verify_type_display || 'Unknown',
          deviceId: record.terminal_sn || 'Unknown'
        },
        checkOut: null, // Will be populated by processing logic
        status: record.punch_state_display || 'Unknown',
        deviceType: 'ZKBio Time',
        deviceId: record.terminal_sn || 'Unknown',
        temperature: record.temperature || null,
        isMask: record.is_mask || null,
        uploadTime: record.upload_time ? new Date(record.upload_time).toISOString() : null,
        originalRecord: record,
        // Add latest activity time for sorting
        latestActivityTime: record.punch_time ? new Date(record.punch_time).getTime() : 0
      };
    });

    // Sort by latest activity time (check-in or check-out) - newest first
    return processedData.sort((a, b) => b.latestActivityTime - a.latestActivityTime);
  }

  /**
   * Group attendance by employee and date
   */
  groupAttendanceByEmployee(attendanceData) {
    const grouped = new Map();

    attendanceData.forEach(record => {
      const key = `${record.emp_code}-${record.punch_time?.split(' ')[0]}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          employee: record,
          checkIns: [],
          checkOuts: [],
          date: record.punch_time?.split(' ')[0]
        });
      }

      const group = grouped.get(key);
      
      if (record.punch_state_display === 'Check In') {
        group.checkIns.push(record);
      } else if (record.punch_state_display === 'Check Out') {
        group.checkOuts.push(record);
      }
    });

    return Array.from(grouped.values());
  }

  /**
   * Get absent employees for a specific date (optimized)
   * @param {string} targetDate - Date in YYYY-MM-DD format
   * @param {Object} options - Options for filtering
   * @returns {Object} Absent employees data
   */
  async getAbsentEmployees(targetDate, options = {}) {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      const {
        excludeWeekends = true,
        excludeHolidays = true,
        onlyActiveEmployees = true
      } = options;

      console.log(`📊 Fetching absent employees for ${targetDate}...`);

      // Use cached data if available and recent (within 1 minute for absent employees)
      const cacheKey = `absent_${targetDate}`;
      if (this.isCacheValid(cacheKey, 'attendance')) {
        const cachedData = this.getCachedData(cacheKey, 'attendance');
        console.log(`📊 Returning cached absent employees data for ${targetDate}`);
        return cachedData;
      }

      // Check if it's a weekend
      const targetDateObj = new Date(targetDate);
      const isWeekend = targetDateObj.getDay() === 0 || targetDateObj.getDay() === 6;
      
      if (excludeWeekends && isWeekend) {
        return {
          success: true,
          data: [],
          summary: {
            totalAbsent: 0,
            totalEmployees: 0,
            absentPercentage: 0,
            workingDay: false,
            reason: 'Weekend'
          },
          message: 'No absent employees on weekends'
        };
      }

      // Parallel fetch: employees and attendance records
      const [employeeResult, attendanceResult] = await Promise.all([
        this.getEmployees(),
        this.getAttendanceForDate(targetDate) // Use specific date attendance instead of today
      ]);

      if (!employeeResult.success) {
        throw new Error('Failed to fetch employees');
      }

      // Filter active employees only
      let employees = employeeResult.data;
      if (onlyActiveEmployees) {
        employees = employees.filter(emp => emp.is_active !== false);
      }

      // Create a Set of present employee IDs for O(1) lookup
      const presentEmployeeIds = new Set();
      if (attendanceResult.success && attendanceResult.data) {
        attendanceResult.data.forEach(record => {
          // Check both direct emp_code and nested originalRecord.emp_code
          const empCode = record.emp_code || record.originalRecord?.emp_code;
          if (empCode) {
            presentEmployeeIds.add(empCode.trim());
          }
        });
      }

      // Find absent employees
      const absentEmployees = employees.filter(employee => 
        !presentEmployeeIds.has(employee.emp_code?.trim())
      );

      // Transform data for frontend
      const transformedData = absentEmployees.map(emp => ({
        employeeId: emp.emp_code,
        firstName: emp.first_name || '',
        lastName: emp.last_name || '',
        fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        department: emp.department?.dept_name || 'N/A',
        position: emp.position?.position_name || 'N/A',
        absenceDate: targetDate,
        absenceReason: 'No punch record',
        isWeekend: isWeekend,
        isHoliday: false, // TODO: Implement holiday check
        employeeData: emp
      }));

      const summary = {
        totalAbsent: absentEmployees.length,
        totalEmployees: employees.length,
        absentPercentage: employees.length > 0 ? Math.round((absentEmployees.length / employees.length) * 100) : 0,
        workingDay: !isWeekend,
        presentEmployees: employees.length - absentEmployees.length,
        date: targetDate
      };

      console.log(`✅ Found ${absentEmployees.length} absent employees out of ${employees.length} total`);

      const result = {
        success: true,
        data: transformedData,
        summary,
        source: 'ZKBio Time API',
        message: `Found ${absentEmployees.length} absent employees for ${targetDate}`
      };

      // Cache the result with shorter TTL for absent employees (1 minute)
      this.setCachedData(result, cacheKey, 'attendance');

      return result;

    } catch (error) {
      console.error('❌ Failed to fetch absent employees:', error.message);
      return { 
        success: false, 
        data: [], 
        summary: {
          totalAbsent: 0,
          totalEmployees: 0,
          absentPercentage: 0,
          workingDay: true,
          presentEmployees: 0,
          date: targetDate
        },
        error: error.message 
      };
    }
  }

  /**
   * Get bulk attendance data for multiple employees by month (OPTIMIZED)
   * @param {Array} employeeIds - Array of employee IDs
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Bulk attendance data for all employees
   */
  async getBulkAttendanceByMonth(employeeIds, month, year) {
    try {
      console.log(`🔧 Fetching bulk attendance data for ${employeeIds.length} employees from ZKBio Time API - ${month}/${year}`);
      
      // Create date range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      
      // Make bulk request for all employees
      const response = await axios.post(`${this.baseURL}/personnel/api/attendance/bulk/`, {
        employeeIds,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }, {
        headers: this.getAuthHeaders()
      });
      
      if (response.data && response.data.success && response.data.data) {
        console.log(`✅ Successfully fetched bulk attendance data for ${employeeIds.length} employees`);
        return response.data.data;
      } else {
        console.log('⚠️ No bulk attendance data received from ZKBio Time API');
        
        // Return empty data structure for all employees
        const emptyData = {};
        for (const employeeId of employeeIds) {
          emptyData[employeeId] = { records: [] };
        }
        return emptyData;
      }
    } catch (error) {
      console.error('❌ Error fetching bulk attendance data from ZKBio Time API:', error.message);
      
      // Return empty data structure for all employees as fallback
      const emptyData = {};
      for (const employeeId of employeeIds) {
        emptyData[employeeId] = { records: [] };
      }
      return emptyData;
    }
  }
}

// Export singleton instance
module.exports = new ZKBioTimeApiService();
