const mongoose = require('mongoose');

const biometricIntegrationSchema = new mongoose.Schema({
  systemName: {
    type: String,
    required: [true, 'System name is required'],
    enum: ['ZKTeco', 'Hikvision', 'Suprema', 'Morpho', 'Custom', 'Other']
  },
  integrationType: {
    type: String,
    required: [true, 'Integration type is required'],
    enum: ['API', 'Database', 'FileImport', 'Webhook']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // API Configuration
  apiConfig: {
    baseUrl: String,
    apiKey: String,
    username: String,
    password: String,
    endpoints: {
      attendance: String,
      employees: String,
      devices: String
    },
    headers: mongoose.Schema.Types.Mixed
  },
  
  // Database Configuration
  dbConfig: {
    host: String,
    port: Number,
    database: String,
    username: String,
    password: String,
    tableName: String,
    connectionString: String
  },
  
  // File Import Configuration
  fileConfig: {
    importPath: String,
    fileFormat: {
      type: String,
      enum: ['CSV', 'Excel', 'JSON', 'XML']
    },
    delimiter: String,
    dateFormat: String,
    timeFormat: String,
    columnMapping: {
      employeeId: String,
      date: String,
      time: String,
      deviceId: String,
      direction: String // IN/OUT
    }
  },
  
  // Webhook Configuration
  webhookConfig: {
    endpoint: String,
    secretKey: String,
    eventTypes: [String]
  },
  
  // Data Mapping
  dataMapping: {
    employeeIdField: {
      type: String,
      default: 'employeeId'
    },
    dateField: {
      type: String,
      default: 'date'
    },
    timeField: {
      type: String,
      default: 'time'
    },
    deviceIdField: {
      type: String,
      default: 'deviceId'
    },
    directionField: {
      type: String,
      default: 'direction'
    }
  },
  
  // Sync Configuration
  syncConfig: {
    autoSync: {
      type: Boolean,
      default: false
    },
    syncInterval: {
      type: Number,
      default: 15 // minutes
    },
    // Scheduled sync configuration
    scheduledSync: {
      type: Boolean,
      default: false
    },
    cronExpression: {
      type: String,
      default: '0 6 * * *' // Daily at 6:00 AM
    },
    lastScheduleUpdate: Date,
    lastSyncAt: Date,
    syncStatus: {
      type: String,
      enum: ['idle', 'running', 'completed', 'failed'],
      default: 'idle'
    }
  },
  
  // Error Handling
  errorLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    error: String,
    details: mongoose.Schema.Types.Mixed
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
biometricIntegrationSchema.index({ isActive: 1 });
biometricIntegrationSchema.index({ systemName: 1 });

// Methods
biometricIntegrationSchema.methods.testConnection = async function() {
  // Implementation will vary based on integration type
  try {
    switch (this.integrationType) {
      case 'API':
        return await this.testAPIConnection();
      case 'Database':
        return await this.testDatabaseConnection();
      case 'FileImport':
        return await this.testFileAccess();
      case 'Webhook':
        return await this.testWebhookEndpoint();
      default:
        throw new Error('Unknown integration type');
    }
  } catch (error) {
    this.errorLog.push({
      error: error.message,
      details: { method: 'testConnection' }
    });
    await this.save();
    throw error;
  }
};

biometricIntegrationSchema.methods.syncAttendance = async function(startDate, endDate) {
  // Implementation will vary based on integration type
  try {
    this.syncConfig.syncStatus = 'running';
    this.syncConfig.lastSyncAt = new Date();
    await this.save();
    
    let attendanceData;
    switch (this.integrationType) {
      case 'API':
        attendanceData = await this.fetchFromAPI(startDate, endDate);
        break;
      case 'Database':
        attendanceData = await this.fetchFromDatabase(startDate, endDate);
        break;
      case 'FileImport':
        attendanceData = await this.importFromFile();
        break;
      case 'Webhook':
        // Webhooks are real-time, so this would just return current status
        attendanceData = [];
        break;
    }
    
    // Process and save attendance data
    const result = await this.processAttendanceData(attendanceData);
    
    this.syncConfig.syncStatus = 'completed';
    await this.save();
    
    return result;
  } catch (error) {
    this.syncConfig.syncStatus = 'failed';
    this.errorLog.push({
      error: error.message,
      details: { method: 'syncAttendance', startDate, endDate }
    });
    await this.save();
    throw error;
  }
};

module.exports = mongoose.model('BiometricIntegration', biometricIntegrationSchema); 