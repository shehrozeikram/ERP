import React, { useState, useEffect, useRef } from 'react';
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
  TrendingUp,
  Download,
  Business,
  FlashOn
} from '@mui/icons-material';
import * as echarts from 'echarts';
import { io } from 'socket.io-client';

const DepartmentChart = () => {
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
    { name: '1 General', attendance: 0, color: '#2ed573' },
    { name: '22 Commcraft', attendance: 0, color: '#2ed573' },
    { name: '46 Hamza Paper', attendance: 0, color: '#2ed573' },
    { name: '49 Recovery-Head', attendance: 0, color: '#2ed573' },
    { name: '50 CEO-Coordination', attendance: 0, color: '#2ed573' },
    { name: '58 Security', attendance: 0, color: '#2ed573' }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    
    // Add refresh animation to existing chart
    if (chartInstance.current && chartData) {
      chartInstance.current.setOption({
        series: [{
          animationDuration: 600,
          animationEasing: 'bounceOut',
          animationType: 'scale'
        }]
      }, true);
    }
    
    // Request fresh data from server
    if (socketRef.current) {
      socketRef.current.emit('requestDepartmentData');
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Initialize WebSocket connection for real-time department data
  useEffect(() => {
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://tovus.net' 
      : 'http://localhost:5001';
    
    const socket = io(baseURL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🏢 DepartmentChart: Connected to server');
    });

    socket.on('zkbioConnectionStatus', (status) => {
      console.log('🏢 DepartmentChart: ZKBio Time status:', status);
      if (!status.connected && isLoading) {
        console.log('🏢 DepartmentChart: ZKBio Time not connected, reducing loading time');
        // If ZKBio Time is not connected, reduce loading time
        setTimeout(() => {
          if (isLoading && !chartData) {
            setIsLoading(false);
          }
        }, 2000); // Only wait 2 seconds if ZKBio Time is not connected
      }
    });

    socket.on('liveDepartmentUpdate', (data) => {
      console.log('🏢 DepartmentChart: Received department data:', data);
      
      if (data.type === 'departmentAttendance' && data.data && data.data.series && data.data.series[0] && data.data.xAxis) {
        const seriesData = data.data.series[0].data;
        const xAxisData = data.data.xAxis.data;
        
        // Convert ZKBio Time data to ECharts format
        const newChartData = xAxisData.map((deptName, index) => {
          const attendance = parseFloat(seriesData[index]) || 0;
          let itemStyle = { color: '#90EE90' }; // Light green default like ZKBio Time
          
          // Keep the color coding for performance indication
          if (attendance < 80) {
            itemStyle.color = '#ff4757'; // Red for low attendance
          } else if (attendance < 90) {
            itemStyle.color = '#ffa502'; // Orange for medium attendance
          }
          
          return {
            name: deptName,
            value: attendance,
            itemStyle: itemStyle
          };
        });

        console.log('🏢 DepartmentChart: Updated chart data:', newChartData);
        setChartData(newChartData);
        setIsLive(true);
        setIsLoading(false); // Stop loading when real data is received
        
        // Update chart if it exists
        if (chartInstance.current) {
          chartInstance.current.setOption({
            series: [{
              data: newChartData,
              animationDuration: 800,
              animationEasing: 'elasticOut',
              animationType: 'scale'
            }]
          }, true); // true for lazy update to trigger animation
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('🏢 DepartmentChart: Disconnected from server');
      setIsLive(false);
      // Don't set loading to false on disconnect, keep trying
    });

    socket.on('error', (error) => {
      console.error('🏢 DepartmentChart: Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fallback timeout - if no data received within 5 seconds, stop loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && !chartData) {
        console.log('🏢 DepartmentChart: Timeout - no data received, stopping loading');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, chartData]);

  // Initialize ECharts
  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas',
        useDirtyRect: true,
        useCoarsePointer: true,
        pointerSize: 4
      });
      
      const currentData = chartData || [];
      
      const option = {
        backgroundColor: 'transparent',
        title: {
          text: 'Department Attendance Statistics',
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          },
          formatter: function(params) {
            const data = params[0];
            return `${data.name} : ${data.value}%`;
          },
          backgroundColor: 'rgb(255, 255, 255)',
          borderColor: 'rgb(145, 203, 116)',
          borderWidth: 1,
          borderRadius: 4,
          textStyle: {
            color: 'rgb(102, 102, 102)',
            fontSize: 14,
            fontFamily: 'sans-serif',
            lineHeight: 21
          },
          padding: 10,
          boxShadow: 'rgba(0, 0, 0, 0.2) 1px 2px 10px',
          transitionDuration: 0.2,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
          extraCssText: `
            white-space: nowrap;
            z-index: 9999999;
            transition: opacity 0.2s cubic-bezier(0.23, 1, 0.32, 1), 
                        visibility 0.2s cubic-bezier(0.23, 1, 0.32, 1), 
                        transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          `
        },
        grid: {
          left: '8%',
          right: '8%',
          bottom: '25%',
          top: '20%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: currentData.map(item => item.name),
          axisLabel: {
            rotate: -45,
            fontSize: 10,
            color: '#666',
            interval: 'auto', // Auto-hide labels to prevent overlap
            margin: 20,
            formatter: function(value) {
              if (value.length > 12) {
                return value.substring(0, 12) + '...';
              }
              return value;
            },
            hideOverlap: true // Hide overlapping labels
          },
          axisLine: {
            lineStyle: {
              color: '#ddd'
            }
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          },
          triggerEvent: true // Enable events for better interaction
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          axisLabel: {
            formatter: '{value}',
            fontSize: 11,
            color: '#666'
          },
          axisLine: {
            lineStyle: {
              color: '#ddd'
            }
          },
          splitLine: {
            lineStyle: {
              color: '#f0f0f0',
              type: 'solid'
            }
          }
        },
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: 0,
            start: 0,
            end: 20, // Show only first 20% initially (about 8-10 departments)
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: true
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            start: 0,
            end: 20, // Initial position shows first 20%
            height: 20,
            bottom: 10,
            handleStyle: {
              color: '#91cb74',
              borderColor: '#91cb74'
            },
            textStyle: {
              color: '#666'
            },
            borderColor: '#ddd',
            fillerColor: 'rgba(145, 203, 116, 0.2)',
            backgroundColor: '#f5f5f5',
            showDetail: true,
            showDataShadow: true
          }
        ],
        series: [{
          type: 'bar',
          data: currentData,
          barWidth: '50%',
          barMaxWidth: 30,
          itemStyle: {
            color: function(params) {
              return params.data.itemStyle ? params.data.itemStyle.color : '#90EE90';
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%', // Always show percentage initially
            fontSize: 9,
            color: '#333',
            fontWeight: 'normal',
            distance: 3,
            hideOverlap: true
          },
          animationDelay: function (idx) {
            return idx * 50;
          },
          animationDuration: 1000,
          animationEasing: 'cubic-bezier(0.23, 1, 0.32, 1)'
        }]
      };

      chartInstance.current.setOption(option);

      // Add zoom event listener to adjust label intervals dynamically
      chartInstance.current.on('dataZoom', function(params) {
        try {
          // Handle different parameter structures safely
          let zoomData;
          if (params.batch && params.batch[0]) {
            // Inside zoom or batch zoom
            zoomData = params.batch[0];
          } else if (params.start !== undefined && params.end !== undefined) {
            // Direct slider zoom
            zoomData = params;
          } else {
            console.warn('DepartmentChart: Unknown dataZoom parameter structure:', params);
            return;
          }

          const zoomEnd = zoomData.end;
          const zoomStart = zoomData.start;
          const visibleRange = zoomEnd - zoomStart;
          
          // Calculate how many departments are currently visible
          const visibleDepartments = Math.round((currentData.length * visibleRange) / 100);
          
          // Calculate appropriate label interval based on zoom level
          let labelInterval = 0;
          if (visibleRange < 30) {
            labelInterval = 0; // Show all labels when zoomed in
          } else if (visibleRange < 60) {
            labelInterval = 1; // Show every other label
          } else {
            labelInterval = Math.ceil(visibleRange / 20); // Show fewer labels when zoomed out
          }
          
          // Update chart with new label interval and bar label visibility
          chartInstance.current.setOption({
            xAxis: {
              axisLabel: {
                interval: labelInterval
              }
            },
            series: [{
              label: {
                formatter: function(params) {
                  // Only show percentage if 9 or fewer departments are visible
                  if (visibleDepartments <= 9) {
                    return params.value + '%';
                  }
                  return ''; // Hide percentage labels when more than 9 departments
                }
              }
            }]
          });
        } catch (error) {
          console.error('DepartmentChart: Error in dataZoom handler:', error);
        }
      });

      // Handle window resize
      const handleResize = () => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      };

      // Use ResizeObserver for better responsive behavior
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          if (chartInstance.current) {
            chartInstance.current.resize();
          }
        }
      });

      if (chartRef.current) {
        resizeObserver.observe(chartRef.current);
      }

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (chartInstance.current) {
          chartInstance.current.dispose();
        }
      };
    }
  }, [chartData, isLoading, theme]);

  return (
    <Zoom in timeout={800}>
      <Card sx={{
        height: '100%',
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
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                  color: theme.palette.secondary.main
                }}
              >
                <Business sx={{ fontSize: 16 }} />
              </Box>
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                color: theme.palette.text.primary,
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${alpha(theme.palette.text.primary, 0.7)} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Department Statistics
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
              <Tooltip title="Trending Analysis">
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
                  <TrendingUp sx={{ fontSize: 14 }} />
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

          {/* ECharts Bar Chart */}
          <Box sx={{ 
            height: { xs: 350, sm: 300, md: 280 }, 
            position: 'relative',
            width: '100%'
          }}>
            <Box 
              ref={chartRef}
              sx={{ 
                height: '260px',
                width: '100%',
                position: 'relative',
                backgroundColor: 'transparent',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
                minHeight: '260px'
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
                  border: `3px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                  borderTop: `3px solid ${theme.palette.secondary.main}`,
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
                  {isRefreshing ? 'Refreshing department data...' : 'Loading latest department data from ZKBio Time...'}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Zoom>
  );
};

export default DepartmentChart;
