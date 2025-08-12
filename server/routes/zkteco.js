const express = require('express');
const router = express.Router();
const { updateCookies, ZKTECO_CONFIG, getFormattedCookies } = require('../config/zktecoConfig');
const { authMiddleware } = require('../middleware/auth');

/**
 * @route   GET /api/zkteco/config
 * @desc    Get current ZKTeco configuration
 * @access  Private (Admin only)
 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    const config = {
      device: {
        host: ZKTECO_CONFIG.device.host,
        port: ZKTECO_CONFIG.device.port,
        websocketUrl: ZKTECO_CONFIG.device.websocketUrl
      },
      connection: ZKTECO_CONFIG.connection,
      logging: ZKTECO_CONFIG.logging,
      cookies: {
        account_info: ZKTECO_CONFIG.cookies.account_info.substring(0, 50) + '...',
        csrftoken: ZKTECO_CONFIG.cookies.csrftoken.substring(0, 20) + '...',
        django_language: ZKTECO_CONFIG.cookies.django_language,
        sessionid: ZKTECO_CONFIG.cookies.sessionid.substring(0, 20) + '...'
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ Error getting ZKTeco config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ZKTeco configuration'
    });
  }
});

/**
 * @route   PUT /api/zkteco/cookies
 * @desc    Update ZKTeco cookies
 * @access  Private (Admin only)
 */
router.put('/cookies', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    const { cookies } = req.body;

    if (!cookies || typeof cookies !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Cookies object is required'
      });
    }

    // Validate required cookies
    const requiredCookies = ['account_info', 'csrftoken', 'sessionid'];
    const missingCookies = requiredCookies.filter(cookie => !cookies[cookie]);
    
    if (missingCookies.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required cookies: ${missingCookies.join(', ')}`
      });
    }

    // Update cookies
    updateCookies(cookies);

    res.json({
      success: true,
      message: 'ZKTeco cookies updated successfully',
      data: {
        updatedCookies: Object.keys(cookies),
        totalCookies: Object.keys(ZKTECO_CONFIG.cookies).length
      }
    });

    console.log('🔄 ZKTeco cookies updated via API by user:', req.user.username);

  } catch (error) {
    console.error('❌ Error updating ZKTeco cookies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ZKTeco cookies'
    });
  }
});

/**
 * @route   POST /api/zkteco/test-connection
 * @desc    Test ZKTeco connection with current cookies
 * @access  Private (Admin only)
 */
router.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    const cookies = getFormattedCookies();
    const deviceConfig = ZKTECO_CONFIG.device;

    res.json({
      success: true,
      message: 'Connection test initiated',
      data: {
        host: deviceConfig.host,
        port: deviceConfig.port,
        websocketUrl: deviceConfig.websocketUrl,
        cookies: cookies.substring(0, 100) + '...',
        timestamp: new Date().toISOString()
      }
    });

    console.log('🧪 ZKTeco connection test requested by user:', req.user.username);

  } catch (error) {
    console.error('❌ Error testing ZKTeco connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test ZKTeco connection'
    });
  }
});

// Keep-alive service management
router.get('/keep-alive/status', authMiddleware, async (req, res) => {
  try {
    const zktecoService = req.app.get('zktecoWebSocketService');
    if (!zktecoService) {
      return res.status(503).json({ 
        success: false, 
        message: 'ZKTeco service not available' 
      });
    }

    const status = zktecoService.getKeepAliveStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error getting keep-alive status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get keep-alive status' 
    });
  }
});

router.post('/keep-alive/refresh', authMiddleware, async (req, res) => {
  try {
    const zktecoService = req.app.get('zktecoWebSocketService');
    if (!zktecoService) {
      return res.status(503).json({ 
        success: false, 
        message: 'ZKTeco service not available' 
      });
    }

    const result = await zktecoService.forceKeepAliveRefresh();
    res.json({ 
      success: true, 
      message: 'Keep-alive refresh initiated',
      data: result 
    });
  } catch (error) {
    console.error('Error forcing keep-alive refresh:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to force keep-alive refresh' 
    });
  }
});

router.put('/keep-alive/interval', authMiddleware, async (req, res) => {
  try {
    const { intervalMs } = req.body;
    
    if (!intervalMs || typeof intervalMs !== 'number' || intervalMs < 30000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid interval. Must be a number >= 30000ms (30 seconds)' 
      });
    }

    const zktecoService = req.app.get('zktecoWebSocketService');
    if (!zktecoService) {
      return res.status(503).json({ 
        success: false, 
        message: 'ZKTeco service not available' 
      });
    }

    // Update the interval in the keep-alive service
    zktecoService.keepAliveService.setInterval(intervalMs);
    
    res.json({ 
      success: true, 
      message: `Keep-alive interval updated to ${intervalMs / 1000} seconds`,
      data: { intervalMs }
    });
  } catch (error) {
    console.error('Error updating keep-alive interval:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update keep-alive interval' 
    });
  }
});

module.exports = router;
