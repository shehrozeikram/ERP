# ZKBio Time Auto-Recovery System

## Overview
This document describes the automatic recovery system implemented for ZKBio Time WebSocket connections and image proxy authentication.

## Problem Solved
When the ZKBio Time server becomes unavailable (502 Bad Gateway), the system would:
- Generate endless error logs
- Never recover automatically
- Require manual server restart
- Break Real-Time Monitor images

## Solution Implemented

### 1. WebSocket Auto-Recovery
**File:** `server/services/zkbioTimeWebSocketProxy.js`

#### Features:
- **Smart Failure Detection**: Detects 502 errors immediately
- **Quick Initial Attempts**: 5 quick reconnection attempts (every 5 seconds)
- **Graceful Disable**: Stops retry spam after max attempts
- **Periodic Retry**: Automatically retries every 30 minutes
- **Automatic Recovery**: Reconnects as soon as server is available

#### Flow:
```
Server Down → 5 quick attempts → Disabled → Wait 30 min → Retry
                                     ↓
                               Clean warning log
                                     ↓
                            If still down → Wait 30 min
                                     ↓
                            If back up → ✅ Auto-reconnect
```

### 2. Image Proxy Auto-Recovery
**File:** `server/routes/imageProxy.js`

#### Features:
- **Auto-Authentication**: Automatically authenticates when cookies are missing
- **Session Expiry Handling**: Detects 401/403 and re-authenticates
- **Automatic Retry**: Retries failed image requests with fresh authentication
- **Smart Error Messages**: Returns informative errors instead of generic failures

#### Flow:
```
Image Request → Check cookies → Missing? → Authenticate → Fetch
                      ↓                          ↓
                  Available                  Success? → ✅ Serve image
                      ↓                          ↓
                Fetch image                   Failed → Return error
                      ↓
              401/403 error?
                      ↓
            Re-authenticate → Retry once → ✅ Serve or fail
```

## Benefits for Production (Digital Ocean)

### ✅ Zero Manual Intervention
- No need to SSH into the server
- No need to restart services
- Works 24/7 automatically

### ✅ Clean Logs
Before:
```
❌ ZKBio Time Chart WebSocket error: Error: Unexpected server response: 502
🔄 Attempting reconnection 1/5...
❌ ZKBio Time Chart WebSocket error: Error: Unexpected server response: 502
🔄 Attempting reconnection 2/5...
(repeats endlessly...)
```

After:
```
⚠️  Chart WebSocket: Server unavailable (502), disabling reconnection
⚠️  Max reconnection attempts reached. Chart WebSocket disabled.
(waits 30 minutes)
🔄 Periodic retry check for disabled WebSocket connections...
🔄 Attempting to re-enable Chart WebSocket...
✅ Connected to ZKBio Time Chart WebSocket
```

### ✅ Resource Efficient
- Only retries every 30 minutes (not constantly)
- Minimal CPU/memory usage during downtime
- No connection flooding

### ✅ Automatic Image Recovery
- Images automatically load when server recovers
- No broken Real-Time Monitor
- Session expiry handled automatically

## Configuration

### Retry Timing (Configurable in zkbioTimeWebSocketProxy.js)
```javascript
this.maxReconnectAttempts = 5;        // Quick attempts before disabling
this.reconnectDelay = 5000;           // 5 seconds between quick attempts
this.periodicRetryDelay = 30 * 60 * 1000; // 30 minutes for periodic retry
```

### Image Timeout (Configurable in imageProxy.js)
```javascript
timeout: 10000  // 10 seconds timeout for image requests
```

## Monitoring

### Success Logs
```
✅ Connected to ZKBio Time Chart WebSocket
✅ Connected to ZKBio Time Device Status WebSocket
✅ Connected to ZKBio Time Department Attendance WebSocket
✅ Successfully authenticated for image proxy
✅ Image fetched successfully after re-authentication
```

### Warning Logs (Normal during downtime)
```
⚠️  Chart WebSocket: Server unavailable (502), disabling reconnection
⚠️  Max chart reconnection attempts reached. Chart WebSocket disabled.
⚠️  No session cookies available, attempting to authenticate...
```

### Error Logs (Requires attention)
```
❌ Failed to obtain ZKBio Time session cookies
❌ No authentication available for image proxy
❌ Error proxying image: [error message]
```

## Testing the System

### Simulate Server Downtime
1. Stop the ZKBio Time server temporarily
2. Observe the system disable WebSockets after 5 attempts
3. Wait for periodic retry (or change to 1 minute for testing)
4. Start the ZKBio Time server
5. Observe automatic reconnection

### Test Image Recovery
1. Clear browser cache
2. Open Real-Time Monitor
3. Images should load automatically
4. Check browser console for any 401/503 errors
5. Images should retry and load successfully

## Deployment Checklist

- [x] WebSocket auto-recovery implemented
- [x] Image proxy auto-authentication implemented
- [x] Periodic retry mechanism enabled
- [x] Clean error logging
- [x] Production-ready configuration
- [x] Zero manual intervention required

## Support

If you encounter persistent issues:
1. Check server logs for error patterns
2. Verify ZKBio Time server is running: `http://45.115.86.139:85`
3. Check authentication credentials in `zkbioTimeWebSocketProxy.js`
4. Verify network connectivity between servers

## Last Updated
Date: October 1, 2025
Version: 2.0 - Auto-Recovery System

