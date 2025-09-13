import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Paper,
  Divider,
  alpha,
  useTheme,
  Fade,
  Slide,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Timeline,
  Refresh,
  FlashOn,
  Person as PersonIcon,
  AccessTime,
  LocationOn,
  CameraAlt,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { io } from 'socket.io-client';
import api from '../services/api';

const RealtimeAttendanceMonitor = () => {
  const theme = useTheme();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [attendanceEvents, setAttendanceEvents] = useState([]);
  const [newEvents, setNewEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    message: 'Connecting to ZKBio Time...'
  });

  // Load today's attendance data from ZKBio Time (same as Attendance Management page)
  const loadHistoricalAttendance = useCallback(async () => {
    try {
      console.log('📊 Loading today\'s attendance data from ZKBio Time...');
      
      const response = await api.get('/zkbio/zkbio/today');
      
      console.log('📋 ZKBio Time Today API Response:', {
        success: response.data.success,
        message: response.data.message,
        dataLength: response.data.data?.length || 0,
        count: response.data.count,
        hasData: !!response.data.data
      });
      
      if (response.data.success && response.data.data) {
        // Map data exactly like Attendance Management page
        const historicalData = response.data.data.map(record => ({
          id: record._id || record.id || Date.now() + Math.random(),
          empCode: record.employee?.employeeId || record.deviceUserId || record.userId || record.uid || 'N/A',
          name: record.employee?.firstName || record.employee?.lastName || record.name || record.userName || record.fullName || 'Unknown Employee',
          time: record.originalRecord?.punch_time || record.recordTime || new Date().toISOString(),
          state: record.originalRecord?.punch_state_display || 'Unknown',
          location: record.originalRecord?.area_alias || 'N/A',
          timestamp: record.originalRecord?.punch_time || record.recordTime || new Date().toISOString()
        }));
        
        // Sort by timestamp (most recent first) and limit to 50
        const sortedData = historicalData
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 50);
        
        console.log(`✅ Loaded ${sortedData.length} ZKBio Time today records`);
        console.log('📋 Sample records:', sortedData.slice(0, 3));
        setAttendanceEvents(sortedData);
      } else {
        console.log('⚠️  No ZKBio Time today data available');
        console.log('   This might mean no attendance records for today');
      }
    } catch (error) {
      console.error('❌ Error loading ZKBio Time today attendance:', error);
      console.error('   Error details:', error.response?.data || error.message);
    }
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://tovus.net' 
      : 'http://localhost:5001';
    
    const newSocket = io(baseURL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      console.log('🔍 Socket ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('zkbioConnectionStatus', (status) => {
      console.log('📡 ZKBio Time status:', status);
      console.log('🔍 ZKBio Time connected:', status.connected);
      setConnectionStatus(status);
    });

    newSocket.on('liveAttendanceUpdate', (data) => {
      console.log('🎉 LIVE ATTENDANCE UPDATE RECEIVED!');
      console.log('📊 Live attendance update:', data);
      
      if (data.events && data.events.length > 0) {
        console.log('🔍 REAL-TIME EVENT DEBUGGING:');
        console.log('Raw event data:', data.events[0]);
        console.log('Number of events:', data.events.length);
        
        // Map real-time events to include image data from ZKBio Time
        const mappedEvents = data.events.map(event => {
          console.log(`🖼️ Processing REAL-TIME event for ${event.name}:`);
          console.log(`   Original imagePath: ${event.imagePath}`);
          console.log(`   Original photoPath: ${event.photoPath}`);
          console.log(`   Event type: REAL-TIME (should have images)`);
          
          const employeePhoto = event.employeePhoto || (event.photoPath ? `/api/images/zkbio-image${event.photoPath}` : null);
          const attendanceImage = event.attendanceImage || (event.imagePath ? `/api/images/zkbio-image${event.imagePath}` : null);
          
          console.log(`   Constructed employeePhoto: ${employeePhoto}`);
          console.log(`   Constructed attendanceImage: ${attendanceImage}`);
          
          return {
            ...event,
            // Use pre-constructed image URLs from server or fallback to local construction
            employeePhoto,
            attendanceImage,
            method: event.method || 'Unknown',
            isRealTime: true // Mark as real-time event
          };
        });
        
        console.log('✅ Mapped REAL-TIME events with images:', mappedEvents);
        
        // Add new events to the beginning of the list (most recent first)
        // Keep only latest 50 records total (new events + existing historical data)
        setAttendanceEvents(prev => [...mappedEvents, ...prev.slice(0, 49)]);
        
        // Show new events notification
        setNewEvents(data.events.slice(0, 3));
        
        // Clear new events after 5 seconds
        setTimeout(() => {
          setNewEvents([]);
        }, 5000);
      }
    });

    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // Listen for all Socket.IO events to debug
    newSocket.onAny((eventName, ...args) => {
      console.log(`🔍 Socket.IO Event Received: ${eventName}`, args);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Load historical attendance data on component mount
  useEffect(() => {
    loadHistoricalAttendance();
  }, [loadHistoricalAttendance]);

  const handleRefresh = useCallback(() => {
    if (socket) {
      socket.emit('requestStatus');
    }
    // Also reload historical data
    loadHistoricalAttendance();
  }, [socket, loadHistoricalAttendance]);

  const formatTime = (timeString) => {
    try {
      if (!timeString) return 'N/A';
      
      const date = new Date(timeString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timeString; // Return original string if not a valid date
      }
      
      // Format exactly like Attendance Management page
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeString || 'N/A';
    }
  };

  const getStatusColor = (state) => {
    switch (state?.toLowerCase()) {
      case 'check in':
        return 'success';
      case 'check out':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Fade in timeout={1200}>
      <Card sx={{ 
        height: '100%', 
        borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        position: 'relative',
        overflow: 'hidden',
        '@keyframes pulse': {
          '0%': {
            boxShadow: `0 0 8px ${alpha(theme.palette.success.main, 0.6)}`,
            transform: 'scale(1)'
          },
          '50%': {
            boxShadow: `0 0 16px ${alpha(theme.palette.success.main, 0.8)}`,
            transform: 'scale(1.1)'
          },
          '100%': {
            boxShadow: `0 0 8px ${alpha(theme.palette.success.main, 0.6)}`,
            transform: 'scale(1)'
          }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.success.main})`,
          borderRadius: '16px 16px 0 0'
        }
      }}>
        <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                  color: theme.palette.primary.main,
                  position: 'relative'
                }}
              >
                <Timeline />
                {connectionStatus.connected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: theme.palette.success.main,
                      animation: 'pulse 2s infinite'
                    }}
                  />
                )}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
                  Real-Time Monitor
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  Live attendance updates from ZKBio Time
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label={
                  connectionStatus.connected ? "LIVE" : 
                  connectionStatus.message?.includes('Demo') ? "DEMO" : 
                  "OFFLINE"
                } 
                size="small" 
                color={
                  connectionStatus.connected ? "success" : 
                  connectionStatus.message?.includes('Demo') ? "warning" : 
                  "error"
                } 
                icon={
                  connectionStatus.connected ? <FlashOn /> : 
                  connectionStatus.message?.includes('Demo') ? <Timeline /> :
                  <Error />
                }
                sx={{ 
                  fontWeight: 600,
                  animation: connectionStatus.connected ? 'pulse 2s infinite' : 'none'
                }}
              />
              <Tooltip title="Refresh Connection">
                <IconButton 
                  onClick={handleRefresh}
                  size="small"
                  sx={{ 
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      transform: 'rotate(180deg)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Connection Status */}
          {!connectionStatus.connected && (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
              action={
                <IconButton onClick={handleRefresh} size="small">
                  <Refresh />
                </IconButton>
              }
            >
              {connectionStatus.message}
            </Alert>
          )}

          {/* New Events Alert */}
          {newEvents.length > 0 && (
            <Slide direction="down" in={newEvents.length > 0} timeout={300}>
              <Box sx={{ mb: 2 }}>
                {newEvents.map((event, index) => (
                  <Fade in timeout={500 + index * 200} key={index}>
                    <Paper
                      sx={{
                        p: 2,
                        mb: 1,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                        animation: 'slideInRight 0.5s ease-out'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Employee Avatar for Real-Time Events */}
                        <Box sx={{ position: 'relative' }}>
                          {event.employeePhoto || event.attendanceImage ? (
                            <Tooltip
                              title={
                                <Box sx={{ 
                                  textAlign: 'center', 
                                  p: 2,
                                  position: 'relative',
                                  overflow: 'hidden',
                                  '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: `linear-gradient(135deg, 
                                      ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.1)} 0%, 
                                      ${alpha(theme.palette.common.black, 0.8)} 50%, 
                                      ${alpha(theme.palette.common.black, 0.95)} 100%)`,
                                    zIndex: -1
                                  }
                                }}>
                                  <Box
                                    component="img"
                                    src={event.employeePhoto || event.attendanceImage}
                                    alt={`${event.name} - ${event.state}`}
                                    sx={{
                                      width: 240,
                                      height: 240,
                                      borderRadius: 4,
                                      objectFit: 'cover',
                                      border: `4px solid ${getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main}`,
                                      boxShadow: `
                                        0 0 0 2px ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.3)},
                                        0 12px 40px ${alpha(theme.palette.common.black, 0.4)},
                                        0 0 60px ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.2)},
                                        inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.1)}
                                      `,
                                      mb: 2,
                                      position: 'relative',
                                      transition: 'all 0.3s ease',
                                      '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        top: -2,
                                        left: -2,
                                        right: -2,
                                        bottom: -2,
                                        background: `linear-gradient(45deg, 
                                          ${getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main}, 
                                          ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.5)})`,
                                        borderRadius: 4,
                                        zIndex: -1,
                                        opacity: 0.6
                                      }
                                    }}
                                  />
                                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                                    <Typography variant="h6" sx={{ 
                                      fontWeight: 700, 
                                      color: 'white',
                                      textShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.8)}`,
                                      mb: 0.5,
                                      fontSize: '1.1rem'
                                    }}>
                                      {event.name}
                                    </Typography>
                                    <Typography variant="body2" sx={{ 
                                      color: 'white', 
                                      opacity: 0.9,
                                      textShadow: `0 1px 4px ${alpha(theme.palette.common.black, 0.6)}`,
                                      mb: 1,
                                      fontWeight: 500
                                    }}>
                                      {event.state} • {formatTime(event.time)}
                                    </Typography>
                                    <Box sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                      px: 1.5,
                                      py: 0.5,
                                      borderRadius: 2,
                                      background: `linear-gradient(135deg, 
                                        ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.2)}, 
                                        ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.1)})`,
                                      border: `1px solid ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.3)}`,
                                      backdropFilter: 'blur(10px)'
                                    }}>
                                      <Box sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main,
                                        boxShadow: `0 0 8px ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.6)}`,
                                        animation: 'pulse 2s infinite'
                                      }} />
                                      <Typography variant="caption" sx={{ 
                                        color: 'white', 
                                        fontWeight: 600,
                                        textShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.5)}`
                                      }}>
                                        LIVE ATTENDANCE
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              }
                              placement="top"
                              arrow
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: 'transparent',
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: 4,
                                    p: 0,
                                    maxWidth: 'none',
                                    boxShadow: `
                                      0 20px 60px ${alpha(theme.palette.common.black, 0.4)},
                                      0 0 0 1px ${alpha(theme.palette.common.white, 0.1)}
                                    `,
                                    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`
                                  }
                                },
                                arrow: {
                                  sx: {
                                    color: alpha(theme.palette.common.black, 0.9),
                                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                                  }
                                }
                              }}
                            >
                              <Avatar 
                                src={event.employeePhoto || event.attendanceImage}
                                sx={{ 
                                  width: 32,
                                  height: 32,
                                  border: `2px solid ${getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main}`,
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    transform: 'scale(1.1)',
                                    boxShadow: `0 4px 16px ${alpha(getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.4)}`
                                  }
                                }}
                                onLoad={() => {
                                  console.log(`✅ Real-time image loaded for ${event.name}:`, event.employeePhoto || event.attendanceImage);
                                  console.log(`🖼️ Avatar should now be visible with image`);
                                }}
                                onError={(e) => {
                                  console.log(`❌ Real-time image failed for ${event.name}:`, event.employeePhoto || event.attendanceImage);
                                  if (e.target) {
                                    e.target.style.display = 'none';
                                  }
                                  if (e.target && e.target.nextSibling) {
                                    e.target.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            </Tooltip>
                          ) : null}
                          <Avatar sx={{ 
                            backgroundColor: alpha(theme.palette.success.main, 0.2), 
                            color: theme.palette.success.main,
                            width: 32,
                            height: 32,
                            display: (event.employeePhoto || event.attendanceImage) ? 'none' : 'flex'
                          }}>
                            <PersonIcon />
                          </Avatar>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {event.name} - {event.state}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {formatTime(event.time)}
                          </Typography>
                        </Box>
                        <Chip 
                          label="NEW" 
                          size="small" 
                          color="success" 
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    </Paper>
                  </Fade>
                ))}
              </Box>
            </Slide>
          )}

          {/* Live Attendance Feed */}
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ 
              color: theme.palette.text.secondary, 
              mb: 2,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <AccessTime sx={{ fontSize: 16 }} />
              Recent Activity ({attendanceEvents.length} events)
            </Typography>
            
            <Box sx={{ 
              height: '400px', 
              overflowY: 'auto',
              '&::-webkit-scrollbar': {
                width: '6px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: alpha(theme.palette.grey[300], 0.1),
                borderRadius: '3px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: alpha(theme.palette.primary.main, 0.3),
                borderRadius: '3px',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.5)
                }
              }
            }}>
              <Stack spacing={1.5}>
                {attendanceEvents.map((event, index) => (
                  <Fade in timeout={800 + index * 100} key={event.id || index}>
                    <Paper
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${alpha(theme.palette.grey[300], 0.2)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Employee Avatar for All Events */}
                        <Box sx={{ position: 'relative' }}>
                          {event.employeePhoto || event.attendanceImage ? (
                            <Tooltip
                              title={
                                <Box sx={{ 
                                  textAlign: 'center', 
                                  p: 2,
                                  position: 'relative',
                                  overflow: 'hidden',
                                  '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: `linear-gradient(135deg, 
                                      ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.1)} 0%, 
                                      ${alpha(theme.palette.common.black, 0.8)} 50%, 
                                      ${alpha(theme.palette.common.black, 0.95)} 100%)`,
                                    zIndex: -1
                                  }
                                }}>
                                  <Box
                                    component="img"
                                    src={event.employeePhoto || event.attendanceImage}
                                    alt={`${event.name} - ${event.state}`}
                                    sx={{
                                      width: 240,
                                      height: 240,
                                      borderRadius: 4,
                                      objectFit: 'cover',
                                      border: `4px solid ${event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main}`,
                                      boxShadow: `
                                        0 0 0 2px ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.3)},
                                        0 12px 40px ${alpha(theme.palette.common.black, 0.4)},
                                        0 0 60px ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.2)},
                                        inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.1)}
                                      `,
                                      mb: 2,
                                      position: 'relative',
                                      transition: 'all 0.3s ease',
                                      '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        top: -2,
                                        left: -2,
                                        right: -2,
                                        bottom: -2,
                                        background: `linear-gradient(45deg, 
                                          ${event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main}, 
                                          ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.5)})`,
                                        borderRadius: 4,
                                        zIndex: -1,
                                        opacity: 0.6
                                      }
                                    }}
                                  />
                                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                                    <Typography variant="h6" sx={{ 
                                      fontWeight: 700, 
                                      color: 'white',
                                      textShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.8)}`,
                                      mb: 0.5,
                                      fontSize: '1.1rem'
                                    }}>
                                      {event.name}
                                    </Typography>
                                    <Typography variant="body2" sx={{ 
                                      color: 'white', 
                                      opacity: 0.9,
                                      textShadow: `0 1px 4px ${alpha(theme.palette.common.black, 0.6)}`,
                                      mb: 1,
                                      fontWeight: 500
                                    }}>
                                      {event.state} • {formatTime(event.time)}
                                    </Typography>
                                    <Box sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                      px: 1.5,
                                      py: 0.5,
                                      borderRadius: 2,
                                      background: `linear-gradient(135deg, 
                                        ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.2)}, 
                                        ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.1)})`,
                                      border: `1px solid ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.3)}`,
                                      backdropFilter: 'blur(10px)'
                                    }}>
                                      <Box sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main,
                                        boxShadow: `0 0 8px ${alpha(event.isRealTime ? (getStatusColor(event.state) === 'success' ? theme.palette.success.main : theme.palette.error.main) : theme.palette.primary.main, 0.6)}`,
                                        animation: event.isRealTime ? 'pulse 2s infinite' : 'none'
                                      }} />
                                      <Typography variant="caption" sx={{ 
                                        color: 'white', 
                                        fontWeight: 600,
                                        textShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.5)}`
                                      }}>
                                        {event.isRealTime ? 'LIVE ATTENDANCE' : 'ATTENDANCE RECORD'}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              }
                              placement="top"
                              arrow
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: 'transparent',
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: 4,
                                    p: 0,
                                    maxWidth: 'none',
                                    boxShadow: `
                                      0 20px 60px ${alpha(theme.palette.common.black, 0.4)},
                                      0 0 0 1px ${alpha(theme.palette.common.white, 0.1)}
                                    `,
                                    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`
                                  }
                                },
                                arrow: {
                                  sx: {
                                    color: alpha(theme.palette.common.black, 0.9),
                                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                                  }
                                }
                              }}
                            >
                              <Avatar 
                                src={event.employeePhoto || event.attendanceImage}
                                sx={{ 
                                  width: 40,
                                  height: 40,
                                  border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    transform: 'scale(1.1)',
                                    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                                  }
                                }}
                                onLoad={() => {
                                  console.log(`✅ Main Avatar image loaded for ${event.name}:`, event.employeePhoto || event.attendanceImage);
                                  console.log(`🖼️ Main Avatar should now be visible with image`);
                                }}
                                onError={(e) => {
                                  console.log(`❌ Main Avatar image failed for ${event.name}:`, event.employeePhoto || event.attendanceImage);
                                  if (e.target) {
                                    e.target.style.display = 'none';
                                  }
                                  if (e.target && e.target.nextSibling) {
                                    e.target.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            </Tooltip>
                          ) : null}
                          <Avatar sx={{ 
                            backgroundColor: alpha(theme.palette.primary.main, 0.1), 
                            color: theme.palette.primary.main,
                            width: 40,
                            height: 40,
                            fontSize: '0.9rem',
                            display: (event.employeePhoto || event.attendanceImage) ? 'none' : 'flex'
                          }}>
                            {event.name ? event.name.charAt(0).toUpperCase() : 'E'}
                          </Avatar>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600, 
                            color: theme.palette.text.primary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {event.name || `Employee ${event.empCode}`}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                              {formatTime(event.time)}
                            </Typography>
                            {event.location && (
                              <>
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                  •
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <LocationOn sx={{ fontSize: 12, color: theme.palette.text.secondary }} />
                                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                    {event.location}
                                  </Typography>
                                </Box>
                              </>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={event.state || 'Present'}
                            size="small"
                            color={getStatusColor(event.state)}
                            sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                          />
                          <CameraAlt sx={{ 
                            fontSize: 16, 
                            color: theme.palette.text.secondary,
                            opacity: 0.7
                          }} />
                        </Box>
                      </Box>
                    </Paper>
                  </Fade>
                ))}
                
                {attendanceEvents.length === 0 && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 4,
                    color: theme.palette.text.secondary
                  }}>
                    {connectionStatus.connected ? (
                      <>
                        <Timeline sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                        <Typography variant="body2">
                          Loading attendance data...
                        </Typography>
                        <Typography variant="caption">
                          Fetching latest 50 records from ZKBio Time
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Error sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                        <Typography variant="body2">
                          Connection to ZKBio Time required
                        </Typography>
                        <Typography variant="caption">
                          Please check your connection
                        </Typography>
                      </>
                    )}
                  </Box>
                )}
              </Stack>
            </Box>
          </Box>
        </CardContent>
        <style jsx>{`
          @keyframes pulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.7;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes slideInRight {
            0% {
              transform: translateX(100%);
              opacity: 0;
            }
            100% {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
      </Card>
    </Fade>
  );
};

export default RealtimeAttendanceMonitor;
