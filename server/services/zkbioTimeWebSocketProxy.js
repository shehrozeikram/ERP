const WebSocket = require('ws');
const axios = require('axios');
const { Server } = require('socket.io');
const http = require('http');

class ZKBioTimeWebSocketProxy {
  constructor() {
    this.zkbioWs = null;
    this.chartWs = null;
    this.deviceWs = null;
    this.deptWs = null;
    this.socketIO = null;
    this.isConnected = false;
    this.chartConnected = false;
    this.deviceConnected = false;
    this.deptConnected = false;
    this.reconnectAttempts = 0;
    this.chartReconnectAttempts = 0;
    this.deviceReconnectAttempts = 0;
    this.deptReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.sessionCookies = null;
    this.lastChartData = null; // Store last chart data
    this.lastDeviceData = null; // Store last device data
    this.lastDeptData = null; // Store last department data
    this.chartDisabled = false; // Flag to disable chart WebSocket if server is unavailable
    this.deviceDisabled = false; // Flag to disable device WebSocket if server is unavailable
    this.deptDisabled = false; // Flag to disable dept WebSocket if server is unavailable
    this.periodicRetryInterval = null; // Interval for periodic retry of disabled connections
    this.periodicRetryDelay = 30 * 60 * 1000; // 30 minutes
  }

  // Start periodic retry for disabled WebSocket connections
  startPeriodicRetry() {
    // Clear any existing interval
    if (this.periodicRetryInterval) {
      clearInterval(this.periodicRetryInterval);
    }

    // Set up periodic retry every 30 minutes
    this.periodicRetryInterval = setInterval(() => {
      console.log('🔄 Periodic retry check for disabled WebSocket connections...');
      
      // Try to reconnect chart WebSocket if disabled
      if (this.chartDisabled) {
        console.log('🔄 Attempting to re-enable Chart WebSocket...');
        this.chartDisabled = false;
        this.chartReconnectAttempts = 0;
        this.connectToChartWebSocket();
      }
      
      // Try to reconnect device WebSocket if disabled
      if (this.deviceDisabled) {
        console.log('🔄 Attempting to re-enable Device WebSocket...');
        this.deviceDisabled = false;
        this.deviceReconnectAttempts = 0;
        this.connectToDeviceWebSocket();
      }
      
      // Try to reconnect department WebSocket if disabled
      if (this.deptDisabled) {
        console.log('🔄 Attempting to re-enable Department WebSocket...');
        this.deptDisabled = false;
        this.deptReconnectAttempts = 0;
        this.connectToDepartmentWebSocket();
      }
    }, this.periodicRetryDelay);
    
    console.log(`✅ Periodic retry enabled - will check every ${this.periodicRetryDelay / 60000} minutes`);
  }

  // Stop periodic retry
  stopPeriodicRetry() {
    if (this.periodicRetryInterval) {
      clearInterval(this.periodicRetryInterval);
      this.periodicRetryInterval = null;
      console.log('⏹️  Periodic retry stopped');
    }
  }

  // Initialize Socket.IO server
  initializeSocketIO(server) {
    this.socketIO = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? ["https://tovus.net", "https://www.tovus.net"] : "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true
    });

    this.socketIO.on('connection', (socket) => {
      console.log('📱 Frontend client connected:', socket.id);
      
      // Send current connection status
      socket.emit('zkbioConnectionStatus', {
        connected: this.isConnected,
        message: this.isConnected ? 'Connected to ZKBio Time' : 'Disconnected from ZKBio Time'
      });

      // Send last chart data immediately if available
      if (this.lastChartData) {
        console.log('📊 Sending cached chart data to new client');
        socket.emit('liveChartUpdate', {
          data: this.lastChartData,
          timestamp: new Date().toISOString(),
          type: 'presentChart'
        });
      }

      // Send last device data immediately if available
      if (this.lastDeviceData) {
        console.log('📱 Sending cached device data to new client');
        socket.emit('liveDeviceStatusUpdate', {
          data: this.lastDeviceData,
          timestamp: new Date().toISOString(),
          type: 'deviceStatus'
        });
      }

      // Send last department data immediately if available
      if (this.lastDeptData) {
        console.log('🏢 Sending cached department data to new client');
        socket.emit('liveDepartmentUpdate', {
          data: this.lastDeptData,
          timestamp: new Date().toISOString(),
          type: 'departmentAttendance'
        });
      }

      // Handle manual chart data refresh request
      socket.on('requestChartData', () => {
        console.log('📊 Manual chart data refresh requested');
        if (this.chartWs && this.chartWs.readyState === WebSocket.OPEN) {
          this.chartWs.send(JSON.stringify({ action: 'get_chart_data' }));
        }
      });

      // Handle manual device data refresh request
      socket.on('requestDeviceData', () => {
        console.log('📱 Manual device data refresh requested');
        if (this.deviceWs && this.deviceWs.readyState === WebSocket.OPEN) {
          this.deviceWs.send(JSON.stringify({ action: 'get_chart_data' }));
        }
      });

      // Handle manual department data refresh request
      socket.on('requestDepartmentData', () => {
        console.log('🏢 Manual department data refresh requested');
        if (this.deptWs && this.deptWs.readyState === WebSocket.OPEN) {
          this.deptWs.send(JSON.stringify({ action: 'get_chart_data' }));
        }
      });

      socket.on('disconnect', () => {
        console.log('📱 Frontend client disconnected:', socket.id);
      });
    });

    console.log('✅ Socket.IO server initialized');
  }

  // Authenticate with ZKBio Time and get session cookies
  async authenticateWithZKBioTime() {
    try {
      console.log('🔐 Authenticating with ZKBio Time...');
      
      // Step 1: Get login page and extract CSRF token
      const loginPageResponse = await axios.get('http://45.115.86.139:85/login/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      // Extract CSRF token from the page
      const csrfMatch = loginPageResponse.data.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
      if (!csrfMatch) {
        console.log('❌ Could not extract CSRF token');
        return false;
      }
      
      const csrfToken = csrfMatch[1];
      console.log(`✅ CSRF token extracted: ${csrfToken.substring(0, 20)}...`);

      // Step 2: Authenticate with proper form data
      const authResponse = await axios.post('http://45.115.86.139:85/login/', 
        new URLSearchParams({
          username: 'superuser',
          password: 'SGCit123456',
          csrfmiddlewaretoken: csrfToken
        }),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'http://45.115.86.139:85/login/',
            'Cookie': loginPageResponse.headers['set-cookie']?.join('; ') || ''
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400,
          timeout: 10000
        }
      );

      if (authResponse.status === 200) {
        const cookies = authResponse.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          this.sessionCookies = cookies.join('; ');
          console.log('✅ Authentication successful, cookies obtained');
          return true;
        }
      }
      
      console.log('❌ Authentication failed - no cookies received');
      return false;
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        console.error('❌ Authentication timeout - ZKBio Time server may be unreachable');
      } else {
        console.error('❌ Authentication error:', error.message);
      }
      return false;
    }
  }

  // Connect to ZKBio Time WebSocket
  async connectToZKBioTime() {
    try {
      // First authenticate to get cookies
      const authSuccess = await this.authenticateWithZKBioTime();
      if (!authSuccess) {
        throw new Error('Authentication failed');
      }

      console.log('🔌 Connecting to ZKBio Time WebSocket...');
      console.log('🌐 Environment:', process.env.NODE_ENV);
      console.log('🍪 Session cookies:', this.sessionCookies ? 'Present' : 'Missing');
      
      this.zkbioWs = new WebSocket('ws://45.115.86.139:85/base/dashboard/realtime_punch/', {
        headers: {
          'Origin': 'http://45.115.86.139:85',
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      this.zkbioWs.on('open', () => {
        console.log('✅ Connected to ZKBio Time WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Notify all connected frontend clients
        if (this.socketIO) {
          this.socketIO.emit('zkbioConnectionStatus', {
            connected: true,
            message: 'Connected to ZKBio Time'
          });
        }
      });

      this.zkbioWs.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Process attendance data
          if (message.data && message.data.length > 0) {
            const processedPunches = message.data.map(row => ({
              id: row[0],           // transaction id
              empCode: row[1],      // emp_code
              name: row[2],         // employee name
              time: row[3],         // punch time
              state: row[4],        // Check In / Check Out
              imagePath: row[5],    // image path
              photoPath: row[6],    // photo path
              location: row[7],     // location/device
              timestamp: new Date().toISOString(),
              score: message.score,
              // Add proxied image URLs
              employeePhoto: row[6] ? `/api/images/zkbio-image${row[6]}` : null,
              attendanceImage: row[5] ? `/api/images/zkbio-image${row[5]}` : null
            }));

            console.log(`📊 Received ${processedPunches.length} new attendance events`);
            
            // Broadcast to all connected frontend clients
            if (this.socketIO) {
              this.socketIO.emit('liveAttendanceUpdate', {
                events: processedPunches,
                timestamp: new Date().toISOString(),
                count: processedPunches.length
              });
            }
            
            // Trigger chart data refresh when new attendance events are received
            if (this.chartWs && this.chartWs.readyState === WebSocket.OPEN) {
              this.chartWs.send(JSON.stringify({ action: 'get_chart_data' }));
            }
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error.message);
        }
      });

      this.zkbioWs.on('error', (error) => {
        console.error('❌ ZKBio Time WebSocket error:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          type: error.type,
          target: error.target?.url
        });
        this.isConnected = false;
        
        // Notify frontend clients
        if (this.socketIO) {
          this.socketIO.emit('zkbioConnectionStatus', {
            connected: false,
            message: `Connection error: ${error.message} (Code: ${error.code || 'Unknown'})`
          });
        }
        
        // Attempt reconnection
        this.attemptReconnection();
      });

      this.zkbioWs.on('close', (code, reason) => {
        console.log(`🔌 ZKBio Time WebSocket closed: ${code} - ${reason}`);
        this.isConnected = false;
        
        // Notify frontend clients
        if (this.socketIO) {
          this.socketIO.emit('zkbioConnectionStatus', {
            connected: false,
            message: 'Disconnected from ZKBio Time'
          });
        }

        // Attempt reconnection
        this.attemptReconnection();
      });

    } catch (error) {
      console.error('❌ Failed to connect to ZKBio Time:', error.message);
      this.isConnected = false;
      this.attemptReconnection();
    }
  }

  // Connect to ZKBio Time Chart WebSocket
  async connectToChartWebSocket() {
    // Skip if chart WebSocket is disabled due to persistent failures
    if (this.chartDisabled) {
      return;
    }

    try {
      // Use existing authentication if available
      if (!this.sessionCookies) {
        const authSuccess = await this.authenticateWithZKBioTime();
        if (!authSuccess) {
          console.log('⚠️  Chart WebSocket: Authentication failed, skipping connection');
          this.chartDisabled = true;
          return;
        }
      }

      console.log('📊 Connecting to ZKBio Time Chart WebSocket...');
      
      this.chartWs = new WebSocket('ws://45.115.86.139:85/base/dashboard/punch_present_chart/', {
        headers: {
          'Origin': 'http://45.115.86.139:85',
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      this.chartWs.on('open', () => {
        console.log('✅ Connected to ZKBio Time Chart WebSocket');
        this.chartConnected = true;
        this.chartReconnectAttempts = 0;
        
        // Send trigger message to get initial chart data
        console.log('📤 Sending trigger message for chart data...');
        this.chartWs.send(JSON.stringify({ action: 'get_chart_data' }));
        
        // Set up periodic refresh every 30 seconds to ensure chart stays updated
        this.chartRefreshInterval = setInterval(() => {
          if (this.chartWs && this.chartWs.readyState === WebSocket.OPEN) {
            this.chartWs.send(JSON.stringify({ action: 'get_chart_data' }));
          }
        }, 30000); // 30 seconds
        
        console.log('📊 Chart WebSocket ready - automatic updates + 30s periodic refresh');
      });

      this.chartWs.on('message', (data) => {
        try {
          const chartData = JSON.parse(data.toString());
          
          // Store the last chart data for immediate delivery to new clients
          this.lastChartData = chartData;
          
          // Broadcast chart data to all connected frontend clients
          if (this.socketIO) {
            this.socketIO.emit('liveChartUpdate', {
              data: chartData,
              timestamp: new Date().toISOString(),
              type: 'presentChart'
            });
          }
        } catch (error) {
          // Error handled silently to maintain clean logs
        }
      });

      this.chartWs.on('error', (error) => {
        // Check if it's a 502 error (server unavailable)
        if (error.message && error.message.includes('502')) {
          console.log('⚠️  Chart WebSocket: Server unavailable (502), disabling reconnection');
          this.chartDisabled = true;
          this.chartConnected = false;
          return;
        }
        this.chartConnected = false;
        this.attemptChartReconnection();
      });

      this.chartWs.on('close', (code, reason) => {
        this.chartConnected = false;
        
        // Clear the periodic refresh interval
        if (this.chartRefreshInterval) {
          clearInterval(this.chartRefreshInterval);
          this.chartRefreshInterval = null;
        }
        
        // Don't attempt reconnection if disabled
        if (!this.chartDisabled) {
          this.attemptChartReconnection();
        }
      });

    } catch (error) {
      // Check for 502 or connection errors
      if (error.message && (error.message.includes('502') || error.message.includes('Unexpected server response'))) {
        console.log('⚠️  Chart WebSocket: Server unavailable, disabling reconnection');
        this.chartDisabled = true;
      }
      this.chartConnected = false;
      if (!this.chartDisabled) {
        this.attemptChartReconnection();
      }
    }
  }

  // Attempt to reconnect chart WebSocket
  attemptChartReconnection() {
    if (this.chartDisabled) {
      return;
    }
    
    if (this.chartReconnectAttempts < this.maxReconnectAttempts) {
      this.chartReconnectAttempts++;
      console.log(`🔄 Attempting chart reconnection ${this.chartReconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
      
      setTimeout(() => {
        this.connectToChartWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('⚠️  Max chart reconnection attempts reached. Chart WebSocket disabled.');
      this.chartDisabled = true;
    }
  }

  // Connect to ZKBio Time Device Status WebSocket
  async connectToDeviceWebSocket() {
    // Skip if device WebSocket is disabled due to persistent failures
    if (this.deviceDisabled) {
      return;
    }

    try {
      // Use existing authentication if available
      if (!this.sessionCookies) {
        const authSuccess = await this.authenticateWithZKBioTime();
        if (!authSuccess) {
          console.log('⚠️  Device WebSocket: Authentication failed, skipping connection');
          this.deviceDisabled = true;
          return;
        }
      }

      console.log('📱 Connecting to ZKBio Time Device Status WebSocket...');
      
      this.deviceWs = new WebSocket('ws://45.115.86.139:85/base/dashboard/device_status_chart/', {
        headers: {
          'Origin': 'http://45.115.86.139:85',
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      this.deviceWs.on('open', () => {
        console.log('✅ Connected to ZKBio Time Device Status WebSocket');
        this.deviceConnected = true;
        this.deviceReconnectAttempts = 0;
        
        // Send trigger message to get initial device data
        console.log('📤 Sending trigger message for device data...');
        this.deviceWs.send(JSON.stringify({ action: 'get_chart_data' }));
        
        // No periodic refresh - let ZKBio Time server push updates automatically
        console.log('📱 Device Status WebSocket ready - waiting for automatic updates from ZKBio Time');
      });

      this.deviceWs.on('message', (data) => {
        try {
          const deviceData = JSON.parse(data.toString());
          
          // Store the last device data for immediate delivery to new clients
          this.lastDeviceData = deviceData;
          
          // Broadcast device data to all connected frontend clients
          if (this.socketIO) {
            this.socketIO.emit('liveDeviceStatusUpdate', {
              data: deviceData,
              timestamp: new Date().toISOString(),
              type: 'deviceStatus'
            });
          }
        } catch (error) {
          // Error handled silently to maintain clean logs
        }
      });

      this.deviceWs.on('error', (error) => {
        // Check if it's a 502 error (server unavailable)
        if (error.message && error.message.includes('502')) {
          console.log('⚠️  Device WebSocket: Server unavailable (502), disabling reconnection');
          this.deviceDisabled = true;
          this.deviceConnected = false;
          return;
        }
        this.deviceConnected = false;
        this.attemptDeviceReconnection();
      });

      this.deviceWs.on('close', (code, reason) => {
        this.deviceConnected = false;
        // Don't attempt reconnection if disabled
        if (!this.deviceDisabled) {
          this.attemptDeviceReconnection();
        }
      });

    } catch (error) {
      // Check for 502 or connection errors
      if (error.message && (error.message.includes('502') || error.message.includes('Unexpected server response'))) {
        console.log('⚠️  Device WebSocket: Server unavailable, disabling reconnection');
        this.deviceDisabled = true;
      }
      this.deviceConnected = false;
      if (!this.deviceDisabled) {
        this.attemptDeviceReconnection();
      }
    }
  }

  // Attempt to reconnect device WebSocket
  attemptDeviceReconnection() {
    if (this.deviceDisabled) {
      return;
    }
    
    if (this.deviceReconnectAttempts < this.maxReconnectAttempts) {
      this.deviceReconnectAttempts++;
      console.log(`🔄 Attempting device reconnection ${this.deviceReconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
      
      setTimeout(() => {
        this.connectToDeviceWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('⚠️  Max device reconnection attempts reached. Device WebSocket disabled.');
      this.deviceDisabled = true;
    }
  }

  // Connect to ZKBio Time Department Attendance WebSocket
  async connectToDepartmentWebSocket() {
    // Skip if department WebSocket is disabled due to persistent failures
    if (this.deptDisabled) {
      return;
    }

    try {
      // Use existing authentication if available
      if (!this.sessionCookies) {
        const authSuccess = await this.authenticateWithZKBioTime();
        if (!authSuccess) {
          console.log('⚠️  Department WebSocket: Authentication failed, skipping connection');
          this.deptDisabled = true;
          return;
        }
      }

      console.log('🏢 Connecting to ZKBio Time Department Attendance WebSocket...');
      
      this.deptWs = new WebSocket('ws://45.115.86.139:85/base/dashboard/punch_dept_att_chart/', {
        headers: {
          'Origin': 'http://45.115.86.139:85',
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      this.deptWs.on('open', () => {
        console.log('✅ Connected to ZKBio Time Department Attendance WebSocket');
        this.deptConnected = true;
        this.deptReconnectAttempts = 0;
        
        // Send trigger message to get initial department data
        console.log('📤 Sending trigger message for department data...');
        this.deptWs.send(JSON.stringify({ action: 'get_chart_data' }));
        
        // No periodic refresh - let ZKBio Time server push updates automatically
        console.log('🏢 Department Attendance WebSocket ready - waiting for automatic updates from ZKBio Time');
      });

      this.deptWs.on('message', (data) => {
        try {
          const deptData = JSON.parse(data.toString());
          
          // Store the last department data for immediate delivery to new clients
          this.lastDeptData = deptData;
          
          // Broadcast department data to all connected frontend clients
          if (this.socketIO) {
            this.socketIO.emit('liveDepartmentUpdate', {
              data: deptData,
              timestamp: new Date().toISOString(),
              type: 'departmentAttendance'
            });
          }
        } catch (error) {
          // Error handled silently to maintain clean logs
        }
      });

      this.deptWs.on('error', (error) => {
        // Check if it's a 502 error (server unavailable)
        if (error.message && error.message.includes('502')) {
          console.log('⚠️  Department WebSocket: Server unavailable (502), disabling reconnection');
          this.deptDisabled = true;
          this.deptConnected = false;
          return;
        }
        this.deptConnected = false;
        this.attemptDepartmentReconnection();
      });

      this.deptWs.on('close', (code, reason) => {
        this.deptConnected = false;
        // Don't attempt reconnection if disabled
        if (!this.deptDisabled) {
          this.attemptDepartmentReconnection();
        }
      });

    } catch (error) {
      // Check for 502 or connection errors
      if (error.message && (error.message.includes('502') || error.message.includes('Unexpected server response'))) {
        console.log('⚠️  Department WebSocket: Server unavailable, disabling reconnection');
        this.deptDisabled = true;
      }
      this.deptConnected = false;
      if (!this.deptDisabled) {
        this.attemptDepartmentReconnection();
      }
    }
  }

  // Attempt to reconnect department WebSocket
  attemptDepartmentReconnection() {
    if (this.deptDisabled) {
      return;
    }
    
    if (this.deptReconnectAttempts < this.maxReconnectAttempts) {
      this.deptReconnectAttempts++;
      console.log(`🔄 Attempting department reconnection ${this.deptReconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
      
      setTimeout(() => {
        this.connectToDepartmentWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('⚠️  Max department reconnection attempts reached. Department WebSocket disabled.');
      this.deptDisabled = true;
    }
  }

  // Test ZKBio Time connection
  async testConnection() {
    try {
      console.log('🧪 Testing ZKBio Time connection...');
      
      // Test HTTP connection first
      const axios = require('axios');
      const response = await axios.get('http://45.115.86.139:85/login/', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      console.log('✅ HTTP connection test passed:', response.status);
      
      // Test authentication
      const authSuccess = await this.authenticateWithZKBioTime();
      console.log('✅ Authentication test:', authSuccess ? 'PASSED' : 'FAILED');
      
      return authSuccess;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }

  // Attempt to reconnect to ZKBio Time
  attemptReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
      
      setTimeout(() => {
        this.connectToZKBioTime();
      }, this.reconnectDelay);
    } else {
      console.log('❌ Max reconnection attempts reached. Switching to demo mode.');
      this.startDemoMode();
    }
  }

  // Start demo mode when ZKBio Time is unreachable
  startDemoMode() {
    console.log('🎭 Starting demo mode with simulated attendance data...');
    
    // Notify frontend clients about demo mode
    if (this.socketIO) {
      this.socketIO.emit('zkbioConnectionStatus', {
        connected: false,
        message: 'Demo Mode - ZKBio Time unreachable'
      });
    }

    // Generate demo attendance events every 10-30 seconds
    const generateDemoEvent = () => {
      const employees = [
        { name: 'Ahmed Ali', empCode: '001' },
        { name: 'Sara Khan', empCode: '002' },
        { name: 'Muhammad Hassan', empCode: '003' },
        { name: 'Fatima Sheikh', empCode: '004' },
        { name: 'Ali Raza', empCode: '005' }
      ];
      
      const actions = ['Check In', 'Check Out'];
      const locations = ['Main Gate', 'Office Building', 'Factory Floor', 'Admin Block'];
      
      const randomEmployee = employees[Math.floor(Math.random() * employees.length)];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const randomLocation = locations[Math.floor(Math.random() * locations.length)];
      
      const demoEvent = {
        id: Date.now(),
        empCode: randomEmployee.empCode,
        name: randomEmployee.name,
        time: new Date().toLocaleTimeString(),
        state: randomAction,
        imagePath: '/demo/image.jpg',
        photoPath: '/demo/photo.jpg',
        location: randomLocation,
        timestamp: new Date().toISOString(),
        score: Date.now()
      };

      console.log(`🎭 Demo event: ${demoEvent.name} - ${demoEvent.state}`);
      
      // Broadcast demo event to frontend clients
      if (this.socketIO) {
        this.socketIO.emit('liveAttendanceUpdate', {
          events: [demoEvent],
          timestamp: new Date().toISOString(),
          count: 1
        });
      }
    };

    // Generate first demo event immediately
    generateDemoEvent();
    
    // Then generate events every 10-30 seconds
    const scheduleNextDemo = () => {
      const delay = Math.random() * 20000 + 10000; // 10-30 seconds
      setTimeout(() => {
        generateDemoEvent();
        scheduleNextDemo();
      }, delay);
    };
    
    scheduleNextDemo();
  }

  // Disconnect from ZKBio Time
  disconnect() {
    if (this.zkbioWs) {
      this.zkbioWs.close();
      this.zkbioWs = null;
    }
    if (this.chartWs) {
      this.chartWs.close();
      this.chartWs = null;
    }
    if (this.chartRefreshInterval) {
      clearInterval(this.chartRefreshInterval);
      this.chartRefreshInterval = null;
    }
    if (this.deviceWs) {
      this.deviceWs.close();
      this.deviceWs = null;
    }
    if (this.deptWs) {
      this.deptWs.close();
      this.deptWs = null;
    }
    this.isConnected = false;
    this.chartConnected = false;
    this.deviceConnected = false;
    this.deptConnected = false;
    console.log('🔌 Disconnected from ZKBio Time (all WebSockets)');
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      chartConnected: this.chartConnected,
      deviceConnected: this.deviceConnected,
      deptConnected: this.deptConnected,
      reconnectAttempts: this.reconnectAttempts,
      chartReconnectAttempts: this.chartReconnectAttempts,
      deviceReconnectAttempts: this.deviceReconnectAttempts,
      deptReconnectAttempts: this.deptReconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

module.exports = ZKBioTimeWebSocketProxy;
