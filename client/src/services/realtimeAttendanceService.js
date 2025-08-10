import { io } from 'socket.io-client';

class RealtimeAttendanceService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
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
      
      // Create Socket.IO connection
      this.socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5001', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: false
      });

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('✅ Connected to real-time attendance service');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.joinAttendanceRoom();
        this.notifyListeners('connection_status', { status: 'connected' });
      });

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

      // Attendance update events
      this.socket.on('attendance_update', (data) => {
        console.log('📊 Real-time attendance update received:', data);
        this.notifyListeners('attendance_update', data);
      });

      this.socket.on('connection_status', (data) => {
        console.log('📡 Connection status update:', data);
        this.notifyListeners('connection_status', data);
      });

      this.socket.on('room_joined', (data) => {
        console.log('👥 Room joined:', data);
        this.notifyListeners('room_joined', data);
      });

    } catch (error) {
      console.error('❌ Failed to connect to real-time service:', error);
      this.isConnected = false;
    }
  }

  // Join attendance room to receive updates
  joinAttendanceRoom() {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_attendance');
      console.log('👥 Joining attendance room...');
    }
  }

  // Leave attendance room
  leaveAttendanceRoom() {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_attendance');
      console.log('👋 Leaving attendance room...');
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.notifyListeners('connection_status', { 
        status: 'failed', 
        message: 'Failed to reconnect after maximum attempts' 
      });
    }
  }

  // Disconnect from service
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from real-time service...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
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
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Test connection
  testConnection() {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
      return true;
    }
    return false;
  }
}

// Export singleton instance
export default new RealtimeAttendanceService();
