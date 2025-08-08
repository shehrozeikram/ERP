import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Fab,
  Tooltip,
  Button
} from '@mui/material';
import {
  Person,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  Refresh as RefreshIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { formatAttendanceTime, formatLocalDateTime } from '../utils/timezoneHelper';

const RealTimeAttendance = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Test connection to real-time service
  const testConnection = async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:8080/zkteco/health`);
      const data = await response.json();
      
      if (data.success && data.status === 'running') {
        console.log('✅ Real-time service is running');
        return true;
      } else {
        console.log('❌ Real-time service is not running');
        return false;
      }
    } catch (error) {
      console.error('❌ Error testing connection:', error);
      return false;
    }
  };

  // WebSocket connection
  const connectWebSocket = () => {
    try {
      // Use the same hostname as the current page, but port 8080 for WebSocket
      const hostname = window.location.hostname;
      const wsUrl = `ws://${hostname}:8080`;
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      // Check if WebSocket is supported
      if (!window.WebSocket) {
        setError('WebSocket is not supported in this browser');
        return;
      }
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      wsRef.current = new WebSocket(wsUrl);
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          console.log('⏰ WebSocket connection timeout');
          wsRef.current.close();
          
          // Try alternative connection method
          console.log('🔄 Trying alternative connection method...');
          const alternativeUrl = `ws://localhost:8080`;
          if (alternativeUrl !== wsUrl) {
            console.log('🔌 Trying alternative URL:', alternativeUrl);
            wsRef.current = new WebSocket(alternativeUrl);
            setupWebSocketHandlers(wsRef.current, connectionTimeout);
          } else {
            setError('Connection timeout. Please check if the real-time service is running on port 8080.');
          }
        }
      }, 10000); // 10 second timeout
      
      setupWebSocketHandlers(wsRef.current, connectionTimeout);
      
    } catch (error) {
      console.error('❌ Error connecting to WebSocket:', error);
      setError('Failed to connect to real-time service');
    }
  };

  // Setup WebSocket event handlers
  const setupWebSocketHandlers = (ws, timeout) => {
    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      clearTimeout(timeout);
      setIsConnected(true);
      setConnectionStatus('connected');
      setError(null);
    };
    
    ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      clearTimeout(timeout);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Only attempt to reconnect if it wasn't a manual close
      if (event.code !== 1000) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      clearTimeout(timeout);
      setError('Failed to connect to real-time service. Please ensure the real-time service is running on port 8080.');
      setIsConnected(false);
      setConnectionStatus('error');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📥 Received WebSocket message:', data);
        
        if (data.type === 'attendance') {
          handleAttendanceUpdate(data.data);
        } else if (data.type === 'connection') {
          console.log('🔌 WebSocket connection established');
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };
  };

  // Handle real-time attendance updates
  const handleAttendanceUpdate = (data) => {
    if (data && data.records && Array.isArray(data.records)) {
      const newRecords = data.records.filter(record => record.success);
      
      if (newRecords.length > 0) {
        setAttendanceRecords(prevRecords => {
          const updatedRecords = [...newRecords, ...prevRecords];
          // Keep only the last 50 records
          return updatedRecords.slice(0, 50);
        });
        
        setLastUpdate(new Date());
        
        // Show notification for new attendance
        if (newRecords.length > 0) {
          const latestRecord = newRecords[0];
          showNotification(latestRecord);
        }
      }
    }
  };

  // Show browser notification
  const showNotification = (record) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = `${record.employeeName} - ${record.isCheckIn ? 'Check-in' : 'Check-out'}`;
      const body = `${record.isCheckIn ? 'Checked in' : 'Checked out'} at ${record.timestamp}`;
      
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }
  };

  // Request notification permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Connect to WebSocket on component mount
  useEffect(() => {
    const initializeConnection = async () => {
      // Test if the real-time service is running first
      const isServiceRunning = await testConnection();
      
      if (isServiceRunning) {
        connectWebSocket();
      } else {
        setError('Real-time service is not running. Please start it first.');
        setConnectionStatus('error');
      }
    };
    
    initializeConnection();
    requestNotificationPermission();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get action icon
  const getActionIcon = (isCheckIn) => {
    return isCheckIn ? <CheckInIcon color="success" /> : <CheckOutIcon color="error" />;
  };

  // Get action text
  const getActionText = (isCheckIn) => {
    return isCheckIn ? 'Check-in' : 'Check-out';
  };

  // Get action color
  const getActionColor = (isCheckIn) => {
    return isCheckIn ? 'success' : 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Real-Time Attendance
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Connection Status */}
          <Chip
            icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
            label={connectionStatus}
            color={getStatusColor(connectionStatus)}
            variant="outlined"
          />
          
          {/* WebSocket URL */}
          <Typography variant="caption" color="text.secondary">
            WS: ws://{window.location.hostname}:8080
          </Typography>
          
          {/* Last Update */}
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Last update: {formatLocalDateTime(lastUpdate)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Connection Instructions */}
      {!isConnected && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="body2" component="div">
              <strong>Real-time attendance is not connected.</strong>
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 1 }}>
              To enable real-time attendance:
            </Typography>
            <Box component="ol" sx={{ mt: 1, pl: 2 }}>
              <li>Start the real-time service: <code>node server/scripts/startRealTimeService.js</code></li>
              <li>Or use the API: <code>POST /api/zkteco-push/start</code></li>
              <li>Configure your ZKTeco device to send push notifications to: <code>http://your-server-ip:8080/zkteco/push</code></li>
              <li>Real-time updates will appear here automatically</li>
            </Box>
            <Typography variant="body2" component="div" sx={{ mt: 1 }}>
              <strong>Current Status:</strong> {connectionStatus === 'error' ? 'Connection failed' : 'Not connected'}
              <br />
              <strong>WebSocket URL:</strong> <code>ws://{window.location.hostname}:8080</code>
              <br />
              <strong>Service Status:</strong> {connectionStatus === 'error' ? '❌ Service may not be running' : '⏳ Checking connection...'}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setError(null);
              setConnectionStatus('connecting');
              connectWebSocket();
            }}
            sx={{ mt: 1 }}
          >
            Retry Connection
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              const isRunning = await testConnection();
              if (isRunning) {
                setError(null);
                setConnectionStatus('connecting');
                connectWebSocket();
              } else {
                setError('Real-time service is not running. Please start it first.');
                setConnectionStatus('error');
              }
            }}
            sx={{ mt: 1, ml: 1 }}
          >
            Test Service
          </Button>
        </Alert>
      )}

      {/* Real-time Attendance List */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2">
              Live Attendance Updates
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isConnected && <CircularProgress size={16} />}
              <Typography variant="caption" color="text.secondary">
                {attendanceRecords.length} recent records
              </Typography>
            </Box>
          </Box>

          {attendanceRecords.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                {isConnected 
                  ? 'Waiting for real-time attendance updates...' 
                  : 'Connect to real-time service to see live updates'
                }
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {attendanceRecords.map((record, index) => (
                <ListItem
                  key={`${record.employeeId}-${record.timestamp}-${index}`}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: index === 0 ? 'action.hover' : 'background.paper'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: getActionColor(record.isCheckIn) + '.light' }}>
                      {getActionIcon(record.isCheckIn)}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" component="span">
                          {record.employeeName}
                        </Typography>
                        <Chip
                          label={getActionText(record.isCheckIn)}
                          color={getActionColor(record.isCheckIn)}
                          size="small"
                        />
                        {index === 0 && (
                          <Chip
                            label="NEW"
                            color="primary"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Employee ID: {record.employeeId}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Time: {record.timestamp}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Action: {record.action}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Floating Action Button for Manual Refresh */}
      <Fab
        color="primary"
        aria-label="refresh"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }}
      >
        <RefreshIcon />
      </Fab>
    </Box>
  );
};

export default RealTimeAttendance; 