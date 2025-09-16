const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Proxy endpoint for ZKBio Time attendance system
 * This allows external users to access the attendance system through our server
 */

// Proxy for ZKBio Time API endpoints
router.all('/zkbio-proxy/*', async (req, res) => {
  try {
    const path = req.path.replace('/zkbio-proxy', '');
    const targetUrl = `http://45.115.86.139:85${path}`;
    
    console.log(`🔄 Proxying request: ${req.method} ${targetUrl}`);
    
    // Prepare request options
    const requestOptions = {
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: '45.115.86.139:85',
        origin: 'http://45.115.86.139:85',
        referer: 'http://45.115.86.139:85'
      },
      timeout: 30000,
      maxRedirects: 5
    };

    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      requestOptions.data = req.body;
    }

    // Add query parameters
    if (Object.keys(req.query).length > 0) {
      requestOptions.params = req.query;
    }

    // Make the request to the attendance system
    const response = await axios(requestOptions);
    
    // Forward the response
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    
    if (error.response) {
      // Forward error response from attendance system
      res.status(error.response.status).json({
        success: false,
        message: 'Attendance system error',
        error: error.response.data || error.message
      });
    } else if (error.code === 'ECONNREFUSED') {
      // Connection refused - attendance system is not accessible
      res.status(503).json({
        success: false,
        message: 'Attendance system is not accessible',
        error: 'Failed to connect to attendance system'
      });
    } else if (error.code === 'ETIMEDOUT') {
      // Timeout
      res.status(504).json({
        success: false,
        message: 'Attendance system timeout',
        error: 'Request timed out'
      });
    } else {
      // Other errors
      res.status(500).json({
        success: false,
        message: 'Proxy error',
        error: error.message
      });
    }
  }
});

module.exports = router;
