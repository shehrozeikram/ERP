const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getZKBioTimeConfig, getUserAgent, updateCookies } = require('../config/zktecoConfig');
const { getPakistanDayRange } = require('../utils/timezoneHelper');

/**
 * ZKBio Time API Service
 * Optimized service with persistent session storage and proactive refresh
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
    this.lastAuthFailureTime = 0;
    this.sessionExpiryTime = null; // Track when session expires
    this.refreshInterval = null; // Background refresh interval
    
    // Session storage file path
    this.sessionFile = path.join(__dirname, '..', 'zkbio-session.json');
    
    // Cache
    this.cache = {
      employees: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
      attendance: { data: {}, timestamp: {}, ttl: 2 * 60 * 1000 }
    };
    
    // Load persisted session on startup
    this.loadSession();
    
    // Start proactive refresh (every 15 minutes)
    this.startProactiveRefresh();
  }

  /**
   * Save session to file
   */
  saveSession() {
    try {
      const sessionData = {
        sessionCookies: this.sessionCookies,
        csrfToken: this.csrfToken,
        isAuthenticated: this.isAuthenticated,
        sessionExpiryTime: this.sessionExpiryTime,
        savedAt: Date.now()
      };
      fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save session:', error.message);
    }
  }

  /**
   * Load session from file
   */
  loadSession() {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
        const now = Date.now();
        
        // Check if session is still valid (not expired)
        if (sessionData.sessionExpiryTime && now < sessionData.sessionExpiryTime) {
          this.sessionCookies = sessionData.sessionCookies;
          this.csrfToken = sessionData.csrfToken;
          this.isAuthenticated = sessionData.isAuthenticated;
          this.sessionExpiryTime = sessionData.sessionExpiryTime;
          console.log('✅ Loaded valid session from file');
          return true;
        } else {
          console.log('⚠️ Saved session expired, will re-authenticate');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load session:', error.message);
    }
    return false;
  }

  /**
   * Start proactive session refresh (every 15 minutes)
   */
  startProactiveRefresh() {
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Refresh every 15 minutes (900000ms)
    this.refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Proactive session refresh...');
        await this.ensureAuth();
      } catch (error) {
        console.error('❌ Proactive refresh failed:', error.message);
      }
    }, 15 * 60 * 1000);
    
    console.log('✅ Proactive session refresh started (every 15 minutes)');
  }

  /**
   * Stop proactive refresh (cleanup)
   */
  stopProactiveRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
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
      
      // Clear any existing session data
      this.isAuthenticated = false;
      this.sessionCookies = null;
      this.csrfToken = null;
      
      // First, get the login page to extract CSRF token
      const loginPageResponse = await axios.get(`${this.baseURL}${this.endpoints.login}`, {
        headers: {
          'User-Agent': getUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000
      });

      // Extract CSRF token from the login page
      const csrfMatch = loginPageResponse.data.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
      if (csrfMatch) {
        this.csrfToken = csrfMatch[1];
        console.log('✅ CSRF token extracted:', this.csrfToken.substring(0, 10) + '...');
      } else {
        console.error('❌ Failed to extract CSRF token from login page');
        return false;
      }

      // Prepare login data
      const loginData = new URLSearchParams({
        'username': this.credentials.username,
        'password': this.credentials.password,
        'csrfmiddlewaretoken': this.csrfToken
      });

      console.log(`🔑 Attempting login with username: ${this.credentials.username}`);

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
        timeout: 15000,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });

      console.log(`📡 Login response status: ${loginResponse.status}`);

      // Extract session cookies from response
      const setCookieHeaders = loginResponse.headers['set-cookie'];
      if (setCookieHeaders && setCookieHeaders.length > 0) {
        this.sessionCookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
        console.log('✅ Session cookies obtained:', setCookieHeaders.length, 'cookies');
        
        // Update the global config with new cookies
        const cookieObj = {};
        setCookieHeaders.forEach(cookie => {
          const [name, value] = cookie.split(';')[0].split('=');
          cookieObj[name.trim()] = value.trim();
        });
        updateCookies(cookieObj);
      } else {
        console.error('❌ No session cookies received from login response');
        console.error('   Login response headers:', JSON.stringify(loginResponse.headers, null, 2));
        return false;
      }

      // Verify authentication by accessing dashboard
      console.log('🔍 Verifying authentication by accessing dashboard...');
      const dashboardResponse = await axios.get(`${this.baseURL}${this.endpoints.dashboard}`, {
        headers: {
          'Cookie': this.sessionCookies,
          'User-Agent': getUserAgent()
        },
        timeout: 10000
      });

      console.log(`📊 Dashboard response status: ${dashboardResponse.status}`);

      if (dashboardResponse.status === 200 && !dashboardResponse.data.includes('login')) {
        this.isAuthenticated = true;
        // Set session expiry to 50 minutes from now (refresh before 60 min expiry)
        this.sessionExpiryTime = Date.now() + (50 * 60 * 1000);
        this.saveSession(); // Persist session
        console.log('✅ ZKBio Time authentication successful');
        return true;
      } else {
        console.error('❌ Authentication verification failed - dashboard contains login page');
        return false;
      }
      
    } catch (error) {
      console.error('❌ ZKBio Time authentication failed:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error stack:', error.stack?.substring(0, 500));
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('   Response data preview:', error.response.data?.substring?.(0, 200) || error.response.data);
      }
      if (error.request) {
        console.error('   Request made but no response received');
        console.error('   Request URL:', error.config?.url);
      }
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
   * Ensure authentication with retry logic and circuit breaker
   */
  async ensureAuth(retryCount = 0, maxRetries = 3) {
    // Circuit breaker: wait if recent failure
    const lastFailureTime = this.lastAuthFailureTime || 0;
    const timeSinceLastFailure = Date.now() - lastFailureTime;
    if (lastFailureTime > 0 && timeSinceLastFailure < 30000) {
      await new Promise(resolve => setTimeout(resolve, 30000 - timeSinceLastFailure));
    }

    // Check if session is expired (proactive check)
    if (this.sessionExpiryTime && Date.now() >= this.sessionExpiryTime) {
      console.log('⚠️ Session expired (proactive check), re-authenticating...');
      this.isAuthenticated = false;
      this.sessionCookies = null;
    }

    if (!this.isLoggedIn()) {
      const authResult = await this.authenticate();
      if (!authResult) {
        this.lastAuthFailureTime = Date.now();
        if (retryCount < maxRetries) {
          const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return await this.ensureAuth(retryCount + 1, maxRetries);
    }
        return false;
      }
      this.lastAuthFailureTime = 0;
      return true;
    }
    
    // Quick session test (only if close to expiry)
    const timeUntilExpiry = this.sessionExpiryTime ? (this.sessionExpiryTime - Date.now()) : 0;
    if (timeUntilExpiry < 5 * 60 * 1000) { // Test if less than 5 min until expiry
    try {
      const testResponse = await axios.get(`${this.baseURL}${this.endpoints.dashboard}`, {
          headers: { 'Cookie': this.sessionCookies, 'User-Agent': getUserAgent() },
          timeout: 10000
      });
      
      if (testResponse.status === 200 && !testResponse.data.includes('login')) {
          this.sessionExpiryTime = Date.now() + (50 * 60 * 1000);
          this.saveSession();
        return true;
      }
    } catch (error) {
        // Silent fail, will re-auth below
      }
    } else {
      return true; // Session still valid, no need to test
    }
    
    // Re-authenticate if test failed or session expired
    console.log('⚠️ Re-authenticating...');
      this.isAuthenticated = false;
      this.sessionCookies = null;
    const authResult = await this.authenticate();
    if (!authResult) {
      this.lastAuthFailureTime = Date.now();
      if (retryCount < maxRetries) {
        const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return await this.ensureAuth(retryCount + 1, maxRetries);
    }
      return false;
    }
    this.lastAuthFailureTime = 0;
    return true;
  }


  /**
   * Get all employees (with pagination to get all employees) - ROBUST VERSION
   */
  async getEmployees(retryCount = 0, maxRetries = 2) {
    try {
      // Check cache first - use stale cache if available even if expired (graceful degradation)
      const cachedData = this.getCachedData('employees', 'employees');
      const isCacheValid = this.isCacheValid('employees', 'employees');
      
      if (isCacheValid && cachedData) {
        console.log('👥 Returning cached employees data');
        return {
          success: true,
          data: cachedData,
          count: Array.isArray(cachedData) ? cachedData.length : 0,
          source: 'Cache'
        };
      }

      // Use stale cache if available (graceful degradation)
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log('⚠️ Using stale cache for employees (API may be unavailable)');
        return {
          success: true,
          data: cachedData,
          count: cachedData.length,
          source: 'Stale Cache',
          warning: 'Using cached data - API may be unavailable'
        };
      }

      if (!(await this.ensureAuth())) {
        // If auth fails but we have stale cache, return it
        if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
          console.log('⚠️ Auth failed, using stale cache');
          return {
            success: true,
            data: cachedData,
            count: cachedData.length,
            source: 'Stale Cache (Auth Failed)',
            warning: 'Authentication failed - using cached data'
          };
        }
        throw new Error('Authentication failed');
      }

      console.log('👥 Fetching all employees from ZKBio Time...');
      
      let allEmployees = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 200;
      const maxPages = 100; // Safety limit to prevent infinite loops
      
      while (hasMore && page <= maxPages) {
        try {
        const response = await axios.get(`${this.baseURL}/personnel/api/employees/`, {
          headers: this.getAuthHeaders(),
          params: {
            page_size: pageSize,
            page: page,
            ordering: 'emp_code'
            },
            timeout: 15000 // 15 second timeout per page
        });

          if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
          allEmployees = allEmployees.concat(response.data.data);
          console.log(`📄 Fetched page ${page}: ${response.data.data.length} employees`);
          
          // Check if there are more pages
          hasMore = response.data.next !== null && response.data.data.length === pageSize;
          page++;
        } else {
          hasMore = false;
          }
        } catch (pageError) {
          console.error(`❌ Error fetching page ${page}:`, pageError.message);
          // If we have some data, return it (partial success)
          if (allEmployees.length > 0) {
            console.log(`⚠️ Returning partial employee data (${allEmployees.length} employees)`);
            this.setCachedData(allEmployees, 'employees', 'employees');
            return {
              success: true,
              data: allEmployees,
              count: allEmployees.length,
              source: 'ZKBio Time API (Partial)',
              warning: `Fetched ${allEmployees.length} employees before error occurred`
            };
          }
          // If first page fails and we have retries, retry
          if (retryCount < maxRetries && page === 1) {
            console.log(`🔄 Retrying employee fetch (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return await this.getEmployees(retryCount + 1, maxRetries);
          }
          throw pageError;
        }
      }

      console.log(`✅ Total employees fetched: ${allEmployees.length}`);
      
      // Cache the result
      if (allEmployees.length > 0) {
      this.setCachedData(allEmployees, 'employees', 'employees');
      }
      
      return {
        success: true,
        data: allEmployees,
        count: allEmployees.length,
        source: 'ZKBio Time API'
      };

    } catch (error) {
      console.error('❌ Failed to fetch employees:', error.message);
      
      // Return stale cache if available
      const cachedData = this.getCachedData('employees', 'employees');
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log('⚠️ Returning stale cache due to error');
        return {
          success: true,
          data: cachedData,
          count: cachedData.length,
          source: 'Stale Cache (Error)',
          warning: `Error occurred: ${error.message} - using cached data`
        };
      }
      
      return { 
        success: false, 
        data: [], 
        count: 0, 
        error: error.message 
      };
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

      const { startDateTime: startTime, endDateTime: endTime, dateString } = getPakistanDayRange();

      console.log('📊 Fetching fresh today\'s attendance from ZKBio Time...');

      // Use larger page size for faster fetching
      const response = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
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
          source: dateString
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
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get attendance for a specific date - ROBUST VERSION
   */
  async getAttendanceForDate(targetDate, retryCount = 0, maxRetries = 2) {
    try {
      // Validate date format
      if (!targetDate || typeof targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error('❌ Invalid date format:', targetDate);
        return { success: false, data: [], count: 0, error: 'Invalid date format. Expected YYYY-MM-DD' };
      }

      // Check cache first
      const cacheKey = `attendance_${targetDate}`;
      const cachedData = this.getCachedData(cacheKey, 'attendance');
      const isCacheValid = this.isCacheValid(cacheKey, 'attendance');
      
      if (isCacheValid && cachedData) {
        console.log(`📊 Returning cached attendance data for ${targetDate}`);
        return {
          success: true,
          data: cachedData,
          count: Array.isArray(cachedData) ? cachedData.length : 0,
          source: 'Cache'
        };
      }

      // Use stale cache if available
      if (cachedData && Array.isArray(cachedData)) {
        console.log(`⚠️ Using stale cache for attendance ${targetDate} (API may be unavailable)`);
        return {
          success: true,
          data: cachedData,
          count: cachedData.length,
          source: 'Stale Cache',
          warning: 'Using cached data - API may be unavailable'
        };
      }

      if (!(await this.ensureAuth())) {
        // If auth fails but we have stale cache, return it
        if (cachedData && Array.isArray(cachedData)) {
          console.log('⚠️ Auth failed, using stale cache');
          return {
            success: true,
            data: cachedData,
            count: cachedData.length,
            source: 'Stale Cache (Auth Failed)',
            warning: 'Authentication failed - using cached data'
          };
        }
        throw new Error('Authentication failed');
      }

      const startTime = `${targetDate}T00:00:00`;
      const endTime = `${targetDate}T23:59:59`;

      console.log(`📊 Fetching attendance for ${targetDate} from ZKBio Time...`);

      // Fetch with pagination to handle large datasets
      let allRecords = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 500; // Reasonable page size
      const maxPages = 50; // Safety limit

      while (hasMore && page <= maxPages) {
        try {
          const response = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          start_time: startTime,
          end_time: endTime,
              page_size: pageSize,
              page: page,
          ordering: '-punch_time'
            },
            timeout: 20000 // 20 second timeout
      });

          if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
            allRecords = allRecords.concat(response.data.data);
            console.log(`📄 Fetched page ${page}: ${response.data.data.length} records`);
            
            hasMore = response.data.next !== null && response.data.data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        } catch (pageError) {
          console.error(`❌ Error fetching attendance page ${page} for ${targetDate}:`, pageError.message);
          // If we have some data, return it (partial success)
          if (allRecords.length > 0) {
            console.log(`⚠️ Returning partial attendance data (${allRecords.length} records)`);
            this.setCachedData(allRecords, cacheKey, 'attendance');
        return {
          success: true,
              data: allRecords,
              count: allRecords.length,
              source: targetDate + ' (Partial)',
              warning: `Fetched ${allRecords.length} records before error occurred`
            };
          }
          // If first page fails and we have retries, retry
          if (retryCount < maxRetries && page === 1) {
            console.log(`🔄 Retrying attendance fetch for ${targetDate} (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return await this.getAttendanceForDate(targetDate, retryCount + 1, maxRetries);
          }
          throw pageError;
        }
      }

      console.log(`✅ Fetched ${allRecords.length} attendance records for ${targetDate}`);
      
      // Cache the result
      if (allRecords.length > 0) {
        this.setCachedData(allRecords, cacheKey, 'attendance');
      } else {
        // Cache empty result too (to avoid repeated API calls for dates with no data)
        this.setCachedData([], cacheKey, 'attendance');
      }
      
      return {
        success: true,
        data: allRecords,
        count: allRecords.length,
        source: targetDate
      };
    } catch (error) {
      console.error(`❌ Failed to fetch attendance for ${targetDate}:`, error.message);
      
      // Return stale cache if available
      const cacheKey = `attendance_${targetDate}`;
      const cachedData = this.getCachedData(cacheKey, 'attendance');
      if (cachedData && Array.isArray(cachedData)) {
        console.log('⚠️ Returning stale cache due to error');
        return {
          success: true,
          data: cachedData,
          count: cachedData.length,
          source: 'Stale Cache (Error)',
          warning: `Error occurred: ${error.message} - using cached data`
        };
      }
      
      return { 
        success: false, 
        data: [], 
        count: 0, 
        error: error.message 
      };
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
      
      const response = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
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
      
      const response = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
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
      // Fetch all pages
      let all = [];
      let page = 1;
      const pageSize = 200;
      let hasMore = true;

      while (hasMore) {
        const resp = await axios.get(`${this.baseURL}/personnel/api/departments/`, {
          headers: this.getAuthHeaders(),
          params: { page_size: pageSize, page }
        });

        const data = resp.data && (resp.data.data || Array.isArray(resp.data) ? resp.data : []);
        const list = Array.isArray(resp.data?.data) ? resp.data.data : (Array.isArray(resp.data) ? resp.data : []);
        all = all.concat(list);
        const next = resp.data?.next;
        hasMore = !!next && list.length === pageSize;
        page += 1;
      }

      console.log(`✅ Fetched ${all.length} departments (all pages)`);
      return {
        success: true,
        data: all,
        count: all.length
      };
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
   * Get all devices/terminals from ZKBio Time
   */
  async getDevices() {
    try {
      const authResult = await this.ensureAuth();
      if (!authResult) {
        console.error('❌ ZKBio Time authentication failed after retries');
        return { success: false, data: [], count: 0, error: 'Authentication to ZKBio Time API failed. Please check server logs for details.' };
      }

      console.log('📱 Fetching devices from ZKBio Time...');

      const response = await axios.get(`${this.baseURL}/iclock/api/terminals/`, {
        headers: this.getAuthHeaders(),
        params: {
          page_size: 500,
          page: 1,
          ordering: 'sn'
        },
        timeout: 15000
      });

      if (response.data && (response.data.data || Array.isArray(response.data))) {
        const list = Array.isArray(response.data) ? response.data : (response.data.data || []);
        console.log(`✅ Fetched ${list.length} devices`);
        return { success: true, data: list, count: list.length };
      }

      return { success: false, data: [], count: 0, error: 'No device data received from ZKBio Time API' };
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error.message);
      return { success: false, data: [], count: 0, error: error.message || 'Failed to fetch devices from ZKBio Time API' };
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
        // ZKBio Time uses app_status for filtering active employees
        // app_status = 1 means inactive, app_status = 0 or undefined means active
        employees = employees.filter(emp => 
          emp.is_active !== false && 
          emp.app_status !== 1
        );
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
