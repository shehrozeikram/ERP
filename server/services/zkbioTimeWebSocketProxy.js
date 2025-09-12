const WebSocket = require('ws');
const axios = require('axios');
const { Server } = require('socket.io');
const http = require('http');

class ZKBioTimeWebSocketProxy {
  constructor() {
    this.zkbioWs = null;
    this.socketIO = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.sessionCookies = null;
  }

  // Initialize Socket.IO server
  initializeSocketIO(server) {
    this.socketIO = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.socketIO.on('connection', (socket) => {
      console.log('📱 Frontend client connected:', socket.id);
      
      // Send current connection status
      socket.emit('zkbioConnectionStatus', {
        connected: this.isConnected,
        message: this.isConnected ? 'Connected to ZKBio Time' : 'Disconnected from ZKBio Time'
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
      
      const response = await axios.get('http://182.180.55.96:85/', {
        auth: {
          username: 'superuser',
          password: 'SGCit123456'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.status === 200) {
        const cookies = response.headers['set-cookie'];
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
      
      this.zkbioWs = new WebSocket('ws://182.180.55.96:85/base/dashboard/realtime_punch/', {
        headers: {
          'Origin': 'http://182.180.55.96:85',
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
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
              score: message.score
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
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error.message);
        }
      });

      this.zkbioWs.on('error', (error) => {
        console.error('❌ ZKBio Time WebSocket error:', error.message);
        this.isConnected = false;
        
        // Notify frontend clients
        if (this.socketIO) {
          this.socketIO.emit('zkbioConnectionStatus', {
            connected: false,
            message: 'Connection error: ' + error.message
          });
        }
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
    this.isConnected = false;
    console.log('🔌 Disconnected from ZKBio Time');
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

module.exports = ZKBioTimeWebSocketProxy;
