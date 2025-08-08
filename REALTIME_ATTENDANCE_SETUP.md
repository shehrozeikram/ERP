# 🕐 Real-Time Attendance System Setup Guide

## 📋 **Overview**

This guide explains how to set up and use the **Real-Time Attendance System** using ZKTeco's Push SDK/HTTP server endpoint. This system allows you to see attendance records **instantly** when employees check in or out, without waiting for scheduled syncs.

## 🎯 **Key Features**

- ✅ **Real-time attendance updates** - See check-ins/check-outs instantly
- ✅ **WebSocket connections** - Live updates to the frontend
- ✅ **Push notifications** - Browser notifications for new attendance
- ✅ **Automatic processing** - Attendance records created/updated automatically
- ✅ **Local timezone support** - Accurate time display for your location
- ✅ **Error handling** - Robust error handling and logging

## 🏗️ **System Architecture**

```
ZKTeco Device → Push Server (Port 8080) → WebSocket → Frontend
     ↓              ↓                        ↓
  Attendance    Process Data           Real-time Display
     Data       Save to DB            Live Updates
```

## 🚀 **Setup Instructions**

### **Step 1: Start the Real-Time Push Server**

#### **Option A: Using API Endpoint**
```bash
# Start the push server
curl -X POST http://localhost:5001/api/zkteco-push/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### **Option B: Using Test Script**
```bash
# Run the test script (includes starting server)
node server/scripts/testRealTimeAttendance.js
```

#### **Option C: Manual Start**
```javascript
// In your server code
const zktecoPushService = require('./services/zktecoPushService');
await zktecoPushService.startPushServer();
```

### **Step 2: Configure ZKTeco Device**

1. **Access ZKTeco Device Settings**
   - Open ZKTeco device web interface
   - Navigate to **System Settings** → **Communication** → **Push Settings**

2. **Configure Push Server**
   - **Server URL**: `http://your-server-ip:8080/zkteco/push`
   - **Method**: `POST`
   - **Content Type**: `application/json`
   - **Enable Push**: `Yes`

3. **Test Configuration**
   - Use the test endpoint: `http://your-server-ip:8080/zkteco/health`
   - Should return: `{"success":true,"status":"running"}`

### **Step 3: Access Real-Time Attendance**

1. **Open Attendance Management**
   - Navigate to: `HR → Attendance Management`

2. **Switch to Real-Time Tab**
   - Click on the **"Real-Time Attendance"** tab
   - You'll see live attendance updates

3. **Monitor Live Updates**
   - New check-ins/check-outs appear instantly
   - WebSocket connection status is displayed
   - Browser notifications for new attendance

## 🔧 **API Endpoints**

### **Push Server Management**

#### **Start Push Server**
```http
POST /api/zkteco-push/start
Authorization: Bearer YOUR_TOKEN
```
**Response:**
```json
{
  "success": true,
  "message": "ZKTeco real-time push server started successfully",
  "data": {
    "port": 8080,
    "pushEndpoint": "/zkteco/push"
  }
}
```

#### **Stop Push Server**
```http
POST /api/zkteco-push/stop
Authorization: Bearer YOUR_TOKEN
```

#### **Get Server Status**
```http
GET /api/zkteco-push/status
Authorization: Bearer YOUR_TOKEN
```
**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "port": 8080,
    "pushEndpoint": "/zkteco/push",
    "clients": 2,
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### **Configure Server Settings**
```http
POST /api/zkteco-push/configure
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "host": "splaza.nayatel.net",
  "port": 4370,
  "pushEndpoint": "/zkteco/push"
}
```

#### **Test Real-Time Processing**
```http
POST /api/zkteco-push/test
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "deviceUserId": "6035",
  "recordTime": "2025-01-15T10:30:00.000Z",
  "state": 1,
  "ip": "splaza.nayatel.net"
}
```

### **Push Endpoint (ZKTeco Device)**

#### **Receive Real-Time Data**
```http
POST http://your-server-ip:8080/zkteco/push
Content-Type: application/json

{
  "deviceUserId": "6035",
  "recordTime": "2025-01-15T10:30:00.000Z",
  "state": 1,
  "ip": "splaza.nayatel.net"
}
```

## 📊 **Real-Time Data Format**

### **ZKTeco Push Data Structure**
```json
{
  "deviceUserId": "6035",           // Employee ID on device
  "recordTime": "2025-01-15T10:30:00.000Z",  // UTC timestamp
  "state": 1,                       // 1 = Check-in, 0 = Check-out
  "ip": "splaza.nayatel.net"        // Device IP/hostname
}
```

### **Processed Attendance Record**
```json
{
  "success": true,
  "action": "created",
  "employeeId": "6035",
  "employeeName": "John Doe",
  "timestamp": "Jan 15, 2025, 03:30 PM",
  "isCheckIn": true,
  "attendanceId": "507f1f77bcf86cd799439011"
}
```

## 🎨 **Frontend Components**

### **Real-Time Attendance Component**
- **Location**: `client/src/components/RealTimeAttendance.js`
- **Features**:
  - WebSocket connection to push server
  - Live attendance updates
  - Browser notifications
  - Connection status display
  - Real-time record list

### **Integration with AttendanceList**
- **Location**: `client/src/pages/HR/AttendanceList.js`
- **Features**:
  - Tab system for switching between regular and real-time views
  - Seamless integration with existing attendance management

## 🔍 **Monitoring and Debugging**

### **Server Logs**
```bash
# Monitor push server logs
tail -f server/logs/zkteco-push.log

# Check server status
curl http://localhost:8080/zkteco/health
```

### **WebSocket Connection**
```javascript
// Test WebSocket connection
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => console.log('Connected to real-time service');
ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));
```

### **Common Issues and Solutions**

#### **1. Push Server Won't Start**
```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill existing process if needed
kill -9 $(lsof -t -i:8080)
```

#### **2. ZKTeco Device Not Sending Data**
- Verify device network connectivity
- Check push server URL configuration
- Test with curl: `curl -X POST http://your-server-ip:8080/zkteco/push -H "Content-Type: application/json" -d '{"test":true}'`

#### **3. Frontend Not Receiving Updates**
- Check WebSocket connection status
- Verify browser console for errors
- Ensure push server is running on correct port

#### **4. Attendance Records Not Appearing**
- Check employee ID mapping
- Verify database connectivity
- Review server logs for processing errors

## 🧪 **Testing**

### **Test Script**
```bash
# Run comprehensive test
node server/scripts/testRealTimeAttendance.js
```

### **Manual Testing**
1. Start push server
2. Open Attendance Management → Real-Time tab
3. Send test data via API
4. Verify real-time updates appear

### **Load Testing**
```bash
# Send multiple test records
for i in {1..10}; do
  curl -X POST http://localhost:8080/zkteco/push \
    -H "Content-Type: application/json" \
    -d "{\"deviceUserId\":\"6035\",\"recordTime\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"state\":1,\"ip\":\"test\"}"
  sleep 1
done
```

## 📈 **Performance Considerations**

### **Scalability**
- Push server handles multiple concurrent connections
- WebSocket connections are lightweight
- Database operations are optimized for real-time processing

### **Reliability**
- Automatic reconnection for WebSocket clients
- Error handling and logging
- Graceful server shutdown

### **Security**
- Authentication required for management endpoints
- Input validation and sanitization
- Rate limiting for push endpoints

## 🎯 **Expected Results**

### **Real-Time Experience**
- ✅ **Instant Updates**: Attendance appears within 1-2 seconds
- ✅ **Live Notifications**: Browser notifications for new attendance
- ✅ **Accurate Times**: Local timezone display
- ✅ **Reliable Connection**: Automatic reconnection on disconnection

### **User Interface**
- ✅ **Connection Status**: Visual indicator of real-time service status
- ✅ **Live Updates**: Real-time attendance list with newest records highlighted
- ✅ **Easy Navigation**: Tab-based interface for switching views
- ✅ **Mobile Friendly**: Responsive design for mobile devices

## 🚀 **Next Steps**

1. **Configure ZKTeco Device**: Set up push notifications to your server
2. **Test Real-Time Functionality**: Use the test script to verify everything works
3. **Monitor Performance**: Check server logs and frontend console
4. **Train Users**: Show team how to use real-time attendance features
5. **Scale as Needed**: Add more devices or optimize for higher load

## 📞 **Support**

If you encounter issues:
1. Check server logs for error messages
2. Verify network connectivity and firewall settings
3. Test with the provided test scripts
4. Review this documentation for troubleshooting steps

**🎉 Your real-time attendance system is now ready to provide instant attendance updates!** 