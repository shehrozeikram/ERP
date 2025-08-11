# 🚀 ZKTeco Real-Time Attendance Setup Guide

## Overview
This guide explains how to configure your ZKTeco device to send **real-time attendance data** directly to the SGC ERP server. This creates a **pure real-time system** like Sidat Haider software - no scheduled sync, no polling, just instant updates.

## 🎯 What We're Building
- **Pure Real-Time**: Device sends data instantly when someone checks in/out
- **No Scheduled Sync**: Eliminates the need for periodic data fetching
- **Instant Updates**: Attendance appears in the system within seconds
- **WebSocket Streaming**: Real-time updates to all connected clients

## 📋 Prerequisites
1. ZKTeco device connected to network (IP: `splaza.nayatel.net:4370`)
2. SGC ERP server running and accessible
3. Device firmware supports Push SDK/HTTP POST

## 🔧 Step 1: Configure ZKTeco Device

### 1.1 Access Device Settings
1. **On Device**: Go to Menu → System → Communication
2. **Network Settings**: Ensure device has static IP or DHCP
3. **Port**: Verify device listens on port 4370

### 1.2 Enable Push Mode
1. **Push Server URL**: Set to `http://your-server-ip:8080/zkteco-push/realtime-attendance`
2. **Push Mode**: Enable "HTTP POST" or "Push SDK"
3. **Push Interval**: Set to "Real-time" or "Immediate"
4. **Authentication**: If required, set communication key

### 1.3 Test Device Connection
1. **Ping Test**: `ping splaza.nayatel.net`
2. **Port Test**: `telnet splaza.nayatel.net 4370`
3. **Device Info**: Verify device responds to basic commands

## 🔧 Step 2: Server Configuration

### 2.1 Start Real-Time Service
```bash
# Start the ZKTeco push service
curl -X POST http://localhost:3000/api/zkteco-push/start
```

### 2.2 Verify Service Status
```bash
# Check service status
curl http://localhost:3000/api/zkteco-push/status
```

### 2.3 Test Real-Time Endpoint
```bash
# Test with sample data
curl -X POST http://localhost:8080/zkteco-push/realtime-attendance \
  -H "Content-Type: application/json" \
  -d '{
    "deviceUserId": "6035",
    "recordTime": "2025-01-20T09:30:00",
    "state": 1,
    "ip": "splaza.nayatel.net"
  }'
```

## 🔧 Step 3: Frontend Real-Time Display

### 3.1 Start Real-Time Service
1. **Open Attendance Page**: Navigate to HR → Attendance
2. **Click "Start Real-time"**: Green button to enable service
3. **Verify Status**: Should show "Real-time Active" with green WiFi icon

### 3.2 Monitor Real-Time Updates
1. **Live Notifications**: Real-time check-ins/outs appear instantly
2. **Statistics**: Real-time count updates in summary cards
3. **WebSocket**: Automatic connection for live updates

## 📊 Data Flow

```
ZKTeco Device → HTTP POST → Server Endpoint → Database → WebSocket → Frontend
     ↓              ↓            ↓           ↓         ↓         ↓
  Check-in    Real-time    Process &     Save to    Broadcast   Display
  / Check-out   Data       Validate      MongoDB    to Clients  Live Update
```

## 🔍 Troubleshooting

### Device Not Sending Data
1. **Check Push URL**: Verify endpoint is correct and accessible
2. **Network Connectivity**: Ensure device can reach server
3. **Push Mode**: Verify Push SDK is enabled on device
4. **Firewall**: Check if port 8080 is open

### Server Not Receiving Data
1. **Service Status**: Check if push service is running
2. **Port Binding**: Verify server listens on port 8080
3. **Logs**: Check server console for incoming requests
4. **Endpoint**: Test with curl to verify endpoint works

### Frontend Not Updating
1. **WebSocket Connection**: Check browser console for connection errors
2. **Real-time Service**: Verify service is started
3. **Browser Notifications**: Grant notification permission
4. **Network**: Ensure WebSocket port is accessible

## 📱 Real-Time Features

### ✅ What Works
- **Instant Updates**: Check-ins/outs appear within seconds
- **Live Notifications**: Browser and in-app notifications
- **Real-time Stats**: Live count of today's real-time records
- **WebSocket Streaming**: Continuous connection for updates
- **No Scheduled Sync**: Pure real-time, no background jobs

### ❌ What's Removed
- **Scheduled Sync**: No more cron jobs or periodic fetching
- **Manual Polling**: No need to manually sync data
- **Background Processes**: No scheduled attendance sync
- **Cron Dependencies**: node-cron package removed

## 🎉 Success Indicators

### Device Side
- ✅ Push Server URL configured correctly
- ✅ Push Mode enabled and active
- ✅ Network connectivity established
- ✅ Test data sent successfully

### Server Side
- ✅ Push service running on port 8080
- ✅ Real-time endpoint receiving data
- ✅ Database records created/updated
- ✅ WebSocket broadcasting active

### Frontend Side
- ✅ Real-time service started
- ✅ WebSocket connected
- ✅ Live updates appearing
- ✅ Real-time statistics updating

## 🚀 Next Steps

1. **Configure Device**: Set Push Server URL on ZKTeco device
2. **Start Service**: Start real-time service from frontend
3. **Test Check-in**: Have someone check in/out on device
4. **Verify Updates**: See real-time updates in attendance page
5. **Monitor Performance**: Check server logs and frontend updates

## 📞 Support

If you encounter issues:
1. Check server console logs for errors
2. Verify device Push SDK configuration
3. Test network connectivity between device and server
4. Ensure all required ports are open and accessible

---

**🎯 Goal**: Pure real-time attendance system with zero scheduled sync or polling - just like Sidat Haider software!
