const axios = require('axios');

/**
 * ZKBio Time API Service
 * Optimized service for ZKBio Time integration
 */
class ZKBioTimeApiService {
  constructor() {
    this.baseURL = 'http://182.180.55.96:85';
    this.token = null;
    this.tokenExpiry = null;
    this.credentials = {
      username: 'superuser',
      password: 'SGCit123456'
    };
  }

  /**
   * Get authentication headers
   */
  getAuthHeaders() {
    return {
      'Authorization': `Token ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Authenticate with ZKBio Time
   */
  async authenticate() {
    try {
      console.log('🔐 Authenticating with ZKBio Time API...');
      
      const response = await axios.post(`${this.baseURL}/api-token-auth/`, {
        username: this.credentials.username,
        password: this.credentials.password
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
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
   * Check if token is valid
   */
  isTokenValid() {
    return this.token && this.tokenExpiry && new Date() < this.tokenExpiry;
  }

  /**
   * Ensure authentication
   */
  async ensureAuth() {
    if (!this.isTokenValid()) {
      return await this.authenticate();
    }
    return true;
  }

  /**
   * Get all employees
   */
  async getEmployees() {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log('👥 Fetching employees from ZKBio Time...');
      
      const response = await axios.get(`${this.baseURL}/personnel/api/employees/`, {
        headers: this.getAuthHeaders()
      });

      if (response.data && response.data.data) {
        console.log(`✅ Fetched ${response.data.data.length} employees`);
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length
        };
      }

      return { success: false, data: [], count: 0 };
    } catch (error) {
      console.error('❌ Failed to fetch employees:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get today's attendance
   */
  async getTodayAttendance() {
    try {
      // Force fresh authentication
      await this.authenticate();

      const today = new Date();
      const startTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`;
      const endTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59`;

      const response = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          start_time: startTime,
          end_time: endTime,
          limit: 1000,
          ordering: '-punch_time'
        }
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length,
          source: 'Today'
        };
      }

      // If no today's data, try without date filter to get latest data
      const latestResponse = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          limit: 1000,
          ordering: '-punch_time'
        }
      });

      if (latestResponse.data && latestResponse.data.data && latestResponse.data.data.length > 0) {
        return {
          success: true,
          data: latestResponse.data.data,
          count: latestResponse.data.count || latestResponse.data.data.length,
          source: 'Latest'
        };
      }

      return { success: false, data: [], count: 0, source: 'None' };
    } catch (error) {
      console.error('❌ Failed to fetch attendance:', error.message);
      return { success: false, data: [], count: 0, error: error.message };
    }
  }

  /**
   * Get employee attendance history with pagination support
   */
  async getEmployeeAttendanceHistory(employeeCode, limit = 1000, offset = 0) {
    try {
      if (!(await this.ensureAuth())) {
        throw new Error('Authentication failed');
      }

      console.log(`🔍 Fetching attendance history for employee ${employeeCode} (limit: ${limit}, offset: ${offset})...`);
      
      const response = await axios.get(`${this.baseURL}/iclock/api/transactions/`, {
        headers: this.getAuthHeaders(),
        params: {
          emp_code: employeeCode,
          limit: limit,
          offset: offset,
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
          hasMore: response.data.data.length === limit
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
      let offset = 0;
      const limit = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const result = await this.getEmployeeAttendanceHistory(employeeCode, limit, offset);
        
        if (!result.success) {
          console.error('❌ Failed to fetch attendance records');
          break;
        }
        
        allRecords = allRecords.concat(result.data);
        hasMore = result.hasMore;
        offset += limit;
        
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
        return {
          success: true,
          data: response.data.data,
          count: response.data.count || response.data.data.length
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
}

// Export singleton instance
module.exports = new ZKBioTimeApiService();
