const express = require('express');
const router = express.Router();
const BiometricIntegration = require('../models/hr/BiometricIntegration');
const biometricService = require('../services/biometricService');
const attendanceService = require('../services/attendanceService');
const zktecoService = require('../services/zktecoService');
const scheduledSyncService = require('../services/scheduledSyncService');
const { authMiddleware } = require('../middleware/auth');
const { errorHandler } = require('../middleware/errorHandler');

// Get all biometric integrations
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching biometric integrations...');
    const integrations = await BiometricIntegration.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    console.log('Found integrations:', integrations.length);
    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    console.error('Error fetching biometric integrations:', error);
    errorHandler(error, req, res);
  }
});

// Get single biometric integration
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    res.json({
      success: true,
      data: integration
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Create new biometric integration
router.post('/', authMiddleware, async (req, res) => {
  try {
    const integrationData = {
      ...req.body,
      createdBy: req.user.id
    };

    const integration = new BiometricIntegration(integrationData);
    await integration.save();

    const populatedIntegration = await BiometricIntegration.findById(integration._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Biometric integration created successfully',
      data: populatedIntegration
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Update biometric integration
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'createdBy') {
        integration[key] = req.body[key];
      }
    });

    integration.updatedBy = req.user.id;
    await integration.save();

    const updatedIntegration = await BiometricIntegration.findById(integration._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Biometric integration updated successfully',
      data: updatedIntegration
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Delete biometric integration
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    integration.isActive = false;
    integration.updatedBy = req.user.id;
    await integration.save();

    res.json({
      success: true,
      message: 'Biometric integration deleted successfully'
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Test biometric integration connection
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    if (!integration.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Biometric integration is not active'
      });
    }

    const result = await integration.testConnection();

    res.json({
      success: true,
      message: 'Connection test completed',
      data: result
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Sync attendance from biometric system
router.post('/:id/sync', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    if (!integration.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Biometric integration is not active'
      });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    // Use the attendance service to sync biometric attendance
    const result = await attendanceService.syncBiometricAttendance(integration._id, start, end);

    res.json({
      success: true,
      message: 'Attendance sync completed successfully',
      data: {
        syncPeriod: { start, end },
        ...result
      }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Process and save biometric data to attendance database
router.post('/:id/process-to-attendance', authMiddleware, async (req, res) => {
  try {
    const { daysBack = 7 } = req.body;
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    if (!integration.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Biometric integration is not active'
      });
    }

    console.log(`📥 Processing biometric data to attendance database (last ${daysBack} days)...`);

    // Get raw attendance data from ZKTeco device
    const rawData = await zktecoService.getAttendanceData();
    
    if (!rawData.success || !rawData.data || rawData.data.length === 0) {
      return res.json({
        success: true,
        message: 'No attendance data found on device',
        data: {
          processed: 0,
          created: 0,
          updated: 0,
          errors: 0
        }
      });
    }

    // Filter out invalid records first
    const validRecords = rawData.data.filter(record => {
      const employeeId = record.uid || record.userId || record.deviceUserId;
      const timestamp = record.timestamp || record.recordTime;
      
      // Skip records with no employee ID or timestamp
      if (!employeeId || !timestamp || timestamp === undefined) {
        return false;
      }
      
      // Check if timestamp can be converted to valid date
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return false;
      }
      
      return true;
    });

    console.log(`📊 Filtered ${validRecords.length} valid records out of ${rawData.data.length} total records`);

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const filteredData = validRecords.filter(record => {
      const recordDate = new Date(record.timestamp || record.recordTime);
      return recordDate >= cutoffDate;
    });

    // Process each record
    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];

    const Employee = require('../models/hr/Employee');
    const Attendance = require('../models/hr/Attendance');

    for (const record of filteredData) {
      try {
        const employeeId = record.uid || record.userId || record.deviceUserId;
        const timestamp = new Date(record.timestamp || record.recordTime);
        
        if (!employeeId) {
          continue;
        }

        // Find employee by employeeId
        const employee = await Employee.findOne({ employeeId: employeeId.toString() });
        
        if (!employee) {
          errorDetails.push({
            employeeId,
            timestamp: record.timestamp,
            error: 'Employee not found in database'
          });
          errors++;
          continue;
        }

        // Get date (without time) for grouping
        const attendanceDate = new Date(timestamp);
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

        const isCheckIn = record.state === 1 || record.state === '1' || record.state === 'IN';
        
        if (!attendance) {
          // Create new attendance record
          attendance = new Attendance({
            employee: employee._id,
            date: attendanceDate,
            status: 'Present',
            isActive: true,
            createdBy: req.user.id
          });

          // Set check-in or check-out
          if (isCheckIn) {
            attendance.checkIn = {
              time: timestamp,
              location: 'Biometric Device',
              method: 'Biometric'
            };
          } else {
            attendance.checkOut = {
              time: timestamp,
              location: 'Biometric Device',
              method: 'Biometric'
            };
          }

          await attendance.save();
          created++;
        } else {
          // Update existing attendance record
          let needsUpdate = false;

          if (isCheckIn) {
            if (!attendance.checkIn || !attendance.checkIn.time || timestamp < attendance.checkIn.time) {
              attendance.checkIn = {
                time: timestamp,
                location: 'Biometric Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          } else {
            if (!attendance.checkOut || !attendance.checkOut.time || timestamp > attendance.checkOut.time) {
              attendance.checkOut = {
                time: timestamp,
                location: 'Biometric Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            attendance.updatedBy = req.user.id;
            await attendance.save();
            updated++;
          }
        }

        processed++;
      } catch (error) {
        console.error(`❌ Error processing record for employee ${record.uid || record.userId}:`, error.message);
        errorDetails.push({
          employeeId: record.uid || record.userId,
          timestamp: record.timestamp,
          error: error.message
        });
        errors++;
      }
    }

    res.json({
      success: true,
      message: 'Biometric data processed and saved to attendance database successfully',
      data: {
        totalRawRecords: rawData.data.length,
        filteredRecords: filteredData.length,
        processed,
        created,
        updated,
        errors,
        errorDetails: errorDetails.slice(0, 10), // Limit error details in response
        summary: {
          dateRange: `Last ${daysBack} days`,
          cutoffDate: cutoffDate.toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('Error processing biometric data to attendance:', error);
    errorHandler(error, req, res);
  }
});

// Start automatic sync for biometric integration
router.post('/:id/auto-sync/start', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    if (!integration.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Biometric integration is not active'
      });
    }

    // Enable auto-sync
    integration.syncConfig.autoSync = true;
    integration.updatedBy = req.user.id;
    await integration.save();

    // Start auto-sync using attendance service
    const result = await attendanceService.startAutoSync(integration._id);

    res.json({
      success: true,
      message: 'Auto-sync started successfully',
      data: result
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Stop automatic sync for biometric integration
router.post('/:id/auto-sync/stop', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    // Disable auto-sync
    integration.syncConfig.autoSync = false;
    integration.updatedBy = req.user.id;
    await integration.save();

    // Stop auto-sync using attendance service
    const result = await attendanceService.stopAutoSync(integration._id);

    res.json({
      success: true,
      message: 'Auto-sync stopped successfully',
      data: result
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get supported biometric systems
router.get('/systems/supported', authMiddleware, async (req, res) => {
  try {
    const supportedSystems = [
      {
        name: 'ZKTeco',
        description: 'ZKTeco biometric devices',
        integrationTypes: ['API', 'Database', 'FileImport'],
        features: ['Attendance', 'Users', 'Real-time sync']
      },
      {
        name: 'Hikvision',
        description: 'Hikvision access control systems',
        integrationTypes: ['API', 'Database'],
        features: ['Attendance', 'Users', 'Video integration']
      },
      {
        name: 'Suprema',
        description: 'Suprema biometric devices',
        integrationTypes: ['API', 'Database'],
        features: ['Attendance', 'Users', 'Fingerprint']
      },
      {
        name: 'Morpho',
        description: 'Morpho biometric devices',
        integrationTypes: ['API', 'Database'],
        features: ['Attendance', 'Users', 'Face recognition']
      },
      {
        name: 'Custom',
        description: 'Custom biometric system',
        integrationTypes: ['API', 'Database', 'FileImport', 'Webhook'],
        features: ['Custom integration']
      }
    ];

    res.json({
      success: true,
      data: supportedSystems
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get ZKTeco device information
router.get('/zkteco/info', authMiddleware, async (req, res) => {
  try {
    await zktecoService.connect('splaza.nayatel.net', 4370);
    const info = await zktecoService.getDeviceInfo();
    await zktecoService.disconnect();
    
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    console.error('ZKTeco info fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get attendance data from ZKTeco device
router.get('/zkteco/attendance', authMiddleware, async (req, res) => {
  try {
    await zktecoService.connect('splaza.nayatel.net', 4370);
    const attendance = await zktecoService.getAttendanceData();
    await zktecoService.disconnect();
    
    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('ZKTeco attendance fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Sync attendance data from ZKTeco to database
router.post('/zkteco/sync-attendance', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const result = await attendanceService.syncZKTecoAttendance(start, end);
    
    res.json({
      success: true,
      message: 'ZKTeco attendance data synced successfully',
      data: result
    });
  } catch (error) {
    console.error('ZKTeco sync error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get users from ZKTeco device
router.get('/zkteco/users', authMiddleware, async (req, res) => {
  try {
    await zktecoService.connect('splaza.nayatel.net', 4370);
    const users = await zktecoService.getUsers();
    await zktecoService.disconnect();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('ZKTeco users fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Test ZKTeco connection
router.get('/zkteco/test-connection', authMiddleware, async (req, res) => {
  try {
    console.log('🔄 Testing ZKTeco connection...');
    const result = await zktecoService.testConnection('splaza.nayatel.net', [4370, 5200, 5000]);
    
    console.log('✅ ZKTeco connection test completed successfully');
    res.json({
      success: true,
      message: 'ZKTeco connection test completed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ ZKTeco connection test error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to test ZKTeco connection',
      error: error.message 
    });
  }
});

// Scheduled sync service is already initialized as singleton

// Schedule daily sync for biometric integration
router.post('/:id/schedule-sync', authMiddleware, async (req, res) => {
  try {
    const { cronExpression } = req.body;
    const integrationId = req.params.id;

    const integration = await BiometricIntegration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    if (!integration.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Biometric integration is not active'
      });
    }

    // Use provided cron expression or default to 6 AM daily
    const cron = cronExpression || '0 6 * * *';
    
    const result = await scheduledSyncService.scheduleSync(integrationId, cron);
    
    res.json({
      success: true,
      message: 'Scheduled sync configured successfully',
      data: {
        integrationId,
        cronExpression: cron,
        nextRun: 'Daily at 6:00 AM',
        ...result
      }
    });
  } catch (error) {
    console.error('Error scheduling sync:', error);
    errorHandler(error, req, res);
  }
});

// Stop scheduled sync for biometric integration
router.post('/:id/schedule-sync/stop', authMiddleware, async (req, res) => {
  try {
    const integrationId = req.params.id;

    const integration = await BiometricIntegration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    const result = scheduledSyncService.stopScheduledSync(integrationId);
    
    // Update database
    integration.syncConfig.scheduledSync = false;
    integration.updatedBy = req.user.id;
    await integration.save();

    res.json({
      success: true,
      message: result ? 'Scheduled sync stopped successfully' : 'No scheduled sync was running',
      data: { integrationId }
    });
  } catch (error) {
    console.error('Error stopping scheduled sync:', error);
    errorHandler(error, req, res);
  }
});

// Setup daily 6 AM sync for all active integrations
router.post('/setup-daily-sync', authMiddleware, async (req, res) => {
  try {
    console.log('Setting up daily 6 AM sync for all active biometric integrations...');
    
    const results = await scheduledSyncService.setupDailySyncForAll();
    
    res.json({
      success: true,
      message: 'Daily sync setup completed for all active integrations',
      data: {
        processedIntegrations: results.length,
        results
      }
    });
  } catch (error) {
    console.error('Error setting up daily sync:', error);
    errorHandler(error, req, res);
  }
});

// Get scheduled sync status for all integrations
router.get('/schedule-sync/status', authMiddleware, async (req, res) => {
  try {
    const status = scheduledSyncService.getScheduledSyncStatus();
    
    // Get additional info from database
    const integrations = await BiometricIntegration.find({
      isActive: true,
      'syncConfig.scheduledSync': true
    }).select('systemName syncConfig');

    const detailedStatus = status.map(item => {
      const integration = integrations.find(i => i._id.toString() === item.integrationId);
      return {
        ...item,
        systemName: integration?.systemName || 'Unknown',
        cronExpression: integration?.syncConfig?.cronExpression || '0 6 * * *',
        lastSync: integration?.syncConfig?.lastSyncAt || null
      };
    });

    res.json({
      success: true,
      data: {
        activeSchedules: detailedStatus.length,
        schedules: detailedStatus
      }
    });
  } catch (error) {
    console.error('Error getting scheduled sync status:', error);
    errorHandler(error, req, res);
  }
});

module.exports = router; 