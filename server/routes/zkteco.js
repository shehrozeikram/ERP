const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({ message: 'ZKTeco route is working!', timestamp: new Date() });
});

// Echo endpoint to see what's being received
router.post('/echo', (req, res) => {
  console.log('🔄 Echo endpoint called');
  console.log('📤 Request body:', req.body);
  console.log('📤 Request headers:', req.headers);
  res.json({ 
    message: 'Echo response',
    received: req.body,
    headers: req.headers,
    timestamp: new Date()
  });
});

// Public ZKTeco authentication endpoint (no ERP auth required)
router.post('/auth', async (req, res) => {
  try {
    console.log('🔄 Proxying ZKTeco auth request...');
    console.log('📤 Request body:', req.body);
    console.log('📤 Request headers:', req.headers);
    console.log('📤 Request method:', req.method);
    console.log('📤 Request URL:', req.url);
    
    // Check if body parser is working
    console.log('📤 Raw request:', req);
    
    // Validate request body
    if (!req.body || !req.body.username || !req.body.password) {
      console.error('❌ Invalid request body - missing username or password');
      console.error('❌ Request body type:', typeof req.body);
      console.error('❌ Request body keys:', req.body ? Object.keys(req.body) : 'undefined');
      return res.status(400).json({ 
        error: 'Invalid request body - username and password required',
        received: req.body,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : 'undefined'
      });
    }
    
    const postData = JSON.stringify(req.body);
    console.log('📤 JSON data being sent:', postData);
    
    const options = {
      hostname: '182.180.55.96',
      port: 85,
      path: '/api/v2/auth/login/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    console.log('📡 HTTP options:', options);

    const request = http.request(options, (response) => {
      let data = '';
      
      console.log('📡 ZKTeco response status:', response.statusCode);
      console.log('📡 ZKTeco response headers:', response.headers);
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log('📡 Raw ZKTeco response data:', data);
        
        try {
          const jsonData = JSON.parse(data);
          console.log('✅ ZKTeco auth response parsed:', jsonData);
          
          if (jsonData.data && jsonData.data.token) {
            // New API format: { data: { token: "...", is_superuser: true/false } }
            res.json({
              token: jsonData.data.token,
              is_superuser: jsonData.data.is_superuser || false
            });
          } else if (jsonData.token) {
            // Old API format: { token: "..." }
            res.json(jsonData);
          } else {
            console.error('❌ No token in ZKTeco response');
            console.error('❌ ZKTeco error details:', jsonData);
            res.status(400).json({ 
              error: 'ZKTeco authentication failed', 
              details: jsonData,
              message: jsonData.detail || jsonData.message || 'Unknown error'
            });
          }
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.error('❌ Raw data that failed to parse:', data);
          res.status(500).json({ error: 'Invalid response from ZKTeco' });
        }
      });
    });

    request.on('error', (error) => {
      console.error('❌ ZKTeco proxy error:', error);
      res.status(500).json({ error: 'Failed to connect to ZKTeco' });
    });

    request.on('timeout', () => {
      console.error('❌ ZKTeco proxy timeout');
      request.destroy();
      res.status(500).json({ error: 'ZKTeco request timeout' });
    });

    request.on('response', (response) => {
      console.log('📡 ZKTeco response received, status:', response.statusCode);
    });

    // Set timeout to 10 seconds
    request.setTimeout(10000);

    request.write(postData);
    request.end();
    
  } catch (error) {
    console.error('❌ ZKTeco proxy error:', error);
    res.status(500).json({ error: 'Failed to connect to ZKTeco' });
  }
});

module.exports = router;
