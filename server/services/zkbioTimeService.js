const axios = require('axios');
const { getZKBioTimeConfig, getUserAgent, updateCookies } = require('../config/zktecoConfig');

/**
 * ZKBio Time Service
 * Handles authentication and API communication with ZKBio Time system
 */
class ZKBioTimeService {
  constructor() {
    this.config = getZKBioTimeConfig();
    this.baseURL = this.config.baseURL;
    this.credentials = this.config.credentials;
    this.endpoints = this.config.endpoints;
    this.isAuthenticated = false;
    this.sessionCookies = null;
    this.csrfToken = null;
  }

  /**
   * Authenticate with ZKBio Time using superuser credentials
   * @returns {Object} Authentication result
   */
  async authenticate() {
    try {
      console.log('🔐 Authenticating with ZKBio Time...');
      
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
        
        return {
          success: true,
          message: 'Successfully authenticated with ZKBio Time',
          cookies: this.sessionCookies,
          csrfToken: this.csrfToken
        };
      } else {
        throw new Error('Authentication verification failed');
      }

    } catch (error) {
      console.error('❌ ZKBio Time authentication failed:', error.message);
      this.isAuthenticated = false;
      
      return {
        success: false,
        message: 'Authentication failed',
        error: error.message
      };
    }
  }

  /**
   * Check if currently authenticated
   * @returns {boolean} Authentication status
   */
  isLoggedIn() {
    return this.isAuthenticated && this.sessionCookies;
  }

  /**
   * Get authenticated headers for API requests
   * @returns {Object} Headers with authentication
   */
  getAuthHeaders() {
    if (!this.isLoggedIn()) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    return {
      'Cookie': this.sessionCookies,
      'X-CSRFToken': this.csrfToken,
      'User-Agent': getUserAgent(),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': `${this.baseURL}${this.endpoints.dashboard}`
    };
  }

  /**
   * Test connection to ZKBio Time
   * @returns {Object} Connection test result
   */
  async testConnection() {
    try {
      console.log('🔍 Testing ZKBio Time connection...');
      
      const response = await axios.get(`${this.baseURL}/`, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': getUserAgent()
        }
      });

      if (response.status === 200) {
        console.log('✅ ZKBio Time server is reachable');
        return {
          success: true,
          message: 'ZKBio Time server is reachable',
          status: response.status,
          server: 'ZKBio Time'
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ ZKBio Time connection test failed:', error.message);
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  /**
   * Get employees from ZKBio Time
   * @returns {Object} Employees data
   */
  async getEmployees() {
    try {
      if (!this.isLoggedIn()) {
        await this.authenticate();
      }

      console.log('👥 Fetching employees from ZKBio Time...');
      
      const response = await axios.get(`${this.baseURL}${this.endpoints.employees}`, {
        headers: this.getAuthHeaders(),
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        console.log(`✅ Retrieved ${response.data?.length || 0} employees`);
        return {
          success: true,
          data: response.data || [],
          count: response.data?.length || 0,
          source: 'ZKBio Time API'
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ Failed to fetch employees:', error.message);
      return {
        success: false,
        message: 'Failed to fetch employees',
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Get attendance records from ZKBio Time
   * @param {Date} startDate - Start date for attendance records
   * @param {Date} endDate - End date for attendance records
   * @returns {Object} Attendance data
   */
  async getAttendanceRecords(startDate = null, endDate = null) {
    try {
      if (!this.isLoggedIn()) {
        await this.authenticate();
      }

      console.log('📊 Fetching attendance records from ZKBio Time...');
      
      // Build query parameters
      const params = new URLSearchParams();
      if (startDate) {
        params.append('start_date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.append('end_date', endDate.toISOString().split('T')[0]);
      }

      const url = `${this.baseURL}${this.endpoints.attendance}${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        const records = response.data || [];
        console.log(`✅ Retrieved ${records.length} attendance records`);
        return {
          success: true,
          data: records,
          count: records.length,
          source: 'ZKBio Time API',
          dateRange: {
            start: startDate,
            end: endDate
          }
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ Failed to fetch attendance records:', error.message);
      return {
        success: false,
        message: 'Failed to fetch attendance records',
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Get real-time attendance data from ZKBio Time
   * @returns {Object} Real-time attendance data
   */
  async getRealTimeAttendance() {
    try {
      if (!this.isLoggedIn()) {
        await this.authenticate();
      }

      console.log('⚡ Fetching real-time attendance from ZKBio Time...');
      
      const response = await axios.get(`${this.baseURL}${this.endpoints.realtime}`, {
        headers: this.getAuthHeaders(),
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        const realTimeData = response.data || [];
        console.log(`✅ Retrieved ${realTimeData.length} real-time records`);
        return {
          success: true,
          data: realTimeData,
          count: realTimeData.length,
          source: 'ZKBio Time Real-time API',
          timestamp: new Date()
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ Failed to fetch real-time attendance:', error.message);
      return {
        success: false,
        message: 'Failed to fetch real-time attendance',
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Sync attendance data to database (similar to existing ZKTeco sync)
   * @param {Date} startDate - Start date for sync
   * @param {Date} endDate - End date for sync
   * @returns {Object} Sync result
   */
  async syncAttendanceToDatabase(startDate = null, endDate = null) {
    try {
      console.log('🔄 Starting ZKBio Time attendance sync to database...');
      
      // Get attendance records from ZKBio Time
      const attendanceResult = await this.getAttendanceRecords(startDate, endDate);
      
      if (!attendanceResult.success || !attendanceResult.data) {
        throw new Error('Failed to fetch attendance data from ZKBio Time');
      }

      // Import required models
      const Attendance = require('../models/hr/Attendance');
      const Employee = require('../models/hr/Employee');
      const { processZKTecoTimestamp } = require('../utils/timezoneHelper');

      const syncedRecords = [];
      const errors = [];
      let created = 0;
      let updated = 0;

      for (const record of attendanceResult.data) {
        try {
          // Extract employee ID and timestamp from ZKBio Time record
          const employeeId = record.employee_id || record.user_id || record.uid;
          const rawTimestamp = record.timestamp || record.punch_time || record.record_time;
          
          if (!employeeId || !rawTimestamp) {
            errors.push({
              record,
              error: 'Missing employee ID or timestamp'
            });
            continue;
          }

          // Process timestamp (handle Pakistan timezone)
          const timestamp = processZKTecoTimestamp(rawTimestamp);
          if (!timestamp) {
            errors.push({
              record,
              error: 'Invalid timestamp format'
            });
            continue;
          }

          // Find employee in database
          const employee = await Employee.findOne({ employeeId: employeeId.toString() });
          if (!employee) {
            errors.push({
              employeeId,
              timestamp: rawTimestamp,
              error: 'Employee not found in database'
            });
            continue;
          }

          // Get attendance date
          const attendanceDate = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());

          // Find existing attendance record
          let attendance = await Attendance.findOne({
            employee: employee._id,
            date: {
              $gte: attendanceDate,
              $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
            },
            isActive: true
          });

          const isCheckIn = record.state === 1 || record.state === '1' || record.state === 'IN' || record.direction === 'IN';
          
          if (!attendance) {
            // Create new attendance record
            attendance = new Attendance({
              employee: employee._id,
              date: attendanceDate,
              status: 'Present',
              isActive: true,
              deviceType: 'ZKBio Time',
              deviceId: 'zkbio-time-system'
            });
            created++;
          } else {
            updated++;
          }

          // Update check-in/check-out times
          if (isCheckIn) {
            if (!attendance.checkIn || !attendance.checkIn.time || timestamp < attendance.checkIn.time) {
              attendance.checkIn = {
                time: timestamp,
                location: 'ZKBio Time System',
                method: 'Biometric'
              };
            }
          } else {
            if (!attendance.checkOut || !attendance.checkOut.time || timestamp > attendance.checkOut.time) {
              attendance.checkOut = {
                time: timestamp,
                location: 'ZKBio Time System',
                method: 'Biometric'
              };
            }
          }

          await attendance.save();
          syncedRecords.push(attendance);

        } catch (error) {
          console.error(`❌ Error processing record for employee ${record.employee_id || record.user_id || record.uid}:`, error.message);
          errors.push({
            record,
            error: error.message
          });
        }
      }

      console.log(`✅ ZKBio Time sync completed: ${created} created, ${updated} updated, ${errors.length} errors`);
      
      return {
        success: true,
        message: 'ZKBio Time attendance sync completed',
        data: {
          totalRecords: attendanceResult.data.length,
          syncedRecords: syncedRecords.length,
          created,
          updated,
          errors: errors.length,
          errorDetails: errors.slice(0, 10) // Limit error details
        }
      };

    } catch (error) {
      console.error('❌ ZKBio Time sync failed:', error.message);
      return {
        success: false,
        message: 'ZKBio Time sync failed',
        error: error.message
      };
    }
  }
}

module.exports = new ZKBioTimeService();
