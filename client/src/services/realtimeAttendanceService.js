// Real-time attendance service using Socket.IO connection to SGC ERP server
import { io } from 'socket.io-client';

class RealtimeAttendanceService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds
    this.reconnectDelay = 1000; // 1 second
    this.connectedClients = new Set(); // Keep for compatibility
    this.lastPunchEvent = null;
    this.connectionStatus = 'disconnected';
    this.listeners = new Map();
  }

  // Connect to Socket.IO server
  connect() {
    try {
      // Prevent multiple connections
      if (this.socket && this.isConnected) {
        console.log('🔌 Already connected to real-time attendance service');
        return;
      }
      
      console.log('🔌 Connecting to real-time attendance service...');
      console.log('🔌 Server URL:', process.env.REACT_APP_API_URL || 'http://localhost:5001');
      
      // Create Socket.IO connection to SGC ERP server
      this.socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5001', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: false
      });

      console.log('🔌 Socket.IO instance created, setting up event handlers...');

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('✅ Connected to real-time attendance service');
        console.log('✅ Socket ID:', this.socket.id);
        this.isConnected = true;
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.joinAttendanceRoom();
        this.notifyListeners('connection_status', { status: 'connected' });
      });

      // Attendance update events - listen for the exact events backend emits
      this.socket.on('attendance_update', (data) => {
        console.log('📊 Real-time attendance update received:', data);
        console.log('📊 Event type:', data.type);
        console.log('📊 Event data:', data.data);
        this.notifyListeners('attendance_update', data);
      });

      // The backend emits 'attendance_update' events, not individual event types
      // So we only need to listen for 'attendance_update' and handle the type inside
      this.socket.on('connection_status', (data) => {
        console.log('📡 Connection status update:', data);
        this.notifyListeners('connection_status', data);
      });

      this.socket.on('room_joined', (data) => {
        console.log('👥 Room joined:', data);
        this.notifyListeners('room_joined', data);
      });

      // Add error and disconnect handlers for debugging
      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from real-time service:', reason);
        this.isConnected = false;
        this.notifyListeners('connection_status', { status: 'disconnected', reason });
        
        // Attempt to reconnect if not manually disconnected
        if (reason !== 'io client disconnect') {
          this.attemptReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        this.isConnected = false;
        this.notifyListeners('connection_status', { status: 'error', error: error.message });
        this.attemptReconnect();
      });

    } catch (error) {
      console.error('❌ Failed to connect to real-time service:', error);
      this.isConnected = false;
    }
  }

  // Join attendance room to receive updates
  joinAttendanceRoom() {
    if (this.socket && this.isConnected) {
      console.log('👥 Joining attendance room...');
      console.log('👥 Socket ID:', this.socket.id);
      console.log('👥 Socket connected:', this.socket.connected);
      this.socket.emit('join_attendance');
      console.log('👥 Join attendance event emitted');
    } else {
      console.log('⚠️ Cannot join attendance room - socket not ready');
      console.log('⚠️ Socket exists:', !!this.socket);
      console.log('⚠️ Is connected:', this.isConnected);
    }
  }

  // Leave attendance room
  leaveAttendanceRoom() {
    if (this.socket && this.isConnected) {
      console.log('👋 Leaving attendance room...');
      this.socket.emit('leave_attendance');
    } else {
      console.log('⚠️ Cannot leave attendance room - socket not connected');
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect Socket.IO (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max Socket.IO reconnection attempts reached');
      this.notifyListeners('connection_status', { 
        status: 'failed', 
        message: 'Failed to reconnect Socket.IO after maximum attempts' 
      });
    }
  }

  // Schedule reconnection attempt
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Scheduling Socket.IO reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval/1000} seconds...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('❌ Max Socket.IO reconnection attempts reached. Manual restart required.');
    }
  }

  // Disconnect from service
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from real-time service...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.reconnectAttempts = 0;
    }
  }

  // Add event listener
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  // Remove event listener
  removeListener(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // Notify all listeners for an event
  notifyListeners(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Get connection status
  getConnectionStatus() {
    try {
      return {
        isConnected: this.isConnected || false,
        connectionStatus: this.connectionStatus || 'disconnected',
        reconnectAttempts: this.reconnectAttempts || 0,
        maxReconnectAttempts: this.maxReconnectAttempts || 5,
        connectedClients: 0, // Socket.IO doesn't expose client count easily
        lastPunchEvent: this.lastPunchEvent || null,
        socketId: this.socket ? this.socket.id : null,
        readyState: this.socket ? (this.socket.connected ? 'connected' : 'disconnected') : null,
        url: process.env.REACT_APP_API_URL || 'http://localhost:5001',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting connection status:', error);
      return {
        isConnected: false,
        connectionStatus: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test connection
  testConnection() {
    if (this.socket && this.isConnected) {
      // For Socket.IO, check if connection is established
      return this.socket.connected;
    }
    return false;
  }
}

// Export singleton instance
export default new RealtimeAttendanceService();
