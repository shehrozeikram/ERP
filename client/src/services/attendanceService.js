import api from './api';

class AttendanceService {
  /**
   * Get all attendance records with pagination and filters
   */
  static async getAttendanceRecords(params = {}) {
    try {
      const response = await api.get('/attendance', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      throw error;
    }
  }

  // Real-time attendance method removed as requested

  /**
   * Get attendance statistics
   */
  static async getAttendanceStatistics(filters = {}) {
    try {
      const response = await api.get('/attendance/statistics', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance statistics:', error);
      throw error;
    }
  }

  /**
   * Get attendance report
   */
  static async getAttendanceReport(params = {}) {
    try {
      const response = await api.get('/attendance/report', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance report:', error);
      throw error;
    }
  }

  /**
   * Get latest attendance record
   */
  static async getLatestAttendance() {
    try {
      const response = await api.get('/attendance/latest');
      return response.data;
    } catch (error) {
      console.error('Error fetching latest attendance:', error);
      throw error;
    }
  }

  /**
   * Fetch ZKTeco attendance on-demand
   */
  static async fetchZKTecoAttendance(startDate = null, endDate = null) {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const response = await api.post('/attendance/fetch-zkteco', null, { params });
      
      return response.data;
    } catch (error) {
      console.error('❌ Frontend: Error fetching ZKTeco attendance:', error);
      throw error;
    }
  }

  /**
   * Create or update attendance record
   */
  static async createOrUpdateAttendance(attendanceData) {
    try {
      const response = await api.post('/attendance', attendanceData);
      return response.data;
    } catch (error) {
      console.error('Error creating/updating attendance:', error);
      throw error;
    }
  }

  /**
   * Bulk create attendance records
   */
  static async bulkCreateAttendance(records) {
    try {
      const response = await api.post('/attendance/bulk', { records });
      return response.data;
    } catch (error) {
      console.error('Error bulk creating attendance:', error);
      throw error;
    }
  }

  /**
   * Get attendance by ID
   */
  static async getAttendanceById(id) {
    try {
      const response = await api.get(`/attendance/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance by ID:', error);
      throw error;
    }
  }

  /**
   * Update attendance by ID
   */
  static async updateAttendance(id, attendanceData) {
    try {
      const response = await api.put(`/attendance/${id}`, attendanceData);
      return response.data;
    } catch (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }
  }

  /**
   * Delete attendance by ID
   */
  static async deleteAttendance(id) {
    try {
      const response = await api.delete(`/attendance/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting attendance:', error);
      throw error;
    }
  }

  /**
   * Process biometric data
   */
  static async processBiometricData(biometricData) {
    try {
      const response = await api.post('/attendance/biometric', biometricData);
      return response.data;
    } catch (error) {
      console.error('Error processing biometric data:', error);
      throw error;
    }
  }
}

/**
 * Get absent employees for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Absent employees data
 */
export const getAbsentEmployees = async (date, options = {}) => {
  try {
    const params = new URLSearchParams({
      date,
      excludeWeekends: options.excludeWeekends !== false ? 'true' : 'false',
      excludeHolidays: options.excludeHolidays !== false ? 'true' : 'false',
      onlyActiveEmployees: options.onlyActiveEmployees !== false ? 'true' : 'false'
    });

    const response = await fetch(`/api/zkbio/absent-employees?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching absent employees:', error);
    throw error;
  }
};

export default AttendanceService;
