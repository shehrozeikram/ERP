const axios = require('axios');
const mongoose = require('mongoose');

class ZKTecoKeepAliveService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.devices = [];
    this.keepAliveInterval = 30000; // 30 seconds
  }

  async start() {
    if (this.isRunning) {
      console.log('ZKTeco Keep Alive Service is already running');
      return;
    }

    try {
      console.log('🚀 Starting ZKTeco Keep Alive Service...');
      
      // Load devices from database
      await this.loadDevices();
      
      // Start keep alive loop
      this.isRunning = true;
      this.intervalId = setInterval(async () => {
        await this.performKeepAlive();
      }, this.keepAliveInterval);

      console.log('✅ ZKTeco Keep Alive Service started successfully');
      
      // Perform initial keep alive
      await this.performKeepAlive();
      
    } catch (error) {
      console.error('❌ Error starting ZKTeco Keep Alive Service:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('ZKTeco Keep Alive Service is not running');
      return;
    }

    try {
      console.log('🛑 Stopping ZKTeco Keep Alive Service...');
      
      this.isRunning = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      console.log('✅ ZKTeco Keep Alive Service stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping ZKTeco Keep Alive Service:', error);
      throw error;
    }
  }

  async loadDevices() {
    try {
      // Load devices from database or configuration
      // This would typically come from a Device model or config file
      this.devices = [
        {
          id: 'device1',
          name: 'Main Entrance Device',
          ip: process.env.ZKTECO_DEVICE_IP || '192.168.1.100',
          port: process.env.ZKTECO_DEVICE_PORT || 4370,
          username: process.env.ZKTECO_USERNAME || 'admin',
          password: process.env.ZKTECO_PASSWORD || 'admin'
        }
      ];

      console.log(`📱 Loaded ${this.devices.length} ZKTeco device(s)`);
      
    } catch (error) {
      console.error('❌ Error loading devices:', error);
      throw error;
    }
  }

  async performKeepAlive() {
    if (!this.isRunning) return;

    try {
      console.log('💓 Performing ZKTeco keep alive...');
      
      for (const device of this.devices) {
        try {
          await this.keepDeviceAlive(device);
        } catch (error) {
          console.error(`❌ Error keeping device ${device.name} alive:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Error in keep alive cycle:', error);
    }
  }

  async keepDeviceAlive(device) {
    try {
      // Send keep alive request to device
      const response = await axios.get(`http://${device.ip}:${device.port}/zkteco/keepalive`, {
        timeout: 5000,
        auth: {
          username: device.username,
          password: device.password
        }
      });

      if (response.status === 200) {
        console.log(`✅ Device ${device.name} is alive and responding`);
        await this.updateDeviceStatus(device.id, 'online');
      } else {
        console.log(`⚠️ Device ${device.name} responded with status: ${response.status}`);
        await this.updateDeviceStatus(device.id, 'warning');
      }
      
    } catch (error) {
      console.error(`❌ Device ${device.name} is not responding:`, error.message);
      await this.updateDeviceStatus(device.id, 'offline');
      
      // Try to reconnect
      await this.attemptReconnection(device);
    }
  }

  async updateDeviceStatus(deviceId, status) {
    try {
      // Update device status in database
      // This would typically update a Device model
      console.log(`📊 Device ${deviceId} status updated to: ${status}`);
      
    } catch (error) {
      console.error('❌ Error updating device status:', error);
    }
  }

  async attemptReconnection(device) {
    try {
      console.log(`🔄 Attempting to reconnect to device ${device.name}...`);
      
      // Implement reconnection logic here
      // This could involve restarting the connection, updating device config, etc.
      
    } catch (error) {
      console.error(`❌ Reconnection attempt failed for device ${device.name}:`, error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      devicesCount: this.devices.length,
      lastKeepAlive: new Date().toISOString()
    };
  }
}

module.exports = ZKTecoKeepAliveService;
