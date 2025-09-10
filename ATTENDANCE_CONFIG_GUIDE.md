# Attendance System Configuration Guide

## Problem Identified
The attendance system is currently configured to connect to `182.180.55.96:85`, which is likely a local/internal IP address that only works from your local network. When users access the system from different networks (like through the domain `tovus.net`), they can't reach this internal IP address.

## Solution Implemented
I've made the attendance system configuration environment-based so you can easily configure different URLs for different environments.

## Configuration Options

### Option 1: Use Public IP/Domain (Recommended)
If your attendance system has a public IP or domain that's accessible from the internet:

```bash
# In your production .env file, set:
ZKBIO_BASE_URL=http://your-public-domain.com:85
ZKTECO_HOST=your-public-domain.com
ZKTECO_WEBSOCKET_URL=ws://your-public-domain.com:85/base/dashboard/realtime_punch/
```

### Option 2: Use VPN/Internal Network
If the attendance system is only accessible through VPN or internal network:

```bash
# In your production .env file, set:
ZKBIO_BASE_URL=http://your-internal-domain.com:85
ZKTECO_HOST=your-internal-domain.com
ZKTECO_WEBSOCKET_URL=ws://your-internal-domain.com:85/base/dashboard/realtime_punch/
```

### Option 3: Use Server as Proxy
If your server can access the attendance system but external users can't:

1. Set up a proxy on your server that forwards requests to the attendance system
2. Configure the environment variables to point to your server's proxy endpoint

## Steps to Fix

1. **Identify the correct URL for your attendance system:**
   - Check if `182.180.55.96` has a public domain name
   - Verify if the attendance system is accessible from your server
   - Test connectivity from your server to the attendance system

2. **Update your production environment:**
   ```bash
   # SSH to your server
   ssh root@68.183.215.177
   
   # Edit the .env file
   cd /var/www/sgc-erp
   nano .env
   
   # Add or update these lines:
   ZKBIO_BASE_URL=http://your-correct-domain.com:85
   ZKTECO_HOST=your-correct-domain.com
   ZKTECO_WEBSOCKET_URL=ws://your-correct-domain.com:85/base/dashboard/realtime_punch/
   ```

3. **Restart the application:**
   ```bash
   pm2 restart all
   ```

## Testing
After updating the configuration, test the attendance system:
1. Access the attendance page from an external network
2. Check if the "Failed to connect to attendance system" error is resolved
3. Verify that attendance data loads correctly

## Current Configuration
The system now reads from these environment variables:
- `ZKBIO_BASE_URL` - Base URL for ZKBio Time system
- `ZKTECO_HOST` - Host for ZKTeco device
- `ZKTECO_PORT` - Port for ZKTeco device
- `ZKTECO_WEBSOCKET_URL` - WebSocket URL for real-time updates
- `ZKBIO_USERNAME` - Username for authentication
- `ZKBIO_PASSWORD` - Password for authentication

## Fallback
If environment variables are not set, the system will use the original hardcoded values as fallbacks.
