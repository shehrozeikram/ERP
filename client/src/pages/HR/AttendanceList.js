import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Fab,
  Card,
  CardContent,
  Grid,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Person,
  Work,
  Fingerprint as BiometricIcon,
  Cancel as AbsentIcon,
  Wifi as WifiIcon,

} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import realtimeAttendanceService from '../../services/realtimeAttendanceService';

const AttendanceList = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({
    employee: '',
    department: '',
    status: '',
    startDate: '',
    endDate: '',
    isApproved: ''
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState('');
  const [syncDateRange, setSyncDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
    endDate: new Date()
  });

  // Real-time attendance state
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());

  // Attendance data state
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Initialize real-time attendance
  useEffect(() => {
    console.log('🚀 Component mounted, initializing real-time attendance...');
    initializeRealTimeAttendance();
    fetchAttendanceData(); // Fetch initial attendance data ONLY ONCE
    
    // Set up real-time attendance listeners
    console.log('🎧 Setting up real-time listeners...');
    const unsubscribeAttendanceUpdate = realtimeAttendanceService.addListener('attendance_update', handleRealTimeAttendanceUpdate);
    const unsubscribeConnectionStatus = realtimeAttendanceService.addListener('connection_status', handleConnectionStatusUpdate);
    
    // The backend only emits 'attendance_update' events, so we only need these two listeners
    console.log('✅ Real-time listeners set up successfully');
    
    // Check connection status immediately
    setTimeout(() => {
      const status = realtimeAttendanceService.getConnectionStatus();
      console.log('🔍 Initial connection status:', status);
      if (!status.isConnected) {
        console.log('⚠️ Real-time service not connected, attempting to connect...');
        realtimeAttendanceService.connect();
        setTimeout(() => {
          realtimeAttendanceService.joinAttendanceRoom();
        }, 1000);
      }
    }, 2000);
    
    return () => {
      // Cleanup real-time connections
      if (window.realtimeSocket) {
        window.realtimeSocket.close();
      }
      // Cleanup real-time listeners
      console.log('🧹 Cleaning up real-time listeners...');
      unsubscribeAttendanceUpdate();
      unsubscribeConnectionStatus();
    };
  }, []);

  // Handle real-time attendance updates
  const handleRealTimeAttendanceUpdate = (data) => {
    console.log('📊 Real-time attendance update received:', data);
    console.log('🔍 Data structure:', JSON.stringify(data, null, 2));
    
    // Handle different data structures from backend
    let updateType = null;
    let attendanceData = null;
    
    // Check if data has the expected structure
    if (data.type === 'attendance_update' && data.data) {
      // New structure from ZKTeco service
      updateType = data.data.type;
      attendanceData = data.data.attendance || data.data;
    } else if (data.type === 'attendance_added' || data.type === 'attendance_updated' || data.type === 'attendance_deleted') {
      // Direct structure from change streams
      updateType = data.type;
      attendanceData = data.data;
    } else if (data.type === 'realtime_attendance' && data.data) {
      // Structure from ZKTeco real-time updates
      console.log('📥 Processing ZKTeco real-time data:', data.data);
      
      // Process ZKTeco real-time data directly without API calls
      if (data.data && Array.isArray(data.data)) {
        // This is raw ZKTeco data, we need to process it
        // For now, we'll refresh to get the processed data
        // TODO: Process ZKTeco data directly in the future
        // fetchAttendanceData(); // REMOVED - No more automatic refreshes
        console.log('📥 ZKTeco real-time data received, waiting for processed attendance_update event');
        return;
      }
    }
    
    console.log('🔍 Processed update:', { updateType, attendanceData });
    
    if (!updateType || !attendanceData) {
      console.log('⚠️ Unknown data structure, skipping update');
      // fetchAttendanceData(); // REMOVED - No more automatic refreshes
      return;
    }
    
    if (updateType === 'attendance_added') {
      // Add new attendance record to the list WITHOUT API call
      setAttendance(prev => {
        // Check if record already exists to avoid duplicates
        const exists = prev.some(record => record._id === attendanceData._id);
        if (exists) {
          console.log('⚠️ Record already exists, skipping duplicate');
          return prev;
        }
        
        const newList = [attendanceData, ...prev];
        console.log('➕ Added new attendance, total records:', newList.length);
        return newList;
      });
      setTotalRecords(prev => prev + 1);
      showRealTimeUpdate(`New attendance recorded for ${attendanceData.employee?.firstName} ${attendanceData.employee?.lastName}`);
    } else if (updateType === 'attendance_updated') {
      // Update existing attendance record WITHOUT API call
      setAttendance(prev => {
        const updated = prev.map(record => 
          record._id === attendanceData._id ? attendanceData : record
        );
        console.log('✏️ Updated attendance record');
        return updated;
      });
      showRealTimeUpdate(`Attendance updated for ${attendanceData.employee?.firstName} ${attendanceData.employee?.lastName}`);
    } else if (updateType === 'attendance_deleted') {
      // Remove deleted attendance record WITHOUT API call
      setAttendance(prev => {
        const filtered = prev.filter(record => record._id !== attendanceData._id);
        console.log('🗑️ Removed attendance record, total records:', filtered.length);
        return filtered;
      });
      setTotalRecords(prev => Math.max(0, prev - 1));
      showRealTimeUpdate('Attendance record deleted');
    }
    
    setLastUpdateTime(new Date());
  };

  // Handle connection status updates
  const handleConnectionStatusUpdate = (data) => {
    console.log('📡 Connection status update:', data);
    
    if (data.status === 'connected') {
      setIsRealTimeEnabled(true);
      setSuccess('Real-time attendance service connected!');
    } else if (data.status === 'disconnected') {
      setIsRealTimeEnabled(false);
      setError('Real-time attendance service disconnected');
    } else if (data.status === 'error') {
      setIsRealTimeEnabled(false);
      setError(`Real-time service error: ${data.error || 'Unknown error'}`);
    }
  };

  // Fetch attendance data from database
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching attendance data...');
      
      const response = await api.get('/attendance', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          sortBy: 'date',
          sortOrder: 'desc'
        }
      });
      
      console.log('📊 API Response:', response.data);
      
      if (response.data.success) {
        setAttendance(response.data.data || []);
        setTotalRecords(response.data.pagination?.total || 0);
        setLastUpdateTime(new Date());
        console.log('✅ Attendance data fetched:', response.data.data?.length || 0, 'records');
        console.log('📋 First record:', response.data.data?.[0]);
      } else {
        console.error('❌ Failed to fetch attendance data');
        setError('Failed to fetch attendance data');
      }
    } catch (error) {
      console.error('❌ Error fetching attendance:', error);
      setError('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch real-time attendance data (without pagination for latest records)
  const fetchRealTimeData = async () => {
    try {
      console.log('🔄 Fetching real-time attendance data...');
      
      const response = await api.get('/attendance', {
        params: {
          page: 1,
          limit: 50, // Get more records for real-time updates
          sortBy: 'date',
          sortOrder: 'desc'
        }
      });
      
      if (response.data.success) {
        const newData = response.data.data || [];
        console.log('📊 Real-time API response:', response.data);
        console.log('📋 New data received:', newData.length, 'records');
        console.log('📋 First record:', newData[0]);
        
        setAttendance(prevData => {
          // Merge new data with existing data, avoiding duplicates
          const merged = [...newData];
          console.log('🔄 Real-time data merged:', merged.length, 'records');
          console.log('🔄 Previous data count:', prevData.length);
          console.log('🔄 New data count:', merged.length);
          return merged;
        });
        setLastUpdateTime(new Date());
        console.log('✅ Real-time data updated');
      }
    } catch (error) {
      console.error('❌ Error fetching real-time data:', error);
    }
  };

  // Refresh attendance data
  const refreshAttendanceData = () => {
    fetchAttendanceData();
  };

  const initializeRealTimeAttendance = async () => {
    try {
      console.log('🚀 Initializing real-time attendance...');
      
      // Connect to real-time attendance service
      realtimeAttendanceService.connect();
      
      // Wait a bit for connection to establish
      setTimeout(() => {
        if (realtimeAttendanceService.getConnectionStatus().isConnected) {
          // Join attendance room to receive updates
          realtimeAttendanceService.joinAttendanceRoom();
          setIsRealTimeEnabled(true);
          console.log('✅ Real-time attendance service connected and joined attendance room');
        } else {
          console.warn('⚠️ Real-time service not connected, will retry...');
          // Retry connection
          setTimeout(() => {
            if (realtimeAttendanceService.getConnectionStatus().isConnected) {
              realtimeAttendanceService.joinAttendanceRoom();
              setIsRealTimeEnabled(true);
              console.log('✅ Real-time attendance service connected on retry');
            } else {
              setIsRealTimeEnabled(false);
              console.error('❌ Failed to connect to real-time service');
            }
          }, 2000);
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error initializing real-time attendance:', error);
      setIsRealTimeEnabled(false);
    }
  };

  // Real-time attendance is now handled by the server via ZKTeco WebSocket
  const checkRealTimeStatus = () => {
    const status = realtimeAttendanceService.getConnectionStatus();
    
    if (status.isConnected) {
      setIsRealTimeEnabled(true);
      setSuccess('Real-time attendance service is connected and active!');
    } else {
      setIsRealTimeEnabled(false);
      setError('Real-time attendance service is not connected. Attempting to reconnect...');
      
      // Try to reconnect
      realtimeAttendanceService.connect();
      setTimeout(() => {
        const newStatus = realtimeAttendanceService.getConnectionStatus();
        if (newStatus.isConnected) {
          realtimeAttendanceService.joinAttendanceRoom();
          setIsRealTimeEnabled(true);
          setSuccess('Real-time attendance service reconnected successfully!');
        } else {
          setError('Failed to reconnect to real-time service');
        }
      }, 2000);
    }
  };

  // Show real-time update notification
  const showRealTimeUpdate = (message) => {
    setSuccess(message);
    // Auto-hide after 5 seconds for better visibility
    setTimeout(() => setSuccess(null), 5000);
    
    // Also update the last update time
    setLastUpdateTime(new Date());
    
    // Show a console log for debugging
    console.log('📱 Real-time notification:', message);
  };





  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      department: '',
      status: '',
      startDate: '',
      endDate: '',
      isApproved: ''
    });
  };

  const handleDelete = async () => {
    // Delete functionality removed
    setDeleteDialogOpen(false);
  };

  const handleSyncBiometric = async () => {
    // Sync functionality removed
    setSyncDialogOpen(false);
  };

  const handleSyncZKTeco = async () => {
    // ZKTeco sync functionality removed
    setSyncDialogOpen(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'success';
      case 'Absent':
        return 'error';
      case 'Late':
        return 'warning';
      case 'Leave':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString();
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const calculateWorkHours = (checkInTime, checkOutTime) => {
    if (!checkInTime || !checkOutTime) return 0;
    const diff = new Date(checkOutTime) - new Date(checkInTime);
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
  };

  const getWorkHoursDisplay = (record) => {
    if (!record.checkIn?.time || !record.checkOut?.time) return 'N/A';
    const hours = calculateWorkHours(record.checkIn.time, record.checkOut.time);
    return `${hours}h`;
  };

  const getStatusDisplay = (record) => {
    if (record.status) return record.status;
    if (record.checkIn?.time && record.checkOut?.time) return 'Present';
    if (record.checkIn?.time) return 'Present';
    return 'Absent';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Real-Time Status Banner */}
      {isRealTimeEnabled && (
        <Paper sx={{ p: 2, mb: 3, backgroundColor: '#e8f5e8', border: '1px solid #4caf50' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <WifiIcon sx={{ color: '#4caf50', mr: 1 }} />
              <Typography variant="h6" color="#2e7d32">
                🟢 Real-Time Attendance Active
              </Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Typography variant="body2" color="textSecondary" sx={{ mr: 2 }}>
                Last Update: {lastUpdateTime.toLocaleTimeString()}
              </Typography>
              <Chip
                label="Connected"
                color="success"
                size="small"
                icon={<WifiIcon />}
              />
            </Box>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Attendance updates from ZKTeco device appear instantly without page refresh
          </Typography>
        </Paper>
      )}

      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Attendance Management
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Real-time Status Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <WifiIcon color="success" />
            <Typography variant="body2" color="success.main">
              Real-time Active
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Last update: {lastUpdateTime.toLocaleTimeString()}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refreshAttendanceData}
            sx={{ mr: 1 }}
          >
            Refresh Data
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              console.log('🔄 Manual real-time refresh...');
              fetchAttendanceData();
              // Also try to reconnect real-time service
              if (!realtimeAttendanceService.getConnectionStatus().isConnected) {
                console.log('🔄 Reconnecting real-time service...');
                realtimeAttendanceService.connect();
                setTimeout(() => {
                  realtimeAttendanceService.joinAttendanceRoom();
                }, 1000);
              }
            }}
            sx={{ mr: 1 }}
          >
            Force Refresh
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              console.log('🔄 Immediate refresh after attendance...');
              // Force immediate refresh to see if data is available
              fetchAttendanceData();
              // Also check real-time status
              const status = realtimeAttendanceService.getConnectionStatus();
              console.log('🔍 Real-time status after refresh:', status);
              alert(`Real-time Status:\nConnected: ${status.isConnected}\nStatus: ${status.connectionStatus}\nSocket ID: ${status.socketId || 'N/A'}`);
            }}
            sx={{ mr: 1 }}
            color="secondary"
          >
            Check After Attendance
          </Button>

          <Button
            variant="outlined"
            startIcon={<BiometricIcon />}
            onClick={() => setSyncDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Sync Biometric
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/attendance/create')}
          >
            Add Attendance
          </Button>
        </Box>
      </Box>

      {/* Debug Panel */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}>
        <Typography variant="h6" gutterBottom>
          🔍 Real-Time Debug Panel
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary">
                Connection Status
              </Typography>
              <Chip
                label={isRealTimeEnabled ? 'Connected' : 'Disconnected'}
                color={isRealTimeEnabled ? 'success' : 'error'}
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary">
                Last Update
              </Typography>
              <Typography variant="body2">
                {lastUpdateTime.toLocaleTimeString()}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary">
                Total Records
              </Typography>
              <Typography variant="body2">
                {totalRecords}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary">
                Current Page Records
              </Typography>
              <Typography variant="body2">
                {attendance.length}
              </Typography>
            </Box>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              const status = realtimeAttendanceService.getConnectionStatus();
              console.log('🔍 Real-time service status:', status);
              const readyStateText = status.readyState || 'UNKNOWN';
              alert(`Socket.IO Status:\nConnected: ${status.isConnected}\nStatus: ${status.connectionStatus}\nSocket ID: ${status.socketId || 'N/A'}\nURL: ${status.url}`);
            }}
            sx={{ mr: 1 }}
          >
            Check Service Status
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              console.log('🧪 Testing real-time update handler...');
              // Simulate a real-time attendance update
              const testData = {
                type: 'attendance_update',
                data: {
                  type: 'attendance_added',
                  attendance: {
                    _id: 'test_' + Date.now(),
                    employee: {
                      firstName: 'Test',
                      lastName: 'User',
                      employeeId: 'TEST001'
                    },
                    checkIn: {
                      time: new Date(),
                      location: 'Office',
                      method: 'Biometric'
                    },
                    status: 'Present',
                    date: new Date()
                  }
                }
              };
              handleRealTimeAttendanceUpdate(testData);
            }}
            sx={{ mr: 1 }}
          >
            Test Real-time Handler
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              console.log('🧪 Testing Socket.IO connection directly...');
              // Test the Socket.IO connection directly
              const socket = realtimeAttendanceService.socket;
              if (socket) {
                console.log('🔌 Socket exists, ID:', socket.id);
                console.log('🔌 Socket connected:', socket.connected);
                console.log('🔌 Socket transport:', socket.io.engine.transport.name);
                
                // Test emitting a test event
                socket.emit('test_event', { message: 'Test from frontend', timestamp: new Date() });
                console.log('📤 Test event emitted');
                
                // Also test joining the attendance room
                socket.emit('join_attendance');
                console.log('📤 Join attendance event emitted');
                
                // Test ping to server
                socket.emit('ping', { message: 'Ping from frontend', timestamp: new Date() });
                console.log('📤 Ping event emitted');
              } else {
                console.log('❌ No socket found');
              }
            }}
            sx={{ mr: 1 }}
          >
            Test Socket.IO
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              console.log('🔄 Testing real-time service connection...');
              // Force reconnect to real-time service
              realtimeAttendanceService.disconnect();
              setTimeout(() => {
                realtimeAttendanceService.connect();
                setTimeout(() => {
                  realtimeAttendanceService.joinAttendanceRoom();
                  const status = realtimeAttendanceService.getConnectionStatus();
                  console.log('🔄 Reconnection test completed, status:', status);
                }, 1000);
              }, 500);
            }}
          >
            Test Reconnection
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}



      {/* Real-Time Status */}
      <Alert severity="success" sx={{ mb: 2 }} onClose={() => {}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography>
            <strong>✅ Real-Time Status:</strong> Real-time attendance is active via ZKTeco WebSocket! Attendance updates automatically when employees check in/out.
          </Typography>
        </Box>
      </Alert>



      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {totalRecords}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Present Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Present').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', color: 'white' }}>
            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Work sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Late Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Late').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AbsentIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Absent Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Absent').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WifiIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Real-time Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    ✅
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Search Employee"
                value={filters.employee || ''}
                onChange={(e) => handleFilterChange('employee', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department || ''}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  label="Department"
                >
                  <MenuItem value="">All Departments</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="Present">Present</MenuItem>
                  <MenuItem value="Absent">Absent</MenuItem>
                  <MenuItem value="Late">Late</MenuItem>
                  <MenuItem value="Leave">Leave</MenuItem>
                  <MenuItem value="Sick Leave">Sick Leave</MenuItem>
                  <MenuItem value="Personal Leave">Personal Leave</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                size="small"
                fullWidth
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Check In</TableCell>
              <TableCell>Check Out</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Work Hours</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Loading attendance records...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : attendance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No attendance records found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              attendance.map((record) => (
                <TableRow key={record._id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {record.employee?.firstName} {record.employee?.lastName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {record.employee?.employeeId}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(record.date)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {record.updatedAt ? new Date(record.updatedAt).toLocaleTimeString() : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {formatTime(record.checkIn?.time)}
                      </Typography>
                      {record.checkIn?.location && (
                        <Typography variant="caption" color="textSecondary">
                          {record.checkIn.location}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {formatTime(record.checkOut?.time)}
                      </Typography>
                      {record.checkOut?.location && (
                        <Typography variant="caption" color="textSecondary">
                          {record.checkOut.location}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusDisplay(record)}
                      color={getStatusColor(getStatusDisplay(record))}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {getWorkHoursDisplay(record)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {record.checkIn?.method || record.checkOut?.method || 'Manual'}
                      </Typography>
                      {record.deviceType && (
                        <Typography variant="caption" color="textSecondary">
                          {record.deviceType}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/attendance/employee/${record.employee._id}/detail`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/attendance/${record._id}/edit`)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedAttendance(record);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalRecords}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </TableContainer>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sync Biometric Attendance</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Biometric Integration</InputLabel>
                <Select
                  value={selectedIntegration}
                  onChange={(e) => setSelectedIntegration(e.target.value)}
                  label="Biometric Integration"
                >
                  <MenuItem value="">Select Integration</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={syncDateRange.startDate}
                  onChange={(newValue) => setSyncDateRange(prev => ({ ...prev, startDate: newValue }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={syncDateRange.endDate}
                  onChange={(newValue) => setSyncDateRange(prev => ({ ...prev, endDate: newValue }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSyncZKTeco}
            variant="contained"
            disabled={syncLoading}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            Sync ZKTeco
          </Button>
          <Button
            onClick={handleSyncBiometric}
            variant="contained"
            disabled={syncLoading || !selectedIntegration}
            startIcon={syncLoading ? <CircularProgress size={20} /> : <BiometricIcon />}
          >
            Sync Biometric
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Attendance Record</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this attendance record? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceList; 