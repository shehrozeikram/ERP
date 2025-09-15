# ZKBio Time Real-Time Monitor Troubleshooting Guide

## Issue: Real-Time Monitor works locally but not on Digital Ocean server

### Root Causes Identified:
1. **PM2 Cluster Mode**: WebSocket connections don't work well with cluster mode
2. **Socket.IO CORS Configuration**: Production CORS settings were too restrictive
3. **WebSocket Connection Timeout**: No proper timeout handling for external connections
4. **Network Connectivity**: Server needs to connect to external ZKBio Time server

### Fixes Applied:

#### 1. PM2 Configuration (ecosystem.config.js)
```javascript
// Changed from cluster mode to fork mode
instances: 1, // Single instance for WebSocket compatibility
exec_mode: 'fork', // Use fork mode instead of cluster for WebSocket support
```

#### 2. Socket.IO CORS Configuration
```javascript
cors: {
  origin: process.env.NODE_ENV === 'production' ? ["https://tovus.net", "https://www.tovus.net"] : "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
},
transports: ['websocket', 'polling'],
allowEIO3: true
```

#### 3. Enhanced WebSocket Connection
- Added connection timeout handling
- Improved error logging with detailed error codes
- Added connection test before WebSocket initialization
- Better reconnection logic

#### 4. Connection Test Script
Created `server/scripts/test-zkbio-connection.js` to diagnose connection issues.

### Deployment Steps:

1. **Deploy the fixes:**
   ```bash
   ./deploy.sh
   ```

2. **Test the connection manually on the server:**
   ```bash
   ssh root@68.183.215.177
   cd /var/www/sgc-erp
   node server/scripts/test-zkbio-connection.js
   ```

3. **Check PM2 logs:**
   ```bash
   pm2 logs sgc-erp-backend --lines 50
   ```

4. **Restart the service if needed:**
   ```bash
   pm2 restart sgc-erp-backend
   ```

### Expected Behavior After Fix:

1. **Server startup logs should show:**
   ```
   🧪 Testing ZKBio Time connection before starting WebSocket...
   ✅ HTTP connection test passed: 200
   ✅ Authentication test: PASSED
   ✅ Connection test passed, starting WebSocket connection...
   🔌 Connecting to ZKBio Time WebSocket...
   ✅ Connected to ZKBio Time WebSocket
   ```

2. **Frontend should show:**
   - "LIVE" status in Real-Time Monitor
   - Real-time attendance updates
   - Employee photos from ZKBio Time

3. **If connection fails:**
   - Server will attempt reconnection
   - Frontend will show "OFFLINE" status
   - Demo mode will activate after max retries

### Network Requirements:

The Digital Ocean server must be able to connect to:
- **HTTP**: `http://182.180.55.96:85/login/`
- **WebSocket**: `ws://182.180.55.96:85/base/dashboard/realtime_punch/`

### Monitoring:

Check these logs for issues:
- PM2 logs: `pm2 logs sgc-erp-backend`
- Nginx logs: `/var/log/nginx/error.log`
- System logs: `journalctl -u nginx`

### Common Issues:

1. **Firewall blocking outbound connections**
   ```bash
   # Check if port 85 is accessible
   telnet 182.180.55.96 85
   ```

2. **DNS resolution issues**
   ```bash
   # Test DNS resolution
   nslookup 182.180.55.96
   ```

3. **PM2 not restarting properly**
   ```bash
   # Force restart
   pm2 delete sgc-erp-backend
   pm2 start ecosystem.config.js --env production
   ```

### Verification:

After deployment, verify the Real-Time Monitor works by:
1. Opening the Dashboard
2. Checking the Real-Time Monitor section
3. Looking for "LIVE" status indicator
4. Testing with actual attendance punches

The Real-Time Monitor should now work exactly the same on the production server as it does locally.
