import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Zoom,
  Chip
} from '@mui/material';
import {
  Refresh,
  People,
  Download,
  FlashOn
} from '@mui/icons-material';
import * as echarts from 'echarts';
import { io } from 'socket.io-client';

const PresentChart = () => {
  const theme = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const socketRef = useRef(null);
  
  // Default fallback data (only used if no real data received)
  const defaultData = [
    { 
      name: 'Absent', 
      value: 0, 
      itemStyle: { color: '#ED6766' }
    },
    { 
      name: 'Present', 
      value: 0, 
      itemStyle: { color: '#91CB74' }
    }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    
    // Request fresh data from server
    if (socketRef.current) {
      socketRef.current.emit('requestChartData');
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Initialize WebSocket connection for real-time chart data
  useEffect(() => {
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://tovus.net' 
      : 'http://localhost:5001';
    
    const socket = io(baseURL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('📊 PresentChart: Connected to server');
      // Request initial chart data
      socket.emit('requestChartData');
    });

    socket.on('zkbioConnectionStatus', (status) => {
      console.log('📊 PresentChart: ZKBio Time status:', status);
      if (!status.connected && isLoading) {
        console.log('📊 PresentChart: ZKBio Time not connected, reducing loading time');
        // If ZKBio Time is not connected, reduce loading time
        setTimeout(() => {
          if (isLoading && !chartData) {
            setIsLoading(false);
          }
        }, 2000); // Only wait 2 seconds if ZKBio Time is not connected
      }
    });

    socket.on('liveChartUpdate', (data) => {
      console.log('📊 PresentChart: Received chart data:', data);
      console.log('📊 PresentChart: Data type:', typeof data);
      console.log('📊 PresentChart: Data.data structure:', data.data);
      console.log('📊 PresentChart: Data.data.series:', data.data?.series);
      
      if (data.type === 'presentChart' && data.data) {
        let newChartData = [];
        
        // Handle different possible data structures from ZKBio Time
        if (data.data.series && data.data.series[0] && data.data.series[0].data) {
          // Structure: { series: [{ data: [...] }] }
          const seriesData = data.data.series[0].data;
          console.log('📊 PresentChart: Series data from ZKBio Time:', seriesData);
          newChartData = seriesData.map(item => ({
            name: item.name,
            value: item.value,
            itemStyle: { 
              color: item.name === 'Present' ? '#91CB74' : '#ED6766' 
            }
          }));
        } else if (Array.isArray(data.data)) {
          // Structure: [{ name: 'Present', value: 10 }, { name: 'Absent', value: 5 }]
          newChartData = data.data.map(item => ({
            name: item.name,
            value: item.value,
            itemStyle: { 
              color: item.name === 'Present' ? '#91CB74' : '#ED6766' 
            }
          }));
        } else if (data.data.present !== undefined || data.data.absent !== undefined) {
          // Structure: { present: 10, absent: 5 }
          newChartData = [
            {
              name: 'Present',
              value: data.data.present || 0,
              itemStyle: { color: '#91CB74' }
            },
            {
              name: 'Absent', 
              value: data.data.absent || 0,
              itemStyle: { color: '#ED6766' }
            }
          ];
        }

        if (newChartData.length > 0) {
          console.log('📊 PresentChart: Updated chart data:', newChartData);
          setChartData(newChartData);
          setIsLive(true);
          setIsLoading(false); // Stop loading when real data is received
          
          // Update chart if it exists
          if (chartInstance.current) {
            chartInstance.current.setOption({
              series: [{
                data: newChartData
              }]
            });
          }
        } else {
          console.log('📊 PresentChart: No valid chart data found in received data');
        }
      } else {
        console.log('📊 PresentChart: Invalid data structure received:', data);
      }
    });

    socket.on('disconnect', () => {
      console.log('📊 PresentChart: Disconnected from server');
      setIsLive(false);
      // Don't set loading to false on disconnect, keep trying
    });

    socket.on('error', (error) => {
      console.error('📊 PresentChart: Socket error:', error);
    });

    // Listen for all Socket.IO events to debug
    socket.onAny((eventName, ...args) => {
      console.log(`🔍 PresentChart Socket.IO Event Received: ${eventName}`, args);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fallback timeout - if no data received within 5 seconds, stop loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && !chartData) {
        console.log('📊 PresentChart: Timeout - no data received, stopping loading');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, chartData]);

  useEffect(() => {
    if (chartRef.current) {
      // Initialize ECharts instance
      chartInstance.current = echarts.init(chartRef.current);
      
      // Only show data if we have real data, otherwise show empty
      const currentData = chartData || [];
      
      const option = {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)',
          backgroundColor: 'rgb(255, 255, 255)',
          borderColor: '#91cb74',
          borderWidth: 1,
          borderRadius: 4,
          textStyle: {
            color: 'rgb(102, 102, 102)',
            fontSize: 14,
            fontFamily: 'sans-serif'
          },
          padding: 10,
          boxShadow: 'rgba(0, 0, 0, 0.2) 1px 2px 10px',
          transitionDuration: 0.2,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)'
        },
        series: [{
          type: 'pie',
          radius: '50%',
          center: ['50%', '50%'],
          data: currentData,
          emphasis: {
            scale: true,
            scaleSize: 5,
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            show: true,
            position: 'outside',
            formatter: '{c} ({d}%)',
            fontSize: 9,
            fontWeight: 'bold',
            color: '#666',
            overflow: 'none',
            ellipsis: false
          },
          labelLine: {
            show: true,
            length: 15,
            length2: 10
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: function (idx) {
            return Math.random() * 200;
          }
        }]
      };

      chartInstance.current.setOption(option);

      // Handle window resize
      const handleResize = () => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartInstance.current) {
          chartInstance.current.dispose();
        }
      };
    }
  }, [chartData, isLoading]);

  return (
    <Zoom in timeout={600}>
      <Card sx={{
        height: '400px',
        borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.7)})`,
          borderRadius: '16px 16px 0 0'
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: -50,
          right: -50,
          width: 100,
          height: 100,
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          borderRadius: '50%',
          opacity: 0.3
        }
      }}>
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                  color: theme.palette.primary.main
                }}
              >
                <People sx={{ fontSize: 16 }} />
              </Box>
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                color: theme.palette.text.primary,
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${alpha(theme.palette.text.primary, 0.7)} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Present Status
              </Typography>
              {isLive && (
                <Chip 
                  label="LIVE" 
                  size="small" 
                  color="success" 
                  icon={<FlashOn />}
                  sx={{ 
                    fontSize: '0.7rem',
                    height: 20,
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.7 },
                      '100%': { opacity: 1 }
                    }
                  }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Refresh Data">
                <IconButton 
                  size="small" 
                  onClick={handleRefresh}
                  sx={{ 
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': { 
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      transform: 'scale(1.1)'
                    },
                    width: 28,
                    height: 28,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Refresh sx={{ 
                    fontSize: 14, 
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' }
                    }
                  }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Employee Management">
                <IconButton 
                  size="small"
                  sx={{ 
                    backgroundColor: alpha(theme.palette.info.main, 0.1), 
                    width: 28, 
                    height: 28,
                    '&:hover': { 
                      backgroundColor: alpha(theme.palette.info.main, 0.2),
                      transform: 'scale(1.1)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <People sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Report">
                <IconButton 
                  size="small"
                  sx={{ 
                    backgroundColor: alpha(theme.palette.success.main, 0.1), 
                    width: 28, 
                    height: 28,
                    '&:hover': { 
                      backgroundColor: alpha(theme.palette.success.main, 0.2),
                      transform: 'scale(1.1)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Download sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* ECharts Pie Chart */}
          <Box 
            ref={chartRef}
            sx={{ 
              height: 280, 
              width: '100%',
              position: 'relative',
              padding: '10px'
            }}
          />
          
          {/* Loading Overlay */}
          {isLoading && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(10px)',
              borderRadius: 2
            }}>
              <Box sx={{
                width: 40,
                height: 40,
                border: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                borderTop: `3px solid ${theme.palette.primary.main}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
              <Typography variant="body2" sx={{ 
                mt: 2, 
                color: theme.palette.text.secondary,
                fontWeight: 500
              }}>
                {isRefreshing ? 'Refreshing data...' : 'Loading latest data from ZKBio Time...'}
              </Typography>
            </Box>
          )}


        </CardContent>
      </Card>
    </Zoom>
  );
};

export default PresentChart;
