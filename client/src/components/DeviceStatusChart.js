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
  Zoom
} from '@mui/material';
import {
  Refresh,
  Devices,
  Download
} from '@mui/icons-material';
import * as echarts from 'echarts';

const DeviceStatusChart = () => {
  const theme = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  const deviceData = [
    { 
      name: 'Online', 
      value: 17, 
      itemStyle: { color: '#2ed573' }
    },
    { 
      name: 'Offline', 
      value: 3, 
      itemStyle: { color: '#ff4757' }
    }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      // Refresh chart data if needed
      if (chartInstance.current) {
        chartInstance.current.setOption({
          series: [{
            data: deviceData
          }]
        });
      }
    }, 1000);
  };

  useEffect(() => {
    if (chartRef.current) {
      // Initialize ECharts instance
      chartInstance.current = echarts.init(chartRef.current);
      
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
          radius: '70%',
          center: ['50%', '50%'],
          data: deviceData,
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
            fontSize: 12,
            fontWeight: 'bold',
            color: '#666'
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
  }, []);

  return (
    <Zoom in timeout={700}>
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
                  background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.2)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                  color: theme.palette.info.main
                }}
              >
                <Devices sx={{ fontSize: 16 }} />
              </Box>
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                color: theme.palette.text.primary,
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${alpha(theme.palette.text.primary, 0.7)} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Device Status
              </Typography>
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
              <Tooltip title="Device Management">
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
                  <Devices sx={{ fontSize: 14 }} />
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
              height: 250, 
              width: '100%',
              position: 'relative'
            }}
          />
        </CardContent>
      </Card>
    </Zoom>
  );
};

export default DeviceStatusChart;
