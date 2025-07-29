const express = require('express');
const router = express.Router();
const BiometricIntegration = require('../models/hr/BiometricIntegration');
const biometricService = require('../services/biometricService');
const zktecoService = require('../services/zktecoService');
const { authMiddleware } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');

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

// Delete biometric integration (soft delete)
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

    let result;
    switch (integration.integrationType) {
      case 'API':
        result = await biometricService.testAPIConnection(integration);
        break;
      case 'Database':
        result = await biometricService.testDatabaseConnection(integration);
        break;
      case 'FileImport':
        result = await biometricService.testFileAccess(integration);
        break;
      default:
        result = { success: false, message: 'Unknown integration type' };
    }

    res.json({
      success: true,
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

    // Fetch data from biometric system
    let rawData;
    switch (integration.integrationType) {
      case 'API':
        rawData = await biometricService.fetchFromAPI(integration, start, end);
        break;
      case 'Database':
        rawData = await biometricService.fetchFromDatabase(integration, start, end);
        break;
      case 'FileImport':
        rawData = await biometricService.importFromFile(integration);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported integration type'
        });
    }

    // Process and save attendance data
    const result = await biometricService.processAttendanceData(integration, rawData);

    res.json({
      success: true,
      message: 'Attendance sync completed successfully',
      data: {
        syncPeriod: { start, end },
        biometricRecords: rawData.length,
        ...result
      }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Start auto-sync
router.post('/:id/auto-sync/start', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    integration.syncConfig.autoSync = true;
    integration.updatedBy = req.user.id;
    await integration.save();

    // Start auto-sync
    await biometricService.startAutoSync(integration._id);

    res.json({
      success: true,
      message: 'Auto-sync started successfully'
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Stop auto-sync
router.post('/:id/auto-sync/stop', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    integration.syncConfig.autoSync = false;
    integration.updatedBy = req.user.id;
    await integration.save();

    // Stop auto-sync
    await biometricService.stopAutoSync(integration._id);

    res.json({
      success: true,
      message: 'Auto-sync stopped successfully'
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get sync status and history
router.get('/:id/sync-status', authMiddleware, async (req, res) => {
  try {
    const integration = await BiometricIntegration.findById(req.params.id);

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Biometric integration not found'
      });
    }

    res.json({
      success: true,
      data: {
        syncStatus: integration.syncConfig.syncStatus,
        lastSyncAt: integration.syncConfig.lastSyncAt,
        autoSync: integration.syncConfig.autoSync,
        syncInterval: integration.syncConfig.syncInterval,
        errorLog: integration.errorLog.slice(-10) // Last 10 errors
      }
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// Get supported biometric systems
router.get('/systems/supported', authMiddleware, async (req, res) => {
  try {
    const systems = [
      {
        name: 'ZKTeco',
        description: 'ZKTeco biometric devices and software',
        integrationTypes: ['API', 'Database', 'FileImport'],
        features: ['Fingerprint', 'Face Recognition', 'Card', 'Password']
      },
      {
        name: 'Hikvision',
        description: 'Hikvision access control and time attendance',
        integrationTypes: ['API', 'Database', 'FileImport'],
        features: ['Face Recognition', 'Card', 'Fingerprint']
      },
      {
        name: 'Suprema',
        description: 'Suprema biometric solutions',
        integrationTypes: ['API', 'Database', 'FileImport'],
        features: ['Fingerprint', 'Face Recognition', 'Card']
      },
      {
        name: 'Morpho',
        description: 'Morpho biometric devices',
        integrationTypes: ['API', 'Database', 'FileImport'],
        features: ['Fingerprint', 'Face Recognition', 'Iris']
      },
      {
        name: 'Custom',
        description: 'Custom biometric system integration',
        integrationTypes: ['API', 'Database', 'FileImport', 'Webhook'],
        features: ['Custom']
      }
    ];

    res.json({
      success: true,
      data: systems
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});

// ===== ZKTeco Specific Routes =====

// Test ZKTeco device connection
router.get('/zkteco/test-connection', authMiddleware, async (req, res) => {
  try {
    const result = await zktecoService.testConnection('splaza.nayatel.net', [4370, 5200, 5000]);
    res.json({
      success: true,
      message: 'ZKTeco connection test completed',
      data: result
    });
  } catch (error) {
    console.error('ZKTeco connection test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get ZKTeco device information
router.get('/zkteco/device-info', authMiddleware, async (req, res) => {
  try {
    await zktecoService.connect('splaza.nayatel.net', 4370);
    const deviceInfo = await zktecoService.getDeviceInfo();
    await zktecoService.disconnect();
    
    res.json({
      success: true,
      data: deviceInfo
    });
  } catch (error) {
    console.error('ZKTeco device info error:', error);
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
    await zktecoService.connect('splaza.nayatel.net', 4370);
    const syncResult = await zktecoService.syncAttendanceToDatabase();
    await zktecoService.disconnect();
    
    res.json({
      success: true,
      message: 'ZKTeco attendance data synced successfully',
      data: syncResult
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

module.exports = router; 