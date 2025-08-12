# 🍪 ZKTeco Cookie Update System Implementation

## Overview
I've implemented a comprehensive cookie management system for your ZKTeco device to resolve the WebSocket connection errors. The system now allows you to easily update cookies when they expire without restarting the server.

## What Was Fixed

### 1. **Updated Hardcoded Cookies**
- **Before**: Outdated cookies causing 500 server errors
- **After**: Updated with your new cookie values:
  - `csrftoken`: `38aYpXDoBu4Rmk1fBMKTM1YfdmYCWXzx`
  - `sessionid`: `4h3w6ffodvp4df9l51f9vkqjvjvvmtf2`
  - `account_info`: `eyJ1c2VybmFtZSI6ICJhZGlsLmFhbWlyIiwgInBhc3N3b3JkIjogIlBhazEyMzQ1NiIsICJlbXBOYW1lIjogIiIsICJlbXBQd2QiOiAiIiwgInJlbWVtYmVyX21lX2FkbWluIjogImNoZWNrZWQiLCAicmVtZW1iZXJfbWVfZW1wbG95ZWUiOiAiIn0=`

### 2. **Centralized Configuration System**
Created `server/config/zktecoConfig.js` to manage all ZKTeco settings in one place:
- Device connection settings
- Authentication cookies
- Connection parameters
- Logging configuration

### 3. **API Endpoints for Cookie Management**
New routes in `server/routes/zkteco.js`:
- `GET /api/zkteco/config` - View current configuration
- `PUT /api/zkteco/cookies` - Update cookies
- `POST /api/zkteco/test-connection` - Test device connection

### 4. **Frontend Management Interface**
Created `client/src/components/ZKTecoConfig.js` component that provides:
- Real-time configuration display
- Cookie update form
- Connection testing
- Admin-only access control

### 5. **Automated Cookie Updates**
The system now automatically uses updated cookies without requiring server restarts.

## Files Created/Modified

### New Files:
- `server/config/zktecoConfig.js` - Centralized configuration
- `server/routes/zkteco.js` - API endpoints
- `client/src/components/ZKTecoConfig.js` - Frontend interface
- `server/scripts/updateZktecoCookies.js` - Command-line cookie updater

### Modified Files:
- `server/services/zktecoWebSocketService.js` - Uses centralized config
- `server/services/zktecoService.js` - Uses centralized config
- `server/index.js` - Added ZKTeco routes

## How to Use

### 1. **Update Cookies via Frontend (Recommended)**
1. Navigate to the ZKTeco Configuration component (admin only)
2. Fill in the new cookie values
3. Click "Update Cookies"
4. The system automatically applies the new cookies

### 2. **Update Cookies via API**
```bash
curl -X PUT http://localhost:5001/api/zkteco/cookies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": {
      "account_info": "your_new_account_info",
      "csrftoken": "your_new_csrf_token",
      "sessionid": "your_new_session_id"
    }
  }'
```

### 3. **Update Cookies via Script**
```bash
cd server/scripts
node updateZktecoCookies.js
```

## Benefits

✅ **No More Server Restarts** - Cookies update in real-time
✅ **Centralized Management** - All settings in one place
✅ **Admin Interface** - Easy-to-use frontend for cookie updates
✅ **Automatic Fallback** - System continues working with new cookies
✅ **Better Error Handling** - Clear feedback on connection issues
✅ **Future-Proof** - Easy to update when cookies expire again

## Security Features

- **Admin-Only Access** - Only users with admin role can manage cookies
- **Input Validation** - Validates required cookies before updating
- **Audit Logging** - Logs all cookie updates with user information
- **Secure Headers** - Proper authentication and authorization

## Troubleshooting

### If You Still Get Connection Errors:
1. **Check Cookie Validity** - Ensure cookies haven't expired
2. **Verify Device IP** - Confirm the device is accessible at `182.180.55.96:85`
3. **Test Connection** - Use the "Test Connection" button in the admin interface
4. **Check Logs** - Monitor server logs for detailed error information

### Common Issues:
- **500 Server Error**: Usually means cookies are expired
- **Connection Refused**: Device might be offline or IP changed
- **Authentication Failed**: Cookies are invalid or expired

## Next Steps

1. **Test the System** - Try connecting to see if the 500 errors are resolved
2. **Monitor Logs** - Watch for successful connections
3. **Set Up Monitoring** - Consider adding alerts for cookie expiration
4. **Regular Updates** - Update cookies before they expire (typically every 30-90 days)

## Support

If you encounter any issues:
1. Check the server logs for detailed error messages
2. Use the admin interface to test connections
3. Verify cookie values are correct and not expired
4. Ensure the ZKTeco device is accessible on the network

The system is now much more robust and should handle cookie updates seamlessly! 🎉
