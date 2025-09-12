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
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('zkbioConnectionStatus', (status) => {
      console.log('📡 ZKBio Time status:', status);
      setConnectionStatus(status);
    });

    newSocket.on('liveAttendanceUpdate', (data) => {
      console.log('📊 Live attendance update:', data);
      
      if (data.events && data.events.length > 0) {
        // Add new events to the list
        setAttendanceEvents(prev => [...data.events, ...prev.slice(0, 19)]);
        
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

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    if (socket) {
      socket.emit('requestStatus');
    }
  }, [socket]);

  const formatTime = (timeString) => {
    try {
      return new Date(timeString).toLocaleTimeString();
    } catch {
      return timeString;
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
                        <Avatar sx={{ 
                          backgroundColor: alpha(theme.palette.success.main, 0.2), 
                          color: theme.palette.success.main,
                          width: 32,
                          height: 32
                        }}>
                          <PersonIcon />
                        </Avatar>
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
                        <Avatar sx={{ 
                          backgroundColor: alpha(theme.palette.primary.main, 0.1), 
                          color: theme.palette.primary.main,
                          width: 40,
                          height: 40,
                          fontSize: '0.9rem'
                        }}>
                          {event.name ? event.name.charAt(0).toUpperCase() : 'E'}
                        </Avatar>
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
                          Waiting for attendance events...
                        </Typography>
                        <Typography variant="caption">
                          Real-time updates will appear here
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
