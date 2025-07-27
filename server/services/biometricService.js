const axios = require('axios');
const mysql = require('mysql2/promise');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const Attendance = require('../models/hr/Attendance');
const Employee = require('../models/hr/Employee');
const BiometricIntegration = require('../models/hr/BiometricIntegration');

class BiometricService {
  constructor() {
    this.integrations = new Map();
  }

  // API Integration Methods
  async fetchFromAPI(integration, startDate, endDate) {
    const { apiConfig, dataMapping } = integration;
    
    try {
      const response = await axios({
        method: 'GET',
        url: `${apiConfig.baseUrl}${apiConfig.endpoints.attendance}`,
        headers: {
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'Content-Type': 'application/json',
          ...apiConfig.headers
        },
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      return this.mapAPIData(response.data, dataMapping);
    } catch (error) {
      throw new Error(`API fetch failed: ${error.message}`);
    }
  }

  mapAPIData(data, mapping) {
    return data.map(record => ({
      employeeId: record[mapping.employeeIdField],
      date: new Date(record[mapping.dateField]),
      time: new Date(record[mapping.timeField]),
      deviceId: record[mapping.deviceIdField],
      direction: record[mapping.directionField] || 'IN'
    }));
  }

  // Database Integration Methods
  async fetchFromDatabase(integration, startDate, endDate) {
    const { dbConfig, dataMapping } = integration;
    
    let connection;
    try {
      if (dbConfig.connectionString) {
        connection = await mysql.createConnection(dbConfig.connectionString);
      } else {
        connection = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database
        });
      }

      const query = `
        SELECT 
          ${dataMapping.employeeIdField} as employeeId,
          ${dataMapping.dateField} as date,
          ${dataMapping.timeField} as time,
          ${dataMapping.deviceIdField} as deviceId,
          ${dataMapping.directionField} as direction
        FROM ${dbConfig.tableName}
        WHERE ${dataMapping.dateField} BETWEEN ? AND ?
        ORDER BY ${dataMapping.dateField}, ${dataMapping.timeField}
      `;

      const [rows] = await connection.execute(query, [startDate, endDate]);
      await connection.end();

      return this.mapDatabaseData(rows, dataMapping);
    } catch (error) {
      if (connection) await connection.end();
      throw new Error(`Database fetch failed: ${error.message}`);
    }
  }

  mapDatabaseData(data, mapping) {
    return data.map(record => ({
      employeeId: record.employeeId,
      date: new Date(record.date),
      time: new Date(record.time),
      deviceId: record.deviceId,
      direction: record.direction || 'IN'
    }));
  }

  // File Import Methods
  async importFromFile(integration) {
    const { fileConfig } = integration;
    
    try {
      const filePath = path.resolve(fileConfig.importPath);
      const fileContent = await fs.readFile(filePath);
      
      let data;
      switch (fileConfig.fileFormat) {
        case 'CSV':
          data = await this.parseCSV(fileContent, fileConfig);
          break;
        case 'Excel':
          data = await this.parseExcel(fileContent, fileConfig);
          break;
        case 'JSON':
          data = JSON.parse(fileContent);
          break;
        default:
          throw new Error('Unsupported file format');
      }

      return this.mapFileData(data, fileConfig.columnMapping);
    } catch (error) {
      throw new Error(`File import failed: ${error.message}`);
    }
  }

  async parseCSV(fileContent, config) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = require('stream');
      const readable = stream.Readable.from(fileContent);
      
      readable
        .pipe(csv({ separator: config.delimiter || ',' }))
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseExcel(fileContent, config) {
    const workbook = xlsx.read(fileContent, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
  }

  mapFileData(data, mapping) {
    return data.map(record => ({
      employeeId: record[mapping.employeeId],
      date: new Date(record[mapping.date]),
      time: new Date(record[mapping.time]),
      deviceId: record[mapping.deviceId],
      direction: record[mapping.direction] || 'IN'
    }));
  }

  // Process and Save Attendance Data
  async processAttendanceData(integration, rawData) {
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      errors: []
    };

    for (const record of rawData) {
      try {
        // Find employee by employee ID
        const employee = await Employee.findOne({ 
          employeeId: record.employeeId 
        });

        if (!employee) {
          results.errors.push({
            employeeId: record.employeeId,
            error: 'Employee not found'
          });
          results.errors++;
          continue;
        }

        // Determine if this is check-in or check-out
        const isCheckIn = record.direction === 'IN';
        const attendanceDate = new Date(record.date);
        attendanceDate.setHours(0, 0, 0, 0);

        // Find existing attendance record for this employee and date
        let attendance = await Attendance.findOne({
          employee: employee._id,
          date: {
            $gte: attendanceDate,
            $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
          },
          isActive: true
        });

        if (!attendance) {
          // Create new attendance record
          attendance = new Attendance({
            employee: employee._id,
            date: record.date,
            checkIn: isCheckIn ? {
              time: record.time,
              location: 'Biometric Device',
              method: 'Biometric',
              deviceId: record.deviceId
            } : {},
            checkOut: !isCheckIn ? {
              time: record.time,
              location: 'Biometric Device',
              method: 'Biometric',
              deviceId: record.deviceId
            } : {},
            status: 'Present',
            createdBy: integration.createdBy
          });
          results.created++;
        } else {
          // Update existing attendance record
          if (isCheckIn) {
            attendance.checkIn = {
              time: record.time,
              location: 'Biometric Device',
              method: 'Biometric',
              deviceId: record.deviceId
            };
          } else {
            attendance.checkOut = {
              time: record.time,
              location: 'Biometric Device',
              method: 'Biometric',
              deviceId: record.deviceId
            };
          }
          attendance.updatedBy = integration.updatedBy;
          results.updated++;
        }

        await attendance.save();
        results.processed++;
      } catch (error) {
        results.errors.push({
          employeeId: record.employeeId,
          error: error.message
        });
        results.errors++;
      }
    }

    return results;
  }

  // Test Connection Methods
  async testAPIConnection(integration) {
    try {
      const response = await axios({
        method: 'GET',
        url: `${integration.apiConfig.baseUrl}/health`,
        headers: {
          'Authorization': `Bearer ${integration.apiConfig.apiKey}`,
          ...integration.apiConfig.headers
        },
        timeout: 5000
      });
      return { success: true, message: 'API connection successful' };
    } catch (error) {
      return { success: false, message: `API connection failed: ${error.message}` };
    }
  }

  async testDatabaseConnection(integration) {
    let connection;
    try {
      if (integration.dbConfig.connectionString) {
        connection = await mysql.createConnection(integration.dbConfig.connectionString);
      } else {
        connection = await mysql.createConnection({
          host: integration.dbConfig.host,
          port: integration.dbConfig.port,
          user: integration.dbConfig.username,
          password: integration.dbConfig.password,
          database: integration.dbConfig.database
        });
      }
      await connection.ping();
      await connection.end();
      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      if (connection) await connection.end();
      return { success: false, message: `Database connection failed: ${error.message}` };
    }
  }

  async testFileAccess(integration) {
    try {
      const filePath = path.resolve(integration.fileConfig.importPath);
      await fs.access(filePath);
      return { success: true, message: 'File access successful' };
    } catch (error) {
      return { success: false, message: `File access failed: ${error.message}` };
    }
  }

  // Auto-sync functionality
  async startAutoSync(integrationId) {
    const integration = await BiometricIntegration.findById(integrationId);
    if (!integration || !integration.syncConfig.autoSync) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours
        
        await this.syncAttendance(integration, startDate, endDate);
      } catch (error) {
        console.error('Auto-sync error:', error);
      }
    }, integration.syncConfig.syncInterval * 60 * 1000);

    this.integrations.set(integrationId, interval);
  }

  async stopAutoSync(integrationId) {
    const interval = this.integrations.get(integrationId);
    if (interval) {
      clearInterval(interval);
      this.integrations.delete(integrationId);
    }
  }
}

module.exports = new BiometricService(); 