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
  Devices,
  Download,
  FlashOn
} from '@mui/icons-material';
import * as echarts from 'echarts';
import { io } from 'socket.io-client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert
} from '@mui/material';
import TablePagination from '@mui/material/TablePagination';
import api from '../services/api';

const DeviceStatusChart = () => {
  const theme = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState('Online'); // Online | Offline
  const [devices, setDevices] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const socketRef = useRef(null);
  
  // Default fallback data (only used if no real data received)
  const defaultData = [
    { 
      name: 'Online', 
      value: 0, 
      itemStyle: { color: '#91CB74' }
    },
    { 
      name: 'Offline', 
      value: 0, 
      itemStyle: { color: '#ED6766' }
    },
    { 
      name: 'Unauthorized', 
      value: 0, 
      itemStyle: { color: '#ffa502' }
    }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    
    // Request fresh data from server
    if (socketRef.current) {
      socketRef.current.emit('requestDeviceData');
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Initialize WebSocket connection for real-time device data
  useEffect(() => {
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://tovus.net' 
      : 'http://localhost:5001';
    
    const socket = io(baseURL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Request initial device data
      socket.emit('requestDeviceData');
    });

    socket.on('zkbioConnectionStatus', (status) => {
      if (!status.connected && isLoading) {
        // If ZKBio Time is not connected, reduce loading time
        setTimeout(() => {
          if (isLoading && !chartData) {
            setIsLoading(false);
          }
        }, 2000); // Only wait 2 seconds if ZKBio Time is not connected
      }
    });

    socket.on('liveDeviceStatusUpdate', (data) => {
      if (data.type === 'deviceStatus' && data.data) {
        let newChartData = [];
        
        // Handle different possible data structures from ZKBio Time
        if (data.data.series && data.data.series[0] && data.data.series[0].data) {
          // Structure: { series: [{ data: [...] }] }
          const seriesData = data.data.series[0].data;
          newChartData = seriesData.map(item => ({
            name: item.name,
            value: item.value,
            itemStyle: { 
              color: item.name === 'Online' ? '#91CB74' : 
                     item.name === 'Offline' ? '#ED6766' : '#ffa502'
            }
          }));
        } else if (Array.isArray(data.data)) {
          // Structure: [{ name: 'Online', value: 10 }, { name: 'Offline', value: 5 }]
          newChartData = data.data.map(item => ({
            name: item.name,
            value: item.value,
            itemStyle: { 
              color: item.name === 'Online' ? '#91CB74' : 
                     item.name === 'Offline' ? '#ED6766' : '#ffa502'
            }
          }));
        } else if (data.data.online !== undefined || data.data.offline !== undefined || data.data.unauthorized !== undefined) {
          // Structure: { online: 10, offline: 5, unauthorized: 2 }
          newChartData = [
            {
              name: 'Online',
              value: data.data.online || 0,
              itemStyle: { color: '#91CB74' }
            },
            {
              name: 'Offline', 
              value: data.data.offline || 0,
              itemStyle: { color: '#ED6766' }
            },
            {
              name: 'Unauthorized', 
              value: data.data.unauthorized || 0,
              itemStyle: { color: '#ffa502' }
            }
          ];
        }

        if (newChartData.length > 0) {
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
        }
      }
    });

    socket.on('disconnect', () => {
      setIsLive(false);
      // Don't set loading to false on disconnect, keep trying
    });

    socket.on('error', (error) => {
      // Error handled silently to maintain clean user experience
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fallback timeout - if no data received within 5 seconds, stop loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && !chartData) {
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

      // Click handler to open modal for Online/Offline slices
      const handleChartClick = (params) => {
        if (params?.componentType === 'series' && params?.seriesType === 'pie') {
          if (params?.name === 'Online') {
            openModal('Online');
          } else if (params?.name === 'Offline') {
            openModal('Offline');
          }
        }
      };

      chartInstance.current.on('click', handleChartClick);

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
          chartInstance.current.off('click');
          chartInstance.current.dispose();
        }
      };
    }
  }, [chartData, isLoading]);

  const fetchDevices = async (statusOverride) => {
    setIsFetching(true);
    setFetchError('');
    try {
      const effective = statusOverride || modalStatus;
      const { data } = await api.get('/zkbio/zkbio/devices', {
        params: {
          status: effective === 'Offline' ? 'offline' : 'online',
          areas: '',
          page,
          page_size: rowsPerPage
        }
      });
      // eslint-disable-next-line no-console
      console.log(`[Devices ${effective}] page ${page}, size ${rowsPerPage}:`, { totalCount: data?.totalCount, count: data?.count, sample: (data?.data || [])[0] });
      const list = Array.isArray(data?.data) ? data.data : [];
      setTotalCount(Number(data?.totalCount || list.length || 0));
      const normalized = (list || []).map((row) => ({
        serial_number: row.sn || row.serial_number || '-',
        device_name: row.alias || '-',
        area: (typeof row.area_alias === 'object')
          ? (row.area_alias.area_name || row.area_alias.name || row.area_alias.title || '-')
          : (row.area_alias || '-'),
        device_ip: row.ip || '-',
        firmware: row.fw_version || '-',
        last_activity: row.last_activity || '-'
      }));
      setDevices(normalized);
    } catch (err) {
      setFetchError(err?.message || 'Failed to fetch device list');
    } finally {
      setIsFetching(false);
    }
  };

  const openModal = (status) => {
    setModalStatus(status);
    setIsModalOpen(true);
    setPage(1);
    setRowsPerPage(20);
    fetchDevices(status);
  };

  const handleChangePage = async (_e, newPage) => {
    const apiPage = newPage + 1;
    setPage(apiPage);
    await fetchDevices();
  };

  const handleChangeRowsPerPage = async (e) => {
    const newSize = parseInt(e.target.value, 10);
    setRowsPerPage(newSize);
    setPage(1);
    await fetchDevices();
  };
 
  return (
    <>
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
                border: `3px solid ${alpha(theme.palette.info.main, 0.3)}`,
                borderTop: `3px solid ${theme.palette.info.main}`,
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
                {isRefreshing ? 'Refreshing device data...' : 'Loading latest device data from ZKBio Time...'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Zoom>
    {/* Devices Modal */}
    <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{modalStatus === 'Offline' ? 'Offline' : 'Online'}</DialogTitle>
        <DialogContent dividers>
          {isFetching && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {!!fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}
          {!isFetching && !fetchError && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Serial Number</TableCell>
                  <TableCell>Device Name</TableCell>
                  <TableCell>Area</TableCell>
                  <TableCell>Device IP</TableCell>
                  <TableCell>Firmware Version</TableCell>
                  <TableCell>Last Activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices && devices.length > 0 ? (
                  devices.map((d, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{d.serial_number || '-'}</TableCell>
                      <TableCell>{d.device_name || '-'}</TableCell>
                      <TableCell>{d.area || '-'}</TableCell>
                      <TableCell>{d.device_ip || '-'}</TableCell>
                      <TableCell>{d.firmware || '-'}</TableCell>
                      <TableCell>{d.last_activity || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No records found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={{ alignItems: 'center' }}>
          <TablePagination
            component="div"
            count={totalCount}
            page={Math.max(0, page - 1)}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
          <Button onClick={() => setIsModalOpen(false)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DeviceStatusChart;
